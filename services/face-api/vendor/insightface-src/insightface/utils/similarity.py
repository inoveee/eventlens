"""Minimal stand-in for skimage.transform.SimilarityTransform.

The deploy omits scikit-image (it would pull scipy — ~100MB RSS that the
free tier's 256MB instance cannot spare). Only the interface insightface
uses is implemented: construction from scale/rotation/translation, params
composition via `+`, and Umeyama least-squares `estimate`. Matrices are
verified numerically against scikit-image's implementation locally.
"""
import numpy as np


class SimilarityTransform:
    def __init__(self, scale=1.0, rotation=0.0, translation=(0, 0), params=None):
        if params is not None:
            self.params = np.asarray(params, dtype=np.float64)
            return
        sx = sy = float(scale)
        theta = float(rotation)
        tx, ty = float(translation[0]), float(translation[1])
        cos, sin = np.cos(theta), np.sin(theta)
        self.params = np.array([
            [sx * cos, -sx * sin, tx],
            [sy * sin,  sy * cos, ty],
            [0.0,        0.0,      1.0],
        ], dtype=np.float64)

    def estimate(self, src, dst):
        src = np.asarray(src, dtype=np.float64)
        dst = np.asarray(dst, dtype=np.float64)
        num = src.shape[0]
        src_mean = src.mean(axis=0)
        dst_mean = dst.mean(axis=0)
        src_demean = src - src_mean
        dst_demean = dst - dst_mean
        A = dst_demean.T @ src_demean / num
        d = np.ones(A.shape[0])
        if np.linalg.det(A) < 0:
            d[A.shape[0] - 1] = -1
        U, S, Vt = np.linalg.svd(A)
        R = U @ np.diag(d) @ Vt
        variance = (src_demean ** 2).sum() / src_demean.shape[0]
        scale = np.sum(S * d) / variance
        T = np.eye(A.shape[0] + 1)
        T[:2, :2] = scale * R
        T[:2, 2] = dst_mean - scale * R @ src_mean
        self.params = T
        return self

    def __add__(self, other):
        # Same semantics as skimage: apply self first, then other.
        return SimilarityTransform(params=other.params @ self.params)
