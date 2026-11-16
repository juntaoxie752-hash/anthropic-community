const $=id=>document.getElementById(id),button=$('make-slop');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let socket,ready=false,total=0n,pending=0,batch=null,sending=false,retryTimer,reconnectTimer,comboTimer,holdTimer,repeatTimer,held=false,closed=false;
const batchKey='anthropic-clicker-batch',pendingKey='anthropic-clicker-pending';
try{pending=Math.max(0,Math.min(100000,Number(localStorage.getItem(pendingKey))||0));}catch{}
try{const saved=JSON.parse(localStorage.getItem(batchKey));if(saved&&/^[a-f0-9-]{36}$/.test(saved.requestId)&&Number.isInteger(saved.clicks)&&saved.clicks>0&&saved.clicks<=40)batch=saved;}catch{}
function persist(){try{localStorage.setItem(pendingKey,String(pending));if(batch)localStorage.setItem(batchKey,JSON.stringify(batch));else localStorage.removeItem(batchKey);}catch{}}
function count(){const value=(total+BigInt(pending+(batch?.clicks||0))).toLocaleString('en-US');$('counter').setAttribute('aria-label',`${value} total clicks`);$('counter').replaceChildren(...[...value].map(char=>{const el=document.createElement('span');el.className=char===','?'comma':'digit';el.textContent=char;el.setAttribute('aria-hidden','true');return el;}));}
function presence(data){if(typeof data.online!=='number')return;
 const countries=data.countries||[],known=countries.filter(c=>c.country!=='XX').length;
 $('countries').replaceChildren(...countries.map(({country,count})=>{const flag=document.createElement('span');flag.className='flag';flag.title=`${country}: ${count} online`;flag.textContent=/^[A-Z]{2}$/.test(country)&&country!=='XX'?[...country].map(c=>String.fromCodePoint(c.charCodeAt(0)+127397)).join(''):'🌐';const n=document.createElement('small');n.textContent=count;flag.append(n);return flag;}));
 $('presence-text').textContent=data.online<=1?'Only you are fucking Anthropic right now.':`${data.online} people${known?` from ${known} ${known===1?'country':'countries'}`:''} are fucking Anthropic right now.`;
}
function state(data){
 if(data.count!==undefined){const next=BigInt(data.count);if(next<total)return;total=next;count();}
 presence(data);
 if(typeof data.combo==='number'){
  clearTimeout(comboTimer);const age=data.lastClick?Date.parse(data.serverTime)-Date.parse(data.lastClick):4500;
  $('combo').hidden=data.combo<2||age>=4500;
  $('combo-count').textContent=`×${data.combo.toLocaleString()}`;
  $('combo-best').textContent=`${data.combo>=data.best?'🏆 NEW HIGH SCORE':'HIGH SCORE'} ${data.best.toLocaleString()}`;
  $('combo').dataset.tier=data.combo>=1000?'overdrive':data.combo>=500?'nuclear':data.combo>=100?'blazing':data.combo>=25?'hot':'warm';
  comboTimer=setTimeout(()=>$('combo').hidden=true,Math.max(0,4500-age));
 }
}
async function api(action,payload){const res=await fetch(`/api/${action}`,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(12000)});const data=await res.json();if(!res.ok)throw Error(data.error||'Connection interrupted');return data;}
function error(message){$('connection-error').textContent=message;$('connection-error').hidden=false;}
function acknowledged(id){if(batch?.requestId!==id)return;batch=null;persist();sending=false;clearTimeout(retryTimer);count();$('connection-error').hidden=true;setTimeout(flush,0);}
async function flush(){
 if(!ready||sending||closed)return;
 if(!batch){if(!pending)return;batch={clicks:Math.min(40,pending),requestId:crypto.randomUUID()};pending-=batch.clicks;persist();}
 sending=true;const current=batch;
 if(socket?.readyState===WebSocket.OPEN){
  socket.send(JSON.stringify({type:'click',...current}));
  retryTimer=setTimeout(()=>{sending=false;socket?.close();void flush();},6000);return;
 }
 try{const data=await api('clicker_click',current);batch=null;persist();sending=false;state(data);$('connection-error').hidden=true;setTimeout(flush,0);}
 catch{sending=false;error('Reconnecting… Your clicks are queued.');retryTimer=setTimeout(flush,3000);}
}
function connect(){
 if(closed||document.hidden||socket?.readyState===WebSocket.OPEN||socket?.readyState===WebSocket.CONNECTING)return;
 socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/clicker_ws`);
 socket.onmessage=event=>{try{const data=JSON.parse(event.data);if(data.type==='ack')acknowledged(data.requestId);else if(data.type==='state'){if(data.requestId)acknowledged(data.requestId);state(data);}else if(data.type==='presence')presence(data);else if(data.type==='error'){error(data.message);socket.close();}}catch{}};
 socket.onopen=()=>{$('connection-error').hidden=true;void flush();};
 socket.onclose=()=>{sending=false;clearTimeout(retryTimer);if(!closed){reconnectTimer=setTimeout(connect,4000);retryTimer=setTimeout(flush,500);}};
 socket.onerror=()=>{};
}
function animate(){
 if(reduced.matches)return;
 const hand=$('gesture'),logo=document.querySelector('.hero-logo');
 for(const el of [hand,logo])el.getAnimations().forEach(a=>a.cancel());
 hand.animate([{transform:'translateY(0) rotate(-6deg)'},{transform:'translateY(18px) rotate(-15deg)',offset:.18},{transform:'translateY(-64px) rotate(5deg) scale(1.12)',offset:.32},{transform:'translateY(-55px) rotate(-3deg)',offset:.46},{transform:'translateY(9px) rotate(-8deg)',offset:.72},{transform:'translateY(0) rotate(-6deg)'}],{duration:520,easing:'cubic-bezier(.2,.8,.3,1)'});
 logo.animate([{transform:'scale(1)'},{transform:'scale(.65,1.12) rotate(-18deg)',offset:.2},{transform:'scale(1.23,.82) rotate(14deg)',offset:.46},{transform:'scale(.94,1.06) rotate(-5deg)',offset:.72},{transform:'scale(1)'}],{delay:150,duration:450,easing:'ease-out'});
}
function poke(fromHold=false){if(!ready||closed)return;pending++;persist();count();animate();if(fromHold)document.dispatchEvent(new CustomEvent('game-sound',{detail:'generate'}));if(!sending)setTimeout(flush,180);}
button.addEventListener('click',event=>{if(event.detail===0||!held)poke();});
function stop(){clearTimeout(holdTimer);clearInterval(repeatTimer);setTimeout(()=>held=false,0);}
button.addEventListener('pointerdown',event=>{if(event.button!==0)return;held=false;button.setPointerCapture(event.pointerId);holdTimer=setTimeout(()=>{held=true;poke(true);repeatTimer=setInterval(()=>poke(true),100);},280);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,stop);
button.addEventListener('contextmenu',e=>e.preventDefault());button.addEventListener('dblclick',e=>e.preventDefault());
async function initialize(){try{state(await api('clicker_state'));ready=true;button.disabled=false;connect();void flush();}catch{error('Could not connect. Retrying…');setTimeout(initialize,4000);}}
setInterval(async()=>{if(document.hidden||!ready)return;if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:'ping'}));return;}try{if(!batch&&!sending)state(await api('clicker_state'));connect();}catch{error('Reconnecting… Your clicks are queued.');}},5000);
document.addEventListener('visibilitychange',()=>{stop();if(document.hidden){socket?.close();}else{connect();void flush();}});
window.addEventListener('pagehide',()=>{stop();closed=true;clearTimeout(reconnectTimer);socket?.close();if(!batch&&pending){batch={clicks:Math.min(40,pending),requestId:crypto.randomUUID()};pending-=batch.clicks;}persist();});
window.addEventListener('pageshow',event=>{if(event.persisted){closed=false;connect();void flush();}});
initialize();
