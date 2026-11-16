import {rpc} from './forum.js';
// One hibernating room fans out authoritative Supabase totals to every player.
export class ClickerRoom {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket'){
   const {visitor,network,payload}=await request.json();
   const state=await rpc(this.env,'clicker','clicker_click',payload,visitor,network);
   this.broadcast({type:'state',...state,requestId:payload.requestId});
   return Response.json(state,{headers:{'Cache-Control':'no-store'}});
  }
  const info=JSON.parse(request.headers.get('X-Clicker-Session'));
  if(this.ctx.getWebSockets().length>=2000)return new Response('Room full',{status:503});
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];
  this.ctx.acceptWebSocket(server);server.serializeAttachment({...info,bucket:Date.now(),hits:0});
  try{const state=await rpc(this.env,'clicker','clicker_state',{country:info.country},info.visitor,info.network);server.send(JSON.stringify({type:'state',...state}));this.broadcastPresence();}
  catch{server.close(1011,'Could not connect');}
  return new Response(null,{status:101,webSocket:client});
 }
 presence(){
  const visitors=new Map();for(const s of this.ctx.getWebSockets()){const a=s.deserializeAttachment();if(a)visitors.set(a.visitor,a.country);}
  const counts=new Map();for(const c of visitors.values())counts.set(c,(counts.get(c)||0)+1);
  return {online:visitors.size,countries:[...counts].map(([country,count])=>({country,count})).sort((a,b)=>b.count-a.count)};
 }
 broadcast(data){const text=JSON.stringify(data);for(const s of this.ctx.getWebSockets())try{s.send(text);}catch{}}
 broadcastPresence(){this.broadcast({type:'presence',...this.presence()});}
 async webSocketMessage(socket,message){
  try{
   if(typeof message!=='string'||message.length>1024)throw Error('Invalid message');
   const data=JSON.parse(message),info=socket.deserializeAttachment(),now=Date.now();
   if(now-info.bucket>60000){info.bucket=now;info.hits=0;}if(++info.hits>600)throw Error('Please slow down');socket.serializeAttachment(info);
   if(data.type==='ping'){socket.send(JSON.stringify({type:'pong'}));return;}
   if(data.type!=='click'||!Number.isInteger(data.clicks)||data.clicks<1||data.clicks>40||!/^([a-f0-9]{8}-)([a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(data.requestId))throw Error('Invalid click batch');
   const state=await rpc(this.env,'clicker','clicker_click',{clicks:data.clicks,requestId:data.requestId,country:info.country},info.visitor,info.network);
   this.broadcast({type:'state',...state,...this.presence(),requestId:data.requestId});
   socket.send(JSON.stringify({type:'ack',requestId:data.requestId}));
  }catch(error){socket.send(JSON.stringify({type:'error',message:error.message}));}
 }
 webSocketClose(socket,code,reason){socket.close(code,reason);this.broadcastPresence();}
 webSocketError(socket){socket.close(1011,'Connection interrupted');this.broadcastPresence();}
}
