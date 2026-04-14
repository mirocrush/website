import subprocess, os, sys
from PIL import Image

exe_path = r'C:\Users\user\AppData\Local\Programs\Microsoft VS Code\Code.exe'
png_out   = 'icon_extracted.png'
ico_out   = 'icon.ico'

# Write a temp PowerShell script to avoid quoting issues
ps_script = 'extract_icon.ps1'
with open(ps_script, 'w') as f:
    f.write(f"""
Add-Type -AssemblyName System.Drawing
$ico = [System.Drawing.Icon]::ExtractAssociatedIcon("{exe_path}")
$bmp = $ico.ToBitmap()
$bmp.Save("{os.path.abspath(png_out)}")
Write-Host "Done"
""")

result = subprocess.run(
    ['powershell', '-ExecutionPolicy', 'Bypass', '-File', ps_script],
    capture_output=True, text=True
)
os.remove(ps_script)
print('PowerShell:', result.stdout.strip())
if result.stderr:
    print('ERR:', result.stderr.strip()[:300])

if os.path.exists(png_out):
    img   = Image.open(png_out).convert('RGBA')
    sizes = [256, 128, 64, 48, 32, 16]
    imgs  = [img.resize((s, s), Image.LANCZOS) for s in sizes]
    imgs[0].save(ico_out, format='ICO',
                 sizes=[(s, s) for s in sizes],
                 append_images=imgs[1:])
    os.remove(png_out)
    print(f'Saved icon.ico — {os.path.getsize(ico_out):,} bytes')
else:
    print('ERROR: PNG not created')
    sys.exit(1)
