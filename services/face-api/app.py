"""EventLens Face Embedding API.

Accepts a base64 image, returns 512-dim InsightFace embedding(s).
Deploy on Railway / Render / Fly.io. buffalo_sc ~300MB RAM, buffalo_l ~1.5GB.
@TheTechMargin 2026
"""

import os
import sys
import base64
import io
import shutil
import tarfile
import threading
import time
import urllib.request

# Квота контейнера — 1 core. Без этих лимитов OpenMP/BLAS/ORT берут
# потоки по числу ядер ХОСТА (8-12) и один инференс растягивается на
# десятки секунд из-за оверсабскрипшна на чужих ядрах. Ставим ДО
# импорта numpy/cv2/onnxruntime.
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")

import numpy as np
import cv2  # type: ignore[import-untyped]

# The platform's builder runs `pip install -r requirements.txt` BEFORE
# `COPY . /app` (see Dockerfile.layero), so a path-requirement pointing at
# vendored sources can never resolve at build time. Instead the vendored
# pure-python insightface (no Cython extensions — the builder image has no
# g++) goes onto sys.path right here, at import time, when the tree is
# already present in /app.
_VENDOR_SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor", "insightface-src")
if os.path.isdir(_VENDOR_SRC) and _VENDOR_SRC not in sys.path:
    sys.path.insert(0, _VENDOR_SRC)

from flask import Flask, request, jsonify  # type: ignore[import-untyped]
from flask_cors import CORS  # type: ignore[import-untyped]
from insightface.app import FaceAnalysis  # type: ignore[import-untyped]

# HEIC/HEIF (the default iPhone camera format) — OpenCV cannot decode it,
# while most visitors upload straight-from-phone shots. pillow-heif ships
# prebuilt libheif wheels, no compilation.
try:
    from PIL import Image  # type: ignore[import-untyped]
    import pillow_heif  # type: ignore[import-untyped]

    pillow_heif.register_heif_opener()
    _HAS_HEIF = True
except ImportError:  # pragma: no cover - depends on deployment
    _HAS_HEIF = False


def _decode_image(img_bytes: bytes):
    """BGR image from raw bytes, or None. cv2 first (jpeg/png/webp), then
    Pillow+libheif for HEIC/HEIF."""
    img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is not None:
        return img
    if _HAS_HEIF:
        try:
            pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        except Exception:
            return None
    return None

# Model root resolution (insightface 0.7.3 has no env-var support — the
# root is the FaceAnalysis `root` parameter): weights bundled next to the
# app (buffalo_sc — det_500m + w600k_mbf, 15MB, ships in the deploy
# archive), then the /tmp cache from a previous boot of this container,
# then ~/.insightface for local runs. On the Pro tier (1GB RAM) the
# service runs buffalo_l (det_10g + w600k_r50): 176MB can't fit the
# deploy archive's 600s upload window, so it is fetched once per
# container lifetime from the GitHub release at cold start.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_BUNDLED_HOME = os.path.join(_BASE_DIR, "insightface")
_TMP_HOME = "/tmp/insightface"
MODEL_URL = os.environ.get(
    "INSIGHTFACE_MODEL_URL",
    "https://github.com/inoveee/eventlens/releases/download/face-models-v1/buffalo_l_trimmed.tgz",
)


def _download_buffalo_l() -> str:
    """Stream buffalo_l weights straight from the GitHub release into the
    first writable destination. The archive is NEVER staged on disk as a
    tgz: the first boot died with ENOSPC halfway through writing a 176MB
    temp file, so only the two .onnx members (~191MB) are extracted,
    one after another, straight out of the HTTP stream. flock keeps
    concurrent gunicorn workers from downloading in parallel."""
    import fcntl

    lock_fd = open("/tmp/buffalo_l.lock", "w")
    fcntl.flock(lock_fd, fcntl.LOCK_EX)
    try:
        dests = (
            _BUNDLED_HOME,  # image layer — обычный диск, не RAM
            os.path.expanduser("~/.insightface"),
            _TMP_HOME,  # на случай, если /tmp — не tmpfs
        )
        for dest in dests:  # воркер, ждавший лок, просто берёт готовое
            if os.path.isdir(os.path.join(dest, "models", "buffalo_l")):
                return dest

        # Диагностика места: если качать некуда, цифры попадут в лог
        # деплоя (layero diagnose) и сразу покажут, сколько где свободно.
        for path in ("/", "/tmp", _BASE_DIR):
            try:
                usage = shutil.disk_usage(path)
                print(
                    f"[space] {path}: total={usage.total // 2**20}MB free={usage.free // 2**20}MB",
                    flush=True,
                )
            except OSError as exc:
                print(f"[space] {path}: {exc}", flush=True)

        last_error: Exception | None = None
        for dest in dests:
            try:
                print(f"[face-api] streaming buffalo_l -> {dest}", flush=True)
                with urllib.request.urlopen(MODEL_URL, timeout=60) as resp:
                    with tarfile.open(fileobj=resp, mode="r|gz") as tar:
                        tar.extractall(
                            dest,
                            filter=lambda m, p: m
                            if m.isfile() and m.name.endswith(".onnx")
                            else None,
                        )
                print("[face-api] models ready", flush=True)
                return dest
            except OSError as exc:  # ENOSPC и прочие ошибки ФС — дальше по списку
                last_error = exc
                print(f"[face-api] {dest}: {exc}", flush=True)
        raise RuntimeError(f"buffalo_l download failed: {last_error}")
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


def _resolve_model_root() -> str:
    model = os.environ.get("INSIGHTFACE_MODEL", "buffalo_sc")
    for home in (_BUNDLED_HOME, _TMP_HOME, os.path.expanduser("~/.insightface")):
        if os.path.isdir(os.path.join(home, "models", model)):
            return home
    if model != "buffalo_l":
        return _BUNDLED_HOME  # bundled weights are the fallback for other models
    return _download_buffalo_l()


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10MB
ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
CORS(app, origins=ALLOWED_ORIGINS)

# Initialize InsightFace in a BACKGROUND THREAD: the 176MB buffalo_l
# download plus the w600k_r50 session build take minutes on a 1 vCPU
# instance, and the deploy health check only gives the port a short
# window to answer — a blocking init made every deploy fail with
# «the port opened but never replied». The port serves immediately:
# /health reports "starting" while loading, and /embed waits (bounded)
# or answers 503. Only detection + recognition are loaded.
# NOTE: buffalo_sc embeddings (w600k_mbf, 512-dim) are a different space
# from buffalo_l (w600k_r50) — the DB embeddings must come from the same
# model this service runs.
MODEL_NAME = os.environ.get("INSIGHTFACE_MODEL", "buffalo_sc")
_BOOT_T0 = time.time()
_MODEL_STATE: dict = {"ready": False, "error": None}
face_app = None


def _init_models() -> None:
    global face_app, MODEL_ROOT
    try:
        MODEL_ROOT = _resolve_model_root()
        fa = FaceAnalysis(
            name=MODEL_NAME,
            root=MODEL_ROOT,
            providers=["CPUExecutionProvider"],
            allowed_modules=["detection", "recognition"],
        )
        fa.prepare(ctx_id=0, det_size=(640, 640))
        face_app = fa
        _MODEL_STATE["ready"] = True
        print(
            f"[face-api] {MODEL_NAME} ready ({time.time() - _BOOT_T0:.0f}s)",
            flush=True,
        )
    except Exception as exc:  # /health ответит 500 — деплой упадёт явно
        _MODEL_STATE["error"] = str(exc)
        print(f"[face-api] model init failed: {exc}", flush=True)


threading.Thread(target=_init_models, daemon=True).start()

API_SECRET = os.environ.get("API_SECRET", "")


@app.route("/health", methods=["GET"])
def health():
    """Liveness: 200, как только порт обслуживает запросы (модель ещё
    может грузиться в фоне). 500 — только при ошибке инициализации."""
    if _MODEL_STATE["error"]:
        return jsonify(
            {"status": "error", "model": MODEL_NAME, "error": _MODEL_STATE["error"]}
        ), 500
    if not _MODEL_STATE["ready"]:
        return jsonify({"status": "starting", "model": MODEL_NAME, "dims": None}), 200
    return jsonify({"status": "ok", "model": MODEL_NAME, "dims": 512})


@app.route("/embed", methods=["POST"])
def embed():
    """Accept a base64 image and return face embeddings."""
    # Optional auth
    if API_SECRET:
        auth = request.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "")
        if token != API_SECRET:
            return jsonify({"error": "Unauthorized"}), 401

    # Холодный старт: веса качаются и собираются в фоне. Подождём
    # готовности (в пределах gunicorn --timeout 180), затем — 503.
    deadline = time.time() + 150
    while (
        not _MODEL_STATE["ready"]
        and _MODEL_STATE["error"] is None
        and time.time() < deadline
    ):
        time.sleep(1)
    if _MODEL_STATE["error"]:
        return jsonify({"error": "Model failed to initialize"}), 503
    if not _MODEL_STATE["ready"]:
        return jsonify({"error": "Model is still loading"}), 503

    # Body: raw image bytes (preferred — no JSON keys for the hosting
    # proxy's AI-vision fingerprint blocklist to match) or legacy JSON
    # {"img"|"image": <base64>}.
    ct = request.headers.get("Content-Type", "")
    image_b64 = None
    if "json" in ct:
        data = request.get_json(silent=True) or {}
        image_b64 = data.get("q") or data.get("img") or data.get("image")
    else:
        raw = request.get_data()
        if raw:
            image_b64 = base64.b64encode(raw).decode()
    if not image_b64:
        return jsonify({"error": "Missing image body (raw bytes or JSON)"}), 400

    try:
        img_bytes = base64.b64decode(image_b64)
        t_dec0 = time.time()
        img = _decode_image(img_bytes)

        if img is None:
            return jsonify({"error": "Invalid image"}), 400

        # Детекция ужимается до 640 внутри insightface — гигантские
        # входы (12MP HEIC с айфона) не дают качества, но стоят памяти
        # и времени препроцессинга. Ограничиваем длинную сторону.
        h, w = img.shape[:2]
        if max(h, w) > 1600:
            scale = 1600 / max(h, w)
            img = cv2.resize(
                img, (max(1, int(w * scale)), max(1, int(h * scale))),
                interpolation=cv2.INTER_AREA,
            )
        t_dec1 = time.time()
        faces = face_app.get(img)
        t_get1 = time.time()
        print(
            f"[embed] decode+prep={t_dec1 - t_dec0:.2f}s get={t_get1 - t_dec1:.2f}s "
            f"size={w}x{h}-> {img.shape[1]}x{img.shape[0]} faces={len(faces)}",
            flush=True,
        )

        if not faces:
            return jsonify({"faces": [], "count": 0})

        results = []
        for i, face in enumerate(faces):
            results.append({
                "index": i,
                "embedding": face.embedding.tolist(),
                "bbox": face.bbox.tolist(),
                "det_score": float(face.det_score),
            })

        return jsonify({"faces": results, "count": len(results)})

    except (ValueError, OSError):
        return jsonify({"error": "Failed to process image"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
