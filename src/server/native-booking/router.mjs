/** Routes only native customer Sandbox traffic; all CMS paths remain with CMS. */
const origin = 'https://qualitour.qualitour.workers.dev';
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const failure = (status=404) => new Response(JSON.stringify({error:status===405?'METHOD_NOT_ALLOWED':'NOT_FOUND'}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
export function createNativeBookingRouter(api) {
 return async function routeNativeBooking(request, env, context) {
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/transfer'||path.startsWith('/api/transfer/')){
   return api.fetch(request,{TRANSFER_DB:env.TRANSFER_DB,TRANSFER_SANDBOX_KEY:env.TRANSFER_SANDBOX_KEY},context);
  }
  if(!path.startsWith('/book/')&&!path.startsWith('/zh/book/'))return null;
  if(url.origin!==origin||!new RegExp(`^/(?:zh/)?book/(?:manage|return|receipt)/${uuid}$`).test(path))return failure();
  if(request.method!=='GET')return failure(405);
  const lang=url.searchParams.get('lang');
  const target=new URL(lang==='zh'||path.startsWith('/zh/')?'/zh/book':'/book',origin);
  const asset=await env.ASSETS.fetch(new Request(target));
  const headers=new Headers(asset.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex');headers.set('Referrer-Policy','no-referrer');
  return new Response(asset.body,{status:asset.status,headers});
 };
}
