import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {fileURLToPath} from 'node:url';
import {authRoutes} from './auth.js';
export function createApp(store){
 const app=express(),server=createServer(app),io=new Server(server,{maxHttpBufferSize:16384});
 app.disable('x-powered-by');
 app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; object-src 'none'; frame-ancestors 'none'");next();});
 app.use(express.json({limit:'8kb'}));
 app.use((req,res,next)=>{if(req.method==='POST'){
  if(!req.is('application/json'))return res.status(415).json({error:'Gunakan JSON.'});
  if(req.headers.origin&&req.headers.origin!==req.protocol+'://'+req.get('host'))return res.status(403).json({error:'Asal permintaan tidak diizinkan.'});
 }next();});
 const protect=authRoutes(app,store);
 app.get('/api/state',(_req,res)=>res.json(store.snapshot()));
 app.post('/api/tickets',(_req,res)=>{const ticket=store.take();io.emit('state',store.snapshot());res.status(201).json(ticket);});
 app.post('/api/operator/:action',protect,(req,res)=>{if(!['next','recall','done','skipped'].includes(req.params.action))return res.status(400).json({error:'Tindakan tidak valid.'});const state=store.operate(req.params.action);io.emit('state',state);res.json(state);});
 const root=fileURLToPath(new URL('../public/',import.meta.url));
 app.get('/operator',(_req,res)=>res.sendFile(root+'operator.html'));
 app.get('/display',(_req,res)=>res.sendFile(root+'display.html'));
 app.use(express.static(root));
 app.use((error,_req,res,_next)=>{const status=error.status===413?413:400;res.status(status).json({error:status===413?'Permintaan terlalu besar.':error instanceof SyntaxError?'JSON tidak valid.':error.message});});
 io.on('connection',socket=>socket.emit('state',store.snapshot()));
 const timer=setInterval(()=>io.emit('state',store.snapshot()),30000);timer.unref();
 server.on('close',()=>clearInterval(timer));
 return {app,server,io};
}
