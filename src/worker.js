import {renderForum, rpc} from './forum.js';
export {ClickerRoom} from './clicker-room.js';
const actions = {
  clicker_state:'clicker', clicker_click:'clicker', clicker_ws:'clicker',
  bubble_board:'social', bubble_name:'social', bubble_events:'social',
  reward_state: 'rewards', reward_share: 'rewards',
  posts: 'forum', post: 'forum', create_post: 'forum', reply: 'forum',
  presence: 'api', react: 'api', like: 'api',
  bubble_state: 'bubble', bubble_make: 'bubble', bubble_flush: 'bubble',
  bubble_buy_center: 'bubble', bubble_buy_workspace: 'bubble', bubble_buy_algorithm: 'bubble',
  bubble_buy_double: 'bubble', bubble_buy_auto: 'bubble', bubble_buy_bowl: 'bubble',
};
const reads = new Set(['posts', 'post', 'bubble_state', 'reward_state', 'bubble_board', 'bubble_events', 'clicker_state', 'clicker_ws']);
const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (url.hostname === 'fuckanthropic.club') {
        if (url.pathname === '/' || url.pathname === '/index.html') return env.ASSETS.fetch(new Request(new URL('/clicker.html',url),request));
        if (url.pathname === '/posts' || url.pathname.startsWith('/posts/')) return Response.redirect('https://anthropicsucks.club'+url.pathname+url.search,301);
        if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://fuckanthropic.club/sitemap.xml\n');
        if (/^\/sitemap/.test(url.pathname)) return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://fuckanthropic.club/</loc></url></urlset>',{headers:{'Content-Type':'application/xml'}});
      }
      if (url.pathname === '/' || url.pathname === '/posts' || url.pathname.startsWith('/posts/') || url.pathname === '/robots.txt' || /^\/sitemap(?:-\d+)?\.xml$/.test(url.pathname)) return renderForum(request,env);
      return env.ASSETS.fetch(request);
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.VISITOR_SECRET) return json({error:'The community database is not connected yet.'},503);
    const action = url.pathname.slice(5);
    if (!actions[action]) return json({error:'Not found'},404);
    if (request.method !== (reads.has(action) ? 'GET' : 'POST')) return json({error:'Method not allowed'},405);
    if ((request.method === 'POST' || action === 'clicker_ws') && request.headers.get('Origin') !== url.origin) return json({error:'Invalid origin'},403);
    try {
      let payload = {};
      if (request.method === 'POST') {
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'JSON required'},415);
        const body = await request.text();
        if (new TextEncoder().encode(body).length > 262144) return json({error:'Request too large'},413);
        try { payload = JSON.parse(body); } catch { return json({error:'Invalid JSON'},400); }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({error:'Invalid request'},400);
      }
      const cookies = request.headers.get('Cookie') || '';
      const existing = cookies.match(/(?:^|;\s*)community_visitor=([a-f0-9-]{36})(?:;|$)/)?.[1];
      const visitor = existing || crypto.randomUUID();
      const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(env.VISITOR_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      const hash = async value => [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2,'0')).join('');
      const identity = await hash(`visitor:${visitor}`);
      const network = await hash(`network:${request.headers.get('CF-Connecting-IP') || 'local'}`);
      if (action.startsWith('clicker_')) {
        const country=/^[A-Z]{2}$/.test(request.cf?.country || '') ? request.cf.country : 'XX';
        payload.country=country;
        if(action==='clicker_ws'){
          if(!existing)return json({error:'Initialize your session first.'},401);
          if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket required'},426);
          return env.CLICKER_ROOM.get(env.CLICKER_ROOM.idFromName('anthropic-clicker')).fetch(new Request('https://room/connect',{headers:{Upgrade:'websocket','X-Clicker-Session':JSON.stringify({visitor:identity,network,country})}}));
        }
      }
      if (action === 'posts' || action === 'post') { payload.sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'newest'; payload.page = Math.min(1000,Math.max(0,Number.parseInt(url.searchParams.get('page') || '0') || 0)); }
      if (action === 'post') payload.id = url.searchParams.get('id');
      if (action === 'presence') payload = {country:/^[A-Z]{2}$/.test(request.cf?.country || '') ? request.cf.country : 'XX'};
      let data;
      try { if(action==='clicker_click'){const response=await env.CLICKER_ROOM.get(env.CLICKER_ROOM.idFromName('anthropic-clicker')).fetch(new Request('https://room/click',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitor:identity,network,payload})}));data=await response.json();}else data = await rpc(env,actions[action],action,payload,identity,network); } catch(e) { return json({error:e.message},e.status || 503); }
      const result = json(data);
      if (!existing) result.headers.append('Set-Cookie',`community_visitor=${visitor}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`);
      return result;
    } catch { return json({error:'Connection interrupted. Please try again.'},503); }
  }
};
