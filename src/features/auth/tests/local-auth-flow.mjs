// LOCAL ONLY. Real browser/UI/Server Action checks; no hosted users or credentials.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const fingerprint=createHash('sha256').update(readFileSync('.env.local')).digest('hex');
const docker=join(process.env.LOCALAPPDATA,'Programs','DockerDesktop','resources','bin','docker.exe');
assert.ok(existsSync(docker),'Docker Desktop executable missing');
const commandEnv={...process.env,PATH:dirname(docker)+delimiter+process.env.PATH,DOCKER_CONTEXT:'desktop-linux'};
const status=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{env:commandEnv,encoding:'utf8',timeout:30000});
assert.equal(status.status,0,'Start local Supabase first');
const local=JSON.parse(status.stdout.slice(status.stdout.indexOf('{')));
assert.equal(new URL(local.API_URL).hostname,'127.0.0.1','Refusing non-local Auth');
const cacheRoot=join(process.env.LOCALAPPDATA,'npm-cache','_npx');
const runner=readdirSync(cacheRoot).map(folder=>join(cacheRoot,folder,'node_modules','playwright','index.mjs')).find(existsSync);
assert.ok(runner,'Run npx.cmd --yes --package=playwright -- playwright --version first; no project dependency needed');
const {chromium}=await import(pathToFileURL(runner).href);
const origin='http://127.0.0.1:3000';
try {await fetch(origin,{signal:AbortSignal.timeout(1500)});throw new Error('Port 3000 is already occupied; stop its server before local-only testing');}
catch(error){if(error.message.includes('already occupied'))throw error;}
const admin=createClient(local.API_URL,local.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const emails=[];
let browser;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3000'],{
 env:{...commandEnv,NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY},
 stdio:['ignore','pipe','pipe'],
});
server.stdout.resume();server.stderr.resume();
async function fillSignup(page,email,password,name){
 await page.getByLabel(/^Display name/).fill(name);
 await page.getByLabel(/^Email address/).fill(email);
 await page.getByLabel(/^Password/).fill(password);
 await page.getByLabel(/^Confirm password/).fill(password);
 await page.getByRole('button',{name:'Create account',exact:true}).click();
}
try {
 let ready=false;
 for(let attempt=0;attempt<90;attempt++){
  if(server.exitCode!==null)throw new Error('Local app server failed to start');
  try {const response=await fetch(origin+'/auth/login',{signal:AbortSignal.timeout(5000)});if(response.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 assert.ok(ready,'Local app readiness timeout');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(30000);
 await page.goto(origin+'/profile');
 await page.waitForURL('**/auth/login?next=%2Fprofile');
 console.log('PASS anonymous profile redirects to login');
 await page.getByLabel(/^Email address/).fill('not-an-email');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByText('Enter a valid email address.',{exact:true}).waitFor();
 console.log('PASS accessible inline validation');
 await page.getByRole('button',{name:'Continue with Google',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Google sign-in is unavailable'}).waitFor();
 console.log('PASS disabled Google provider fails safely (no Google sign-in claimed)');
 const email='khi-local-ui-'+randomUUID()+'@example.com';emails.push(email);
 const password='Local!'+randomBytes(18).toString('hex');
 await page.goto(origin+'/auth/sign-up?next=%2Fprofile');
 await fillSignup(page,email,password,'LOCAL UI ONLY');
 await page.waitForURL('**/profile');
 await page.getByRole('heading',{name:'LOCAL UI ONLY',exact:true}).waitFor();
 await page.getByText(email,{exact:true}).waitFor();
 console.log('PASS real signup, cookie session, database profile bootstrap and display name');
 await page.goto(origin+'/auth/login?next=%2Fprofile');await page.waitForURL('**/profile');
 console.log('PASS authenticated login page redirects');
 const cookies=await context.cookies();
 assert.ok(cookies.some(cookie=>cookie.name.includes('auth-token')));
 const authenticated=createClient(local.API_URL,local.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:signed,error:signError}=await authenticated.auth.signInWithPassword({email,password});assert.equal(signError,null);
 const own=await authenticated.from('profiles').select('id,display_name').eq('id',signed.user.id).single();assert.equal(own.error,null);assert.equal(own.data.display_name,'LOCAL UI ONLY');
 const otherEmail='khi-local-private-'+randomUUID()+'@example.com';emails.push(otherEmail);
 const other=await admin.auth.admin.createUser({email:otherEmail,password,email_confirm:true});assert.equal(other.error,null);
 const privateRead=await authenticated.from('profiles').select('id').eq('id',other.data.user.id);assert.equal(privateRead.error,null);assert.equal(privateRead.data.length,0);
 console.log('PASS own-profile read and other-profile RLS isolation');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/auth/login');
 assert.equal((await context.cookies()).some(cookie=>cookie.name.includes('auth-token')),false);
 await page.goto(origin+'/profile');await page.waitForURL('**/auth/login?next=%2Fprofile');
 console.log('PASS current-session logout clears cookies and protected access');
 await page.getByLabel(/^Email address/).fill(email);
 await page.getByLabel(/^Password/).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/profile');
 console.log('PASS actual password login and protected profile');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/auth/login');
 await page.goto(origin+'/auth/login?next='+encodeURIComponent('//evil.example'));
 await page.getByLabel(/^Email address/).fill(email);await page.getByLabel(/^Password/).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/profile');assert.equal(new URL(page.url()).origin,origin);
 console.log('PASS malicious next rejected in actual login flow');
 const isolated=await browser.newContext();const callbackPage=await isolated.newPage();
 await callbackPage.goto(origin+'/auth/callback?next='+encodeURIComponent('//evil.example'));await callbackPage.waitForURL('**/auth/login?next=%2Fprofile&error=callback');
 await callbackPage.getByRole('alert').filter({hasText:'sign-in link could not be completed'}).waitFor();
 await callbackPage.goto(origin+'/auth/callback?code=invalid-local-code');await callbackPage.waitForURL('**/auth/login?next=%2Fprofile&error=callback');
 console.log('PASS missing/invalid PKCE code produces safe callback failure');
 const callbackContext=await browser.newContext();
 const verifierCookies=new Map();
 const pkceClient=createBrowserClient(local.API_URL,local.ANON_KEY,{
  auth:{autoRefreshToken:false,detectSessionInUrl:false},
  cookies:{getAll:()=>Array.from(verifierCookies,([name,value])=>({name,value})),setAll:values=>values.forEach(cookie=>verifierCookies.set(cookie.name,cookie.value))},
 });
 const recovery=await pkceClient.auth.resetPasswordForEmail(email,{redirectTo:origin+'/auth/callback?next=%2Fprofile'});
 assert.equal(recovery.error,null,'Local email request failed');
 await callbackContext.addCookies(Array.from(verifierCookies,([name,value])=>({name,value,url:origin,sameSite:'Lax'})));
 let confirmationLink;
 for(let attempt=0;attempt<20;attempt++){
  const mailbox=await fetch((local.INBUCKET_URL ?? 'http://127.0.0.1:54324')+'/api/v1/messages').then(response=>response.json());
  const message=mailbox.messages?.find(message=>message.To?.some(recipient=>recipient.Address===email));
  if(message){
   const body=await fetch((local.INBUCKET_URL ?? 'http://127.0.0.1:54324')+'/api/v1/message/'+message.ID).then(response=>response.json());
   const link=(body.HTML ?? body.Text ?? '').match(/https?:[^"<>\s]+\/auth\/v1\/verify\?[^"<>\s]+/)?.[0];
   if(link){confirmationLink=link.replaceAll('&amp;','&');break;}
  }
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert.ok(confirmationLink,'Local Mailpit verification link missing');
 assert.equal(new URL(confirmationLink).hostname,'127.0.0.1','Refusing external mail link');
 const verifiedPage=await callbackContext.newPage();await verifiedPage.goto(confirmationLink);
 await verifiedPage.waitForURL('**/profile');await verifiedPage.getByRole('heading',{name:'LOCAL UI ONLY',exact:true}).waitFor();
 assert.ok((await callbackContext.cookies()).some(cookie=>cookie.name.includes('auth-token')));
 console.log('PASS real local email PKCE exchange, callback session cookies and verified profile');
 await callbackContext.close();

 await context.close();await isolated.close();
} finally {
 if(browser)await browser.close();
 server.kill();
 // Clean up only the exact disposable LOCAL identities created above.
 const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:1000});
 assert.equal(error,null);
 for(const user of data.users.filter(user=>emails.includes(user.email))){const result=await admin.auth.admin.deleteUser(user.id);assert.equal(result.error,null);}
 assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'),fingerprint);
 console.log('LOCAL fixtures removed; .env.local unchanged');
}
