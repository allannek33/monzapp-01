const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ST={soumise:'Soumise',en_verification:'En cours de vérification',validee:'Validée',non_verifiee:'Non vérifiée',refusee:'Refusée',suspendue:'Suspendue'},PL={ios:'iOS',android:'Android',web:'Web',pwa:'PWA'},PUBS=['validee','non_verifiee'];
let me=null,cats=[],F={},tab='apps';
async function api(p,o={}){const fd=o.body instanceof FormData;const r=await fetch('/api'+p,{method:o.method||'GET',headers:{'x-requested-with':'monzapp',...(o.body&&!fd?{'content-type':'application/json'}:{})},body:o.body?(fd?o.body:JSON.stringify(o.body)):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Erreur réseau');return d}
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),3000)};
const go=h=>location.hash==='#'+h?route():(location.hash=h);
const icon=a=>a.icon_key?`<img src="/api/files/${esc(a.icon_key)}" alt="">`:`<span>${esc((a.name||'?')[0]).toUpperCase()}</span>`;
const badge=s=>`<span class="b ${s}">${ST[s]}</span>`,stars=r=>r?'★ '+r:'Pas encore noté';
const plats=a=>a.platforms.split(',').map(p=>PL[p]).join(' · ');
const card=a=>`<a class="card" href="#/app/${a.id}"><div class="ic">${icon(a)}</div><div class="ci"><b>${esc(a.name)}</b><br><small>${esc(a.cat||'')} · ${plats(a)}</small><p>${esc(a.description.slice(0,100))}${a.description.length>100?'…':''}</p>${badge(a.status)} <i>${stars(a.rating)} (${a.nrev})</i></div></a>`;
const sec=(t,l)=>`<h2>${t}</h2>${l.length?`<div class="grid">${l.map(card).join('')}</div>`:'<p class="mu">Aucune application publiée pour le moment. <a href="#/dev/new">Publie la première !</a></p>'}`;
function shrink(f,max){return new Promise((ok,ko)=>{const i=new Image(),u=URL.createObjectURL(f);i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);const x=c.getContext('2d');x.fillStyle='#11161a';x.fillRect(0,0,c.width,c.height);x.drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>b?ok(b):ko(new Error('Image illisible')),'image/jpeg',.82)};i.onerror=()=>ko(new Error('Image illisible'));i.src=u})}
const sel=(v,x)=>v===x?'selected':'';
async function loadMe(){try{me=(await api('/me')).user}catch{me=null}}

function nav(){const h=location.hash||'#/';const L=[['#/','Accueil'],['#/explore','Explorer'],...(me?[['#/dev','Publier'],['#/favorites','Favoris'],['#/profile','Profil']]:[['#/login','Connexion']]),...(me?.role==='admin'?[['#/admin','Admin']]:[])];
 const html=L.map(([u,t])=>`<a href="${u}" class="${h===u||(u!=='#/'&&h.startsWith(u))?'on':''}">${t}</a>`).join('');
 $('#top').innerHTML=`<a class="lg" href="#/"><img src="/img/m.png" alt=""><b>MONZAPP</b></a><div class="dn">${html}</div>`;$('#tabs').innerHTML=html}

async function home(){const[n,p]=await Promise.all([api('/apps?sort=new&limit=6'),api('/apps?sort=popular&limit=6')]);
 app.innerHTML=`<section class="hero"><h1>Découvre. Valide. Crée.</h1><p class="mu">Le catalogue indépendant d'applications, avec avis et statuts de validation éditoriale.</p><form onsubmit="return A.go(event)"><input name="q" placeholder="Rechercher une application…"><button>Rechercher</button></form></section><h2>Catégories</h2><div class="chips">${cats.map(c=>`<a href="#/explore?cat=${c.slug}">${esc(c.name)}</a>`).join('')}</div>${sec('Nouveautés',n.apps)}${sec('Populaires',p.apps)}`}

async function explore(qs){const P=new URLSearchParams(qs||''),g=k=>P.get(k)||'',r=await api('/apps?'+P);
 app.innerHTML=`<h1>Explorer</h1><form class="flt" onsubmit="return A.flt(event)"><input name="q" placeholder="Rechercher" value="${esc(g('q'))}"><select name="cat"><option value="">Toutes catégories</option>${cats.map(c=>`<option value="${c.slug}" ${sel(g('cat'),c.slug)}>${esc(c.name)}</option>`).join('')}</select><select name="platform"><option value="">Toutes plateformes</option>${Object.entries(PL).map(([k,v])=>`<option value="${k}" ${sel(g('platform'),k)}>${v}</option>`).join('')}</select><select name="sort">${[['new','Nouveauté'],['popular','Popularité'],['rating','Avis'],['validation','Statut de validation']].map(([k,v])=>`<option value="${k}" ${sel(g('sort'),k)}>${v}</option>`).join('')}</select><button>Filtrer</button></form><p class="mu">${r.apps.length} résultat(s)</p>${r.apps.length?`<div class="grid">${r.apps.map(card).join('')}</div>`:''}`}

async function detail(id){const d=await api('/apps/'+id),a=d.app,pub=PUBS.includes(a.status);
 const links=[['Site officiel',a.website],['GitHub',a.github],['Documentation',a.docs],['Présentation vidéo',a.video]].filter(x=>x[1]).map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${t}</a>`).join('');
 const rv=d.reviews.map(r=>`<div class="rv"><span><b>${esc(r.pseudo)}</b> <i>★ ${r.rating}</i></span><p>${esc(r.comment)}</p>${me?`<small>${me.id===r.user_id||me.role==='admin'?`<a href="#" onclick="return A.delrev(${r.id})">Supprimer</a> · `:''}${me.id!==r.user_id?`<a href="#" onclick="return A.report('${a.id}',${r.id})">Signaler</a>`:''}</small>`:''}</div>`).join('')||'<p class="mu">Aucun avis pour le moment.</p>';
 const canRev=me&&me.id!==a.owner_id&&pub;
 app.innerHTML=`<div class="det"><div class="ic big">${icon(a)}</div><div><h1>${esc(a.name)}</h1><small>${esc(a.developer_name)} · ${esc(a.cat||'')} · ${plats(a)}</small><br>${badge(a.status)} <i>${stars(a.rating)} (${a.nrev}) · ${a.nfav} ♥</i></div></div>
 ${a.status_note?`<p class="note">Note de modération : ${esc(a.status_note)}</p>`:''}${pub?'':'<p class="note">Cette fiche n\'est pas visible publiquement.</p>'}
 <a class="btn big" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer nofollow">ACCÉDER À L'APPLICATION</a><p>${esc(a.description).replace(/\n/g,'<br>')}</p>
 ${d.images.length?`<div class="shots">${d.images.map(i=>`<img src="/api/files/${esc(i)}" loading="lazy" alt="Capture d'écran">`).join('')}</div>`:''}<p class="lks">${links}</p>
 <p class="mu">Publiée le ${new Date(a.created_at).toLocaleDateString('fr-FR')} · mise à jour le ${new Date(a.updated_at).toLocaleDateString('fr-FR')}. Le statut de validation est une évaluation éditoriale, pas une certification de sécurité.</p>
 <div class="row"><button onclick="A.fav('${a.id}',${d.fav})">${d.fav?'♥ Retirer des favoris':'♡ Ajouter aux favoris'}</button><button class="ghost" onclick="A.report('${a.id}')">Signaler</button>${d.mine?`<a class="btn ghost" href="#/dev/edit/${a.id}">Modifier</a>`:''}</div>
 <h2>Avis</h2>${canRev?`<form class="f" onsubmit="return A.review(event,'${a.id}')"><select name="rating">${[5,4,3,2,1].map(n=>`<option value="${n}">${'★'.repeat(n)}</option>`).join('')}</select><textarea name="comment" rows="3" maxlength="1000" placeholder="Ton avis (facultatif)"></textarea><button>Publier mon avis</button></form>`:me?'':'<p><a href="#/login">Connecte-toi</a> pour donner ton avis.</p>'}${rv}`}

const authView=reg=>{app.innerHTML=`<h1>${reg?'Créer un compte':'Connexion'}</h1><form class="f" onsubmit="return A.auth(event,${reg})"><input name="email" type="email" placeholder="Email" required autocomplete="email">${reg?'<input name="pseudo" placeholder="Pseudo" required minlength="2" maxlength="30">':''}<input name="password" type="password" placeholder="Mot de passe (8 caractères min.)" required minlength="8" autocomplete="${reg?'new-password':'current-password'}"><button>${reg?'Créer mon compte':'Se connecter'}</button></form><p>${reg?'Déjà inscrit ? <a href="#/login">Connexion</a>':'Pas de compte ? <a href="#/register">Inscription</a>'}</p>`};

function profile(){app.innerHTML=`<h1>Mon profil</h1><p class="mu">${esc(me.email)} · rôle : ${me.role==='admin'?'administrateur':'membre'}</p><form class="f" onsubmit="return A.saveme(event)"><input name="pseudo" value="${esc(me.pseudo)}" required minlength="2" maxlength="30"><textarea name="bio" rows="3" maxlength="500" placeholder="Présentation">${esc(me.bio)}</textarea><button>Enregistrer</button></form>${me.role==='admin'?'':`<h2>Accès administrateur</h2><form class="f" onsubmit="return A.claim(event)"><input name="code" type="password" placeholder="Code administrateur" autocomplete="off"><button class="ghost">Activer</button></form>`}<div class="row"><a class="btn ghost" href="#/favorites">Mes favoris</a><a class="btn ghost" href="#/dev">Mes applications</a><button class="ghost" onclick="A.logout()">Se déconnecter</button></div>`}
async function favs(){const r=await api('/favorites');app.innerHTML=`<h1>Mes favoris</h1>${r.apps.length?`<div class="grid">${r.apps.map(card).join('')}</div>`:'<p class="mu">Aucun favori pour le moment.</p>'}`}
async function dev(){const r=await api('/my/apps');app.innerHTML=`<h1>Mes applications</h1><a class="btn" href="#/dev/new">+ Publier une application</a>${r.apps.map(a=>`<div class="row2"><span><a href="#/app/${a.id}"><b>${esc(a.name)}</b></a> ${badge(a.status)}</span><small>${a.nrev} avis · ${a.nfav} favoris${a.status_note?' · Note : '+esc(a.status_note):''}</small><span><a href="#/dev/edit/${a.id}">Modifier</a> · <a href="#" onclick="return A.del('${a.id}')">Supprimer</a></span></div>`).join('')||'<p class="mu">Tu n\'as pas encore publié d\'application.</p>'}`}

async function form(id){let a={platforms:'',images:[]};if(id){const d=await api('/apps/'+id);a=d.app;a.images=d.images}
 F={icon:a.icon_key||null,images:[...a.images],id};const v=k=>esc(a[k]);
 app.innerHTML=`<h1>${id?'Modifier':'Publier'} une application</h1><p class="mu">Chaque fiche est vérifiée par un administrateur avant d'être publique.</p><form class="f" onsubmit="return A.save(event)">
 <input name="name" placeholder="Nom officiel *" required maxlength="80" value="${v('name')}"><textarea name="description" rows="5" placeholder="Description * (20 caractères min.)" required maxlength="3000">${v('description')}</textarea>
 <select name="category_id" required><option value="">Catégorie *</option>${cats.map(c=>`<option value="${c.id}" ${sel(a.category_id,c.id)}>${esc(c.name)}</option>`).join('')}</select>
 <fieldset><legend>Plateformes *</legend>${Object.entries(PL).map(([k,n])=>`<label><input type="checkbox" name="platforms" value="${k}" ${(','+a.platforms+',').includes(','+k+',')?'checked':''}> ${n}</label>`).join('')}</fieldset>
 <input name="url" type="url" placeholder="Lien d'accès (App Store, Play Store, site, PWA…) *" required value="${v('url')}"><input name="developer_name" placeholder="Développeur / éditeur *" required value="${esc(a.developer_name||me.pseudo)}">
 <input name="website" type="url" placeholder="Site officiel (facultatif)" value="${v('website')}"><input name="github" type="url" placeholder="GitHub (facultatif)" value="${v('github')}"><input name="docs" type="url" placeholder="Documentation (facultatif)" value="${v('docs')}"><input name="video" type="url" placeholder="Présentation vidéo (facultatif)" value="${v('video')}">
 <label>Icône (redimensionnée automatiquement)<input type="file" accept="image/png,image/jpeg,image/webp" onchange="A.up(this,'icon')"></label><div class="pv" id="pvi"></div>
 <label>Captures d'écran (5 max)<input type="file" multiple accept="image/png,image/jpeg,image/webp" onchange="A.up(this,'img')"></label><div class="pv" id="pvs"></div>
 <button>${id?'Enregistrer':'Soumettre pour validation'}</button></form>`;pv()}
function pv(){$('#pvi').innerHTML=F.icon?`<div><img src="/api/files/${F.icon}" alt=""><a href="#" onclick="return A.rm('icon')">Retirer</a></div>`:'';$('#pvs').innerHTML=F.images.map((k,i)=>`<div><img src="/api/files/${k}" alt=""><a href="#" onclick="return A.rm(${i})">Retirer</a></div>`).join('')}

async function admin(){const tb=[['apps','Applications'],['reports','Signalements'],['cats','Catégories'],['users','Utilisateurs'],['stats','Statistiques']];let h='';
 if(tab==='apps'){const r=await api('/admin/apps');h=r.apps.map(a=>`<div class="row2"><span><a href="#/app/${a.id}"><b>${esc(a.name)}</b></a> ${badge(a.status)}</span><small>${esc(a.developer_name)} · ${esc(a.url)}</small><div class="adm"><select id="s-${a.id}">${Object.entries(ST).map(([k,n])=>`<option value="${k}" ${sel(a.status,k)}>${n}</option>`).join('')}</select><input id="n-${a.id}" placeholder="Note (facultatif)" value="${esc(a.status_note)}"><button onclick="A.setst('${a.id}')">Appliquer</button><button class="ghost" onclick="A.del('${a.id}')">Supprimer</button></div></div>`).join('')||'<p class="mu">Aucune application.</p>'}
 if(tab==='reports'){const r=await api('/admin/reports');h=r.reports.map(x=>`<div class="row2"><span><a href="#/app/${x.app_id}">${esc(x.app_name)}</a> · par ${esc(x.reporter)} · <b>${x.status}</b></span><small>${esc(x.reason)}${x.review_comment?' — Avis : '+esc(x.review_comment):''}</small><div class="adm">${x.status==='ouvert'?`<button onclick="A.resolve(${x.id})">Marquer traité</button>`:''}${x.review_id?`<button class="ghost" onclick="A.delrev(${x.review_id})">Supprimer l'avis</button>`:''}</div></div>`).join('')||'<p class="mu">Aucun signalement.</p>'}
 if(tab==='cats')h=`<form class="adm" onsubmit="return A.addcat(event)"><input name="name" placeholder="Nouvelle catégorie" required><button>Ajouter</button></form>`+cats.map(c=>`<div class="row2"><span>${esc(c.name)} <a href="#" onclick="return A.delcat(${c.id})">Supprimer</a></span></div>`).join('');
 if(tab==='users'){const r=await api('/admin/users');h=r.users.map(u=>`<div class="row2"><span><b>${esc(u.pseudo)}</b> · ${esc(u.email)} · ${u.role}</span>${u.id!==me.id?`<div class="adm"><button class="ghost" onclick="A.role('${u.id}','${u.role==='admin'?'user':'admin'}')">${u.role==='admin'?'Retirer admin':'Passer admin'}</button></div>`:''}</div>`).join('')}
 if(tab==='stats'){const s=await api('/admin/stats');h=`<div class="grid">${[['Utilisateurs',s.users],['Applications',s.apps],['À vérifier',s.pending],['Avis',s.reviews],['Signalements ouverts',s.reports]].map(([n,v])=>`<div class="row2"><small>${n}</small><b style="font-size:1.8rem">${v}</b></div>`).join('')}</div>`}
 app.innerHTML=`<h1>Administration</h1><div class="tabs">${tb.map(([k,n])=>`<button class="${tab===k?'on':''}" onclick="A.tab('${k}')">${n}</button>`).join('')}</div>${h}`}

const A={
 go(e){e.preventDefault();go('/explore?q='+encodeURIComponent(e.target.q.value))},
 flt(e){e.preventDefault();const p=new URLSearchParams();new FormData(e.target).forEach((v,k)=>v&&p.set(k,v));go('/explore?'+p)},
 async auth(e,reg){e.preventDefault();await api('/auth/'+(reg?'register':'login'),{method:'POST',body:Object.fromEntries(new FormData(e.target))});await loadMe();go('/')},
 async claim(e){e.preventDefault();await api('/admin-claim',{method:'POST',body:{code:e.target.code.value}});await loadMe();toast('Accès administrateur activé');route()},
 async logout(){await api('/auth/logout',{method:'POST'});me=null;go('/')},
 async saveme(e){e.preventDefault();await api('/me',{method:'PUT',body:Object.fromEntries(new FormData(e.target))});await loadMe();toast('Profil enregistré');route()},
 async fav(id,f){if(!me)return go('/login');await api('/apps/'+id+'/favorite',{method:f?'DELETE':'POST'});route()},
 async review(e,id){e.preventDefault();await api('/apps/'+id+'/reviews',{method:'POST',body:Object.fromEntries(new FormData(e.target))});toast('Avis enregistré');route()},
 async delrev(id){if(!confirm('Supprimer cet avis ?'))return;await api('/reviews/'+id,{method:'DELETE'});toast('Avis supprimé');route()},
 async report(id,rid){if(!me)return go('/login');const reason=prompt('Motif du signalement ?');if(!reason)return;await api('/apps/'+id+'/report',{method:'POST',body:{reason,review_id:rid}});toast('Signalement envoyé')},
 async del(id){if(!confirm('Supprimer définitivement cette application ?'))return;await api('/apps/'+id,{method:'DELETE'});toast('Application supprimée');go(location.hash.startsWith('#/admin')?'/admin':'/dev')},
 async up(inp,kind){for(const f of inp.files){if(kind==='img'&&F.images.length>=5){toast('5 captures maximum');break}const fd=new FormData();fd.append('file',await shrink(f,kind==='icon'?256:1000),'img.jpg');const{key}=await api('/upload',{method:'POST',body:fd});kind==='icon'?F.icon=key:F.images.push(key);pv()}inp.value=''},
 rm(k){k==='icon'?F.icon=null:F.images.splice(k,1);pv()},
 async save(e){e.preventDefault();const fd=new FormData(e.target),b=Object.fromEntries(fd);b.platforms=fd.getAll('platforms');b.icon_key=F.icon;b.images=F.images;
  await api(F.id?'/apps/'+F.id:'/apps',{method:F.id?'PUT':'POST',body:b});toast(F.id?'Fiche enregistrée':'Fiche soumise pour validation');go('/dev')},
 tab(t){tab=t;route()},
 async setst(id){await api(`/admin/apps/${id}/status`,{method:'POST',body:{status:$('#s-'+id).value,note:$('#n-'+id).value}});toast('Statut mis à jour');route()},
 async resolve(id){await api(`/admin/reports/${id}/resolve`,{method:'POST'});route()},
 async addcat(e){e.preventDefault();await api('/admin/categories',{method:'POST',body:{name:e.target.name.value}});cats=(await api('/categories')).categories;route()},
 async delcat(id){if(!confirm('Supprimer cette catégorie ?'))return;await api('/admin/categories/'+id,{method:'DELETE'});cats=(await api('/categories')).categories;route()},
 async role(id,role){await api(`/admin/users/${id}/role`,{method:'POST',body:{role}});route()}
};
for(const k in A){const f=A[k];A[k]=(...a)=>{try{const r=f(...a);if(r&&r.catch)r.catch(e=>toast(e.message))}catch(e){toast(e.message)}return false}}

const R=[[/^\/$/,home],[/^\/explore(?:\?(.*))?$/,explore],[/^\/app\/([\w-]+)$/,detail],[/^\/login$/,()=>authView(false)],[/^\/register$/,()=>authView(true)],[/^\/profile$/,profile],[/^\/favorites$/,favs],[/^\/dev$/,dev],[/^\/dev\/new$/,()=>form()],[/^\/dev\/edit\/([\w-]+)$/,form],[/^\/admin$/,admin]];
async function route(){const h=location.hash.slice(1)||'/';
 if(!me&&/^\/(dev|favorites|profile|admin)/.test(h)){location.hash='#/login';return}
 for(const[re,fn]of R){const m=h.match(re);if(m){nav();try{await fn(...m.slice(1))}catch(e){app.innerHTML=`<p class="err">${esc(e.message)}</p>`}scrollTo(0,0);return}}
 app.innerHTML='<h1>Page introuvable</h1><a href="#/">Retour à l\'accueil</a>'}
addEventListener('hashchange',route);
(async()=>{await loadMe();try{cats=(await api('/categories')).categories}catch{}route()})();
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));
