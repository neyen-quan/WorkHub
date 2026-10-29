from pathlib import Path
import sys,json,hashlib
from importlib.machinery import SourceFileLoader
mod=SourceFileLoader('package_files',str(Path(__file__).with_name('package-files.py'))).load_module()
root,out,old,new=sys.argv[1:];root=Path(root)
files={}
for f in sorted(root.rglob('*')):
 if f.is_file() and not f.relative_to(root).as_posix().startswith('runtime/'):
  files['electron/transition/app/'+f.relative_to(root).as_posix()]=f.read_bytes()
for name in ['wizard.cjs','wizard-preload.cjs','wizard.html']:
 files['electron/transition/'+name]=(Path(__file__).parent/'transition'/name).read_bytes()
files['electron/main.cjs']=b"require('./transition/wizard.cjs');\n"
files['package.json']=json.dumps({'name':'workhub-desktop','version':new,'main':'electron/main.cjs'}).encode()
m={'app':'workhub-desktop','from':old,'to':new,'files':[{'path':n,'sha256':hashlib.sha256(b).hexdigest()} for n,b in files.items()]}
mod.write_zip(out,[('workhub-patch.json',json.dumps(m).encode()),*[('payload/'+n,b) for n,b in files.items()]])
