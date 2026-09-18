"""
NDI output via ctypes — no pip packages needed.
Requires only the NDI Runtime dylib (free download):
  https://ndi.video/tools/  →  "NDI Tools" for macOS
  installs to: /Library/NDI SDK for Apple/lib/macOS/libndi.dylib
"""
import ctypes
import ctypes.util
import json
import os
import sys

import pygame

# ── NDI constants ─────────────────────────────────────────────────────────────
_FOURCC_BGRA         = 0x41524742
_FRAME_FORMAT_PROG   = 1
_TIMECODE_SYNTHESIZE = 0x8000000000000000

# ── Canvas / output size ──────────────────────────────────────────────────────
_W,  _H  = 48,  24
_OW, _OH = 480, 240   # 10× scale, nearest-neighbour

# ── ctypes structs ────────────────────────────────────────────────────────────
class _SendCreate(ctypes.Structure):
    _fields_ = [
        ('p_ndi_name',  ctypes.c_char_p),
        ('p_groups',    ctypes.c_char_p),
        ('clock_video', ctypes.c_bool),
        ('clock_audio', ctypes.c_bool),
    ]

class _VideoFrame(ctypes.Structure):
    _fields_ = [
        ('xres',                 ctypes.c_int),
        ('yres',                 ctypes.c_int),
        ('FourCC',               ctypes.c_uint32),
        ('frame_rate_N',         ctypes.c_int),
        ('frame_rate_D',         ctypes.c_int),
        ('picture_aspect_ratio', ctypes.c_float),
        ('frame_format_type',    ctypes.c_int),
        ('timecode',             ctypes.c_int64),
        ('p_data',               ctypes.c_void_p),
        ('line_stride_in_bytes', ctypes.c_int),
        ('p_metadata',           ctypes.c_char_p),
        ('timestamp',            ctypes.c_int64),
    ]

# ── module state ──────────────────────────────────────────────────────────────
_lib         = None
_sender      = None
_enabled     = False
_scaled_surf = None
_data_buf    = None
_frame       = None

_SEARCH_PATHS = [
    '/Library/NDI SDK for Apple/lib/macOS/libndi.dylib',
    '/usr/local/lib/libndi.dylib',
    '/usr/lib/libndi.so.5',
    '/usr/lib/x86_64-linux-gnu/libndi.so.5',
]

_DEFAULTS = {
    'ndi_enabled':     True,
    'ndi_stream_name': 'Matrix Pong',
}


def load_config(path='config.json'):
    if not os.path.exists(path):
        with open(path, 'w') as f:
            json.dump(_DEFAULTS, f, indent=2)
        return dict(_DEFAULTS)
    with open(path) as f:
        data = json.load(f)
    for k, v in _DEFAULTS.items():
        data.setdefault(k, v)
    return data


def _load_lib():
    for path in _SEARCH_PATHS:
        if os.path.exists(path):
            try:
                return ctypes.CDLL(path)
            except OSError:
                continue
    found = ctypes.util.find_library('ndi')
    if found:
        try:
            return ctypes.CDLL(found)
        except OSError:
            pass
    return None


def _setup_signatures(lib):
    lib.NDIlib_initialize.restype  = ctypes.c_bool
    lib.NDIlib_initialize.argtypes = []
    lib.NDIlib_destroy.restype     = None
    lib.NDIlib_destroy.argtypes    = []
    lib.NDIlib_send_create.restype  = ctypes.c_void_p
    lib.NDIlib_send_create.argtypes = [ctypes.POINTER(_SendCreate)]
    lib.NDIlib_send_destroy.restype  = None
    lib.NDIlib_send_destroy.argtypes = [ctypes.c_void_p]
    lib.NDIlib_send_send_video_v2.restype  = None
    lib.NDIlib_send_send_video_v2.argtypes = [ctypes.c_void_p,
                                               ctypes.POINTER(_VideoFrame)]


def init(cfg=None):
    global _lib, _sender, _enabled, _scaled_surf, _data_buf, _frame
    cfg = cfg or {}

    _lib = _load_lib()
    if _lib is None:
        print('[ndi] libndi not found — NDI disabled.', file=sys.stderr)
        print('[ndi] Install NDI Tools: https://ndi.video/tools/', file=sys.stderr)
        return

    _setup_signatures(_lib)
    if not _lib.NDIlib_initialize():
        print('[ndi] NDIlib_initialize() failed', file=sys.stderr)
        return

    name   = cfg.get('ndi_stream_name', 'Matrix Pong').encode('utf-8')
    create = _SendCreate(p_ndi_name=name, p_groups=None,
                         clock_video=False, clock_audio=False)
    handle = _lib.NDIlib_send_create(ctypes.byref(create))
    if not handle:
        print('[ndi] NDIlib_send_create() failed', file=sys.stderr)
        _lib.NDIlib_destroy()
        return

    _scaled_surf = pygame.Surface((_OW, _OH))
    _data_buf    = ctypes.create_string_buffer(_OW * _OH * 4)
    _frame = _VideoFrame(
        xres                 = _OW,
        yres                 = _OH,
        FourCC               = _FOURCC_BGRA,
        frame_rate_N         = 60,
        frame_rate_D         = 1,
        picture_aspect_ratio = float(_OW) / float(_OH),
        frame_format_type    = _FRAME_FORMAT_PROG,
        timecode             = _TIMECODE_SYNTHESIZE,
        p_data               = ctypes.cast(_data_buf, ctypes.c_void_p),
        line_stride_in_bytes = _OW * 4,
        p_metadata           = None,
        timestamp            = _TIMECODE_SYNTHESIZE,
    )
    _sender  = handle
    _enabled = True
    print(f'[ndi] streaming "{cfg.get("ndi_stream_name","Matrix Pong")}"'
          f' at {_OW}×{_OH}px BGRA @ 60 fps', file=sys.stderr)


def shutdown():
    global _sender, _enabled
    _enabled = False
    if _lib and _sender:
        _lib.NDIlib_send_destroy(ctypes.c_void_p(_sender))
        _lib.NDIlib_destroy()
        _sender = None


def send_frame(canvas_surface, cfg=None):
    global _enabled
    if not _enabled:
        return
    try:
        pygame.transform.scale(canvas_surface, (_OW, _OH), _scaled_surf)
        raw = pygame.image.tostring(_scaled_surf, 'BGRA')
        ctypes.memmove(_data_buf, raw, _OW * _OH * 4)
        _lib.NDIlib_send_send_video_v2(ctypes.c_void_p(_sender),
                                       ctypes.byref(_frame))
    except Exception as e:
        print(f'[ndi] send error: {e} — NDI disabled', file=sys.stderr)
        _enabled = False
