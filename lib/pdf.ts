// PDF documents (quotation summaries, order summaries and reports) in English and
// Hebrew. Text is laid out right-to-left for Hebrew with the Unicode bidi algorithm,
// and each character is drawn with the first embedded font that contains it.
import {PDFDocument,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import {pdfFonts} from './pdf-fonts.ts';

export type PdfBlock=
  |{kind:'heading';text:string}
  |{kind:'text';text:string;muted?:boolean;size?:number}
  |{kind:'pairs';rows:[string,string][]}
  |{kind:'table';head:string[];rows:string[][];widths?:number[]}
  |{kind:'total';label:string;value:string}
  |{kind:'space';h?:number};
export type PdfInput={lang:'en'|'he';title:string;subtitle?:string;blocks:PdfBlock[];footer?:string;landscape?:boolean;pageLabel?:(n:number,total:number)=>string};

const bidi=bidiFactory();
const ink=rgb(0.09,0.17,0.16),muted=rgb(0.38,0.44,0.43),accent=rgb(0.09,0.3,0.25),line=rgb(0.88,0.91,0.9),band=rgb(0.95,0.97,0.96);
type Fonts={regular:PDFFont[];bold:PDFFont[]};
type Glyphs={embedder:{font:{hasGlyphForCodePoint(cp:number):boolean}}};
const has=(f:PDFFont,cp:number)=>{try{return (f as unknown as Glyphs).embedder.font.hasGlyphForCodePoint(cp);}catch{return false;}};
function fontFor(chain:PDFFont[],ch:string){const cp=ch.codePointAt(0)||32;return chain.find(f=>has(f,cp))||chain[0];}
// Reorders one line from logical to visual order.
function visual(text:string,rtl:boolean){
  if(!/[֐-ࣿיִ-﷿ﹰ-﻿]/.test(text)&&!rtl)return text;
  const levels=bidi.getEmbeddingLevels(text,rtl?'rtl':'ltr');
  const chars=[...text];
  if(chars.length!==text.length)return text; // astral characters: keep logical order
  for(const [i,c] of bidi.getMirroredCharactersMap(text,levels.levels))chars[i]=c;
  for(const [start,end] of bidi.getReorderSegments(text,levels)){const seg=chars.slice(start,end+1).reverse();chars.splice(start,end-start+1,...seg);}
  return chars.join('');
}
function runs(text:string,chain:PDFFont[]){
  const out:{font:PDFFont;text:string}[]=[];
  for(const ch of text){const font=/\s/.test(ch)&&out.length?out[out.length-1].font:fontFor(chain,ch);const last=out[out.length-1];if(last&&last.font===font)last.text+=ch;else out.push({font,text:ch});}
  return out;
}
const widthOf=(text:string,size:number,chain:PDFFont[])=>runs(text,chain).reduce((w,r)=>w+r.font.widthOfTextAtSize(r.text,size),0);

export async function renderPdf(input:PdfInput):Promise<Uint8Array>{
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
  doc.setTitle(input.title);doc.setProducer('Verba');doc.setCreator('Verba');doc.setLanguage(input.lang==='he'?'he-IL':'en');
  const load=async(names:string[])=>Promise.all(names.map(n=>doc.embedFont(Buffer.from(pdfFonts[n],'base64'),{subset:true})));
  const fonts:Fonts={regular:await load(['latin-400','latin-ext-400','cyrillic-400','hebrew-400']),bold:await load(['latin-700','latin-ext-700','cyrillic-700','hebrew-700'])};
  const rtl=input.lang==='he';
  const [W,H]=input.landscape?[842,595]:[595,842];
  const M=44,inner=W-2*M;
  let page:PDFPage=doc.addPage([W,H]);let y=H-M;
  const pages:PDFPage[]=[page];
  const draw=(text:string,x:number,top:number,size:number,opts:{bold?:boolean;color?:ReturnType<typeof rgb>;align?:'start'|'end'|'center';width?:number}={})=>{
    const chain=opts.bold?fonts.bold:fonts.regular;const v=visual(text.replace(/→/g,'›'),rtl);const w=widthOf(v,size,chain);const box=opts.width??inner;
    const align=opts.align||'start';
    let cx=align==='center'?x+(box-w)/2:(align==='start')!==rtl?x:x+box-w;
    for(const r of runs(v,chain)){page.drawText(r.text,{x:cx,y:top-size,size,font:r.font,color:opts.color||ink});cx+=r.font.widthOfTextAtSize(r.text,size);}
  };
  const fit=(text:string,size:number,width:number,bold=false)=>{const chain=bold?fonts.bold:fonts.regular;if(widthOf(text,size,chain)<=width)return text;let t=text;while(t.length>1&&widthOf(t+'…',size,chain)>width)t=t.slice(0,-1);return t+'…';};
  const wrap=(text:string,size:number,width:number,bold=false)=>{const chain=bold?fonts.bold:fonts.regular;const lines:string[]=[];for(const para of text.split('\n')){let cur='';for(const word of para.split(/\s+/)){const next=cur?cur+' '+word:word;if(widthOf(next,size,chain)<=width||!cur)cur=next;else{lines.push(cur);cur=word;}}lines.push(cur);}return lines.map(l=>fit(l,size,width,bold));};
  const ensure=(h:number)=>{if(y-h<M+28){page=doc.addPage([W,H]);pages.push(page);y=H-M;return true;}return false;};
  // Header
  draw('verba.',M,y,20,{bold:true,color:accent});draw(input.title,M,y+2,10,{color:muted,align:'end'});y-=40;
  for(const l of wrap(input.title,18,inner,true)){draw(l,M,y,18,{bold:true});y-=24;}
  if(input.subtitle){for(const l of wrap(input.subtitle,10,inner)){draw(l,M,y,10,{color:muted});y-=14;}}
  y-=8;page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:1,color:line});y-=16;
  for(const b of input.blocks){
    if(b.kind==='space'){y-=b.h??10;continue;}
    if(b.kind==='heading'){ensure(40);y-=4;draw(b.text,M,y,12,{bold:true,color:accent});y-=20;continue;}
    if(b.kind==='text'){const size=b.size||10;for(const l of wrap(b.text,size,inner)){ensure(size+4);draw(l,M,y,size,{color:b.muted?muted:ink});y-=size+4;}y-=4;continue;}
    if(b.kind==='pairs'){const lw=inner*0.36;for(const [k,v] of b.rows){const lines=wrap(v||'—',10,inner-lw-8);ensure(14*lines.length);const lx=rtl?M+inner-lw:M,vx=rtl?M:M+lw+8;draw(fit(k,10,lw),lx,y,10,{color:muted,width:lw});lines.forEach((l,i)=>draw(l,vx,y-i*14,10,{width:inner-lw-8}));y-=14*lines.length+3;}y-=6;continue;}
    if(b.kind==='total'){ensure(34);page.drawRectangle({x:M,y:y-26,width:inner,height:28,color:band});draw(b.label,M+10,y-6,11,{bold:true,width:inner-20});draw(b.value,M+10,y-5,13,{bold:true,align:'end',width:inner-20,color:accent});y-=40;continue;}
    if(b.kind==='table'){
      const n=b.head.length;const weights=b.widths||b.head.map(()=>1);const sum=weights.reduce((a,c)=>a+c,0);
      const widths=weights.map(w=>inner*w/sum);const size=n>8?7.5:9;const rowH=size+8;
      const xs:number[]=[];let acc=0;for(const w of widths){xs.push(rtl?M+inner-acc-w:M+acc);acc+=w;}
      const header=()=>{page.drawRectangle({x:M,y:y-rowH+2,width:inner,height:rowH,color:band});b.head.forEach((h,i)=>draw(fit(h,size,widths[i]-6,true),xs[i]+3,y-2,size,{bold:true,width:widths[i]-6}));y-=rowH;};
      ensure(rowH*2);header();
      for(const row of b.rows){if(ensure(rowH))header();row.forEach((c,i)=>draw(fit(String(c??''),size,widths[i]-6),xs[i]+3,y-2,size,{width:widths[i]-6}));y-=rowH;page.drawLine({start:{x:M,y:y+2},end:{x:W-M,y:y+2},thickness:0.5,color:line});}
      y-=10;continue;
    }
  }
  pages.forEach((p,i)=>{page=p;const label=input.pageLabel?input.pageLabel(i+1,pages.length):`${i+1} / ${pages.length}`;p.drawLine({start:{x:M,y:M+14},end:{x:W-M,y:M+14},thickness:0.5,color:line});if(input.footer)draw(fit(input.footer,7.5,inner-70),rtl?M+70:M,M+8,7.5,{color:muted,width:inner-70,align:'start'});draw(label,rtl?M:W-M-60,M+8,7.5,{color:muted,width:60,align:rtl?'start':'end'});});
  return doc.save();
}
