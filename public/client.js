import {renderState,notify,$} from './view.js';
let csrf='',authenticated=false,online=false;
const page=document.body.dataset.page;
async function api(url,body){const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body||{})});const value=await res.json();if(!res.ok){if(res.status===401&&url!=='/api/login')await session();throw new Error(value.error||'Permintaan gagal.');}return value;}
function access(){if(page!=='operator')return;$('#login-section').hidden=authenticated;$('#controls').hidden=!authenticated;}
async function session(){const res=await fetch('/api/session');const s=await res.json();csrf=s.csrf||'';authenticated=s.authenticated;if($('#setup-note'))$('#setup-note').textContent=s.configured?'Gunakan kata sandi yang diatur di server.':'Operator belum disiapkan. Jalankan npm run setup di terminal server terlebih dahulu.';access();}
const socket=io();
socket.on('connect',()=>{online=true;$('#connection').textContent='● Terhubung langsung';if($('#take'))$('#take').disabled=false;session().catch(e=>notify(e.message));});
socket.on('disconnect',()=>{online=false;$('#connection').textContent='○ Terputus · menunggu sambungan';if($('#take'))$('#take').disabled=true;document.querySelectorAll('.operator-actions button').forEach(b=>b.disabled=true);});
socket.on('state',state=>renderState(state,online));
socket.on('connect_error',()=>{$('#connection').textContent='○ Sambungan belum tersedia';});
if(page==='take')$('#take').addEventListener('click',async()=>{const b=$('#take');b.disabled=true;try{const ticket=await api('/api/tickets');$('#ticket').hidden=false;$('#your-number').textContent='A-'+String(ticket.number).padStart(3,'0');$('#your-day').textContent=ticket.day+' · Simpan tiket ini sampai dipanggil.';notify('Nomor berhasil dibuat. Pengambilan berikutnya menghasilkan tiket baru.');}catch(e){notify(e.message);}finally{b.disabled=!online;}});
if(page==='operator'){
 $('#login').addEventListener('submit',async e=>{e.preventDefault();try{const result=await api('/api/login',{password:new FormData(e.currentTarget).get('password')});csrf=result.csrf;authenticated=true;e.currentTarget.reset();access();notify('Anda masuk sebagai operator.');}catch(e){notify(e.message);}});
 $('#logout').addEventListener('click',async()=>{try{await api('/api/logout');csrf='';authenticated=false;access();notify('Anda telah keluar.');}catch(e){notify(e.message);}});
 for(const [id,action] of [['next','next'],['recall','recall'],['finish','done'],['skip','skipped']])$('#'+id).addEventListener('click',async()=>{const buttons=document.querySelectorAll('.operator-actions button');buttons.forEach(b=>b.disabled=true);try{renderState(await api('/api/operator/'+action),online);notify(action==='recall'?'Nomor dipanggil ulang.':'Status antrean diperbarui.');}catch(e){notify(e.message);}finally{try{const r=await fetch('/api/state');renderState(await r.json(),online);}catch{notify('Server belum dapat dihubungi. Tunggu sambungan pulih.');}}});
 session().catch(e=>notify(e.message));
}
