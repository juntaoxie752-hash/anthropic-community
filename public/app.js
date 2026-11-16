const $ = (id) => document.getElementById(id);
let sort = 'newest', page = 0, generation = 0, ready = false;
const toast = (message) => { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 4500); };
async function api(path, data) {
  const res = await fetch(`/api/${path}`, { method: data ? 'POST' : 'GET', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(12000) });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Could not connect. Please try again.');
  return result;
}
function stats(data) {
  $('comment-count').textContent = data.comments.toLocaleString();
  const countries = data.countries || [];
  $('countries').replaceChildren(...countries.map(({country, count}) => {
    const el = document.createElement('span'); el.className = 'country';
    el.textContent = /^[A-Z]{2}$/.test(country) ? [...country].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('') : '🌐';
    el.title = `${country}: ${count} online`; const badge = document.createElement('span'); badge.className = 'country-count'; badge.textContent = count; el.append(badge); return el;
  }));
  $('countries').hidden = !countries.length;
  $('connection-text').textContent = `${data.online} ${data.online === 1 ? 'person' : 'people'} here right now.`;
}
function comment(row) {
  const el = document.createElement('article'); el.className = 'post-card';
  const slug = row.title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75).replace(/-$/,'') || 'discussion';
  const path = `/posts/${row.id}/${slug}`;
  const vote = document.createElement('button'); vote.className = 'like-button'; vote.textContent = `Like ${row.likes}`; vote.setAttribute('aria-pressed',String(row.liked)); vote.setAttribute('aria-label','Like post');
  vote.onclick = async () => {vote.disabled=true; try {const data=await api('like',{id:row.id,liked:vote.getAttribute('aria-pressed')!=='true'}); vote.textContent=`Like ${data.likes}`;vote.setAttribute('aria-pressed',String(data.liked));if(sort==='popular') await load();}catch(e){toast(e.message);}finally{vote.disabled=false;}};
  const main=document.createElement('div'); main.className='post-main';
  const meta=document.createElement('div');meta.className='comment-meta';meta.textContent=`u/${row.name} · ${new Date(row.created_at).toLocaleDateString()}`;
  const heading=document.createElement('h3'), link=document.createElement('a');link.href=path;link.textContent=row.title;heading.append(link);
  const body=document.createElement('p');body.className='post-excerpt';body.textContent=row.body;
  const replies=document.createElement('a');replies.className='reply-link';replies.href=path+'#replies';replies.textContent=`${row.replies} replies · Join the discussion `;
  main.append(meta,heading,body,replies);el.append(vote,main);return el;
}
async function load(append = false) {
  const token = ++generation; const nextPage = append ? page + 1 : 0;
  $('comments').setAttribute('aria-busy','true'); $('load-more').disabled = true;
  try {
    const data = await api(`posts?sort=${sort}&page=${nextPage}`);
    if (token !== generation) return;
    if (!append) { $('comments').replaceChildren(); $('comments').classList.remove('empty'); }
    const existing = new Set([...$('comments').children].map(el => el.dataset.id));
    data.items.filter(row => !existing.has(String(row.id))).forEach(row => { const el = comment(row); el.dataset.id = row.id; $('comments').append(el); });
    if (!data.items.length && !append) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'No posts yet. Start the first discussion.'; $('comments').append(empty); }
    page = nextPage; $('load-more').hidden = !data.hasMore;
  } finally { if (token === generation) { $('comments').setAttribute('aria-busy','false'); $('load-more').disabled = false; } }
}

$('body').oninput = () => $('char-count').textContent = `${$('body').value.length} / 20,000`;
$('comment-form').onsubmit = async e => { e.preventDefault(); if (!ready) return; $('post').disabled=true; try { const data=await api('create_post',{title:$('post-title').value.trim(),name:$('name').value.trim()||'Anonymous',body:$('body').value.trim(),requestId:crypto.randomUUID()}); location.assign(`/posts/${data.id}`); }catch(e){toast(e.message);$('post').disabled=false;} };
function updateSort() { document.querySelectorAll('[data-sort]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.sort === sort))); }
document.querySelectorAll('[data-sort]').forEach(el => el.onclick = () => { sort = el.dataset.sort; updateSort(); load().catch(e => toast(e.message)); });
$('load-more').onclick = () => load(true).catch(e => toast(e.message));
async function refresh() { stats(await api('presence',{})); }
async function connect() {
  try { await refresh(); ready = true; $('post').disabled = false; await load(); }
  catch { $('connection-text').textContent = 'Connection unavailable. Please try again shortly.'; if (!$('comments').querySelector('article')) $('comments').textContent = 'The community is not connected yet. Please try again shortly.'; $('comments').classList.add('empty'); $('comments').setAttribute('aria-busy','false'); }
}
connect();
setInterval(() => { if (!document.hidden) { if (!ready) connect(); else refresh().catch(() => $('connection-text').textContent = 'Connection interrupted. Reconnecting…'); } },30000);
