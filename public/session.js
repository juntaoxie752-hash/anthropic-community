// One initial identity request per document prevents competing first-visit cookies.
let pending;
export function ensureSession() {
 if (!pending) pending = fetch('/api/presence', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(12000)})
  .then(async response => {if (!response.ok) throw new Error('Could not connect. Please try again.'); return response.json();})
  .catch(error => {pending = null; throw error;});
 return pending;
}
