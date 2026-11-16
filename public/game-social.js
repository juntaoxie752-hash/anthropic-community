import {ensureSession} from './session.js';
const $ = id => document.getElementById(id);
const dollars = n => `$${Number(n).toLocaleString('en-US')}`;
async function social(action, payload) {
 await ensureSession();
 const response = await fetch(`/api/${action}`, {method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(12000)});
 const data=await response.json();
 if(!response.ok) throw new Error(data.error || 'Could not load. Close and try again.');
 return data;
}
function renderBoard(data) {
 const rows=$('leaderboard-rows');rows.replaceChildren();
 for(const player of data.items) {
  const row=document.createElement('tr');if(player.you)row.className='is-you';
  for(const value of [`#${player.rank}`,`${player.name}${player.you?' (you)':''}`,dollars(player.contributed)]) {
   const cell=document.createElement('td');cell.textContent=value;row.append(cell);
  }
  rows.append(row);
 }
 $('personal-rank').textContent=`You: ${data.me.rank ? `#${data.me.rank}` : 'Unranked'} · ${dollars(data.me.contributed)} contributed`;
 $('leaderboard-status').textContent=data.items.length?'':'No sales yet. Be the first on the board.';
}
let boardLoading=false;
$('open-leaderboard').onclick=async()=>{
 if(boardLoading)return;
 const dialog=$('leaderboard-dialog');dialog.showModal();boardLoading=true;
 $('leaderboard-status').textContent='Loading…';$('leaderboard-rows').replaceChildren();$('personal-rank').textContent='';
 const save=$('player-name-form').querySelector('button');save.disabled=true;
 try {const data=await social('bubble_board');$('player-name').value=data.me.name||'';renderBoard(data);}
 catch(error){$('leaderboard-status').textContent=error.message;}
 finally {boardLoading=false;save.disabled=false;}
};
$('player-name-form').onsubmit=async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');if(button.disabled)return;
 button.disabled=true;$('leaderboard-status').textContent='Saving…';
 try {renderBoard(await social('bubble_name',{name:$('player-name').value.trim()}));$('leaderboard-status').textContent='Name saved.';}
 catch(error){$('leaderboard-status').textContent=error.message;}
 finally{button.disabled=false;}
};
let eventsLoading=false;
$('open-events').onclick=async()=>{
 if(eventsLoading)return;
 $('events-dialog').showModal();eventsLoading=true;$('events-status').textContent='Loading…';$('event-history').replaceChildren();
 try {
  const data=await social('bubble_events');
  $('events-status').textContent=data.items.length?'':'No world events yet.';
  for(const event of data.items) {
   const button=document.createElement('button');button.type='button';button.className='event-history-item';
   const date=document.createElement('time');date.dateTime=event.occurredAt;
   date.textContent=new Date(event.occurredAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
   const title=document.createElement('strong');title.textContent=event.title||'Data center down. Bubble deflated.';
   const impact=document.createElement('span');impact.textContent=`−${dollars(event.loss)} · View event`;
   button.append(date,title,impact);
   button.onclick=()=>{$('events-dialog').close();document.dispatchEvent(new CustomEvent('replay-world-event',{detail:event}));};
   $('event-history').append(button);
  }
 } catch(error){$('events-status').textContent=error.message;}
 finally{eventsLoading=false;}
};
for(const button of document.querySelectorAll('[data-close-panel]'))button.onclick=()=>button.closest('dialog').close();
