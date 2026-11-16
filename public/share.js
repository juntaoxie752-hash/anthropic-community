import {claimShareReward, rewardState} from './rewards.js';
import {MARK} from './share-icons.js';
export const channels = [['x','X'],['whatsapp','WhatsApp'],['telegram','Telegram'],['facebook','Facebook'],['reddit','Reddit'],['messages','Messages'],['email','Email'],['line','LINE'],['linkedin','LinkedIn'],['native','More']];
export function shareIntent(channel,url,message,ios=false) {
 const link=encodeURIComponent(url),text=encodeURIComponent(message),combined=encodeURIComponent(`${message}\n${url}`);
 return {x:`https://x.com/intent/post?url=${link}&text=${text}`,whatsapp:`https://wa.me/?text=${combined}`,telegram:`https://t.me/share/url?url=${link}&text=${text}`,facebook:`https://www.facebook.com/sharer/sharer.php?u=${link}`,reddit:`https://www.reddit.com/submit?url=${link}&title=${text}`,messages:`sms:${ios?'&':'?'}body=${combined}`,email:`mailto:?subject=${encodeURIComponent('Anthropic Sucks')}&body=${combined}`,line:`https://social-plugins.line.me/lineit/share?url=${link}&text=${text}`,linkedin:`https://www.linkedin.com/sharing/share-offsite/?url=${link}`}[channel];
}
let active;
function openShare(trigger) {
 active?.close();
 const url=new URL(location.pathname,location.origin).href;
 const postTitle=document.querySelector('.thread-post h1')?.textContent;
 const message=postTitle?`${postTitle} — join the discussion on Anthropic Sucks.`:'Fuck Anthropic. Burst the AI bubble. AI must not be controlled by evil companies.';
 const dialog=document.createElement('dialog');dialog.className='share-sheet';dialog.setAttribute('aria-labelledby','share-title');
 dialog.innerHTML=`<button class="share-close" aria-label="Close share dialog">×</button><h2 id="share-title">Share the frustration.</h2><p class="share-subtitle">A shared wall. A louder voice.</p><p class="share-reward" data-share-reward>First share +$50M</p><p class="share-reward-status" role="status"></p><label for="share-message">Say it your way</label><textarea id="share-message" maxlength="280" rows="3"></textarea><div class="share-platforms" role="group" aria-label="Share options">${channels.map(([key,label])=>`<button class="share-option" data-channel="${key}"><span class="share-icon" style="background:${MARK[key][0]||'#302b28'}"><svg viewBox="0 0 24 24" aria-hidden="true">${MARK[key][1]}</svg></span><span>${label}</span></button>`).join('')}</div><p class="share-hint">Facebook and LinkedIn share the link. Copy your message to add it there.</p><div class="share-link-row"><input aria-label="Share link" readonly><button class="share-copy-link">Copy link</button></div><button class="share-copy-message">Copy message + link</button><p class="share-status" role="status" aria-live="polite"></p>`;
 document.body.append(dialog);active=dialog;
 const field=dialog.querySelector('input'),messageField=dialog.querySelector('textarea'),status=dialog.querySelector('.share-status');field.value=url;messageField.value=message;
 const notify=text=>{status.textContent=text;};
 rewardState().catch(()=>{});
 const reward=()=>claimShareReward().then(data=>{
  dialog.querySelector('.share-reward-status').textContent=data.reward ? '+$50,000,000 “ARR” added to your balance.' : 'Your one-time share reward has already been claimed.';
 }).catch(error=>{dialog.querySelector('.share-reward-status').textContent=error.message;});
 async function copy(text,label) {try{await navigator.clipboard.writeText(text);notify(label);void reward();}catch{messageField.focus();messageField.select();notify('Copy using your device’s copy command. The link is shown below.');}}
 dialog.querySelector('.share-copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(url);notify('Link copied.');void reward();}catch{field.focus();field.select();notify('Select and copy the link below.');}};
 dialog.querySelector('.share-copy-message').onclick=()=>copy(`${messageField.value.trim()}\n${url}`,'Message and link copied.');
 field.onfocus=()=>field.select();
 for(const button of dialog.querySelectorAll('[data-channel]'))button.onclick=async()=>{
  void reward();
  const channel=button.dataset.channel,text=messageField.value.trim();
  if(channel==='native'){
   if(!navigator.share){notify('System sharing is unavailable here. Choose a platform or copy the message and link.');return;}
   try{await navigator.share({title:postTitle||'Anthropic Sucks',text,url});notify('Shared.');}catch(e){if(e.name!=='AbortError')notify('Could not open system sharing. Try copying the message and link.');}return;
  }
  const href=shareIntent(channel,url,text,/iPad|iPhone|iPod/.test(navigator.userAgent));
  if(channel==='email'||channel==='messages'){const link=document.createElement('a');link.href=href;dialog.append(link);link.click();link.remove();notify('Continue in your email or messaging app.');}
  else {const popup=window.open(href,'_blank');if(popup){popup.opener=null;notify(['facebook','linkedin'].includes(channel)?'Add your message in the sharing window. Use “Copy message + link” if needed.':'Finish sharing in the new window.');}else notify('The sharing window was blocked. Allow pop-ups or copy the message and link.');}
 };
 dialog.querySelector('.share-close').onclick=()=>dialog.close();
 let backdrop=false;dialog.onpointerdown=e=>{backdrop=e.target===dialog;};dialog.onclick=e=>{if(e.target===dialog&&backdrop)dialog.close();};
 dialog.addEventListener('close',()=>{dialog.remove();if(active===dialog)active=null;trigger.focus();});
 dialog.showModal();dialog.querySelector('.share-close').focus();
}
if(typeof document!=='undefined')document.querySelectorAll('[data-share]').forEach(button=>button.addEventListener('click',()=>openShare(button)));
