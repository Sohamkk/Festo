const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const KEY='occasionpass_v2';let mem=null;
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
function seed(){return{users:[],tickets:[],session:null,events:[]}}
function load(){try{const r=localStorage.getItem(KEY);if(r)return JSON.parse(r)}catch(e){}return mem}
let db=load()||seed();
function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){mem=db}}
async function hash(s){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return btoa(s)}}
const me=()=>db.users.find(u=>u.id===db.session);
const fmt=s=>new Date(s).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',5000)}

let theme='halloween',view='home';
function setTheme(t){theme=t;document.documentElement.dataset.theme=t;colors(t);const c=TH[t],fx=$('#fx');fx.className=c.up?'up':'';fx.innerHTML='';
for(let i=0;i<16;i++){const s=document.createElement('span');s.textContent=c.fx[i%c.fx.length];s.style.left=Math.random()*100+'%';s.style.fontSize=(16+Math.random()*22)+'px';s.style.animationDuration=(9+Math.random()*10)+'s';s.style.animationDelay=(-Math.random()*15)+'s';fx.appendChild(s)}render()}

function render(){const u=me();
$('#navr').innerHTML=u?`<button class="btn ghost" id="nh">Events</button> <button class="btn" id="np">${esc(u.name.split(' ')[0])} · Profile</button>`:`<button class="btn" id="nl">Login / Register</button>`;
if(u){$('#nh').onclick=()=>{view='home';render()};$('#np').onclick=()=>{view='profile';render()}}else{$('#nl').onclick=()=>openAuth('login')}
view==='profile'&&u?profile(u):home()}

function home(){const c=TH[theme];
const list=db.events.filter(e=>e.t===theme).sort((a,b)=>a.date.localeCompare(b.date));
$('#main').innerHTML=`<h1>${c.e} ${c.n} events near you</h1><p class="sub">Pick an occasion, book a verified event, and get a QR ticket for entry.</p>
<div class="chips" role="group" aria-label="Choose occasion">${Object.keys(TH).map(k=>`<button class="chip" data-t="${k}" aria-pressed="${k===theme}">${TH[k].e} ${TH[k].n}</button>`).join('')}</div>
<div class="grid">${list.map(e=>`<article class="card"><div class="big">${c.e}</div><h3>${esc(e.title)}</h3>
<div class="meta">📅 ${fmt(e.date)}</div><div class="meta">📍 ${esc(e.venue)}</div><div class="meta">by ${esc(e.org)} · ${e.seats} seats left</div>
<div class="row"><span class="price">₹${e.price}</span><button class="btn" data-book="${e.id}" ${e.seats<1?'disabled':''}>${e.seats<1?'Sold out':'Book now'}</button></div></article>`).join('')||'<p class="sub">No events yet for this occasion. Organizers can create the first one from their profile, and it will appear here for everyone.</p>'}</div>`;
$$('[data-t]').forEach(b=>b.onclick=()=>setTheme(b.dataset.t));
$$('[data-book]').forEach(b=>b.onclick=()=>openEvent(b.dataset.book))}

function profile(u){const mine=db.tickets.filter(t=>t.uid===u.id);
let h=`<h1>${esc(u.name)}</h1><p><span class="badge">${CAT[u.cat]}</span>${u.verified?'<span class="badge">✔ Phone verified</span>':''}</p><p class="meta">${esc(u.email)} · +91 ${esc(u.phone)}</p>
<h2>My tickets</h2><div class="grid">${mine.map(t=>{const e=db.events.find(x=>x.id===t.eid);return`<div class="card"><h3>${esc(e.title)}</h3><div class="meta">📅 ${fmt(e.date)}</div><div class="meta">📍 ${esc(e.venue)}</div><div class="meta">${t.id}</div><div class="row"><button class="btn" data-tk="${t.id}">View / download</button></div></div>`}).join('')||'<p class="sub">No tickets yet.</p>'}</div>`;
if(u.cat==='organizer'){const own=db.events.filter(e=>e.oid===u.id);
h+=`<h2>Organizer panel</h2><div class="card" style="max-width:460px"><div class="box" style="all:unset;display:block"><div id="oform">
<input id="o_t" placeholder="Event title"><select id="o_th">${Object.keys(TH).map(k=>`<option value="${k}">${TH[k].n}</option>`).join('')}</select>
<input id="o_d" type="datetime-local" aria-label="Date and time"><input id="o_v" placeholder="Venue address"><input id="o_p" type="number" min="0" placeholder="Ticket price in ₹"><input id="o_s" type="number" min="1" placeholder="Number of seats">
<button class="btn" id="o_go" type="button">Publish event</button></div></div></div>
<h3>My events</h3><div class="grid">${own.map(e=>`<div class="card"><h3>${esc(e.title)}</h3><div class="meta">📅 ${fmt(e.date)} · 📍 ${esc(e.venue)}</div><div class="meta">${db.tickets.filter(t=>t.eid===e.id).length} sold · ₹${db.tickets.filter(t=>t.eid===e.id).length*e.price} collected</div></div>`).join('')||'<p class="sub">You have not published an event yet.</p>'}</div>`}
h+=`<p><button class="btn ghost" id="lo">Log out</button></p>`;$('#main').innerHTML=h;
$$('[data-tk]').forEach(b=>b.onclick=()=>showTicket(b.dataset.tk));
$('#lo').onclick=()=>{db.session=null;save();view='home';render()};
const og=$('#o_go');if(og)og.onclick=()=>{const t=$('#o_t').value.trim(),d=$('#o_d').value,v=$('#o_v').value.trim(),p=+$('#o_p').value,s=+$('#o_s').value;
if(!t||!d||!v||!s||p<0||isNaN(p))return toast('Fill title, date, venue, price and seats.');
db.events.push({id:'e'+Date.now(),t:$('#o_th').value,title:t,date:d,venue:v,price:p,seats:s,org:u.name,oid:u.id});save();toast('Event published!');render()}}

/* auth */
let A={mode:'login',method:'email',otp:null,otpPhone:null};
function openAuth(mode){A.mode=mode;A.method='email';A.otp=null;$('#auth').classList.add('on');applyAuth()}
function applyAuth(){const reg=A.mode==='register',ph=A.method==='phone';
$('#at').textContent=reg?'Create your account':'Welcome back';
$('#tabs').classList.toggle('hide',reg);$$('.reg').forEach(x=>x.classList.toggle('hide',!reg));
$('#f_email').classList.toggle('hide',!reg&&ph);$('#f_pass').classList.toggle('hide',!reg&&ph);
$('#f_phone').classList.toggle('hide',!reg&&!ph);$('#otprow').classList.toggle('hide',!reg&&!ph);
$('#go').textContent=reg?'Create account':'Login';$('#sw').textContent=reg?'I have an account':'Create account';
$$('#tabs .chip').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===A.method))}
$$('#tabs .chip').forEach(b=>b.onclick=()=>{A.method=b.dataset.m;applyAuth()});
$('#sw').onclick=()=>{A.mode=A.mode==='login'?'register':'login';A.method='email';applyAuth()};
$('#sendotp').onclick=()=>{const p=$('#f_phone').value.trim();if(!/^\d{10}$/.test(p))return toast('Enter a valid 10-digit phone number.');
A.otp=String(Math.floor(100000+Math.random()*900000));A.otpPhone=p;toast('Demo OTP: '+A.otp)};
$('#go').onclick=async()=>{const em=$('#f_email').value.trim().toLowerCase(),pw=$('#f_pass').value,ph=$('#f_phone').value.trim(),otp=$('#f_otp').value.trim();
const otpOk=()=>A.otp&&otp===A.otp&&A.otpPhone===ph;
if(A.mode==='register'){const name=$('#f_name').value.trim();
if(!name||!/\S+@\S+\.\S+/.test(em)||pw.length<6||!/^\d{10}$/.test(ph))return toast('Check name, email, password (6+) and phone.');
if(!otpOk())return toast('Send an OTP and enter it correctly.');
if(db.users.some(u=>u.email===em||u.phone===ph))return toast('An account with this email or phone already exists.');
const u={id:'u'+Date.now(),name,cat:$('#f_cat').value,email:em,phone:ph,h:await hash(pw),verified:true};db.users.push(u);db.session=u.id;}
else if(A.method==='email'){const u=db.users.find(x=>x.email===em);if(!u||u.h!==await hash(pw))return toast('Wrong email or password.');db.session=u.id}
else{const u=db.users.find(x=>x.phone===ph);if(!u)return toast('No account with this phone.');if(!otpOk())return toast('Send an OTP and enter it correctly.');db.session=u.id}
save();A.otp=null;closeAll();toast('Logged in');render()};
function closeAll(){$$('.modal').forEach(m=>m.classList.remove('on'))}
document.addEventListener('click',e=>{if(e.target.matches('[data-close]')||e.target.classList.contains('modal'))closeAll()});

/* booking + ticket */
function openEvent(id){const u=me();if(!u){toast('Please log in to book.');return openAuth('login')}
const e=db.events.find(x=>x.id===id);const c=TH[e.t];
$('#evb').innerHTML=`<div class="big">${c.e}</div><h3>${esc(e.title)}</h3><div class="meta">📅 ${fmt(e.date)}</div><div class="meta">📍 ${esc(e.venue)}</div><div class="meta">Organizer: ${esc(e.org)}</div>
<p>Ticket for <b>${esc(u.name)}</b></p><div class="row"><span class="price">₹${e.price}</span><button class="btn" id="pay">Pay ₹${e.price}</button></div>
<p class="note">Prototype: no real payment is taken. A live site would use Razorpay or UPI here.</p><button class="link" data-close>Cancel</button>`;
$('#ev').classList.add('on');
$('#pay').onclick=()=>{if(e.seats<1)return;e.seats--;const t={id:'OP-'+Math.random().toString(36).slice(2,8).toUpperCase(),eid:e.id,uid:u.id,at:Date.now()};db.tickets.push(t);save();closeAll();render();showTicket(t.id)}}
function showTicket(tid){const t=db.tickets.find(x=>x.id===tid),e=db.events.find(x=>x.id===t.eid),u=db.users.find(x=>x.id===t.uid);
$('#tk').classList.add('on');const q=$('#qr');q.innerHTML='';
new QRCode(q,{text:`OCCASIONPASS|${t.id}|${e.id}|${u.name}`,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});
const c=$('#tc'),x=c.getContext('2d');c.width=680;c.height=300;
x.fillStyle='#fff';x.fillRect(0,0,680,300);x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--ac').trim()||'#f60';x.fillRect(0,0,16,300);
x.fillStyle='#111';x.font='bold 28px sans-serif';x.fillText(e.title.slice(0,26),40,56);
x.font='18px sans-serif';x.fillStyle='#444';x.fillText('Date: '+fmt(e.date),40,100);x.fillText('Venue: '+e.venue.slice(0,34),40,132);x.fillText('Name: '+u.name.slice(0,30),40,164);x.fillText('Organizer: '+e.org,40,196);
x.font='bold 20px monospace';x.fillStyle='#111';x.fillText(t.id,40,246);x.font='13px sans-serif';x.fillStyle='#777';x.fillText('Occasion Pass · Show this QR at entry',40,274);
const qc=q.querySelector('canvas');if(qc)x.drawImage(qc,430,40,220,220);
$('#dl').onclick=()=>c.toBlob(async b=>{try{const d=await claude.use('downloads');if(!d){$('#dlnote').textContent='Download is not available here. Press and hold the ticket image to save it, or take a screenshot.';return}
await d.save({filename:'ticket-'+t.id+'.png',data:b})}catch(err){$('#dlnote').textContent=err&&err.code==='declined'?'Download cancelled.':'Could not download. Take a screenshot of the ticket instead.'}},'image/png')}
setTheme('halloween');
