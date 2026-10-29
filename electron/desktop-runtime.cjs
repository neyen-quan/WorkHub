const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
function safeAsset(root, rawUrl) {
  const pathname = decodeURIComponent(new URL(rawUrl, 'http://127.0.0.1').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid asset');
  return target;
}
function serveDesktop(root) {
  const server = http.createServer(async (req,res) => {
    try {
      if (!['GET','HEAD'].includes(req.method) || req.headers.host !== '127.0.0.1:5173') {res.writeHead(403);res.end();return;}
      const file = safeAsset(root,req.url);
      const data = await fs.readFile(file);
      const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method === 'HEAD' ? undefined : data);
    } catch {res.writeHead(404);res.end();}
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5173,'127.0.0.1',()=>resolve(server));});
}
module.exports={serveDesktop,safeAsset};
