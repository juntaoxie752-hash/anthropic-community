export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Render only explicit HTTPS URLs as links; all other user content remains escaped text.
export const linkedText = value => String(value ?? '').split(/(https:\/\/[^\s<>"']+)/g).map((part,index) => index % 2 ? `<a class="source-link" href="${escape(part)}" target="_blank" rel="noopener noreferrer ugc nofollow">${escape(part)}</a>` : escape(part)).join('');
export const postPath = post => `/posts/${post.id}/${String(post.title).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75).replace(/-$/,'') || 'discussion'}`;
export const origin = env => env.CANONICAL_ORIGIN || 'https://anthropicsucks.club';
export async function rpc(env, service, action, payload={}, visitor='server', network='server') {
 const functions = {forum:'community_forum', api:'community_api', bubble:'community_bubble', rewards:'community_rewards'};
 const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/rpc/${functions[service]}`, {
  method:'POST', headers:{'Content-Type':'application/json',apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`},
  body:JSON.stringify({action,visitor,network,payload}),signal:AbortSignal.timeout(10000)
 });
 if(!response.ok) {const data=await response.json().catch(()=>({})); const e=new Error(data.code==='P0001'?data.message:'The community is temporarily unavailable. Please try again.'); e.status=data.code==='P0001'?400:503; throw e;}
 return response.json();
}
const meta = row => `<div class="comment-meta"><strong>u/${escape(row.name)}</strong><time datetime="${escape(row.created_at)}">${escape(new Date(row.created_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}))}</time></div>`;
export const vote = row => `<button class="like-button" data-like="${escape(row.id)}" aria-pressed="${Boolean(row.liked)}" aria-label="Like post"><span>Like</span> <span data-score>${Number(row.likes)||0}</span></button>`;
export function card(row) {
 return `<article class="post-card" data-id="${escape(row.id)}"><div class="vote-column">${vote(row)}</div><div class="post-main">${meta(row)}<h3><a href="${escape(postPath(row))}">${escape(row.title)}</a></h3><p class="post-excerpt">${escape(row.body)}</p><a class="reply-link" href="${escape(postPath(row))}#replies">${Number(row.replies)||0} replies · Join the discussion </a></div></article>`;
}
const responseHTML = (body,status=200) => new Response(body,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(status>=400?{'X-Robots-Tag':'noindex'}:{})}});
function shell({title,description,path,content,env,structured,noindex=false}) {
 const canonical=origin(env)+path;
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | Anthropic Sucks</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:type" content="article">${noindex?'<meta name="robots" content="noindex,follow">':''}<link rel="stylesheet" href="/style.css"><link rel="icon" href="/favicon.svg?v=a-slash">${structured?`<script type="application/ld+json">${JSON.stringify(structured).replace(/</g,'\\u003c')}</script>`:''}<script type="module" src="/thread.js"></script><script type="module" src="/share.js"></script></head><body><header class="forum-header"><a href="/">a<span class="accent">/</span> <strong>Anthropic Sucks</strong></a><a href="/#wall">Create a post </a></header><main class="thread">${content}</main><footer><p>Independent community. Not affiliated with Anthropic.</p><a href="/posts">All posts</a></footer><div id="toast" class="toast" role="status" hidden></div></body></html>`;
}
export async function renderForum(request,env) {
 const url=new URL(request.url), canonical=origin(env);
 const page=Math.max(0,Math.min(100000,parseInt(url.searchParams.get('page'))||0));
 const xml=body=>new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});
 if(url.pathname==='/robots.txt') return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${canonical}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain'}});
 try {
  if(!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Database not connected');
  if(url.pathname==='/sitemap.xml') {
   const data=await rpc(env,'forum','sitemap_count');
   return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({length:data.pages},(_,i)=>`<sitemap><loc>${escape(canonical)}/sitemap-${i}.xml</loc></sitemap>`).join('')}</sitemapindex>`);
  }
  const sitemap=url.pathname.match(/^\/sitemap-(\d+)\.xml$/);
  if(sitemap) {
   const rows=await rpc(env,'forum','sitemap',{page:Number(sitemap[1])});
   return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Number(sitemap[1])===0?`<url><loc>${canonical}/</loc></url><url><loc>${canonical}/posts</loc></url>`:''}${rows.map(p=>`<url><loc>${escape(canonical+postPath(p))}</loc></url>`).join('')}</urlset>`);
  }
  if(url.pathname==='/' || url.pathname==='/posts') {
   const sort=url.searchParams.get('sort')==='popular'?'popular':'newest';
   const data=await rpc(env,'forum','posts',{sort,page});
   const pagination=`<nav class="pagination" aria-label="Post pages">${page?`<a href="/posts?page=${page-1}&amp;sort=${sort}"> Previous</a>`:''}${data.hasMore?`<a href="/posts?page=${page+1}&amp;sort=${sort}">Next posts </a>`:''}</nav>`;
   if(url.pathname==='/') {
    let html=await (await env.ASSETS.fetch(new Request(new URL('/index.html',url)))).text();
    html=html.replace('<!--SEO_HEAD-->',`<link rel="canonical" href="${canonical}/">`)
     .replace('<!--POSTS-->',data.items.map(card).join('')||'<div class="empty">No posts yet. Start the first discussion.</div>')
     .replace('<!--PAGINATION-->',pagination);
    return responseHTML(html);
   }
   if(page && !data.items.length) return responseHTML(shell({title:'Page not found',description:'This page does not exist.',path:'/posts',env,noindex:true,content:'<h1 class="thread-title">Page not found</h1><a href="/posts">Back to posts</a>'}),404);
   return responseHTML(shell({title:`Community discussions${page?` — Page ${page+1}`:''}`,description:'Experiences, feedback, and discussions about Anthropic and Claude.',path:`/posts${page?`?page=${page}`:''}`,env,noindex:sort==='popular',content:`<h1 class="thread-title">Community discussions</h1><nav class="sort"><a href="/posts">Newest</a><a href="/posts?sort=popular">Popular</a></nav>${data.items.map(card).join('')||'<p>No posts yet.</p>'}${pagination}`}));
  }
  const match=url.pathname.match(/^\/posts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/[^/]+)?\/?$/i);
  const data=match?await rpc(env,'forum','post',{id:match[1],page}):{post:null};
  if(!data.post) return responseHTML(shell({title:'Post not found',description:'This post is unavailable.',path:'/posts',env,noindex:true,content:'<h1 class="thread-title">Post not found.</h1><p>This post may have been removed.</p><a href="/posts">Browse discussions </a>'}),404);
  const p=data.post,path=postPath(p);
  if(url.pathname!==path) return Response.redirect(url.origin+path+(page?`?page=${page}`:''),301);
  const structured={'@context':'https://schema.org','@type':'DiscussionForumPosting',headline:p.title,text:p.body,datePublished:p.created_at,author:{'@type':'Person',name:p.name},url:canonical+path,commentCount:p.replies,comment:data.items.map(r=>({'@type':'Comment',text:r.body,datePublished:r.created_at,author:{'@type':'Person',name:r.name}}))};
  const replies=data.items.map(r=>`<article class="thread-reply" id="reply-${r.id}">${meta(r)}<p class="comment-body">${escape(r.body)}</p></article>`).join('');
  return responseHTML(shell({title:p.title,description:p.body.replace(/\s+/g,' ').slice(0,160),path:path+(page?`?page=${page}`:''),env,structured,content:`<a class="back-link" href="/posts"> All discussions</a><article class="thread-post">${meta(p)}<h1 class="thread-title">${escape(p.title)}</h1><p class="thread-body">${linkedText(p.body)}</p><div class="thread-actions">${vote(p)}<a href="#replies">${p.replies} replies</a><button class="share-button" data-share>Share <small class="credit-bonus" data-share-bonus title="One-time share credits">+$50M</small></button></div></article><section id="replies"><h2>Replies <span>${p.replies}</span></h2><form id="reply-form" data-post="${p.id}" class="composer"><label class="sr-only" for="reply-body">Your reply</label><textarea id="reply-body" required maxlength="20000" placeholder="Join the conversation…"></textarea><div class="composer-bottom"><label class="sr-only" for="reply-name">Name (optional)</label><input id="reply-name" maxlength="40" placeholder="Anonymous (or pick a name)"><button class="post-button">Reply <small class="credit-bonus" title="Reply credits">+$10M</small></button></div></form><p class="reward-hint">Every reply earns +$10M “ARR” · credited after posting.</p><p class="guidance">No threats, personal information, or spam.</p><div class="reply-tree">${replies||'<p class="empty">No replies yet. Start the conversation.</p>'}</div><nav class="pagination" aria-label="Reply pages">${page?`<a href="${path}?page=${page-1}#replies"> Previous replies</a>`:''}${data.hasMore?`<a href="${path}?page=${page+1}#replies">More replies </a>`:''}</nav></section>`}));
 } catch {
  if(url.pathname==='/') {let html=await (await env.ASSETS.fetch(new Request(new URL('/index.html',url)))).text(); return responseHTML(html.replace('<!--POSTS-->','<p class="empty">The community is temporarily unavailable.</p>'),503);}
  return responseHTML(shell({title:'Temporarily unavailable',description:'Please try again shortly.',path:url.pathname,env,noindex:true,content:'<h1 class="thread-title">Back shortly.</h1><p>The community is temporarily unavailable. Please try again.</p>'}),503);
 }
}
