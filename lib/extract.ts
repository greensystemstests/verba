import {unzipSync,strFromU8} from 'fflate';
import {HttpError} from './server';
import {MAX_SOURCE} from './translation';
// Reads the text of an uploaded source document on the server. TXT, DOCX and text-based PDF
// are read directly; images and scanned PDFs have no text layer and need pasting or retyping.
const unescapeXml=(s:string)=>s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi,(_,e:string)=>{const m=e.toLowerCase();if(m==='amp')return '&';if(m==='lt')return '<';if(m==='gt')return '>';if(m==='quot')return '"';if(m==='apos')return "'";const code=m.startsWith('#x')?parseInt(m.slice(2),16):parseInt(m.slice(1),10);return Number.isFinite(code)&&code>0&&code<0x110000?String.fromCodePoint(code):'';});
const NO_TEXT='This file has no readable text, for example a scan or a photo. Paste the text instead, or upload a text-based PDF, Word or TXT file.';

export async function extractSourceText(bytes:Uint8Array,type:string,limit=MAX_SOURCE):Promise<string>{
  let text='';
  if(type==='text/plain'){try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new HttpError(422,'Save the text document as UTF-8 and upload it again.');}}
  else if(type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
    try{
      const files=unzipSync(bytes,{filter:f=>f.name==='word/document.xml'&&f.originalSize<50_000_000});
      const xml=files['word/document.xml']?strFromU8(files['word/document.xml']):'';
      // A table row becomes one line, with its cells separated by " | ", so rows stay together.
      const cellText=(cell:string)=>cell.replace(/<\/w:p>/g,' ').replace(/<w:(?:tab|br|cr)\s*\/>/g,' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
      const flat=xml.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g,row=>`<w:p><w:r><w:t>${[...row.matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>/g)].map(m=>cellText(m[0])).join(' | ')}</w:t></w:r></w:p>`);
      text=unescapeXml(flat.replace(/<w:tab\s*\/>/g,'\t').replace(/<w:(?:br|cr)\s*\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'')).replace(/\n{3,}/g,'\n\n').trim();
    }catch{throw new HttpError(422,'This Word file could not be read. Save it again as .docx and upload it.');}
  }
  else if(type==='application/pdf'){
    try{const {getDocumentProxy,extractText}=await import('unpdf');const pdf=await getDocumentProxy(bytes.slice());text=(await extractText(pdf,{mergePages:true})).text.replace(/\n{3,}/g,'\n\n').trim();}
    catch{throw new HttpError(422,'This PDF could not be read. Paste the text instead or upload a different file.');}
  }
  else throw new HttpError(422,NO_TEXT);
  if(!text.trim())throw new HttpError(422,NO_TEXT);
  if(text.length>limit)throw new HttpError(422,'Source text is too long (the limit is 20,000 characters). Split longer documents into smaller files.');
  return text;
}
