let toastTimer;
function toast(message) { const el=document.getElementById('toast'); el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4000); }
async function api(action,payload) { const response=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Please try again.');return data; }
// Establish the anonymous session before allowing writes, including first visits to deep links.
const session=api('presence',{});
session.catch(()=>{});
document.querySelectorAll('[data-like]').forEach(button=>{
 button.disabled=true;
 session.then(async()=>{
  const response=await fetch(`/api/post?id=${encodeURIComponent(button.dataset.like)}`);
  if(!response.ok)throw new Error('Unavailable');
  const data=await response.json();if(!data.post)throw new Error('Unavailable');
  button.setAttribute('aria-pressed',String(data.post.liked));button.querySelector('[data-score]').textContent=data.post.likes;button.disabled=false;
 }).catch(()=>{button.disabled=false;});
 button.onclick=async()=>{button.disabled=true;try{await session;const data=await api('like',{id:button.dataset.like,liked:button.getAttribute('aria-pressed')!=='true'});button.setAttribute('aria-pressed',String(data.liked));button.querySelector('[data-score]').textContent=data.likes;}catch(e){toast(e.message);}finally{button.disabled=false;}};
});
const form=document.getElementById('reply-form');
if(form)form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await session;await api('reply',{id:form.dataset.post,name:document.getElementById('reply-name').value.trim()||'Anonymous',body:document.getElementById('reply-body').value.trim(),requestId:crypto.randomUUID()});location.assign(location.pathname+'?page=0#replies');}catch(e){toast(e.message);button.disabled=false;}};
