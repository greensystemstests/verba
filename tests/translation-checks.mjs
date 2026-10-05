import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {segmentSource,batchSegments,mechanicalChecks,validateSegments,translationInput,extractionSchema,highStakes,promptFor} from '../lib/translation.ts';
import {docx,xlsx,zip} from '../lib/office-export.ts';
import {validDocx} from '../lib/file-validation.ts';
let n=0;const check=(v,label)=>{assert(v,label);n++;};
const text=('A faithful source. אבג مرحبا 😀 '+ 'x'.repeat(1010)+'\n').repeat(7);
const source=segmentSource(text);check(source.map(s=>s.text).join('')===text,'source lossless');check(source.every(s=>s.text.length<=1000),'bounded segments');check(source.every(s=>!/[\uD800-\uDBFF]$/.test(s.text)),'surrogates preserved');check(batchSegments(source,0).reduce((n,s)=>n+s.text.length,0)<=3500,'bounded provider batch');
for(const [s,t,category] of [['Take 5 mg','Prendre 50 mg','Numbers'],['Loss -5%','Perte 5%','Numbers'],['Rate 5%','Taux 5','Numbers'],['Dose 1,000 mg','Dose 1.000 mg','Numbers'],['Take 5 mg','Prendre 5 g','Units'],['AB123 test','test AB124','Identifiers'],['Go to https://example.test','Aller au site','Identifiers']])check(mechanicalChecks([{id:'s1',text:s}],[{id:'s1',translation:t}],[]).some(i=>i.category===category),category+' '+s);
check(!mechanicalChecks([{id:'s1',text:'Dose 5 mg'}],[{id:'s1',translation:'جرعة ٥ mg'}],[]).some(i=>i.category==='Numbers'),'Arabic digits');
check(mechanicalChecks([{id:'s1',text:'No allergies'}],[{id:'s1',translation:'Aucune allergie'}],[{source_term:'allergies',target_term:'hypersensibilité'}]).some(i=>i.category==='Terminology'),'glossary gate');
for(const result of [[],[{id:'s2',translation:'text'}],[{id:'s1',translation:' '}],[{id:'s1',translation:'a'},{id:'s1',translation:'b'}]]){assert.throws(()=>validateSegments([{id:'s1',text:'source'}],result));n++;}
const p={requestKey:crypto.randomUUID(),title:'Test',source:'English',target:'French',sector:'Medical',tone:'Faithful',text:'Test source',consent:true};
check(translationInput.safeParse(p).success,'valid request');for(const patch of [{target:'English'},{consent:false},{tone:'Brand voice'},{fileId:crypto.randomUUID()},{text:' '.repeat(5)},{text:'a'.repeat(20001)}])check(!translationInput.safeParse({...p,...patch}).success,'invalid request');
check(!extractionSchema.safeParse({text:' ',complete:true,detectedLanguage:'English',issues:[]}).success,'blank extraction');check(highStakes('Medical')&&highStakes('Legal')&&highStakes('Finance')&&!highStakes('Marketing'),'review by sector');check(promptFor(p,true).includes('negations')&&promptFor(p,true).includes('SOURCE'),'medical independent source review');
const word=docx('שלום <test>','Line 1\nDose ٥ mg & <script>','AI draft',true);check(validDocx(word),'valid DOCX');check(!validDocx(new TextEncoder().encode('PKgarbage')),'invalid zip');check(!validDocx(zip({'[Content_Types].xml':'x','word/document.xml':'x','word/vbaProject.bin':'evil'})),'macro rejected');check(!validDocx(zip({'[Content_Types].xml':'x','word/document.xml':'x','../evil':'x'})),'traversal rejected');
await writeFile('/tmp/verba-test.docx',word);await writeFile('/tmp/verba-test.xlsx',xlsx([['Project','Amount'],['=SUM(A1:A2)','שלום & < >']]));
console.log(`PASS: ${n} translation integrity, validation and format assertions`);
