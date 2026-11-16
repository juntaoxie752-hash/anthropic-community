import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import vm from 'node:vm';
import {setImmediate as settle} from 'node:timers/promises';
import {MARK} from '../public/share-icons.js';
test('share UI claims on copied links or platform clicks, not opening; reports claimed and failure states',async()=>{
 const w=new Window({url:'https://example.test'});
 try {
  w.document.body.innerHTML='<button data-share>Share</button>';
  let claims=0,fail=false;
  const context=vm.createContext({document:w.document,location:w.location,URL,MARK,window:{open:()=>null},
   navigator:{userAgent:'test',clipboard:{writeText:async()=>{if(fail)throw Error('denied');}}},
   rewardState:async()=>({shareClaimed:false}),
   claimShareReward:async()=>({reward:++claims===1?500000:0})});
  const code=(await readFile(new URL('../public/share.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replaceAll('export ','');
  vm.runInContext(code,context);
  w.document.querySelector('[data-share]').click();await settle();assert.equal(claims,0);
  w.document.querySelector('.share-copy-link').click();await settle();assert.equal(claims,1);
  assert.match(w.document.querySelector('.share-reward-status').textContent,/50,000,000/);
  w.document.querySelector('[data-channel="x"]').click();await settle();assert.equal(claims,2);
  assert.match(w.document.querySelector('.share-reward-status').textContent,/already been claimed/);
  fail=true;w.document.querySelector('.share-copy-link').click();await settle();assert.equal(claims,2);
  // Even cancelling or lacking system share counts as a button click by design.
  w.document.querySelector('[data-channel="native"]').click();await settle();assert.equal(claims,3);
 }finally{await w.happyDOM.close();}
});
