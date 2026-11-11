import {QueueStore} from './store.js';
import {createApp} from './app.js';
const store=new QueueStore(process.env.QUEUE_DB||'./data/queue.sqlite');
const {server,io}=createApp(store);
server.listen(Number(process.env.PORT||5331),process.env.HOST||'127.0.0.1',()=>console.log('Queue Display: http://'+(process.env.HOST||'127.0.0.1')+':'+(process.env.PORT||5331)));
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>{io.close(()=>{store.close();process.exit(0);});});
