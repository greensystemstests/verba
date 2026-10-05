// Test-only preload (never loaded in production): sends requests for the AI
// provider to the local mock server named by PROVIDER_TEST_REDIRECT. Every other
// request is untouched. The app code itself is unchanged.
const target=process.env.PROVIDER_TEST_REDIRECT;
if(target){const original=globalThis.fetch;globalThis.fetch=async(input,init)=>{const request=new Request(input,init);if(request.url.startsWith('https://api.openai.com/')){const url=target+new URL(request.url).pathname;const body=request.method==='GET'?undefined:await request.arrayBuffer();return original(url,{method:request.method,headers:request.headers,body,signal:init?.signal});}return original(input,init);};}
