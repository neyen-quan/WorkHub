const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createChannelClient,repositoryOf,validateFeed}=require('../electron/update-channel.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const feed=(url='https://github.com/example/WorkHub/releases/download/v0.1.37/patch.zip')=>({schema:1,product:'WorkHub',appId:'agency.neyen.workhub',version:'0.1.37',patches:[{from:'0.1.36',to:'0.1.37',url,size:10,sha256:'a'.repeat(64)}],full:{url:url.replace('patch.zip','full.zip'),size:100,sha256:'b'.repeat(64)}});
const channel='https://github.com/example/WorkHub/releases/latest/download/latest.json';
test('GitHub channel rejects credentials, other hosts and mixed-product or cross-repository assets',()=>{
 assert.equal(repositoryOf(channel).repository,'example/WorkHub');for(const u of ['http://github.com/example/WorkHub/latest.json','https://user:/example/WorkHub/releases/latest/download/latest.json','https://example.com/latest.json'])assert.throws(()=>repositoryOf(u));
 assert.throws(()=>validateFeed({...feed(),product:'Other'},'0.1.36',channel));assert.throws(()=>validateFeed(feed('https://github.com/other/repo/releases/download/v0.1.37/patch.zip'),'0.1.36',channel));assert.throws(()=>validateFeed({...feed(),patches:[{...feed().patches[0],size:undefined}]},'0.1.36',channel));
 assert.equal(validateFeed(feed(),'0.1.36',channel).patch.from,'0.1.36');assert.equal(validateFeed(feed(),'0.1.37',channel).upToDate,true);
});
async function server(t,fn){const s=http.createServer(fn);await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>s.close(r)));return 'http://127.0.0.1:'+s.address().port;}
test('download reports bytes, verifies size/hash, syncs a writable file, and leaves no partial file after a bad hash',async t=>{
 const bytes=Buffer.alloc(130000,'x'),url=await server(t,(q,r)=>{r.writeHead(200,{'content-length':bytes.length});r.write(bytes.subarray(0,60000));setTimeout(()=>r.end(bytes.subarray(60000)),50);});const folder=fs.mkdtempSync(path.join(os.tmpdir(),'workhub download '));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));const events=[],client=createChannelClient({allowLocal:true}),file=path.join(folder,'patch.zip');
 await client.request(url,{destination:file,expectedHash:sha(bytes),expectedSize:bytes.length,onProgress:p=>events.push(p)});assert.equal(fs.readFileSync(file).length,bytes.length);assert.ok(events.some(p=>p.stage==='download'&&p.received>0));assert.equal(events.at(-1).stage,'verification');
 const bad=path.join(folder,'bad.zip');await assert.rejects(()=>client.request(url,{destination:bad,expectedHash:'0'.repeat(64),expectedSize:bytes.length}),/SHA-256/);assert.equal(fs.existsSync(bad),false);
});
test('canceled and stalled downloads fail visibly and remove the partial ZIP',async t=>{
 const url=await server(t,(q,r)=>{r.writeHead(200);r.write('chunk');});const folder=fs.mkdtempSync(path.join(os.tmpdir(),'workhub cancel '));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));const client=createChannelClient({allowLocal:true,stallTimeout:100}),file=path.join(folder,'cancel.zip'),controller=new AbortController();setTimeout(()=>controller.abort(),40);
 await assert.rejects(()=>client.request(url,{destination:file,signal:controller.signal}));assert.equal(fs.existsSync(file),false);
 await assert.rejects(()=>client.request(url,{destination:path.join(folder,'stalled.zip')}));assert.equal(fs.existsSync(path.join(folder,'stalled.zip')),false);
});

