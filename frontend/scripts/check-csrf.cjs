const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../lib/api.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
async function check(responses,run){
 const calls=[];const module={exports:{}};
 const fetch=async(url,init)=>{calls.push({url,token:new Headers(init.headers).get('X-CSRFToken'),body:init.body});const reply=responses.shift();assert.ok(reply,'Unexpected request');return {ok:reply.status<400,status:reply.status,json:async()=>reply.data};};
 vm.runInNewContext(source,{exports:module.exports,require:()=>({dateTime:()=>''}),Headers,FormData,fetch});
 await run(module.exports,calls);assert.equal(responses.length,0);
}
(async()=>{
 await check([{status:200,data:{csrfToken:'fresh-custom-cookie-token'}},{status:201,data:{id:1}}],async({api},calls)=>{assert.equal((await api('auth/register/',{method:'POST',body:'{}'})).id,1);assert.equal(calls[1].token,'fresh-custom-cookie-token');});
 await check([{status:200,data:{csrfToken:'stale'}},{status:403,data:{code:'csrf_failed'}},{status:200,data:{csrfToken:'rotated'}},{status:200,data:{ok:true}}],async({api},calls)=>{assert.equal((await api('me/',{method:'PATCH',body:'{}'})).ok,true);assert.equal(calls[3].token,'rotated');});
 await check([{status:200,data:{csrfToken:'valid'}},{status:403,data:{detail:'Permission denied'}}],async({api})=>{await assert.rejects(api('me/',{method:'PATCH',body:'{}'}),e=>e.status===403);});
 await check([{status:503,data:{}}],async({api})=>{await assert.rejects(api('auth/register/',{method:'POST',body:'{}'}));});
 await check([{status:200,data:{csrfToken:'first'}},{status:403,data:{code:'csrf_failed'}},{status:200,data:{csrfToken:'second'}},{status:403,data:{code:'csrf_failed'}}],async({api})=>{await assert.rejects(api('me/',{method:'PATCH',body:'{}'}),e=>e.status===403);});
 await check([{status:200,data:{results:[]}}],async({api},calls)=>{await api('mentors/');assert.equal(calls.length,1);assert.equal(calls[0].token,null);});
 console.log('CSRF custom-cookie support, rotation retry, permission failures, bootstrap errors, retry limit and GET checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
