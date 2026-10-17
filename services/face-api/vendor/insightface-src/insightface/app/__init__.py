from .face_analysis import *
# mask_renderer (and its thirdparty.face3d Cython chain) is intentionally
# not imported: it needs the compiled mesh_core_cython extension, while the
# vendored pure-python build strips it. FaceAnalysis — detection and
# recognition — never touches masks.
