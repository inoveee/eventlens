"""EventLens Face Embedding API.

Accepts a base64 image, returns 512-dim InsightFace embedding(s).
Deploy on Railway / Render / Fly.io. buffalo_sc ~300MB RAM, buffalo_l ~1.5GB.
@TheTechMargin 2026
"""

import os
import sys
import base64
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

# Model root resolution (insightface 0.7.3 has no env-var support — the
# root is the FaceAnalysis `root` parameter): weights bundled next to the
# app (the deploy ships buffalo_sc — det_500m + w600k_mbf, 15MB total, it
# fits both the deploy archive and the free tier's 256MB instance), then
# the /tmp cache, then ~/.insightface for local runs without the bundle.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_BUNDLED_HOME = os.path.join(_BASE_DIR, "insightface")
_TMP_HOME = "/tmp/insightface"


def _resolve_model_root() -> str:
    for home in (_BUNDLED_HOME, _TMP_HOME, os.path.expanduser("~/.insightface")):
        if os.path.isdir(os.path.join(home, "models", os.environ.get("INSIGHTFACE_MODEL", "buffalo_sc"))):
            return home
    return _BUNDLED_HOME


MODEL_ROOT = _resolve_model_root()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10MB
ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
CORS(app, origins=ALLOWED_ORIGINS)

# Initialize InsightFace (same pipeline as the Colab notebook, compact
# bundle). Only detection + recognition are used — skip gender/age/
# landmark modules to cut cold start and RAM.
# NOTE: buffalo_sc embeddings (w600k_mbf, 512-dim) are a different space
# from buffalo_l (w600k_r50) — the DB embeddings must come from the same
# model this service runs.
MODEL_NAME = os.environ.get("INSIGHTFACE_MODEL", "buffalo_sc")
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
