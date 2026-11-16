// CC0 Kenney samples; audio is decorative and never blocks game actions.
const samples = {tap:'land',generate:'jump',flush:'fall',cash:'coin',upgrade:'coin',jackpot:'coin'};
const levels = {tap:.12,generate:.20,flush:.22,cash:.24,upgrade:.23,jackpot:.26};
let muted=false, context, master, unlocked=false, generation=0;
try {muted=localStorage.getItem('game-muted')==='1';} catch {}
const buffers=new Map(), voices=new Set(), last=new Map();
const files=new Map(Object.values(samples).map(name=>[name,fetch(`/assets/audio/${name}.wav`).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null)]));
function updateToggle(){
 const button=document.getElementById('sound-toggle');if(!button)return;
 button.setAttribute('aria-pressed',String(!muted));
 button.setAttribute('aria-label',muted?'Enable sound effects':'Mute sound effects');
 button.title=muted?'Sound off':'Sound on';button.classList.toggle('is-muted',muted);
}
function stop(){generation++;for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
async function unlock(){
 if(muted || document.hidden)return false;
 try {
  if(!context){
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
   context=new Audio();master=context.createGain();master.gain.value=.65;master.connect(context.destination);
  }
  if(context.state!=='running')await context.resume();
  unlocked=context.state==='running';return unlocked;
 }catch{return false;}
}
async function play(kind){
 if(muted || !unlocked || document.hidden || !samples[kind])return;
 const now=performance.now(), gap=kind==='generate'?65:kind==='tap'?60:180;
 if(now-(last.get(kind)??-Infinity)<gap)return;last.set(kind,now);
 const epoch=generation;
 try {
  const name=samples[kind];
  if(!buffers.has(name))buffers.set(name,files.get(name).then(bytes=>bytes?context.decodeAudioData(bytes):null).catch(()=>null));
  const buffer=await buffers.get(name);
  if(!buffer || muted || document.hidden || epoch!==generation || context.state!=='running')return;
  const sequence=kind==='upgrade'?[1,1.25]:kind==='jackpot'?[1,1.25,1.5]:[kind==='flush'?.65:kind==='generate'?.9+Math.random()*.18:1];
  sequence.forEach((rate,index)=>{
   while(voices.size>=6){const oldest=voices.values().next().value;try{oldest.stop();}catch{}voices.delete(oldest);}
   const source=context.createBufferSource(), gain=context.createGain();source.buffer=buffer;source.playbackRate.value=rate;
   gain.gain.value=levels[kind];source.connect(gain);gain.connect(master);voices.add(source);
   source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};
   source.start(context.currentTime+index*.09);
  });
 }catch{ /* Unsupported audio or a failed download must never interrupt play. */ }
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('button');if(!button || button.disabled)return;
 if(button.id==='sound-toggle'){
  muted=!muted;stop();try{localStorage.setItem('game-muted',muted?'1':'0');}catch{}updateToggle();
  if(!muted)void unlock().then(ok=>{if(ok)void play('tap');});return;
 }
 const kind=button.id==='make-slop'?'generate':['flush-slop','flush-slop-label'].includes(button.id)?'flush':'tap';
 void unlock().then(ok=>{if(ok)void play(kind);});
},{capture:true});
document.addEventListener('game-sound',event=>{void play(event.detail);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();if(context)void context.suspend().catch(()=>{});}});
updateToggle();
