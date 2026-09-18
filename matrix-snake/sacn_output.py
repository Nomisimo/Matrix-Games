import json
import os
import socket
import struct
import sys
import uuid

import pygame

_sock    = None
_cid     = None
_seq     = [0] * 8   # indices 0-3: Matrix1 universes, 4-7: Matrix2 universes
_enabled = False
_source  = b'MatrixSnake' + b'\x00' * 54   # 64 bytes null-padded source name

_DEFAULTS = {
    'output_mode':            'sacn',        # 'sacn' | 'ndi' | 'both'
    'sacn_enabled':           True,          # legacy fallback when output_mode absent
    'matrix1_universe_start': 1,
    'matrix2_universe_start': 5,
    'fixtures_per_universe':  170,
    'bind_ip':                '0.0.0.0',     # set to LAN interface IP if multicast goes wrong interface
    'ndi_stream_name':        'Matrix Snake',
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


def init(cfg=None):
    global _sock, _cid, _enabled
    try:
        _cid  = uuid.uuid4().bytes
        _sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        _sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 8)
        bind_ip = (cfg or {}).get('bind_ip', '0.0.0.0')
        if bind_ip and bind_ip != '0.0.0.0':
            _sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF,
                             socket.inet_aton(bind_ip))
            print(f'[sacn] multicast interface: {bind_ip}', file=sys.stderr)
        _enabled = True
    except OSError as e:
        print(f'[sacn] init error: {e} — sACN disabled', file=sys.stderr)


def shutdown():
    global _sock, _enabled
    _enabled = False
    if _sock:
        _sock.close()
        _sock = None


def send_frame(canvas_surface, cfg):
    if not _enabled or not cfg.get('sacn_enabled', True):
        return

    raw = pygame.image.tostring(canvas_surface, 'RGB')  # row-major, 48*24*3 bytes
    fpv = cfg.get('fixtures_per_universe', 170)

    _send_matrix(raw, x_offset=0,  universe_start=cfg.get('matrix1_universe_start', 1), seq_base=0, fpv=fpv)
    _send_matrix(raw, x_offset=24, universe_start=cfg.get('matrix2_universe_start', 5), seq_base=4, fpv=fpv)


def _send_matrix(raw, x_offset, universe_start, seq_base, fpv):
    # Build DMX buffer using tile-based column-major ordering.
    # Tiles: 6 columns × 6 rows of 4×4 px tiles, column-major (tile_idx = tile_col*6 + tile_row).
    # Within each tile: row-major (pix_idx = (my%4)*4 + (mx%4)).
    buf = bytearray(1728)
    for mx in range(24):
        canvas_x = x_offset + mx
        tile_col = mx // 4
        pix_col  = mx % 4
        for my in range(24):
            src      = (my * 48 + canvas_x) * 3
            tile_row = my // 4
            pix_row  = my % 4
            tile_idx = tile_col * 6 + tile_row
            fixture  = tile_idx * 16 + pix_row * 4 + pix_col
            dst      = fixture * 3
            buf[dst:dst + 3] = raw[src:src + 3]

    # Slice into per-universe chunks and send
    cpv = fpv * 3   # channels per universe
    u   = 0
    off = 0
    while off < len(buf):
        chunk    = bytes(buf[off:off + cpv])
        universe = universe_start + u
        seq_idx  = seq_base + u
        _seq[seq_idx] = (_seq[seq_idx] + 1) & 0xFF
        pkt = _build_packet(universe, chunk, _seq[seq_idx])
        _send_udp(pkt, universe)
        off += cpv
        u   += 1


def _build_packet(universe, channel_data, seq):
    N   = len(channel_data)
    pkt = bytearray(126 + N)

    # Preamble / postamble / ACN identifier (offsets 0-15)
    pkt[0:2]  = b'\x00\x10'
    pkt[2:4]  = b'\x00\x00'
    pkt[4:16] = b'ASC-E1.17\x00\x00\x00'

    # Root layer (offsets 16-37)
    struct.pack_into('>H', pkt, 16, 0x7000 | (110 + N))
    struct.pack_into('>I', pkt, 18, 0x00000004)
    pkt[22:38] = _cid

    # Framing layer (offsets 38-114)
    struct.pack_into('>H', pkt, 38, 0x7000 | (88 + N))
    struct.pack_into('>I', pkt, 40, 0x00000002)
    pkt[44:108] = _source
    pkt[108]    = 0x64          # priority 100
    pkt[109:111] = b'\x00\x00' # sync address
    pkt[111]    = seq
    pkt[112]    = 0x00          # options
    struct.pack_into('>H', pkt, 113, universe)

    # DMP layer (offsets 115-125)
    struct.pack_into('>H', pkt, 115, 0x7000 | (11 + N))
    pkt[117]    = 0x02          # DMP vector
    pkt[118]    = 0xa1          # address type & data type
    pkt[119:121] = b'\x00\x00' # first property address
    pkt[121:123] = b'\x00\x01' # address increment
    struct.pack_into('>H', pkt, 123, N + 1)  # property count (incl. start code)
    pkt[125]    = 0x00          # start code

    pkt[126:126 + N] = channel_data
    return bytes(pkt)


def _send_udp(pkt, universe):
    global _enabled
    addr = f'239.255.{(universe >> 8) & 0xFF}.{universe & 0xFF}'
    try:
        _sock.sendto(pkt, (addr, 5568))
    except OSError as e:
        print(f'[sacn] send error: {e} — sACN disabled', file=sys.stderr)
        _enabled = False
