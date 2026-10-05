import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export const randomToken=()=>randomBytes(32).toString('hex');
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const key=scryptSync(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024});return `scrypt:16384:8:5:${salt}:${key.toString('hex')}`;}
export function verifyPassword(password:string,stored:string){try{const [algorithm,n,r,p,salt,digest]=stored.split(':');if(algorithm!=='scrypt'||n!=='16384'||r!=='8'||p!=='5'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(digest))return false;const actual=scryptSync(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024});return timingSafeEqual(actual,Buffer.from(digest,'hex'));}catch{return false;}}
export function safeReturnPath(value:string){try{const url=new URL(value,'https://verba.local');return value.startsWith('/')&&!value.startsWith('//')&&url.origin==='https://verba.local'&&!url.pathname.startsWith('/account')?url.pathname+url.search:'/';}catch{return '/';}}
