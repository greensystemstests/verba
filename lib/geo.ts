// Country, dialling-code and city lists for address and phone fields.
import {getCountries,getCountryCallingCode,parsePhoneNumberFromString,type CountryCode} from 'libphonenumber-js/min';

export const countryCodes=getCountries();
export function countryName(code:string,lang:'en'|'he'='en'){
  try{return new Intl.DisplayNames([lang],{type:'region'}).of(code)||code;}catch{return code;}
}
export function countryOptions(lang:'en'|'he'='en'){
  return countryCodes.map(c=>({value:c,label:countryName(c,lang)})).sort((a,b)=>a.label.localeCompare(b.label,lang));
}
export function dialCode(country:string){try{return '+'+getCountryCallingCode(country as CountryCode);}catch{return '';}}
export function dialOptions(lang:'en'|'he'='en'){
  const seen=new Set<string>();
  return countryOptions(lang).flatMap(c=>{const d=dialCode(c.value);if(!d||seen.has(d+c.value))return [];seen.add(d+c.value);return [{value:d,label:`${d} ${c.label}`,country:c.value}];});
}
// Returns the number in international E.164 form, or null when it is not a valid phone number.
export function normalizePhone(prefix:string,number:string){
  const digits=(number||'').replace(/[^\d+]/g,'');
  if(!digits)return null;
  const full=digits.startsWith('+')?digits:(prefix||'').replace(/[^\d+]/g,'')+digits.replace(/^0+/,'');
  const parsed=parsePhoneNumberFromString(full.startsWith('+')?full:'+'+full);
  return parsed&&parsed.isValid()?parsed.number:null;
}
export function splitPhone(e164:string|null|undefined){const p=parsePhoneNumberFromString(e164||'');return p?{prefix:'+'+p.countryCallingCode,number:String(p.nationalNumber)}:{prefix:'+972',number:e164||''};}
export const displayPhone=(e164:string)=>{const p=parsePhoneNumberFromString(e164||'');return p?p.formatInternational():e164;};

// Cities in Israel (the office country). Other countries use a free city field with suggestions.
export const israelCities:[string,string][]=[
  ['Jerusalem','ירושלים'],['Tel Aviv-Yafo','תל אביב-יפו'],['Haifa','חיפה'],['Rishon LeZion','ראשון לציון'],['Petah Tikva','פתח תקווה'],
  ['Ashdod','אשדוד'],['Netanya','נתניה'],['Beersheba','באר שבע'],['Bnei Brak','בני ברק'],['Holon','חולון'],['Ramat Gan','רמת גן'],
  ['Rehovot','רחובות'],['Ashkelon','אשקלון'],['Bat Yam','בת ים'],['Beit Shemesh','בית שמש'],['Kfar Saba','כפר סבא'],['Herzliya','הרצליה'],
  ['Hadera','חדרה'],['Modi\'in-Maccabim-Re\'ut','מודיעין-מכבים-רעות'],['Nazareth','נצרת'],['Lod','לוד'],['Ramla','רמלה'],['Ra\'anana','רעננה'],
  ['Rahat','רהט'],['Hod HaSharon','הוד השרון'],['Givatayim','גבעתיים'],['Kiryat Ata','קריית אתא'],['Nahariya','נהריה'],['Kiryat Gat','קריית גת'],
  ['Umm al-Fahm','אום אל-פחם'],['Eilat','אילת'],['Rosh HaAyin','ראש העין'],['Afula','עפולה'],['Ness Ziona','נס ציונה'],['Akko','עכו'],
  ['Elad','אלעד'],['Ramat HaSharon','רמת השרון'],['Karmiel','כרמיאל'],['Yavne','יבנה'],['Tiberias','טבריה'],['Tayibe','טייבה'],
  ['Kiryat Motzkin','קריית מוצקין'],['Shefa-\'Amr','שפרעם'],['Nof HaGalil','נוף הגליל'],['Kiryat Yam','קריית ים'],['Kiryat Bialik','קריית ביאליק'],
  ['Or Yehuda','אור יהודה'],['Ma\'ale Adumim','מעלה אדומים'],['Netivot','נתיבות'],['Dimona','דימונה'],['Sderot','שדרות'],['Kiryat Ono','קריית אונו'],
  ['Yehud-Monosson','יהוד-מונוסון'],['Zikhron Ya\'akov','זכרון יעקב'],['Safed','צפת'],['Kiryat Shmona','קריית שמונה'],['Arad','ערד'],
  ['Ofakim','אופקים'],['Sakhnin','סח\'נין'],['Migdal HaEmek','מגדל העמק'],['Tirat Carmel','טירת כרמל'],['Or Akiva','אור עקיבא'],
  ['Kfar Yona','כפר יונה'],['Gedera','גדרה'],['Even Yehuda','אבן יהודה'],['Caesarea','קיסריה'],['Pardes Hanna-Karkur','פרדס חנה-כרכור'],
  ['Mevaseret Zion','מבשרת ציון'],['Shoham','שוהם'],['Ariel','אריאל'],['Kiryat Malakhi','קריית מלאכי'],['Yokneam Illit','יקנעם עילית'],
];
export const cityLabel=(city:string,lang:'en'|'he')=>lang==='he'?(israelCities.find(c=>c[0]===city)?.[1]||city):city;
