import {QueueStore} from './store.js';
import {passwordHash} from './auth.js';
async function secret(){
 if(!process.stdin.isTTY){let value='';for await(const chunk of process.stdin)value+=chunk;return value.trim();}
 process.stdout.write('Kata sandi operator baru (minimal 12 karakter): ');
 process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
 return new Promise((resolve,reject)=>{let value='';const onData=chunk=>{
  for(const char of chunk){if(char==='\u0003'){finish();reject(new Error('Dibatalkan.'));return;}if(char==='\r'||char==='\n'){finish();resolve(value);return;}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' ')value+=char;}
 };function finish(){process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',onData);});
}
const store=new QueueStore(process.env.QUEUE_DB||'./data/queue.sqlite');
try{if(store.db.prepare('SELECT id FROM operator').get())throw new Error('Operator sudah dikonfigurasi; pengaturan awal tidak mengubah kata sandi yang ada.');const hash=passwordHash(await secret());store.db.prepare('INSERT INTO operator(id,password) VALUES(1,?)').run(hash);console.log('Operator disiapkan. Jalankan npm start, lalu masuk di /operator.');}catch(e){console.error(e.message);process.exitCode=1;}finally{store.close();}
