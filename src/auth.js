import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function passwordHash(value){if(typeof value!=='string'||value.length<12||value.length>200)throw new Error('Kata sandi harus 12–200 karakter.');const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(value,salt,64).toString('hex');}
function verify(value,stored){const [salt,hash]=stored.split(':');const actual=scryptSync(value,salt,64),expected=Buffer.from(hash,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function authRoutes(app,store){
 const attempts=new Map();
 const cookie=(token,age)=>'queue_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(process.env.SECURE_COOKIE==='1'?'; Secure':'');
 function session(req){const match=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('queue_session='));if(!match)return null;const token=match.slice('queue_session='.length);if(!/^[a-f0-9]{64}$/.test(token))return null;return store.db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(digest(token),Date.now());}
 app.get('/api/session',(req,res)=>{const s=session(req);res.json({authenticated:!!s,csrf:s?.csrf,configured:!!store.db.prepare('SELECT id FROM operator').get()});});
 app.post('/api/login',(req,res)=>{
  const key=req.ip,now=Date.now();let rate=attempts.get(key);
  if(!rate||rate.until<now){rate={count:0,until:now+900000};attempts.set(key,rate);}
  if(rate.count>=6)return res.status(429).json({error:'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'});
  const row=store.db.prepare('SELECT password FROM operator WHERE id=1').get(),value=req.body.password;
  if(!row)return res.status(503).json({error:'Operator belum diatur. Jalankan npm run setup di terminal server.'});
  if(typeof value!=='string'||value.length>200||!verify(value,row.password)){rate.count++;return res.status(401).json({error:'Kata sandi tidak cocok.'});}
  attempts.delete(key);const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
  store.db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
  const old=session(req);if(old)store.db.prepare('DELETE FROM sessions WHERE token=?').run(old.token);
  store.db.prepare('INSERT INTO sessions(token,csrf,expires) VALUES(?,?,?)').run(digest(token),csrf,now+28800000);
  res.setHeader('Set-Cookie',cookie(token,28800));res.json({csrf});
 });
 const protect=(req,res,next)=>{const s=session(req);if(!s)return res.status(401).json({error:'Masuk sebagai operator terlebih dahulu.'});if(req.headers['x-csrf-token']!==s.csrf)return res.status(403).json({error:'Sesi formulir tidak valid. Muat ulang halaman.'});req.operatorSession=s;next();};
 app.post('/api/logout',protect,(req,res)=>{store.db.prepare('DELETE FROM sessions WHERE token=?').run(req.operatorSession.token);res.setHeader('Set-Cookie',cookie('',0));res.json({message:'Anda telah keluar.'});});
 return protect;
}
