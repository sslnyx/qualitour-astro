import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('a 150px gallery source retains intrinsic dimensions in the rendered lightbox',async()=>{
 const folder=await mkdtemp(resolve('.astro/lightbox-regression-'));
 try{
  const source=await readFile(process.env.PHOTO_LIGHTBOX_TEST_SOURCE || 'src/components/PhotoLightbox.tsx','utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const file=resolve(folder,'lightbox.mjs');await writeFile(file,compiled);
  const Component=(await import(pathToFileURL(file).href)).default;
  const html=renderToStaticMarkup(React.createElement(Component,{images:['/tiny.webp'],imageDimensions:[{width:150,height:150}],authorName:'Test tour',onClose:()=>{}}));
  assert.match(html,/<img[^>]*width="150"[^>]*height="150"/);
  assert.match(html,/!w-auto/);assert.match(html,/!h-auto/);assert.match(html,/!m-0/);
 }finally{await rm(folder,{recursive:true,force:true})}
});
