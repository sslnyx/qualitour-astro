import type { APIRoute } from 'astro';
import { GET as passthrough } from '@astrojs/cloudflare/image-passthrough-endpoint';
import { cmsMediaRedirect } from '../lib/cms/media-passthrough.mjs';

export const prerender=false;
export const GET: APIRoute=async(context)=>{
  const target=cmsMediaRedirect(context.url.searchParams.get('href'),context.url.origin);
  // This trial intentionally serves original bytes. A redirect lets the normal
  // media endpoint stream R2 without a Worker fetching its own workers.dev URL.
  if(target)return new Response(null,{status:307,headers:{Location:target,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  return passthrough(context);
};
