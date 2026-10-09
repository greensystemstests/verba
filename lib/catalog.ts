// Services, order data and pricing for the online ordering system (spec 1.1.4,
// slides 1.1–1.8). Prices are calculated in EUR and stored in cents.
import { z } from 'zod';

export const sectors = ['General','Medical','Legal','Finance','Technology','Marketing'] as const;
export const languages = ['English','Hebrew','Arabic','French','German','Spanish','Italian','Portuguese','Russian','Bulgarian','Ukrainian','Chinese','Japanese'] as const;
export const services = ['Document translation','Translation + notary','Translation validation','Certificate translation','Certificate + notary','Notary only','Additional services','Courier only'] as const;
export type Service = typeof services[number];
export const statuses = ['Draft','Submitted','In review','Translating','Notary review','Ready','Delivered','Cancelled'] as const;
export const levels = ['Professional','Student','Machine draft'] as const;
export type Level = typeof levels[number];
export const urgencies = ['Standard','Priority','Express'] as const;
export const notaryTypes = ['Translation certification','Signature verification','Certified copy','Affidavit'] as const;
export const formats = ['PDF','DOCX','TXT','JPG','PNG'] as const;
export const subjects = ['Document','Website','Software or app','Marketing material','Certificate','Presentation','Other'] as const;
export const documentTypes = ['Document','Medical report','Clinical study','Contract','Financial report','Technical manual','Website','Other'] as const;
export const certificateTypes = ['Birth certificate','Marriage certificate','Divorce certificate','Death certificate','Diploma','Academic transcript','ID card','Passport','Driving licence','Police certificate','Name change certificate','Other certificate'] as const;
export const extraServices = ['Graphics and DTP','Quality assurance (QA)','Localization testing','Subtitles','Voice-over','Transcription','Other'] as const;
export const timeWindows = ['Any time','08:00–12:00','12:00–16:00','16:00–20:00'] as const;
export const deliveryTimings = ['Standard','Next day','Same day'] as const;
export const paymentStates = ['Not requested','Awaiting payment','Paid','Refunded'] as const;
export const currencies = ['EUR','USD','ILS','GBP','CHF','CAD','AUD','JPY','CNY','PLN','SEK','BGN'] as const;
export type Currency = typeof currencies[number];

const translatingServices: readonly Service[] = ['Document translation','Translation + notary','Translation validation','Certificate translation','Certificate + notary'];
export const translates = (s: string) => translatingServices.includes(s as Service);
export const isCertificate = (s: string) => s === 'Certificate translation' || s === 'Certificate + notary';
// Notary is always part of 1.2, 1.5 and 1.6, and optional for validation (1.3).
export const notaryRequired = (s: string) => s === 'Translation + notary' || s === 'Certificate + notary' || s === 'Notary only';
export const notaryOptional = (s: string) => s === 'Translation validation';
export const hasNotary = (o: { service: string; notary?: boolean }) => notaryRequired(o.service) || (notaryOptional(o.service) && !!o.notary);
export const hasCourier = (o: { service: string; collect?: boolean; deliver?: boolean }) => o.service === 'Courier only' || !!o.collect || !!o.deliver;
export const levelsFor = (s: string): readonly Level[] => s === 'Document translation' ? levels : s === 'Translation validation' ? [] : ['Professional','Student'];

export const details = [
 {name:'Medical',tag:'Every detail matters.',text:'Medical records, clinical research and patient information. Preserve terminology, dosage and meaning.',icon:'medical'},
 {name:'Legal',tag:'Keep the intent intact.',text:'Contracts, court documents and certificates, with a clear route to notarial review.',icon:'legal'},
 {name:'Finance',tag:'Precision beyond the numbers.',text:'Financial reports, investor communications and disclosures with consistent terminology.',icon:'finance'},
 {name:'Technology',tag:'Make complexity clear.',text:'Software, technical documentation and product guides that speak your users’ language.',icon:'technology'},
 {name:'Marketing',tag:'The same idea. A new audience.',text:'Websites, campaigns and brand content adapted for the people you want to reach.',icon:'marketing'},
];

// Structured address (spec: country and city lists, street, number, floor, apartment, zip,
// contact with phone prefix, time range, remarks). Country is an ISO 3166 code.
export const addressSchema = z.object({
  country: z.string().max(80).default('IL'),
  city: z.string().max(100).default(''),
  street: z.string().max(200).default(''),
  number: z.string().max(20).default(''),
  floor: z.string().max(20).default(''),
  apartment: z.string().max(20).default(''),
  postcode: z.string().max(30).default(''),
  contact: z.string().max(100).default(''),
  phonePrefix: z.string().max(8).default('+972'),
  phone: z.string().max(40).default(''),
  window: z.string().max(100).default('Any time'),
  notes: z.string().max(500).default(''),
});
export type Address = z.infer<typeof addressSchema>;
const countryNames: Record<string,string> = {israel:'IL',bulgaria:'BG',italy:'IT','united kingdom':'GB',uk:'GB',france:'FR',germany:'DE',spain:'ES','united states':'US',usa:'US'};
// Older orders stored the country name and a single street line.
export function normalizeAddress(a: unknown): Address {
  const raw = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
  const country = String(raw.country || 'IL');
  const code = /^[A-Z]{2}$/.test(country) ? country : countryNames[country.toLowerCase()] || country.slice(0, 80);
  return addressSchema.parse({ ...raw, country: code, window: raw.window === '09:00–17:00' ? 'Any time' : raw.window ?? 'Any time' });
}
export const addressLine = (a: Address) => [a.street && [a.street, a.number].filter(Boolean).join(' '), a.floor && `floor ${a.floor}`, a.apartment && `apt ${a.apartment}`, a.city, a.postcode].filter(Boolean).join(', ');

export const documentSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.string().max(100),
  pages: z.number().int().min(1).max(10000),
  words: z.number().int().min(0).max(1000000),
  format: z.enum(formats),
  fileIds: z.array(z.string().uuid()).max(10).default([]),
  // Identical documents (e.g. several identical certificates) ordered together.
  quantity: z.number().int().min(1).max(50).default(1),
  counted: z.boolean().default(false),
});
export type DocumentInput = z.infer<typeof documentSchema>;

const orderFields = z.object({
  title: z.string().max(160).default(''),
  service: z.enum(services),
  sector: z.enum(sectors).default('General'),
  subject: z.enum(subjects).default('Document'),
  description: z.string().max(2000).default(''),
  source: z.enum(languages).default('English'),
  targets: z.array(z.enum(languages)).max(8).default([]),
  documents: z.array(documentSchema).max(20).default([]),
  level: z.enum(levels).default('Professional'),
  validation: z.boolean().default(false),
  dtp: z.boolean().default(false),
  urgency: z.enum(urgencies).default('Standard'),
  notary: z.boolean().default(false),
  notaryType: z.enum(notaryTypes).default('Translation certification'),
  notaryUrgency: z.enum(urgencies).default('Standard'),
  notaryCountry: z.string().max(2).default('IL'),
  copies: z.number().int().min(1).max(20).default(1),
  physical: z.boolean().default(false),
  collect: z.boolean().default(false),
  deliver: z.boolean().default(false),
  roundTrip: z.boolean().default(false),
  pickup: addressSchema.default({}),
  dropoff: addressSchema.default({}),
  timing: z.enum(deliveryTimings).default('Standard'),
  invoice: z.boolean().default(false),
  extraType: z.enum(extraServices).default('Other'),
  freeText: z.string().max(5000).default(''),
  firstName: z.string().max(60).default(''),
  lastName: z.string().max(60).default(''),
  name: z.string().max(120).default(''),
  email: z.string().max(254).default(''),
  phonePrefix: z.string().max(8).default('+972'),
  phone: z.string().max(40).default(''),
  company: z.string().max(120).default(''),
  customerCountry: z.string().max(2).default('IL'),
  notes: z.string().max(4000).default(''),
  agreed: z.boolean().default(false),
  currency: z.enum(currencies).default('EUR'),
  // Kept for orders created before collection and return were separate choices.
  delivery: z.boolean().default(false),
});
export const MAX_FREE_TEXT_WORDS = 500;
export const wordCount = (s: string) => (s.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
const required = (a: Address) => !!(a.city.trim() && a.street.trim() && a.phone.trim());

export const orderSchema = orderFields.transform(o => {
  // Older clients send a single "delivery" flag meaning collection and return.
  if (o.delivery && !o.collect && !o.deliver) o = { ...o, collect: true, deliver: true };
  // The customer's own phone is the contact phone for an address that has none.
  for (const k of ['pickup', 'dropoff'] as const) if (!o[k].phone.trim() && o.phone.trim()) o = { ...o, [k]: { ...o[k], phone: o.phone, phonePrefix: o.phonePrefix } };
  const name = [o.firstName, o.lastName].filter(Boolean).join(' ').trim() || o.name.trim();
  const delivery = hasCourier(o);
  const title = o.title.trim() || (translates(o.service) ? `${o.service}: ${o.source} → ${o.targets.join(', ')}` : o.service === 'Additional services' ? `${o.service}: ${o.extraType}` : o.service);
  return { ...o, name, delivery, title: title.slice(0, 160), targets: translates(o.service) ? o.targets : [] };
}).superRefine((v, ctx) => {
  const issue = (message: string, path: string) => ctx.addIssue({ code: 'custom', message, path: [path] });
  if (v.name.length < 2) issue('Enter your first and last name', 'firstName');
  if (!z.string().email().safeParse(v.email).success) issue('Enter a valid email address', 'email');
  if (v.service === 'Additional services') {
    if (v.freeText.trim().length < 3) issue('Describe the service you need', 'freeText');
    if (wordCount(v.freeText) > MAX_FREE_TEXT_WORDS) issue(`Keep the description under ${MAX_FREE_TEXT_WORDS} words`, 'freeText');
    return;
  }
  if (translates(v.service)) {
    if (!v.targets.length) issue('Choose at least one target language', 'targets');
    if (v.targets.includes(v.source)) issue('Source and target languages must be different', 'targets');
    if (!v.documents.length) issue('Add at least one document', 'documents');
    if (v.sector === 'Medical' && v.level !== 'Professional' && v.service !== 'Translation validation') issue('Medical documents require the professional workflow', 'level');
    if (!levelsFor(v.service).includes(v.level) && v.service !== 'Translation validation') issue('This service level is not available for the selected service', 'level');
  }
  if (v.service === 'Notary only' && !v.documents.length) issue('Add at least one document', 'documents');
  if (v.service === 'Courier only' && !v.collect && !v.deliver) issue('Choose collection, delivery or both', 'collect');
  if (v.collect && !required(v.pickup)) issue('Complete the collection address and contact phone', 'pickup');
  if (v.deliver && !required(v.dropoff)) issue('Complete the delivery address and contact phone', 'dropoff');
});
export type OrderInput = z.input<typeof orderFields>;
export type Order = z.output<typeof orderSchema>;

// Reads any stored payload (including older ones) into the current shape.
export function normalizeOrder(raw: unknown): Order {
  const p = { ...(raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}) };
  if (p.delivery === true && p.collect === undefined && p.deliver === undefined) { p.collect = true; p.deliver = true; }
  if (p.service === 'Courier only' && p.collect === undefined) { p.collect = true; p.deliver = true; }
  if (typeof p.name === 'string' && !p.firstName && !p.lastName) { const [first, ...rest] = p.name.trim().split(/\s+/); p.firstName = first || ''; p.lastName = rest.join(' '); }
  if (p.level === 'Machine draft' && p.service !== 'Document translation') p.level = 'Professional';
  if (!sectors.includes(p.sector as typeof sectors[number])) p.sector = 'General';
  p.pickup = normalizeAddress(p.pickup); p.dropoff = normalizeAddress(p.dropoff);
  const docs = Array.isArray(p.documents) ? p.documents : [];
  const int = (v: unknown, min: number, max: number, fallback: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
  p.documents = docs.slice(0, 20).map((d, i) => { const doc = d as Record<string, unknown>; return { ...doc, name: String(doc.name || `Document ${i + 1}`).slice(0, 160), type: String(doc.type || 'Document').slice(0, 100), pages: int(doc.pages, 1, 10000, 1), words: int(doc.words, 0, 1000000, 0), quantity: int(doc.quantity, 1, 50, 1), counted: !!doc.counted, format: formats.includes(doc.format as typeof formats[number]) ? doc.format : 'PDF' }; });
  p.copies = int(p.copies, 1, 20, 1);
  const parsed = orderFields.safeParse(p);
  const base = parsed.success ? parsed.data : orderFields.parse({ service: services.includes(p.service as Service) ? p.service : 'Document translation' });
  const name = [base.firstName, base.lastName].filter(Boolean).join(' ').trim() || base.name;
  return { ...base, name, delivery: hasCourier(base) };
}

export const blankAddress: Address = addressSchema.parse({});
export function newDocument(n: number, certificate = false): DocumentInput {
  return { name: certificate ? `Certificate ${n}` : `Document ${n}`, type: certificate ? 'Birth certificate' : 'Document', pages: 1, words: 250, format: 'PDF', fileIds: [], quantity: 1, counted: false };
}
export function newOrder(service: Service = 'Document translation'): Order {
  return { ...orderFields.parse({ service, sector: 'Medical', targets: ['Hebrew'], documents: [newDocument(1, isCertificate(service))], validation: true }), name: '', delivery: false, title: '' };
}

// ---------- Pricing ----------
export const defaultPricing = {
  professional: 0.14, student: 0.08, machine: 0.03, validation: 0.04,
  notary: 75, copy: 15, delivery: 25, minimum: 25, usd: 1.10, ils: 4.00,
  certificateProfessional: 30, certificateStudent: 18, dtpPage: 6,
  courierInternational: 60, nextDay: 10, sameDay: 20, roundTrip: 1.8,
  priority: 0.25, express: 0.5,
};
export type FlatPricing = typeof defaultPricing;
export const defaultFactors = {
  sectors: { General: 1, Medical: 1.2, Legal: 1.15, Finance: 1.1, Technology: 1.05, Marketing: 1 } as Record<string, number>,
  languages: { Japanese: 1.15, Chinese: 1.15, Arabic: 1.15, Hebrew: 1.15 } as Record<string, number>,
  formats: { PDF: 1, DOCX: 1, TXT: 1, JPG: 1, PNG: 1 } as Record<string, number>,
  documentTypes: {} as Record<string, number>,
  customerTypes: { new: 1, existing: 1, organization: 1 } as Record<string, number>,
  countries: {} as Record<string, number>,
  notaryTypes: { 'Translation certification': 75, 'Signature verification': 60, 'Certified copy': 40, 'Affidavit': 90 } as Record<string, number>,
  // Extra notary fee per additional 100 words (beyond the first 100), e.g. for translation certification.
  notaryPer100: { 'Translation certification': 0 } as Record<string, number>,
  // Official notary price lists by destination country: {IL: {'Translation certification': 70}}.
  notaryCountries: {} as Record<string, Record<string, number>>,
  capacity: { Professional: 2000, Student: 1500, 'Machine draft': 20000 } as Record<string, number>,
  rates: { USD: 1.10, ILS: 4.00, GBP: 0.85, CHF: 0.94, CAD: 1.50, AUD: 1.65, JPY: 160, CNY: 7.8, PLN: 4.3, SEK: 11.4, BGN: 1.9558 } as Record<string, number>,
};
export type Factors = typeof defaultFactors;
export type Pricing = FlatPricing & { factors: Factors; officeCountry: string; internationalCarrier: string; localCarrier: string };
const numberMap = z.record(z.string().max(80), z.number().min(0).max(100000));
export const pricingSchema = z.object({
  ...Object.fromEntries(Object.keys(defaultPricing).map(k => [k, z.number().min(0).max(10000)])) as Record<keyof FlatPricing, z.ZodNumber>,
  factors: z.object({
    sectors: numberMap, languages: numberMap, formats: numberMap, documentTypes: numberMap, customerTypes: numberMap, countries: numberMap,
    notaryTypes: numberMap, notaryPer100: numberMap, notaryCountries: z.record(z.string().max(2), numberMap), capacity: numberMap, rates: numberMap,
  }),
  officeCountry: z.string().length(2),
  internationalCarrier: z.string().max(40),
  localCarrier: z.string().max(40),
}).refine(p => p.professional > 0 && p.student > 0 && p.machine > 0 && p.validation > 0 && p.roundTrip >= 1, 'Enter positive rates');
// Workspaces created before price factors existed store only the flat rates.
export function normalizePricing(stored: unknown): Pricing {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Pricing>;
  const f = (s.factors || {}) as Partial<Factors>;
  const merged = Object.fromEntries(Object.entries(defaultFactors).map(([k, v]) => [k, { ...v, ...((f as Record<string, object>)[k] || {}) }])) as Factors;
  if (!f.rates) { if (s.usd) merged.rates.USD = s.usd; if (s.ils) merged.rates.ILS = s.ils; }
  if (s.notary && !f.notaryTypes) merged.notaryTypes['Translation certification'] = s.notary;
  const flat = Object.fromEntries(Object.entries(defaultPricing).map(([k, v]) => [k, typeof (s as Record<string, unknown>)[k] === 'number' ? (s as Record<string, number>)[k] : v])) as FlatPricing;
  return { ...flat, factors: merged, officeCountry: s.officeCountry || 'IL', internationalCarrier: s.internationalCarrier || 'DHL', localCarrier: s.localCarrier || 'Local courier' };
}
export const basePricing = normalizePricing(defaultPricing);

export type CustomerKind = 'new' | 'existing' | 'organization';
export type QuoteLine = { key: string; label: string; amount: number };
export type LevelPrice = { level: Level; translation: number; validation: number; total: number; days: number };
export type Quote = {
  words: number; pages: number; lines: QuoteLine[]; total: number; days: number; levels: LevelPrice[];
  base: number; review: number; rush: number; notary: number; delivery: number; dtp: number; adjustment: number;
  manual: boolean; international: boolean; carrier: string; trips: number;
};
const pct = (p: FlatPricing, u: string) => u === 'Priority' ? p.priority : u === 'Express' ? p.express : 0;
const r2 = (n: number) => Math.round(n * 100) / 100;

function translationCost(o: Order, p: Pricing, level: Level) {
  const f = p.factors;
  const sector = f.sectors[o.sector] ?? 1;
  const langSum = o.targets.reduce((n, l) => n + (f.languages[l] ?? 1), 0);
  if (isCertificate(o.service)) {
    const perPage = level === 'Student' ? p.certificateStudent : p.certificateProfessional;
    const pages = o.documents.reduce((n, d) => n + d.pages * d.quantity * (f.formats[d.format] ?? 1) * (f.documentTypes[d.type] ?? 1), 0);
    return Math.max(p.minimum, pages * perPage * sector * langSum);
  }
  const rate = o.service === 'Translation validation' ? p.validation : level === 'Professional' ? p.professional : level === 'Student' ? p.student : p.machine;
  const weighted = o.documents.reduce((n, d) => n + (d.words || d.pages * 250) * d.quantity * (f.formats[d.format] ?? 1) * (f.documentTypes[d.type] ?? 1), 0);
  return Math.max(p.minimum, weighted * rate * sector * langSum);
}
function deliveryDays(o: Order, p: Pricing, level: Level, words: number) {
  const capacity = p.factors.capacity[level] || 2000;
  let days = Math.max(1, Math.ceil(words * Math.max(1, o.targets.length) / capacity)) + (o.validation ? 1 : 0);
  if (o.urgency === 'Priority') days = Math.max(1, Math.ceil(days * 0.6));
  if (o.urgency === 'Express') days = Math.max(1, Math.ceil(days * 0.35));
  return days;
}
export function customerKind(info?: { business?: boolean; previousOrders?: number }): CustomerKind {
  return info?.business ? 'organization' : (info?.previousOrders || 0) > 0 ? 'existing' : 'new';
}

export function quote(input: Order | OrderInput, pricing: Pricing | FlatPricing = defaultPricing, customer: CustomerKind = 'new'): Quote {
  const o = normalizeOrder(input);
  const p = 'factors' in pricing ? pricing as Pricing : normalizePricing(pricing);
  const f = p.factors;
  const words = o.documents.reduce((n, d) => n + (d.words || d.pages * 250) * d.quantity, 0);
  const pages = o.documents.reduce((n, d) => n + d.pages * d.quantity, 0);
  const lines: QuoteLine[] = [];
  const add = (key: string, label: string, amount: number) => { if (amount) lines.push({ key, label, amount: r2(amount) }); return amount; };
  const service = o.service;
  const tr = translates(service);
  const customerFactor = (f.customerTypes[customer] ?? 1) * (f.countries[o.customerCountry] ?? 1);
  const langSum = o.targets.reduce((n, l) => n + (f.languages[l] ?? 1), 0);
  const levelPrices: LevelPrice[] = tr && service !== 'Translation validation' ? levelsFor(service).map(level => {
    const translation = translationCost(o, p, level) * customerFactor;
    const validation = words * p.validation * langSum * customerFactor;
    return { level, translation: r2(translation), validation: r2(validation), total: r2(translation + validation), days: deliveryDays(o, p, level, words) };
  }) : [];
  const level: Level = service === 'Translation validation' ? 'Professional' : o.level;
  const rawBase = tr ? translationCost(o, p, level) : 0;
  const base = add('translation', service === 'Translation validation' ? 'Validation' : 'Translation', rawBase);
  const review = add('validation', 'Language review', tr && o.validation && service !== 'Translation validation' ? words * p.validation * langSum : 0);
  const dtp = add('dtp', 'Layout and formatting (DTP)', tr && o.dtp ? pages * p.dtpPage * Math.max(1, o.targets.length) : 0);
  const rush = add('rush', 'Urgency supplement', (base + review + dtp) * pct(p, o.urgency));
  const adjustment = add('customer', customer === 'new' ? 'Customer adjustment' : customer === 'existing' ? 'Returning customer' : 'Organization rate', (base + review + dtp + rush) * (customerFactor - 1));
  let notary = 0;
  if (hasNotary(o)) {
    const country = f.notaryCountries[o.notaryCountry] || {};
    const fee = country[o.notaryType] ?? f.notaryTypes[o.notaryType] ?? p.notary;
    const per100 = f.notaryPer100[o.notaryType] || 0;
    const docs = Math.max(1, o.documents.reduce((n, d) => n + d.quantity, 0));
    const extraWords = o.documents.reduce((n, d) => n + Math.max(0, Math.ceil(((d.words || d.pages * 250) - 100) / 100)) * d.quantity, 0);
    notary = fee * docs + (o.copies - 1) * p.copy * docs + per100 * extraWords;
    notary += notary * pct(p, o.notaryUrgency);
    add('notary', 'Notary', notary);
  }
  let delivery = 0, trips = 0, international = false;
  if (hasCourier(o)) {
    const ends = [o.collect ? o.pickup.country : p.officeCountry, o.deliver ? o.dropoff.country : p.officeCountry];
    international = ends.some(c => c && c !== p.officeCountry);
    trips = service === 'Courier only' ? 1 : (o.collect ? 1 : 0) + (o.deliver ? 1 : 0);
    const leg = international ? p.courierInternational : p.delivery;
    delivery = leg * trips * (service === 'Courier only' && o.roundTrip ? p.roundTrip : 1);
    delivery += trips * (o.timing === 'Same day' ? p.sameDay : o.timing === 'Next day' ? p.nextDay : 0);
    delivery += delivery * pct(p, o.urgency);
    add('delivery', 'Courier', delivery);
  }
  const total = Math.round(lines.reduce((n, l) => n + l.amount, 0) * 100);
  const notaryDays = hasNotary(o) ? (o.notaryUrgency === 'Express' ? 1 : o.notaryUrgency === 'Priority' ? 2 : 3) : 0;
  const days = (tr ? deliveryDays(o, p, level, words) : 0) + notaryDays + (hasCourier(o) && !tr && !notaryDays ? (o.timing === 'Same day' ? 0 : 1) : 0);
  return {
    words, pages, lines, total, days: Math.max(service === 'Courier only' && o.timing === 'Same day' ? 0 : 1, days), levels: levelPrices,
    base, review, rush, notary, delivery, dtp, adjustment,
    manual: service === 'Additional services' || notary > 0 || delivery > 0,
    international, carrier: international ? p.internationalCarrier : p.localCarrier, trips,
  };
}

export function convert(eur: number, currency: string, p: { factors?: Factors; usd?: number; ils?: number } = basePricing) {
  if (currency === 'EUR') return eur;
  const rate = p.factors?.rates[currency] ?? (currency === 'USD' ? p.usd : currency === 'ILS' ? p.ils : undefined);
  return eur * (rate || 1);
}
export function money(cents: number, currency = 'EUR', p: { factors?: Factors; usd?: number; ils?: number } = basePricing, locale = 'en') {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en', { style: 'currency', currency }).format(convert(cents / 100, currency, p));
}
// Adds business days (Mon–Fri) to a date; used for the project delivery date.
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) left--; }
  return d;
}
export const orderReference = (n: number, year = new Date().getUTCFullYear()) => `VB-${year}-${String(n).padStart(6, '0')}`;
export const shipmentReference = (n: number) => `SH-${String(n).padStart(6, '0')}`;
