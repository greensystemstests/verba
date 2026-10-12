// Every language DeepL offers, by the English name Verba shows. `source` is the code for the text to translate,
// `target` the code for the result (some targets are variants). Languages outside DeepL's core set are "beta" at DeepL:
// they need a switch in the request and have no formality setting or glossaries.
export type DeeplLanguage={name:string;source:string;target:string};
const same=(name:string,code:string):DeeplLanguage=>({name,source:code,target:code});
export const deeplLanguages:DeeplLanguage[]=[
  same('Acehnese','ACE'),same('Afrikaans','AF'),same('Albanian','SQ'),same('Arabic','AR'),same('Aragonese','AN'),same('Armenian','HY'),same('Assamese','AS'),same('Aymara','AY'),same('Azerbaijani','AZ'),
  same('Bashkir','BA'),same('Basque','EU'),same('Belarusian','BE'),same('Bengali','BN'),same('Bhojpuri','BHO'),same('Bosnian','BS'),same('Breton','BR'),same('Bulgarian','BG'),same('Burmese','MY'),
  same('Cantonese','YUE'),same('Catalan','CA'),same('Cebuano','CEB'),same('Central Kurdish (Sorani)','CKB'),{name:'Chinese',source:'ZH',target:'ZH-HANS'},{name:'Chinese (Traditional)',source:'ZH',target:'ZH-HANT'},same('Croatian','HR'),same('Czech','CS'),
  same('Dari','PRS'),same('Danish','DA'),same('Dutch','NL'),{name:'English',source:'EN',target:'EN-US'},{name:'English (British)',source:'EN',target:'EN-GB'},same('Esperanto','EO'),same('Estonian','ET'),
  same('Finnish','FI'),same('French','FR'),{name:'French (Canadian)',source:'FR',target:'FR-CA'},same('Galician','GL'),same('Georgian','KA'),same('German','DE'),{name:'German (Swiss)',source:'DE',target:'DE-CH'},same('Goan Konkani','GOM'),same('Greek','EL'),same('Guarani','GN'),same('Gujarati','GU'),
  same('Haitian Creole','HT'),same('Hausa','HA'),same('Hebrew','HE'),same('Hindi','HI'),same('Hungarian','HU'),same('Icelandic','IS'),same('Igbo','IG'),same('Indonesian','ID'),same('Irish','GA'),same('Italian','IT'),
  same('Japanese','JA'),same('Javanese','JV'),same('Kapampangan','PAM'),same('Kazakh','KK'),same('Korean','KO'),same('Kyrgyz','KY'),same('Latin','LA'),same('Latvian','LV'),same('Lingala','LN'),same('Lithuanian','LT'),same('Lombard','LMO'),same('Luxembourgish','LB'),
  same('Macedonian','MK'),same('Maithili','MAI'),same('Malagasy','MG'),same('Malay','MS'),same('Malayalam','ML'),same('Maltese','MT'),same('Maori','MI'),same('Marathi','MR'),same('Mongolian','MN'),
  same('Nepali','NE'),same('Northern Kurdish (Kurmanji)','KMR'),same('Norwegian (Bokmål)','NB'),same('Occitan','OC'),same('Oromo','OM'),same('Pangasinan','PAG'),same('Pashto','PS'),same('Persian','FA'),same('Polish','PL'),
  {name:'Portuguese',source:'PT',target:'PT-PT'},{name:'Portuguese (Brazilian)',source:'PT',target:'PT-BR'},same('Punjabi','PA'),same('Quechua','QU'),same('Romanian','RO'),same('Russian','RU'),
  same('Sanskrit','SA'),same('Serbian','SR'),same('Sesotho','ST'),same('Sicilian','SCN'),same('Slovak','SK'),same('Slovenian','SL'),{name:'Spanish',source:'ES',target:'ES'},{name:'Spanish (Latin American)',source:'ES',target:'ES-419'},same('Sundanese','SU'),same('Swahili','SW'),same('Swedish','SV'),
  same('Tagalog','TL'),same('Tajik','TG'),same('Tamil','TA'),same('Tatar','TT'),same('Telugu','TE'),same('Thai','TH'),same('Tsonga','TS'),same('Tswana','TN'),same('Turkish','TR'),same('Turkmen','TK'),
  same('Ukrainian','UK'),same('Urdu','UR'),same('Uzbek','UZ'),same('Vietnamese','VI'),same('Welsh','CY'),same('Wolof','WO'),same('Xhosa','XH'),same('Yiddish','YI'),same('Zulu','ZU'),
];
export const deeplLanguageNames=deeplLanguages.map(l=>l.name);
const byName=new Map(deeplLanguages.map(l=>[l.name,l]));
export const deeplLanguage=(name:string)=>byName.get(name);
// Languages DeepL has long offered as standard (the rest, and Hebrew, are beta).
const CORE=new Set(['AR','BG','CS','DA','DE','EL','EN','ES','ET','FI','FR','HU','ID','IT','JA','KO','LT','LV','NB','NL','PL','PT','RO','RU','SK','SL','SV','TR','UK','ZH']);
export const isBetaLanguage=(name:string)=>{const l=byName.get(name);return !!l&&!CORE.has(l.source);};
// Languages written right to left.
export const rightToLeft=new Set(['Arabic','Hebrew','Persian','Urdu','Pashto','Yiddish','Dari','Central Kurdish (Sorani)']);
