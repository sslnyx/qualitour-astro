#!/usr/bin/env python3
"""Compare released visitor HTML against the pre-cutover SEO inventory."""
import argparse, concurrent.futures, hashlib, json, re, time, urllib.request, urllib.error
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
class Scan(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.skip=0;self.text=[];self.meta=[];self.links=[];self.title='';self.in_title=False;self.h1=[];self.in_h1=False;self.schema=[];self.in_json=False;self.buf='';self.bad_images=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t in ('script','style'):self.skip+=1
  if t=='script' and a.get('type')=='application/ld+json':self.in_json=True;self.buf=''
  if t=='meta' and (a.get('name') in ('description','robots') or a.get('property','').startswith('og:')):self.meta.append(a)
  if t=='link' and a.get('rel') in ('canonical','alternate'):self.links.append(a)
  if t=='title':self.in_title=True
  if t=='h1':self.in_h1=True
  if t in ('img','source'):
   for k in ('src','srcset'):
    value=a.get(k,'')
    if '/wp-content/' in value or 'qualitour-cms-free-test.' in value or value.startswith('/_emdash/api/media/file/') or '/_image?href=%2F_image' in value:self.bad_images.append(value)
 def handle_endtag(self,t):
  if t=='script' and self.in_json:
   self.in_json=False
   try:self.schema.append(json.loads(self.buf))
   except ValueError:pass
  if t in ('script','style'):self.skip=max(0,self.skip-1)
  if t=='title':self.in_title=False
  if t=='h1':self.in_h1=False
 def handle_data(self,d):
  if self.in_title:self.title+=d
  if self.in_h1:self.h1.append(d)
  if self.in_json:self.buf+=d
  if not self.skip and d.strip():self.text.append(' '.join(d.split()))
 def result(self):return {'title':self.title,'meta':self.meta,'links':self.links,'h1':self.h1,'schema':self.schema,'textSha256':hashlib.sha256('\n'.join(self.text).encode()).hexdigest()}
# Old category and landing pages were removed on purpose (new menu: /tours/style/*, /tours/destination/*); they must now 404.
REMOVED=re.compile(r'^/(?:zh/)?(?:tours/(?:type|activity|duration|destination)/[^/]+|destinations/[^/]+)$')
def main():
 p=argparse.ArgumentParser();p.add_argument('--baseline',required=True);p.add_argument('--origin',default='https://qualitour.qualitour.workers.dev');p.add_argument('--output',required=True);p.add_argument('--workers',type=int,default=3);args=p.parse_args()
 if args.origin!='https://qualitour.qualitour.workers.dev':raise SystemExit('Unapproved verification origin')
 rows=json.loads(Path(args.baseline).read_text());seen=set();targets=[]
 for row in rows:
  if not row.get('canonical'):continue
  path=urlsplit(row['canonical']).path
  if path in seen:continue
  seen.add(path);targets.append((path,row))
 def check(target):
  path,old=target;start=time.monotonic();out={'path':path,'expectRemoved':bool(REMOVED.match(path))};req=urllib.request.Request(args.origin+path,headers={'User-Agent':'Qualitour-Release-Check/3.0'})
  try:
   with urllib.request.urlopen(req,timeout=60) as r:
    body=r.read().decode();out.update(status=r.status,render=r.headers.get('X-Qualitour-Rendered'),cache=r.headers.get('CF-Cache-Status'),bytes=len(body.encode()));scan=Scan();scan.feed(body);new=scan.result();out['seoDifferences']={k:{'before':old.get(k),'after':new.get(k)} for k in ('title','meta','links','h1','schema') if old.get(k)!=new.get(k)};out['textUnchanged']=old.get('textSha256')==new['textSha256'];out['badImages']=scan.bad_images
  except urllib.error.HTTPError as e:out.update(status=e.code,error='HTTP error')
  except Exception as e:out.update(status=0,error=type(e).__name__)
  out['ms']=round((time.monotonic()-start)*1000);return out
 with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(args.workers,4))) as pool:
  results=[]
  for result in pool.map(check,targets):
   results.append(result)
   if len(results)%50==0:print(json.dumps({'checked':len(results),'total':len(targets)}),flush=True)
 Path(args.output).write_text(json.dumps(results,ensure_ascii=False,indent=2))
 removed=[r for r in results if r['expectRemoved']];results=[r for r in results if not r['expectRemoved']]
 failures=[r for r in results if r['status']!=200 or r.get('seoDifferences') or r.get('badImages')]+[r for r in removed if r['status']!=404]
 print(json.dumps({'checked':len(results),'http200':sum(r['status']==200 for r in results),'seoParity':sum(not r.get('seoDifferences') and r['status']==200 for r in results),'textParity':sum(r.get('textUnchanged',False) for r in results),'removedExpected404':sum(r['status']==404 for r in removed),'removedTotal':len(removed),'failures':len(failures),'runtimePages':sum(bool(r.get('render')) for r in results)},ensure_ascii=False))
 raise SystemExit(1 if failures else 0)
if __name__=='__main__':main()
