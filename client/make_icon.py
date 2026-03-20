"""
Generate icon.ico for the Private Editor.
Priority:
  1. Extract directly from the locally installed VS Code (Code.exe)
  2. Download from GitHub (fallback)
  3. Generate a simple VS Code-like icon (last resort)
"""
import os, sys, subprocess
from PIL import Image

ICO_OUT  = 'icon.ico'
VSCODE   = r'C:\Users\user\AppData\Local\Programs\Microsoft VS Code\Code.exe'
VSCODE2  = r'C:\Program Files\Microsoft VS Code\Code.exe'


def _save_ico(img: Image.Image):
    sizes = [256, 128, 64, 48, 32, 16]
    imgs  = [img.resize((s, s), Image.LANCZOS) for s in sizes]
    imgs[0].save(ICO_OUT, format='ICO',
                 sizes=[(s, s) for s in sizes],
                 append_images=imgs[1:])
    print(f'Saved {ICO_OUT} — {os.path.getsize(ICO_OUT):,} bytes')


def try_extract_local():
    exe = VSCODE if os.path.exists(VSCODE) else (VSCODE2 if os.path.exists(VSCODE2) else None)
    if not exe:
        return False

    png = 'icon_extracted.png'
    ps  = 'extract_icon.ps1'
    with open(ps, 'w') as f:
        f.write(f'''
Add-Type -AssemblyName System.Drawing
$ico = [System.Drawing.Icon]::ExtractAssociatedIcon("{exe}")
$ico.ToBitmap().Save("{os.path.abspath(png)}")
''')
    subprocess.run(['powershell', '-ExecutionPolicy', 'Bypass', '-File', ps],
                   capture_output=True)
    os.remove(ps)

    if os.path.exists(png):
        img = Image.open(png).convert('RGBA')
        os.remove(png)
        _save_ico(img)
        print('Source: local VS Code installation')
        return True
    return False


def try_download():
    try:
        import urllib.request
        url = 'https://raw.githubusercontent.com/microsoft/vscode/main/resources/win32/code.ico'
        tmp = 'icon_dl.ico'
        urllib.request.urlretrieve(url, tmp)
        img = Image.open(tmp).convert('RGBA').resize((256, 256), Image.LANCZOS)
        os.remove(tmp)
        _save_ico(img)
        print('Source: downloaded from GitHub')
        return True
    except Exception as e:
        print(f'Download failed: {e}')
        return False


def generate_fallback():
    from PIL import ImageDraw
    size = 256
    img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d    = ImageDraw.Draw(img)
    pad  = size * 0.06
    d.rounded_rectangle([pad, pad, size - pad, size - pad],
                         radius=size * 0.18, fill='#007acc')
    cx, cy = size / 2, size / 2
    s = size * 0.62
    lx = cx - s * 0.28
    d.polygon([
        (lx - s * 0.22, cy), (lx, cy - s * 0.36),
        (lx + s * 0.14, cy - s * 0.20), (lx - s * 0.04, cy),
        (lx + s * 0.14, cy + s * 0.20), (lx, cy + s * 0.36),
    ], fill='white')
    rx = cx + s * 0.10
    d.polygon([
        (rx + s * 0.22, cy - s * 0.36), (rx - s * 0.06, cy - s * 0.36),
        (rx + s * 0.08, cy), (rx - s * 0.06, cy + s * 0.36),
        (rx + s * 0.22, cy + s * 0.36), (rx + s * 0.38, cy),
    ], fill='white')
    bh = size * 0.09
    d.rectangle([lx + s * 0.02, cy - bh / 2, rx + s * 0.22, cy + bh / 2], fill='white')
    _save_ico(img)
    print('Source: generated fallback icon')


if __name__ == '__main__':
    if try_extract_local():
        sys.exit(0)
    if try_download():
        sys.exit(0)
    generate_fallback()
