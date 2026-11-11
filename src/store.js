import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
export class QueueStore {
 constructor(file,clock=()=>new Date()){
  if(file!==':memory:')fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
  this.db=new DatabaseSync(file,{timeout:10000});this.clock=clock;
  this.db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000;");
  this.db.exec(
   'CREATE TABLE IF NOT EXISTS counters(day TEXT PRIMARY KEY,value INTEGER NOT NULL);'+
   "CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY,day TEXT NOT NULL,number INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','called','done','skipped')),calls INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,called_at TEXT,UNIQUE(day,number));"+
   "CREATE UNIQUE INDEX IF NOT EXISTS one_active ON tickets(status) WHERE status='called';"+
   'CREATE TABLE IF NOT EXISTS operator(id INTEGER PRIMARY KEY CHECK(id=1),password TEXT NOT NULL);'+
   'CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);'
  );
 }
 day(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(this.clock());}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 take(){return this.transaction(()=>{
  const day=this.day();
  const counter=this.db.prepare('INSERT INTO counters(day,value) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET value=value+1 RETURNING value').get(day);
  const result=this.db.prepare('INSERT INTO tickets(day,number,created_at) VALUES(?,?,?)').run(day,counter.value,this.clock().toISOString());
  return this.db.prepare('SELECT * FROM tickets WHERE id=?').get(result.lastInsertRowid);
 });}
 operate(action){return this.transaction(()=>{
  let current=this.db.prepare("SELECT * FROM tickets WHERE status='called'").get();
  if(action==='next'){
   if(current)throw new Error('Selesaikan atau lewati antrean aktif terlebih dahulu.');
   current=this.db.prepare("SELECT * FROM tickets WHERE day=? AND status='waiting' ORDER BY number LIMIT 1").get(this.day());
   if(!current)throw new Error('Tidak ada antrean menunggu hari ini.');
   this.db.prepare("UPDATE tickets SET status='called',calls=calls+1,called_at=? WHERE id=?").run(this.clock().toISOString(),current.id);
  }else{
   if(!current)throw new Error('Belum ada nomor yang sedang dipanggil.');
   if(action==='recall')this.db.prepare('UPDATE tickets SET calls=calls+1,called_at=? WHERE id=?').run(this.clock().toISOString(),current.id);
   else if(['done','skipped'].includes(action))this.db.prepare('UPDATE tickets SET status=? WHERE id=?').run(action,current.id);
   else throw new Error('Tindakan tidak dikenal.');
  }
  return this.snapshot();
 });}
 snapshot(){
  const day=this.day(),current=this.db.prepare("SELECT * FROM tickets WHERE status='called'").get()||null;
  const counts={total:0,waiting:0,called:0,done:0,skipped:0};
  for(const row of this.db.prepare('SELECT status,count(*) count FROM tickets WHERE day=? GROUP BY status').all(day)){counts[row.status]=row.count;counts.total+=row.count;}
  const waiting=this.db.prepare("SELECT * FROM tickets WHERE day=? AND status='waiting' ORDER BY number").all(day);
  const recent=this.db.prepare("SELECT * FROM tickets WHERE day=? AND status IN ('done','skipped') ORDER BY id DESC LIMIT 10").all(day);
  return {day,current,counts,waiting,recent};
 }
 close(){this.db.close();}
}
