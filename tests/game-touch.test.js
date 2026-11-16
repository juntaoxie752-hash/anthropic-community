import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {installGameTouch} from '../public/game-touch.js';

test('rapid button taps cancel native zoom/click, fire once, and preserve disabled, scroll, pinch and text input',()=>{
 const w=new Window();
 w.document.body.innerHTML='<section><button><span>Generate</span></button><div>Stage</div><input></section>';
 const root=w.document.querySelector('section'), button=root.querySelector('button'), label=button.firstChild;
 installGameTouch(root);
 let clicks=0;button.onclick=()=>clicks++;
 const point=(x=10,id=1)=>({clientX:x,clientY:20,identifier:id});
 const send=(target,type,touches,changedTouches=[],time=100)=>{
  const e=new w.Event(type,{bubbles:true,cancelable:true});
  Object.defineProperties(e,{touches:{value:touches},changedTouches:{value:changedTouches},timeStamp:{value:time}});
  target.dispatchEvent(e);return e;
 };
 for(let i=0;i<3;i++) {
  send(label,'touchstart',[point()],[],100+i*100);
  assert.equal(send(label,'touchend',[],[point()],150+i*100).defaultPrevented,true);
 }
 assert.equal(clicks,3);
 button.disabled=true;send(label,'touchstart',[point()]);
 assert.equal(send(label,'touchend',[],[point()],160).defaultPrevented,true);assert.equal(clicks,3);
 button.disabled=false;
 send(label,'touchstart',[point()]);send(label,'touchmove',[point(40)]);
 assert.equal(send(label,'touchend',[],[point(40)],160).defaultPrevented,false);assert.equal(clicks,3);
 send(label,'touchstart',[point()]);send(label,'touchstart',[point(),point(50,2)]);
 assert.equal(send(label,'touchend',[],[point()],160).defaultPrevented,false);assert.equal(clicks,3);
 const input=root.querySelector('input');send(input,'touchstart',[point()]);
 assert.equal(send(input,'touchend',[],[point()],160).defaultPrevented,false);
 const stage=root.querySelector('div');send(stage,'touchstart',[point()],[],1000);send(stage,'touchend',[],[point()],1050);
 send(stage,'touchstart',[point()],[],1100);assert.equal(send(stage,'touchend',[],[point()],1150).defaultPrevented,true);
 const dbl=new w.Event('dblclick',{bubbles:true,cancelable:true});label.dispatchEvent(dbl);assert.equal(dbl.defaultPrevented,true);
});
