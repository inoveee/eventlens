"""EventLens Face Embedding API.

Accepts a base64 image, returns 512-dim InsightFace embedding(s).
Deploy on Railway / Render / Fly.io. buffalo_sc ~300MB RAM, buffalo_l ~1.5GB.
@TheTechMargin 2026
"""

import os
import tarfile
import urllib.request
import base64
import numpy as np
import cv2  # type: ignore[import-untyped]
from flask import Flask, request, jsonify  # type: ignore[import-untyped]
from flask_cors import CORS  # type: ignore[import-untyped]
from insightface.app import FaceAnalysis  # type: ignore[import-untyped]

# Model root resolution (insightface 0.7.3 has no env-var support — the
# root is the FaceAnalysis `root` parameter):
#   1. weights bundled next to the app (local dev, offline);
#   2. /tmp cache from a previous boot of this container;
#   3. ~/.insightface (local dev fallback);
#   4. download the trimmed buffalo_l (det_10g + w600k_r50 — the only two
#      modules this service loads) from the GitHub release at cold start.
#      Platform filesystems are ephemeral, and the 176MB deploy archive is
#      both too big to upload from a slow link and gone after redeploy, so
#      fetching at boot is the reliable path.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_BUNDLED_HOME = os.path.join(_BASE_DIR, "insightface")
_TMP_HOME = "/tmp/insightface"
MODEL_URL = os.environ.get(
    "INSIGHTFACE_MODEL_URL",
    "https://github.com/inoveee/eventlens/releases/download/face-models-v1/buffalo_l_trimmed.tgz",
)


def _resolve_model_root() -> str:
    for home in (_BUNDLED_HOME, _TMP_HOME, os.path.expanduser("~/.insightface")):
        if os.path.isdir(os.path.join(home, "models", "buffalo_l")):
            return home
    os.makedirs(_TMP_HOME, exist_ok=True)
    tgz_path = "/tmp/buffalo_l.tgz"
    print(f"[face-api] model weights missing — downloading from {MODEL_URL}", flush=True)
    urllib.request.urlretrieve(MODEL_URL, tgz_path)
    with tarfile.open(tgz_path) as tar:
        try:
            tar.extractall(_TMP_HOME, filter="data")
        except TypeError:  # Python < 3.11.4 has no filter kwarg
            tar.extractall(_TMP_HOME)
    os.remove(tgz_path)
    print("[face-api] models ready", flush=True)
    return _TMP_HOME


MODEL_ROOT = _resolve_model_root()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10MB
ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
CORS(app, origins=ALLOWED_ORIGINS)

# Initialize InsightFace (same model as Colab notebook).
# Only detection + recognition are used — skip gender/age/landmark modules
# to cut cold start and RAM roughly in half.
MODEL_NAME = os.environ.get("INSIGHTFACE_MODEL", "buffalo_l")
face_app = FaceAnalysis(
    name=MODEL_NAME,
    root=MODEL_ROOT,
    providers=["CPUExecutionProvider"],
    allowed_modules=["detection", "recognition"],
)
face_app.prepare(ctx_id=0, det_size=(640, 640))

API_SECRET = os.environ.get("API_SECRET", "")


@app.route("/health", methods=["GET"])
def health():
    """Return service health status and model info."""
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
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"error": "Invalid image"}), 400

        faces = face_app.get(img)

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
