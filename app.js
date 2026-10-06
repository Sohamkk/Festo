const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const CFG=window.OP_CONFIG||{};
const ready=!!(window.supabase&&CFG.SUPABASE_URL&&!CFG.SUPABASE_URL.includes('PASTE')&&!CFG.SUPABASE_ANON_KEY.includes('PASTE'));
const sb=ready?supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;
const F=[
['halloween','Halloween','🎃','🎃🦇👻🕸️',0,270,'#ff7a1a','#1a0a00',0],
['diwali','Diwali','🪔','🪔✨🎆🌟',1,25,'#ffb020','#1c0f05',0],
['christmas','Christmas','🎄','❄️🎄⭐🎁',0,150,'#ff4d57','#ffffff',0],
['newyear','New Year','🥂','🎉🎊✨🥂',0,230,'#f5c542','#1a1400',0],
['holi','Holi','🎨','🎨💜💛💗',0,320,'#d6249f','#ffffff',1],
['navratri','Navratri and Garba','💃','💃🪘✨🌺',0,340,'#ff5fa2','#2a0015',0],
['durgapuja','Durga Puja','🔱','🔱🌺🪔🥁',0,5,'#e63946','#ffffff',0],
['ganesh','Ganesh Chaturthi','🐘','🐘🌺🪔🥥',0,30,'#ff8c1a','#1a0a00',0],
['dussehra','Dussehra','🏹','🏹🔥✨🎆',1,15,'#ff6b2c','#1a0800',0],
['eid','Eid','🌙','🌙⭐✨🕌',0,165,'#2ec4a0','#04201a',0],
['rakhi','Raksha Bandhan','🪢','🪢🌸💛🎁',0,345,'#ff7aa8','#2a0010',0],
['janmashtami','Janmashtami','🦚','🦚🪈🌼✨',0,215,'#4cc3ff','#001824',0],
['shivratri','Maha Shivratri','🕉️','🕉️🔱🌙✨',0,245,'#9d8cff','#0e0a2a',0],
['onam','Onam','🌼','🌼🍃🛶🌺',0,90,'#ffcc33','#1a1400',0],
['pongal','Pongal and Sankranti','🪁','🪁🌾☀️🌽',0,45,'#ffb703','#1a1000',0],
['baisakhi','Baisakhi and Lohri','🔥','🔥🌾🥁🪁',1,40,'#ff9f1c','#1a0d00',0],
['ugadi','Ugadi and Gudi Padwa','🌿','🌿🌼🥭🪔',0,120,'#ff9f43','#1a0d00',0],
['gurpurab','Guru Nanak Jayanti','🙏','🙏🕯️✨🌼',1,50,'#ffd23f','#1a1400',0],
['valentine','Valentine\'s Day','❤️','❤️💕🌹💌',0,340,'#ff3d7f','#ffffff',0],
['easter','Easter','🐣','🐣🥚🌷🐰',0,280,'#c77dff','#12001f',0],
['independence','Independence Day','🇮🇳','🇮🇳🎆✨🕊️',0,220,'#ff9933','#1a0d00',0],
['republic','Republic Day','🇮🇳','🇮🇳🎆✨🕊️',0,140,'#3ddc84','#00200d',0],
['other','Other occasions','🎉','🎉🎈✨🎊',0,260,'#ff6bd6','#1a0014',0]];
const TH={};F.forEach(f=>TH[f[0]]={n:f[1],e:f[2],fx:[...f[3]],up:f[4],h:f[5],a:f[6],o:f[7],l:f[8]});
function colors(t){const c=TH[t],r=document.documentElement.style,h=c.h,L=c.l;
const v={'--bg':L?`hsl(${h} 100% 98%)`:`hsl(${h} 45% 8%)`,'--card':L?'#fff':`hsl(${h} 35% 14%)`,'--line':L?`hsl(${h} 60% 88%)`:`hsl(${h} 30% 25%)`,'--ink':L?`hsl(${h} 60% 15%)`:`hsl(${h} 100% 96%)`,'--mut':L?`hsl(${h} 25% 40%)`:`hsl(${h} 20% 72%)`,'--ac':c.a,'--onac':c.o};
for(const k in v)r.setProperty(k,v[k])}
const CAT={student:'Student',professional:'Professional',other:'Member',organizer:'Organizer'};
const db={events:[],tickets:[],byId:{},user:null};
const me=()=>db.user;
const fmt=s=>new Date(s).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',6000)}

/* ---- data from Supabase ---- */
const mapEv=r=>({id:r.id,t:r.festival,title:r.title,date:r.starts_at,venue:r.venue,price:r.price_inr,seats:r.seats_left,org:r.organizer_name,oid:r.organizer_id});
async function loadEvents(){if(!sb)return;
const {data,error}=await sb.from('events_public').select('*').gte('starts_at',new Date().toISOString()).order('starts_at');
if(error)return toast(/events_public|schema cache/i.test(error.message)?'Database not set up yet: run the full database.sql in Supabase SQL Editor (see START-HERE.md).':'Could not load events: '+error.message);
db.events=data.map(mapEv);db.events.forEach(e=>db.byId[e.id]=e)}
async function loadUser(){db.user=null;db.tickets=[];if(!sb)return;
const {data:{session}}=await sb.auth.getSession();if(!session)return;const a=session.user;
const {data:p}=await sb.from('profiles').select('*').eq('id',a.id).maybeSingle();
db.user={id:a.id,name:p?p.name:'Member',cat:p?p.category:'other',email:a.email||'',verified:!!a.email_confirmed_at};
const {data:t}=await sb.from('tickets').select('id,event_id,user_id,created_at');db.tickets=t||[];
const miss=[...new Set(db.tickets.map(x=>x.event_id))].filter(i=>!db.byId[i]);
if(miss.length){const {data:ev}=await sb.from('events_public').select('*').in('id',miss);(ev||[]).forEach(r=>db.byId[r.id]=mapEv(r))}}
async function refresh(){await loadEvents();await loadUser();render()}

/* ---- theme + layout ---- */
let theme='halloween',view='home',eventFilter='all';
function setTheme(t,filterEvents=true){theme=t;if(filterEvents)eventFilter=t;document.documentElement.dataset.theme=t;colors(t);const c=TH[t],fx=$('#fx');fx.className=c.up?'up':'';fx.innerHTML='';
for(let i=0;i<16;i++){const s=document.createElement('span');s.textContent=c.fx[i%c.fx.length];s.style.left=Math.random()*100+'%';s.style.fontSize=(16+Math.random()*22)+'px';s.style.animationDuration=(9+Math.random()*10)+'s';s.style.animationDelay=(-Math.random()*15)+'s';fx.appendChild(s)}render()}
function showAllEvents(){eventFilter='all';render()}
function render(){const u=me();
$('#navr').innerHTML=u?`<button class="btn ghost" id="nh">Events</button> <button class="btn" id="np">${u.cat==='organizer'?'Organizer dashboard':`${esc(u.name.split(' ')[0])} · Profile`}</button>`:`<button class="btn" id="nl">Login / Register</button>`;
if(u){$('#nh').onclick=()=>{view='home';render()};$('#np').onclick=()=>{view='profile';render()}}else{$('#nl').onclick=()=>openAuth('login')}
view==='profile'&&u?profile(u):home()}

function home(){const c=TH[theme];
const list=db.events.filter(e=>eventFilter==='all'||e.t===eventFilter);
$('#main').innerHTML=(sb?'':`<div class="card" style="margin-top:10px"><b>Setup needed:</b> open <code>config.js</code> and paste your Supabase Project URL and anon key. See START-HERE.md.</div>`)+
`<h1>${eventFilter==='all'?'Upcoming events':`${c.e} ${c.n} events`}</h1><p class="sub">Browse events in every category or filter by occasion. Book an event by a verified organizer and get a QR ticket.</p>
<div class="chips" role="group" aria-label="Filter by occasion"><button class="chip" data-all-events aria-pressed="${eventFilter==='all'}">✨ All events</button>${Object.keys(TH).map(k=>`<button class="chip" data-t="${k}" aria-pressed="${k===eventFilter}">${TH[k].e} ${TH[k].n}</button>`).join('')}</div>
<div class="grid">${list.map(e=>{const eventTheme=TH[e.t]||c;return `<article class="card"><div class="big">${eventTheme.e}</div><h3>${esc(e.title)}</h3>
<span class="badge">${esc(eventTheme.n)}</span><div class="meta">📅 ${fmt(e.date)}</div><div class="meta">📍 ${esc(e.venue)}</div><div class="meta">by ${esc(e.org)} · ${e.seats} seats left</div>
<div class="row"><span class="price">₹${e.price}</span><button class="btn" data-book="${e.id}" ${e.seats<1?'disabled':''}>${e.seats<1?'Sold out':'Book now'}</button></div></article>`}).join('')||'<p class="sub">No upcoming events yet. Check back later or try another category.</p>'}</div>`;
$$('[data-all-events]').forEach(b=>b.onclick=showAllEvents);
$$('[data-t]').forEach(b=>b.onclick=()=>setTheme(b.dataset.t));
$$('[data-book]').forEach(b=>b.onclick=()=>openEvent(b.dataset.book))}

function profile(u){const mine=db.tickets.filter(t=>t.user_id===u.id);
let h=`<h1>${esc(u.name)}</h1><p><span class="badge">${CAT[u.cat]}</span>${u.verified?'<span class="badge">✔ Email verified</span>':''}</p><p class="meta">${esc(u.email)}</p>
<h2>My tickets</h2><div class="grid">${mine.map(t=>{const e=db.byId[t.event_id];return e?`<div class="card"><h3>${esc(e.title)}</h3><div class="meta">📅 ${fmt(e.date)}</div><div class="meta">📍 ${esc(e.venue)}</div><div class="meta">${t.id}</div><div class="row"><button class="btn" data-tk="${t.id}">View / download</button></div></div>`:''}).join('')||'<p class="sub">No tickets yet.</p>'}</div>`;
if(u.cat==='organizer'){const own=db.events.filter(e=>e.oid===u.id);
h+=`<h2>Create an event</h2><div class="card" style="max-width:460px"><div class="box" style="all:unset;display:block">
<label for="o_t">Event name</label><input id="o_t" placeholder="Event title" required>
<label for="o_th">Event category / occasion</label><select id="o_th" aria-label="Event category">${Object.keys(TH).map(k=>`<option value="${k}">${TH[k].n}</option>`).join('')}</select>
<label for="o_d">Date and time</label><input id="o_d" type="datetime-local" aria-label="Date and time" required>
<label for="o_v">Location / venue</label><input id="o_v" placeholder="Venue name and address" required>
<label for="o_p">Ticket price (INR)</label><input id="o_p" type="number" min="1" step="1" placeholder="Ticket price in ₹" required>
<label for="o_s">Available tickets</label><input id="o_s" type="number" min="1" step="1" placeholder="Number of seats" required>
<button class="btn" id="o_go" type="button">Publish event</button></div></div>
<h3>My upcoming events</h3><div class="grid">${own.map(e=>{const n=db.tickets.filter(t=>t.event_id===e.id).length;return`<div class="card"><h3>${esc(e.title)}</h3><div class="meta">${TH[e.t]?TH[e.t].n:''} · 📅 ${fmt(e.date)}</div><div class="meta">📍 ${esc(e.venue)}</div><div class="meta">${n} sold · ₹${n*e.price} collected</div></div>`}).join('')||'<p class="sub">You have not published an event yet.</p>'}</div>`}
h+=`<p><button class="btn ghost" id="lo">Log out</button></p>`;$('#main').innerHTML=h;
$$('[data-tk]').forEach(b=>b.onclick=()=>showTicket(b.dataset.tk));
$('#lo').onclick=async()=>{await sb.auth.signOut();view='home'};
const og=$('#o_go');if(og){$('#o_th').value=theme;og.onclick=async()=>{const t=$('#o_t').value.trim(),d=$('#o_d').value,v=$('#o_v').value.trim(),p=Number($('#o_p').value),s=Number($('#o_s').value),startsAt=new Date(d);
if(!t||!d||!v||!Number.isFinite(startsAt.getTime())||startsAt<=new Date()||!Number.isInteger(p)||p<1||!Number.isInteger(s)||s<1)return toast('Enter an event name, future date/time, venue, whole-rupee price, and ticket count.');
og.disabled=true;const {error}=await sb.from('events').insert({organizer_id:u.id,festival:$('#o_th').value,title:t,starts_at:new Date(d).toISOString(),venue:v,price_inr:p,seats:s});og.disabled=false;
if(error)return toast(error.message);toast('Event published! Everyone can now see it.');await loadEvents();render()}}}

/* ---- login / register ---- */
let A={mode:'login'};
function openAuth(mode){A.mode=mode;$('#auth').classList.add('on');applyAuth()}
function applyAuth(){const reg=A.mode==='register';
$('#at').textContent=reg?'Create your account':'Welcome back';
$$('.reg').forEach(x=>x.classList.toggle('hide',!reg));
$('#go').textContent=reg?'Create account':'Login';$('#sw').textContent=reg?'I have an account':'Create account';
$('#anote').textContent=reg?'Use a valid email address and a password of at least 6 characters.':'';
$('#sw').onclick=()=>{A.mode=A.mode==='login'?'register':'login';applyAuth()};
$('#go').onclick=async()=>{if(!sb)return toast('Add your Supabase keys in config.js first.');
const reg=A.mode==='register',name=$('#f_name').value.trim(),em=$('#f_email').value.trim().toLowerCase(),pw=$('#f_pass').value;
if(reg&&!name)return toast('Please enter your full name.');
if(reg){if(!/\S+@\S+\.\S+/.test(em)||pw.length<6)return toast('Enter a valid email and a password of 6+ characters.');
const {data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{name,category:$('#f_cat').value}}});if(error)return toast(error.message);
if(!data.session){closeAll();return toast('Check your email and click the confirmation link, then log in.')}}
else{const {error}=await sb.auth.signInWithPassword({email:em,password:pw});if(error)return toast(error.message)}
closeAll();view='home';toast('Welcome!')};
}
function closeAll(){$$('.modal').forEach(m=>m.classList.remove('on'))}
document.addEventListener('click',e=>{if(e.target.matches('[data-close]')||e.target.classList.contains('modal'))closeAll()});

/* ---- booking + ticket ---- */
function openEvent(id){const u=me();if(!u){toast('Please log in to book.');return openAuth('login')}
const e=db.byId[id],c=TH[e.t];
$('#evb').innerHTML=`<div class="big">${c.e}</div><h3>${esc(e.title)}</h3><span class="badge">${esc(c.n)}</span><div class="meta">📅 ${fmt(e.date)}</div><div class="meta">📍 ${esc(e.venue)}</div><div class="meta">Organizer: ${esc(e.org)}</div>
<p>Ticket for <b>${esc(u.name)}</b></p><div class="row"><span class="price">₹${e.price}</span><button class="btn" id="pay" ${e.seats<1?'disabled':''}>${e.seats<1?'Sold out':'Pay and get ticket'}</button></div>
<p class="note">Secure payment is processed by Razorpay. Your QR ticket is issued after payment is verified.</p><button class="link" data-close>Cancel</button>`;
$('#ev').classList.add('on');
$('#pay').onclick=async()=>{const b=$('#pay');b.disabled=true;
if(!window.Razorpay){b.disabled=false;return toast('Razorpay Checkout did not load. Check your connection and try again.')}
let order;
try{const {data,error}=await sb.functions.invoke('create-order',{body:{event_id:id}});
if(error||!data||data.error){b.disabled=false;return toast(data?.error||error?.message||'Could not start checkout. Please try again.')}
order=data;
}catch(error){b.disabled=false;return toast(error.message||'Could not start checkout. Please try again.')}
let paymentReturned=false;
try{const checkout=new Razorpay({key:order.key_id,amount:order.amount,currency:order.currency,name:'Occasion Pass',description:order.event_title,order_id:order.order_id,
prefill:{name:u.name,email:u.email},
handler:async response=>{paymentReturned=true;try{const {data:result,error:verifyError}=await sb.functions.invoke('verify-payment',{body:{reservation_id:order.reservation_id,razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature}});
if(verifyError||!result||result.error){closeAll();await loadEvents();await loadUser();render();return toast(result?.error||'Payment verification is pending. Check My tickets before trying to pay again.')}
closeAll();await loadEvents();await loadUser();render();
if(result.ticket_id)showTicket(result.ticket_id);
else toast(result.message||'No ticket was issued. If money was debited it will be refunded automatically.');
}catch(error){toast(error.message||'Payment may have been received. Check My tickets or contact support before trying again.')} },
modal:{ondismiss:()=>{if(!paymentReturned)b.disabled=false}}});
checkout.on('payment.failed',r=>{b.disabled=false;toast('Payment failed: '+(r.error&&r.error.description||'bank declined the payment')+'. No ticket was issued. Please try again.')});
checkout.open()}catch(error){b.disabled=false;toast(error.message||'Could not open Razorpay Checkout. Please try again.')}}
}
function showTicket(tid){const t=db.tickets.find(x=>x.id===tid),e=db.byId[t.event_id],u=me();
$('#tk').classList.add('on');const q=$('#qr');q.innerHTML='';
new QRCode(q,{text:`OCCASIONPASS|${t.id}|${e.id}|${u.name}`,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});
const c=$('#tc'),x=c.getContext('2d');c.width=680;c.height=300;
x.fillStyle='#fff';x.fillRect(0,0,680,300);x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--ac').trim()||'#f60';x.fillRect(0,0,16,300);
x.fillStyle='#111';x.font='bold 28px sans-serif';x.fillText(e.title.slice(0,26),40,56);
x.font='18px sans-serif';x.fillStyle='#444';x.fillText('Date: '+fmt(e.date),40,100);x.fillText('Venue: '+e.venue.slice(0,34),40,132);x.fillText('Name: '+u.name.slice(0,30),40,164);x.fillText('Organizer: '+e.org,40,196);
x.font='bold 20px monospace';x.fillStyle='#111';x.fillText(t.id,40,246);x.font='13px sans-serif';x.fillStyle='#777';x.fillText('Show this QR at entry',40,274);
const qc=q.querySelector('canvas');if(qc)x.drawImage(qc,430,40,220,220);
$('#dl').onclick=()=>c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='ticket-'+t.id+'.png';document.body.appendChild(a);a.click();a.remove()},'image/png')}

/* ---- start ---- */
setTheme('halloween',false);
if(sb)sb.auth.onAuthStateChange((ev)=>{if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(ev))setTimeout(refresh,0)});
