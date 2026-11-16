"""Build the offline Windows demo update using Python's standard library."""
from pathlib import Path
import hashlib
import json
import zipfile
ROOT=Path(__file__).resolve().parents[1]
FILES=['server/platform/app.js','server/platform/demo-catalog.js','server/platform/index.js','src/Platform.jsx','src/platform.css','scripts/demo-catalog.mjs','START-FLIXORA.cmd','ADD-DEMO.cmd','README.md','docs/DEMO_CATALOG.md','docs/PLATFORM_DELIVERY.md']
manifest={'version':1,'files':[]}
entries={}
for name in FILES:
    content=(ROOT/name).read_bytes()
    manifest['files'].append({'path':name,'sha256':hashlib.sha256(content).hexdigest()})
    entries['payload/'+name]=content
entries['demo-update-manifest.json']=json.dumps(manifest,indent=2).encode()
entries['APPLY-DEMO-UPDATE.cjs']=(ROOT/'scripts/apply-demo-update.cjs').read_bytes()
entries['APPLY-DEMO-UPDATE.cmd']=b'@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\nnode "%~dp0APPLY-DEMO-UPDATE.cjs"\r\nif errorlevel 1 (\r\n  pause\r\n  exit /b 1\r\n)\r\n'
entries['PEHLE-PARHEIN.txt']='''FLIXORA DEMO UPDATE - 240 TITLES + 540 SAMPLE EPISODES

1. Purani API aur Vite ki dono server windows X se band karein.
2. Is ZIP ko naye folder mein Extract All karein.
3. APPLY-DEMO-UPDATE.cmd par double-click karein.
4. Helper aapka pehle se installed Flixora folder dhoondega.
5. Sahi folder select karein agar ek se zyada copies milen.
6. Server windows band karne ke baad Enter dabayein.
7. Update, demo data aur browser launch automatic hain.

Aapka admin account, password, .env aur uploaded videos replace nahi honge.
Purane code ka backup .flixora/update-backups/ mein rahega.

Demo cards fictional metadata hain. In mein playable movies nahi hain.
Admin > Demo catalog se hide, show ya remove kar sakte hain.

Node.js 24+ aur pehle se installed project dependencies zaroori hain.
'''.encode()
out=ROOT/'downloads'/'Flixora-demo-update.zip';out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for name,content in sorted(entries.items()):
        info=zipfile.ZipInfo('Flixora-demo-update/'+name,date_time=(2026,1,1,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=0o100644 << 16
        archive.writestr(info,content)
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
print(f'{out.name}: {out.stat().st_size:,} bytes, {len(entries)} verified entries')
