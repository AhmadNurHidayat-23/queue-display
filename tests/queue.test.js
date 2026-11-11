import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {io as client} from 'socket.io-client';
import {QueueStore} from '../src/store.js';
import {createApp} from '../src/app.js';
import {passwordHash} from '../src/auth.js';
const password='Khusus-Pengujian-2307';
function onceState(socket,predicate){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off('state',on);reject(new Error('Socket tidak menerima state'));},5000);const on=value=>{if(predicate(value)){clearTimeout(timer);socket.off('state',on);resolve(value);}};socket.on('state',on);});}
async function server(store){const app=createApp(store);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return {...app,url:'http://127.0.0.1:'+app.server.address().port};}
const stop=app=>new Promise(r=>app.io.close(r));
test('HTTP nyata, nomor bersamaan, dua monitor, operator, restart SQLite',async()=>{
 const file=path.join(mkdtempSync(path.join(tmpdir(),'queue-test-')),'queue.sqlite');
 let store=new QueueStore(file),app=await server(store);
 store.db.prepare('INSERT INTO operator(id,password) VALUES(1,?)').run(passwordHash(password));
 const a=client(app.url,{autoConnect:false,transports:['websocket']}),b=client(app.url,{autoConnect:false,transports:['websocket']});
 try{
  const initialA=onceState(a,s=>s.counts.total===0),initialB=onceState(b,s=>s.counts.total===0);a.connect();b.connect();await Promise.all([initialA,initialB]);
  const updateA=onceState(a,s=>s.counts.total===24),updateB=onceState(b,s=>s.counts.total===24);
  const tickets=await Promise.all(Array.from({length:24},async()=>{const r=await fetch(app.url+'/api/tickets',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,201);return r.json();}));
  assert.equal(new Set(tickets.map(t=>t.number)).size,24);assert.deepEqual(tickets.map(t=>t.number).sort((a,b)=>a-b),Array.from({length:24},(_,i)=>i+1));await Promise.all([updateA,updateB]);
  const post=(url,body={},headers={})=>fetch(app.url+url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await post('/api/operator/next')).status,401);
  assert.equal((await post('/api/login',{password:'Salah'})).status,401);
  const login=await post('/api/login',{password}),cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();const headers={cookie,'X-CSRF-Token':csrf};
  assert.equal((await post('/api/operator/next',{}, {cookie})).status,403);
  let nextA=onceState(a,s=>s.current?.number===1),nextB=onceState(b,s=>s.current?.number===1);assert.equal((await post('/api/operator/next',{},headers)).status,200);await Promise.all([nextA,nextB]);
  assert.equal((await post('/api/operator/next',{},headers)).status,400);
  nextA=onceState(a,s=>s.current?.calls===2);nextB=onceState(b,s=>s.current?.calls===2);await post('/api/operator/recall',{},headers);await Promise.all([nextA,nextB]);
  await post('/api/operator/done',{},headers);await post('/api/operator/next',{},headers);await post('/api/operator/skipped',{},headers);
  const state=await (await fetch(app.url+'/api/state')).json();assert.equal(state.counts.done,1);assert.equal(state.counts.skipped,1);assert.equal(state.counts.waiting,22);
  a.disconnect();b.disconnect();await stop(app);store.close();
  store=new QueueStore(file);app=await server(store);assert.equal(store.snapshot().counts.total,24);assert.equal(store.take().number,25);
  assert.equal(store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.equal((await fetch(app.url+'/api/operator/next',{method:'POST',headers:{'Content-Type':'application/json',cookie,'X-CSRF-Token':csrf},body:'{}'})).status,200);
  assert.equal((await fetch(app.url+'/api/operator/recall',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://lain.example'},body:'{}'})).status,403);
 }finally{a.disconnect();b.disconnect();await stop(app);store.close();}
});
test('hari WIB, nomor reset, panggilan kemarin tetap harus diselesaikan',()=>{
 let now=new Date('2026-11-10T16:59:00Z');const s=new QueueStore(':memory:',()=>now);
 try{assert.equal(s.day(),'2026-11-10');assert.equal(s.take().number,1);s.operate('next');now=new Date('2026-11-10T17:01:00Z');assert.equal(s.day(),'2026-11-11');assert.equal(s.take().number,1);assert.equal(s.snapshot().current.day,'2026-11-10');assert.throws(()=>s.operate('next'));s.operate('done');s.operate('next');assert.equal(s.snapshot().current.day,'2026-11-11');}finally{s.close();}
});
test('pengaturan menolak kata sandi pendek',()=>{assert.throws(()=>passwordHash('pendek'));assert.notEqual(passwordHash(password),passwordHash(password));});
