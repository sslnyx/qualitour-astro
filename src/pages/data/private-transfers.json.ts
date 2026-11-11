import type { APIRoute } from 'astro';
import { getTransferSnapshot } from '../../lib/zaui/zaui';

// Generated once with the HTML: cPanel serves this file without Node or API credentials.
export const prerender = true;
export const GET: APIRoute = () => new Response(JSON.stringify(getTransferSnapshot(), null, 2) + '\n', {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
