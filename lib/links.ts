// Link targets for pages that can be served from two places.
// On the Render app both variables are unset, so every link stays a plain path
// ("/", "/order", ...). The static GitHub Pages build sets them so that app pages
// point at the Render origin and static pages stay under the Pages base path.
const clean=(v:string|undefined)=>(v||'').replace(/\/+$/,'');
const app=clean(process.env.NEXT_PUBLIC_APP_ORIGIN);
const site=clean(process.env.NEXT_PUBLIC_SITE_BASE);
/** A page that needs the server (translator, orders, accounts, workspace). */
export const appHref=(path:string)=>app+path;
/** A page that is fully static (services, privacy, terms). */
export const siteHref=(path:string)=>site+path;
