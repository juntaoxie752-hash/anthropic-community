import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import vm from 'node:vm';
import {setImmediate as nextTurn} from 'node:timers/promises';
test('audio waits for interaction, caps overlapping voices, mutes immediately and remembers preference',async()=>{
 const w=new Window({url:'https://example.test'});let created=0,started=0,stopped=0;
 try{
  w.document.body.innerHTML='<button id="make-slop">Generate</button><button id="sound-toggle"></button><button disabled id="disabled">No</button>';
  Object.defineProperty(w.document,'hidden',{value:false,configurable:true});
  class AudioContext {
   constructor(){created++;this.state='running';this.currentTime=0;}
   createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
   createBufferSource(){return {playbackRate:{value:1},connect(){},disconnect(){},start(){started++;},stop(){stopped++;}};}
   async decodeAudioData(){return {};}
   async resume(){this.state='running';}
   async suspend(){this.state='suspended';}
  }
  w.AudioContext=AudioContext;let clock=0;
  vm.runInContext(await readFile(new URL('../public/game-audio.js',import.meta.url),'utf8'),vm.createContext({window:w,document:w.document,localStorage:w.localStorage,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}),performance:{now:()=>clock},console}));
  await nextTurn();assert.equal(created,0);assert.equal(started,0);
  w.document.dispatchEvent(new w.CustomEvent('game-sound',{detail:'cash'}));await nextTurn();assert.equal(started,0);
  w.document.getElementById('make-slop').click();await nextTurn();assert.equal(created,1);assert.equal(started,1);
  for(let i=0;i<12;i++){clock+=200;w.document.dispatchEvent(new w.CustomEvent('game-sound',{detail:'cash'}));await nextTurn();}
  assert.ok(stopped>=7);
  w.document.getElementById('sound-toggle').click();assert.equal(w.localStorage.getItem('game-muted'),'1');
  const before=started;clock+=200;w.document.getElementById('make-slop').click();await nextTurn();assert.equal(started,before);
  assert.equal(w.document.getElementById('sound-toggle').getAttribute('aria-pressed'),'false');
  w.document.getElementById('sound-toggle').click();await nextTurn();assert.equal(w.localStorage.getItem('game-muted'),'0');assert.ok(started>before);
  Object.defineProperty(w.document,'hidden',{value:true,configurable:true});w.document.dispatchEvent(new w.Event('visibilitychange'));
  const hiddenBefore=started;clock+=300;w.document.dispatchEvent(new w.CustomEvent('game-sound',{detail:'jackpot'}));await nextTurn();assert.equal(started,hiddenBefore);
 }finally{await w.happyDOM.close();}
});
