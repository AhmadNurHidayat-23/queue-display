export const $=selector=>document.querySelector(selector);
export function notify(text){$('#message').hidden=false;$('#message').textContent=text;}
function el(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
const number=value=>'A-'+String(value).padStart(3,'0');
let lastCall='';
export function renderState(state,online){
 $('#day').textContent=state.day+' / WIB';
 $('#current').textContent=state.current?number(state.current.number):'—';
 $('#call-note').textContent=state.current?'Panggilan ke-'+state.current.calls+' · Tiket '+state.current.day:'Belum ada nomor yang sedang dipanggil';
 for(const [id,key] of [['total','total'],['waiting-count','waiting'],['done','done'],['skipped','skipped']])$('#'+id).textContent=state.counts[key];
 const list=$('#waiting');list.replaceChildren();for(const t of state.waiting)list.append(el('span',number(t.number),'queue-number'));if(!state.waiting.length)list.append(el('p','Belum ada antrean menunggu hari ini.','empty'));
 if($('#recent')){const recent=$('#recent');recent.replaceChildren();for(const t of state.recent){const row=el('div','','row');row.append(el('strong',number(t.number)),el('span',t.status==='done'?'Selesai':'Dilewati'));recent.append(row);}if(!state.recent.length)recent.append(el('p','Hasil layanan akan tercatat setelah nomor selesai atau dilewati.','empty'));}
 if($('#next')){$('#next').disabled=!online||!!state.current||!state.waiting.length;for(const id of ['recall','finish','skip'])$('#'+id).disabled=!online||!state.current;}
 const call=state.current?state.current.id+':'+state.current.calls:'';
 if(call&&lastCall&&call!==lastCall&&document.body.dataset.page==='display')notify('Panggilan '+number(state.current.number)+' · ke-'+state.current.calls);
 lastCall=call;
}
