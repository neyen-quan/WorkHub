"""Deterministic archives; deltas use published inventories, never rebuilt baselines."""
from pathlib import Path
import hashlib,json,zipfile,sys

def sha(data):return hashlib.sha256(data).hexdigest()
def write_zip(output,files):
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name,data in files:
            info=zipfile.ZipInfo(name,(2020,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            z.writestr(info,data)
def inventory(root,version,engine,native_fingerprint):
    files={}
    for file in sorted(Path(root).rglob('*')):
        if file.is_file():
            name=file.relative_to(root).as_posix()
            if name=='assets/workhub-installation.json':continue
            files[name]={'size':file.stat().st_size,'sha256':sha(file.read_bytes())}
    return {'product':'WorkHub','appId':'agency.neyen.workhub','version':version,'engineVersion':engine,'nativeFingerprint':native_fingerprint,'files':files}
def package(root,output,version,engine,fingerprint):
    data=inventory(root,version,engine,fingerprint)
    (Path(root)/'assets/workhub-installation.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    write_zip(output,[(p.relative_to(root).as_posix(),p.read_bytes())for p in sorted(Path(root).rglob('*'))if p.is_file()])
def patch(root,base_inventory,output,legacy=False):
    root=Path(root);base=json.loads(Path(base_inventory).read_text(encoding='utf-8'));target=json.loads((root/'assets/workhub-installation.json').read_text(encoding='utf-8'))
    changed=[]
    for name,record in target['files'].items():
        if base['files'].get(name)!=record:changed.append(name)
    changed.append('assets/workhub-installation.json')
    # Legacy recovery keeps its stable bootstrap; new launcher is installed last.
    if legacy:
        forbidden=[n for n in changed if n.startswith('runtime/') or n=='electron/desktop-bootstrap.cjs']
        if forbidden:raise RuntimeError('La transición requiere cambiar un motor o bootstrap incompatible: '+str(forbidden))
        changed=[n for n in changed if n!='WorkHub.exe']+(['WorkHub.exe'] if 'WorkHub.exe' in changed else [])
    entries=[(name,(root/name).read_bytes())for name in changed]
    manifest={'format':1 if legacy else 2,'appId':'agency.neyen.workhub','version':target['version'],'fromVersions':[base['version']],'files':[{'path':name,'size':len(data),'sha256':sha(data)}for name,data in entries]}
    if not legacy:
        manifest.update(base=base,target=target,remove=[n for n in base['files']if n not in target['files']])
        if any(n in ('electron/desktop-start.cjs','electron/desktop-bootstrap.cjs')for n in changed):raise RuntimeError('El bootstrap estable no puede cambiar mediante un parche común.')
    write_zip(output,[('workhub-patch.json',json.dumps(manifest,ensure_ascii=False,indent=2).encode()),*entries])
    print(f'{output}: {len(entries)} archivos, {Path(output).stat().st_size} bytes')
def repair(root,output,base_inventory):
    root=Path(root);target=json.loads((root/'assets/workhub-installation.json').read_text());base=json.loads(Path(base_inventory).read_text())
    omitted=[n for n in target['files'] if n.startswith('runtime/') or n=='WorkHub.exe']
    if any(target['files'][n]!=base['files'].get(n) for n in omitted):raise RuntimeError('Repair requires an unchanged runtime and launcher')
    names=[n for n in target['files'] if n not in omitted]+['assets/workhub-installation.json']
    write_zip(output,[(n,(root/n).read_bytes()) for n in names])
    print('Small repair archive: '+str(output))
if __name__=='__main__':
    if sys.argv[1]=='package':package(*sys.argv[2:])
    elif sys.argv[1]=='repair':repair(*sys.argv[2:])
    elif sys.argv[1]=='patch':patch(*sys.argv[2:5],legacy='--legacy' in sys.argv[5:])

