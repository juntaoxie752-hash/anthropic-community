from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import subprocess,json
slugs=['public-benefit-fund','s1-sec','roadshow-launch','an-update-on-independent-evaluators','accenture-embedded-evaluation','distillation-defenses','2026-usage-policy-update','cyber-verification-program','claude-frontier-academy','expanding-partnership-gsa','anthropic-cyber-mission','genesis-mission-commitment','christopher-stubbs-joins-long-term-benefit-trust','ai-for-science-expands-foundations-research-institutions','open-call-guest-investigators-life-sciences','donating-agent-skills-to-the-agentic-ai-foundation','singapore-office-opening','barclays-scales-claude']
class Extract(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.text=[]
 def handle_starttag(self,t,a):
  if t in ('script','style'):self.skip+=1
 def handle_endtag(self,t):
  if t in ('script','style'):self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip and d.strip():self.text.append(d.strip())
def run(slug):
 url='https://www.anthropic.com/news/'+slug
 p=Path('editorial/sources')/(slug+'.html')
 subprocess.run(['curl','--proxy','http://127.0.0.1:1235','-L','--max-time','30','-s',url,'-o',str(p)])
 e=Extract();e.feed(p.read_text() if p.exists() else '');text='\n'.join(e.text);p.with_suffix('.txt').write_text(text)
 return {'slug':slug,'text':text[:16000]}
with ThreadPoolExecutor(max_workers=6) as pool:
 results=list(pool.map(run,slugs))
Path('editorial/sources/extracted.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
for r in results:print(r['slug'],len(r['text']))
