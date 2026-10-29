const api=window.workHubUpdater,$=id=>document.getElementById(id);
const stages={idle:'Listo',connection:'Conexión',download:'Descarga',verification:'Verificación',confirmation:'Confirmación',preparation:'Preparación',backup:'Respaldo',handoff:'Iniciando instalador',installation:'Instalación','startup-check':'Comprobación del arranque',recovery:'Recuperación',restart:'Reinicio',complete:'Actualización completada',canceled:'Cancelado',error:'Error'};
let state={},clock;
function size(n){if(!Number.isFinite(n))return '';return n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB';}
function render(next){
 state=next;document.body.classList.toggle('error',next.stage==='error');
 $('stage').textContent=stages[next.stage]||next.stage||'Listo';$('message').textContent=next.message||'';$('detail').textContent=next.error||next.detail||'';
 const percent=next.total?Math.min(100,next.received/next.total*100):next.totalItems?Math.min(100,next.completed/next.totalItems*100):null;
 if(percent!==null){$('progress').value=percent;$('percent').textContent=Math.floor(percent)+'%';}else if(next.busy){$('progress').removeAttribute('value');$('percent').textContent='';}else{$('progress').value=next.stage==='complete'?100:0;$('percent').textContent='';}
 $('bytes').textContent=next.total?size(next.received||0)+' / '+size(next.total):next.received?size(next.received):next.totalItems?`${next.completed||0} / ${next.totalItems} archivos`:'';
 $('installed').textContent=next.installed||'—';$('available').textContent=next.available||'—';
 for(const id of ['check','save-channel','local'])$(id).disabled=!!next.busy;
 $('download').disabled=!!next.busy||!next.canInstall;$('full').disabled=!!next.busy||!next.hasFull;$('cancel').disabled=!next.canCancel;
 if(document.activeElement!==$('channel'))$('channel').value=next.channel||'';
}
async function command(name,arg){try{const result=await api.command(name,arg);if(result?.error)render({...state,busy:false,stage:'error',message:'No se completó la operación.',error:result.error});}catch(e){render({...state,busy:false,stage:'error',message:'No se pudo comunicar con el actualizador.',error:e.message});}}
if(api.mode==='installer'){document.body.classList.add('installer');$('logo').src='workhub.png';$('heading').textContent='Instalando actualización';$('footer').textContent='Mantené esta ventana abierta. Si la nueva versión no arranca, se recuperará la anterior.';}
else{
 $('check').onclick=()=>command('check');$('save-channel').onclick=()=>command('channel',$('channel').value.trim());$('download').onclick=()=>command('install');$('local').onclick=()=>command('local');$('full').onclick=()=>command('full');
}
$('cancel').onclick=()=>command('cancel');api.onState(render);api.ready().then(render).catch(e=>render({stage:'error',error:e.message}));
clock=setInterval(()=>{const seconds=state.startedAt?Math.max(0,Math.floor(((state.finishedAt||Date.now())-state.startedAt)/1000)):0;$('elapsed').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');if(state.waiting)$('detail').textContent='La conexión sigue abierta, esperando datos. Podés cancelar e intentar de nuevo.';},250);

