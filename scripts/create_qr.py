"""Create a QR for the final portal URL. pip install 'qrcode[pil]'"""
import sys
from urllib.parse import urlparse
import qrcode
if len(sys.argv) != 3 or urlparse(sys.argv[1]).scheme != 'https':
    raise SystemExit('Usage: python scripts/create_qr.py https://YOUR_HOST output.png')
qrcode.make(sys.argv[1]).save(sys.argv[2])
print('QR image saved.')
