// Test-only preload (never loaded in production): sends requests for external providers
// (AI, social sign-in, captcha, SMS) to the local mock server named by
// PROVIDER_TEST_REDIRECT. The AI provider keeps its path; other hosts are prefixed with
// their host name (e.g. /oauth2.googleapis.com/token). The app code itself is unchanged.
const target=process.env.PROVIDER_TEST_REDIRECT;
const hosts=['oauth2.googleapis.com','openidconnect.googleapis.com','graph.facebook.com','api.x.com','challenges.cloudflare.com','api.twilio.com','www.ecb.europa.eu','api.cloudmersive.com'];
if(target){const original=globalThis.fetch;globalThis.fetch=async(input,init)=>{const request=new Request(input,init);const url=new URL(request.url);
  const path=url.hostname==='api.openai.com'?url.pathname:hosts.includes(url.hostname)?'/'+url.hostname+url.pathname+url.search:null;
  if(path!==null){const body=request.method==='GET'?undefined:await request.arrayBuffer();return original(target+path,{method:request.method,headers:request.headers,body,signal:init?.signal});}
  return original(input,init);};}
