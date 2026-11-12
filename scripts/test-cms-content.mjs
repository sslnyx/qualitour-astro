import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogue, contentHash, renderRichText, mediaUrl, normalizeCmsMediaReferences, sortToursByPublishedAt } from '../src/lib/cms/legacy-adapter.mjs';
import { createCmsReader, CMS_ORIGIN, normalizeCmsMediaUrl, resolveCmsOrigin } from '../src/lib/cms/read-client.mjs';

const block = text => [{ _type: 'block', children: [{ _type: 'span', text }] }];
function fixture() {
  const data = { source_key: 'wp-en-12', title: 'A & B', tour_code:'', summary: 'Summary', price: '500', currency: 'CAD', duration: '2 Days', location: 'Vancouver', overview: block('Original'), itinerary: [], itinerary_continued: [], additional_info: [], faq: [], gallery: [] };
  const tour = { id: 12, status: 'publish', slug: 'original-tour', title: { rendered: 'A &amp; B' }, excerpt: { rendered: '<p>Summary</p>' }, content: { rendered: '<table><tr><td>Original</td></tr></table>' }, featured_media: 5, tour_meta: { price: '500', ribbon: 'Popular', brochure: { url: 'https://qualitour.ca/original.pdf' } }, tour_terms: { destinations: [{ id: 8, slug: 'canada', name: 'Canada' }] }, goodlayers_data: { sections: [{ value: { id: 'overview' }, items: [{ type: 'text-box', value: { content: '<table>Original</table>' } }] }] } };
  const baseline = Object.fromEntries(Object.entries(data).map(([k,v])=>[k,contentHash(v)]));
  const compat = { schema: 1, locales: { en: { tours: { 'wp-en-12': { tour, baseline, date: '2025-01-01' } }, terms: { destinations: [{ id: 8, slug: 'canada', name: 'Canada', parent: 0 }, { id: 9, slug: 'private-term', name: 'Private', parent: 0 }] } } } };
  return { data, tour, compat, entry: { id: 'cms-12', locale: 'en', status: 'published', publishedAt:'2026-11-12T00:00:00Z', data } };
}
test('unchanged CMS blocks retain original tables, URLs and presentation metadata', () => {
  const f=fixture(); const {tours,terms}=buildCatalogue([f.entry],f.compat,'en');
  assert.equal(tours[0].id,12); assert.equal(tours[0].slug,'original-tour');
  assert.deepEqual(tours[0].goodlayers_data.sections,f.tour.goodlayers_data.sections);
  assert.equal(tours[0].content.rendered,f.tour.content.rendered);
  assert.equal(tours[0].tour_meta.ribbon,'Popular');
  assert.equal(terms.destinations.find(term=>term.id===8).count,1);
  assert.equal(terms.destinations.find(term=>term.id===9).count,0);
});
test('current CMS edits win without leaking raw/private fields or stale HTML/discounts', () => {
  const f=fixture(); Object.assign(f.data,{title:'<New>',price:'600',overview:block('Edited <safe>'),hero:{meta:{storageKey:'image.jpg'}},tour_classifications:{basis:'PRIVATE'}});
  f.entry.authorId='PRIVATE'; f.tour.tour_meta['tourmaster-tour-discount']='true'; f.tour.tour_meta['tour-price-discount-text']='200';
  const tour=buildCatalogue([f.entry],f.compat,'en').tours[0];
  assert.equal(tour.title.rendered,'&lt;New&gt;'); assert.equal(tour.tour_meta['tour-price-text'],'600');
  assert.equal(tour.tour_meta['tour-price-discount-text'],undefined);
  assert.equal(tour.content.rendered,'<p>Edited &lt;safe&gt;</p>');
  assert.equal(tour.goodlayers_data.sections.length,0);
  assert.equal(tour.featured_image_url,`${CMS_ORIGIN}/_emdash/api/media/file/image.jpg`);
  assert.doesNotMatch(JSON.stringify(tour),/PRIVATE|authorId|source_key|tour_classifications/);
});
test('only current published, locale-matched entries appear; unknown/duplicate identities fail', () => {
  const f=fixture();
  assert.throws(()=>buildCatalogue([{...f.entry,status:'draft'}],f.compat,'en'),/published/);
  assert.throws(()=>buildCatalogue([{...f.entry,locale:'zh'}],f.compat,'en'),/locale/);
  assert.throws(()=>buildCatalogue([f.entry,f.entry],f.compat,'en'),/Duplicate/);
  assert.throws(()=>buildCatalogue([{...f.entry,data:{...f.data,source_key:'wp-en-99'}}],f.compat,'en'),/compatibility/);
  assert.throws(()=>buildCatalogue([],f.compat,'en'),/empty/);
});
test('rich text escapes content, rejects active links and never passes HTML/custom embeds through', () => {
  assert.throws(()=>renderRichText([{_type:'html',html:'<script>bad</script>'}]),/Unsupported CMS rich-text/);
  const html=renderRichText([{_type:'block',markDefs:[{_key:'a',_type:'link',href:'javascript:alert(1)'}],children:[{_type:'span',text:'<X>',marks:['a','strong']}]}]);
  assert.equal(html,'<p><strong>&lt;X&gt;</strong></p>');
  assert.equal(mediaUrl('//evil.test/x'),undefined); assert.equal(mediaUrl('javascript:x'),undefined);
  assert.equal(mediaUrl({meta:{storageKey:'../private'}}),undefined);
});
const ok = data => new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}});
test('reader requests published tours only, pages fully and keeps token on the exact origin', async () => {
  const calls=[];
  const reader=createCmsReader({token:'TEST-SECRET',fetchImpl:async(url,options)=>{
    calls.push({url:new URL(url),options});
    const page=Number(new URL(url).searchParams.get('page'));
    return ok({total:2,items:[{id:String(page),locale:'en',status:'published',data:{title:'Public'}}]});
  }});
  assert.equal((await reader.listPublished('en',{limit:1})).length,2);
  for(const {url,options} of calls){assert.equal(url.origin,CMS_ORIGIN);assert.equal(url.searchParams.get('status'),'published');assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer TEST-SECRET');}
});
test('reader refuses redirects, partial lists, duplicate pages and concurrent catalogue drift', async () => {
  const read=fetchImpl=>createCmsReader({token:'TEST-SECRET',fetchImpl}).listPublished('en',{limit:1});
  await assert.rejects(read(async()=>new Response('',{status:302,headers:{Location:'https://evil.test'}})),/302/);
  await assert.rejects(read(async()=>ok({total:2,items:[]})),/Incomplete/);
  await assert.rejects(read(async()=>ok({total:2,items:[{id:'same',locale:'en',status:'published',data:{}}]})),/Duplicate/);
  let page=0;await assert.rejects(read(async()=>ok({total:2+page++,items:[{id:String(page),locale:'en',status:'published',data:{}}]})),/changed/);
});
test('authentication errors never include credentials or response bodies', async () => {
  await assert.rejects(createCmsReader({token:'TEST-SECRET',fetchImpl:async()=>new Response('TEST-SECRET',{status:401})}).listPublished('en'),error=>!error.message.includes('TEST-SECRET')&&/401/.test(error.message));
});
test('CI requires EMDASH_TOKEN even when CLI fallback is explicitly requested', async () => {
  const previous = process.env.CI;
  process.env.CI = '1';
  try {
    const reader = createCmsReader({ allowCli: true, credentialPath: '/unused/cli-auth.json' });
    await assert.rejects(reader.listPublished('en'), /requires the private EMDASH_TOKEN/);
  } finally {
    if (previous === undefined) delete process.env.CI;
    else process.env.CI = previous;
  }
});
test('absent fields and unresolved media stop publication; explicit empty arrays clear sections',()=>{
  const f=fixture();delete f.data.overview;
  assert.throws(()=>buildCatalogue([f.entry],f.compat,'en'),/field overview/);
  f.data.overview=[];assert.equal(buildCatalogue([f.entry],f.compat,'en').tours[0].content.rendered,'');
  f.data.hero='UNRESOLVED-MEDIA-ID';assert.throws(()=>buildCatalogue([f.entry],f.compat,'en'),/Invalid CMS media/);
});
test('a same-total publish/unpublish swap between passes is rejected',async()=>{
  let call=0;
  const reader=createCmsReader({token:'TEST',fetchImpl:async()=>ok({total:1,items:[{id:++call===1?'old':'new',locale:'en',status:'published',version:1,data:{}}]})});
  await assert.rejects(reader.listPublished('en'),/changed between/);
});
test('homepage latest selection uses CMS publication dates before limiting, independently of IDs or legacy order',()=>{
  const tours=[{id:900,date:'2025-01-01T00:00:00Z'},{id:2,date:'2026-11-12T01:00:00+01:00'},{id:1,date:'2026-11-12T00:30:00Z'}];
  assert.deepEqual(sortToursByPublishedAt(tours).slice(0,2).map(t=>t.id),[1,2]);
  assert.deepEqual(sortToursByPublishedAt(tours,'asc').map(t=>t.id),[900,2,1]);
  assert.deepEqual(tours.map(t=>t.id),[900,2,1]);
  const f=fixture();assert.equal(buildCatalogue([f.entry],f.compat,'en').tours[0].date,'2026-11-12T00:00:00.000Z');
  delete f.entry.publishedAt;assert.throws(()=>buildCatalogue([f.entry],f.compat,'en'),/publication date/);
});

test('CMS origin accepts only the approved old, renamed, and branded origins', () => {
  for (const origin of [
    'https://qualitour-cms-free-test.qualitour.workers.dev',
    'https://qualitour.qualitour.workers.dev',
    'https://qualitour.ca',
  ]) assert.equal(resolveCmsOrigin(origin), origin);
  for (const origin of [
    'http://qualitour.qualitour.workers.dev',
    'https://qualitour.qualitour.workers.dev.evil.test',
    'https://qualitour.qualitour.workers.dev/path',
    'https://user@qualitour.qualitour.workers.dev',
    'https://example.test',
  ]) assert.throws(() => resolveCmsOrigin(origin), /QUALITOUR_CMS_ORIGIN/);
});

test('stale CMS media hosts normalize in a derived presentation without mutating source content', () => {
  const old = 'https://qualitour-cms-free-test.qualitour.workers.dev';
  const current = 'https://qualitour.qualitour.workers.dev';
  const source = {
    featured_image_url: `${old}/_emdash/api/media/file/hero.jpg`,
    tour_meta: { brochure: { url: `${old}/_emdash/api/media/file/brochure.pdf?download=1` } },
    goodlayers_data: {
      tour_gallery: [{ url: `${old}/_emdash/api/media/file/gallery.jpg#large` }],
      sections: [{ value: { content: `<img src="${old}/_emdash/api/media/file/inline.jpg"><a href="${old}/ordinary-page">Keep</a>` } }],
    },
    external: 'https://supplier.example/photo.jpg',
  };
  const before = structuredClone(source);
  const presentation = normalizeCmsMediaReferences(source, current);

  assert.deepEqual(source, before);
  assert.equal(presentation.featured_image_url, `${current}/_emdash/api/media/file/hero.jpg`);
  assert.equal(presentation.tour_meta.brochure.url, `${current}/_emdash/api/media/file/brochure.pdf?download=1`);
  assert.equal(presentation.goodlayers_data.tour_gallery[0].url, `${current}/_emdash/api/media/file/gallery.jpg#large`);
  assert.match(presentation.goodlayers_data.sections[0].value.content, new RegExp(`${current}/_emdash/api/media/file/inline\\.jpg`));
  assert.match(presentation.goodlayers_data.sections[0].value.content, new RegExp(`${old}/ordinary-page`));
  assert.equal(presentation.external, source.external);
  assert.equal(normalizeCmsMediaUrl(`${old}/_emdash/api/media/file/photo.jpg`, current), `${current}/_emdash/api/media/file/photo.jpg`);
});
