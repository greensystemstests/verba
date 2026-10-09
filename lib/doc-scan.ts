// Upload safety scan and automatic word count ("accurate analysis", spec 1.1).
// The built-in scan rejects active content: PDF scripts, launch actions, embedded
// files and XFA forms; Word macros, ActiveX, embedded objects and external templates.
// An external antivirus API (Cloudmersive) is added when CLOUDMERSIVE_API_KEY is set.
import {PDFDocument,PDFDict,PDFName,PDFStream,PDFRawStream} from 'pdf-lib';
import {unzipSync,strFromU8} from 'fflate';
import {sourceWordCount} from './words.ts';

export type ScanResult={ok:true}|{ok:false;reason:string};
const risky=['JavaScript','JS','Launch','EmbeddedFile','EmbeddedFiles','RichMedia','XFA','ImportData'];
async function scanPdf(bytes:Uint8Array):Promise<ScanResult>{
  let doc:PDFDocument;
  try{doc=await PDFDocument.load(bytes,{ignoreEncryption:true,updateMetadata:false,throwOnInvalidObject:false});}
  catch{return {ok:false,reason:'The PDF could not be read. Save it again as a standard PDF and retry.'};}
  if(doc.isEncrypted)return {ok:false,reason:'Password-protected PDFs cannot be processed. Remove the password and upload again.'};
  for(const [,obj] of doc.context.enumerateIndirectObjects()){
    const dict=obj instanceof PDFDict?obj:obj instanceof PDFStream||obj instanceof PDFRawStream?obj.dict:null;
    if(!dict)continue;
    for(const key of dict.keys()){const name=key.decodeText();if(risky.includes(name))return {ok:false,reason:'The PDF contains scripts, embedded files or other active content and was rejected for safety.'};}
    const type=dict.get(PDFName.of('S'))||dict.get(PDFName.of('Type'));
    if(type instanceof PDFName&&risky.includes(type.decodeText()))return {ok:false,reason:'The PDF contains scripts, embedded files or other active content and was rejected for safety.'};
  }
  return {ok:true};
}
function scanDocx(bytes:Uint8Array):ScanResult{
  try{
    const files=unzipSync(bytes,{filter:f=>f.name.endsWith('.rels')&&f.originalSize<2_000_000});
    for(const [name,data] of Object.entries(files)){
      const xml=strFromU8(data);
      if(/TargetMode=["']External["']/.test(xml)&&/(attachedTemplate|oleObject|subDocument|frame)/i.test(xml))return {ok:false,reason:`The Word document links to external content (${name}) and was rejected for safety.`};
      if(/relationships\/(oleObject|package|control|vbaProject)/i.test(xml))return {ok:false,reason:'The Word document contains embedded objects or macros and was rejected for safety.'};
    }
    return {ok:true};
  }catch{return {ok:false,reason:'The Word document could not be read.'};}
}
async function externalScan(bytes:Uint8Array,name:string):Promise<ScanResult>{
  const key=process.env.CLOUDMERSIVE_API_KEY;if(!key)return {ok:true};
  try{const form=new FormData();form.set('inputFile',new Blob([bytes.slice().buffer]),name);
    const r=await fetch('https://api.cloudmersive.com/virus/scan/file',{method:'POST',headers:{Apikey:key},body:form,signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new Error(String(r.status));const b=await r.json() as {CleanResult?:boolean};
    return b.CleanResult===true?{ok:true}:{ok:false,reason:'The antivirus scan flagged this file. It was not saved.'};}
  catch{return {ok:false,reason:'The antivirus scan is temporarily unavailable. Please try again in a few minutes.'};}
}
export const externalScannerEnabled=()=>!!process.env.CLOUDMERSIVE_API_KEY;
export async function scanUpload(bytes:Uint8Array,ext:string,name:string):Promise<ScanResult>{
  if(ext==='txt'&&bytes.includes(0))return {ok:false,reason:'The text file contains binary data and was rejected.'};
  const local=ext==='pdf'?await scanPdf(bytes):ext==='docx'?scanDocx(bytes):{ok:true} as ScanResult;
  if(!local.ok)return local;
  return externalScan(bytes,name);
}

export type DocStats={words:number;pages:number}|null;
function decodeText(bytes:Uint8Array){
  if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le').decode(bytes.slice(2));
  if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be').decode(bytes.slice(2));
  return new TextDecoder('utf-8').decode(bytes);
}
// Counts words in TXT, DOCX and PDF files. Scanned images have no text layer and return null.
export async function documentStats(bytes:Uint8Array,ext:string):Promise<DocStats>{
  try{
    if(ext==='txt'){const words=sourceWordCount(decodeText(bytes));return {words,pages:Math.max(1,Math.ceil(words/250))};}
    if(ext==='docx'){
      const files=unzipSync(bytes,{filter:f=>(f.name==='word/document.xml'||f.name==='docProps/app.xml'||/^word\/(footnotes|endnotes)\.xml$/.test(f.name))&&f.originalSize<50_000_000});
      const text=['word/document.xml','word/footnotes.xml','word/endnotes.xml'].map(n=>files[n]?strFromU8(files[n]):'').join(' ')
        .replace(/<w:tab\/>|<w:br\/>|<\/w:p>/g,' ').replace(/<[^>]+>/g,'').replace(/&(amp|lt|gt|quot|apos);/g,' ');
      const words=sourceWordCount(text);
      const declared=Number(files['docProps/app.xml']?strFromU8(files['docProps/app.xml']).match(/<Pages>(\d+)<\/Pages>/)?.[1]:0);
      return {words,pages:declared>0?declared:Math.max(1,Math.ceil(words/250))};
    }
    if(ext==='pdf'){
      const {getDocumentProxy,extractText}=await import('unpdf');
      const pdf=await getDocumentProxy(bytes.slice());
      const {totalPages,text}=await extractText(pdf,{mergePages:true});
      const words=sourceWordCount(text);
      return words?{words,pages:totalPages}:{words:0,pages:totalPages};
    }
  }catch{return null;}
  return null;
}
