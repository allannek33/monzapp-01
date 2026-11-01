class E extends Error{constructor(m,s=400){super(m);this.status=s}}
const J=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...h}});
const enc=new TextEncoder(),hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''),unhex=s=>new Uint8Array(s.match(/../g).map(x=>parseInt(x,16))),rnd=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const pbk=async(pw,salt)=>hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(salt),iterations:100000},await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']),256));
const ST=['soumise','en_verification','validee','non_verifiee','refusee','suspendue'],PLAT=['ios','android','web','pwa'],PUBS=['validee','non_verifiee'],PUB="a.status IN ('validee','non_verifiee')";
const okUrl=u=>{try{return/^https?:$/.test(new URL(u).protocol)}catch{return false}};
const opt=u=>{u=(u||'').toString().trim();if(!u)return null;if(!okUrl(u))throw new E('Lien invalide : '+u);return u};
const slug=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const SEL=`SELECT a.*,c.name cat,c.slug catslug,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE app_id=a.id) rating,(SELECT COUNT(*) FROM reviews WHERE app_id=a.id) nrev,(SELECT COUNT(*) FROM favorites WHERE app_id=a.id) nfav FROM applications a LEFT JOIN categories c ON c.id=a.category_id`;
const O={popular:'nfav DESC,nrev DESC,a.created_at DESC',new:'a.created_at DESC',rating:'rating DESC,nrev DESC',validation:"(a.status='validee') DESC,a.created_at DESC"};
const IMG={'image/png':1,'image/jpeg':1,'image/webp':1};

async function api(r,env){
 const DB=env.DB,U=new URL(r.url),p=U.pathname.replace(/^\/api/,'')||'/',M=r.method,Q=U.searchParams;
 const q=(s,...a)=>DB.prepare(s).bind(...a);
 try{
  if(!DB)throw new E('Base de données non reliée : suivre l\'étape « Relier la base » du guide',503);
  await init(DB);
  if(M!=='GET'&&r.headers.get('x-requested-with')!=='monzapp')throw new E('Requête refusée',403);
  const t=(r.headers.get('cookie')||'').match(/(?:^|;\s*)mz=([a-f0-9]+)/)?.[1];
  const me=t?await q('SELECT u.id,u.email,u.pseudo,u.role,u.bio FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',await sha(t),Date.now()).first():null;
  const need=()=>{if(!me)throw new E('Connexion requise',401)},adm=()=>{need();if(me.role!=='admin')throw new E('Réservé aux administrateurs',403)};
  const log=(a,x)=>q('INSERT INTO admin_logs(admin_id,action,target,created_at) VALUES(?,?,?,?)',me.id,a,String(x),Date.now()).run();
  const body=async()=>/json/.test(r.headers.get('content-type')||'')?await r.json().catch(()=>({})):{};
  const sess=async id=>{const k=rnd(32);await q('INSERT INTO sessions VALUES(?,?,?)',await sha(k),id,Date.now()+2592e6).run();return J({ok:true},200,{'set-cookie':`mz=${k}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`})};
  const canSee=a=>a&&(PUBS.includes(a.status)||(me&&(me.id===a.owner_id||me.role==='admin')));
  const clean=async b=>{const s=k=>(b[k]??'').toString().trim(),plats=[...new Set((Array.isArray(b.platforms)?b.platforms:[]).filter(x=>PLAT.includes(x)))],cid=+b.category_id;
   if(s('name').length<2||s('name').length>80||s('description').length<20||s('description').length>3000||s('developer_name').length<2||!plats.length||!okUrl(s('url')))throw new E("Champs invalides : nom, description (20 caractères min.), développeur, plateformes et lien d'accès (http/https) sont obligatoires");
   if(!await q('SELECT 1 FROM categories WHERE id=?',cid).first())throw new E('Catégorie invalide');
   const key=k=>/^[a-f0-9]{32}$/.test(k||'')?k:null;
   return{name:s('name'),description:s('description'),category_id:cid,platforms:plats.join(','),url:s('url'),developer_name:s('developer_name'),website:opt(b.website),github:opt(b.github),docs:opt(b.docs),video:opt(b.video),icon_key:key(b.icon_key),images:(Array.isArray(b.images)?b.images:[]).map(key).filter(Boolean).slice(0,5)}};
  let m;

  // ---- Auth
  if(p==='/auth/register'&&M==='POST'){const b=await body(),email=(b.email||'').trim().toLowerCase(),pseudo=(b.pseudo||'').trim(),pw=b.password||'';
   if(!/^\S+@\S+\.\S+$/.test(email)||pseudo.length<2||pseudo.length>30||pw.length<8||pw.length>200)throw new E('Email, pseudo (2 à 30 caractères) ou mot de passe (8 caractères min.) invalide');
   if(await q('SELECT 1 FROM users WHERE email=? OR pseudo=?',email,pseudo).first())throw new E('Email ou pseudo déjà utilisé',409);
   const salt=rnd(16),id=crypto.randomUUID();
   await q('INSERT INTO users(id,email,pseudo,pass_hash,salt,role,created_at) VALUES(?,?,?,?,?,?,?)',id,email,pseudo,await pbk(pw,salt),salt,'user',Date.now()).run();
   return sess(id)}
  if(p==='/auth/login'&&M==='POST'){const b=await body(),u=await q('SELECT * FROM users WHERE email=?',(b.email||'').trim().toLowerCase()).first();
   if(!u||await pbk(b.password||'',u.salt)!==u.pass_hash)throw new E('Email ou mot de passe incorrect',401);return sess(u.id)}
  if(p==='/auth/logout'&&M==='POST'){if(t)await q('DELETE FROM sessions WHERE token_hash=?',await sha(t)).run();return J({ok:true},200,{'set-cookie':'mz=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'})}
  if(p==='/me'&&M==='GET')return J({user:me});
  if(p==='/me'&&M==='PUT'){need();const b=await body(),pseudo=(b.pseudo||'').trim(),bio=(b.bio||'').toString().slice(0,500);
   if(pseudo.length<2||pseudo.length>30)throw new E('Pseudo invalide (2 à 30 caractères)');
   if(await q('SELECT 1 FROM users WHERE pseudo=? AND id!=?',pseudo,me.id).first())throw new E('Pseudo déjà utilisé',409);
   await q('UPDATE users SET pseudo=?,bio=? WHERE id=?',pseudo,bio,me.id).run();return J({ok:true})}

  // ---- Public
  if(p==='/categories'&&M==='GET')return J({categories:(await q('SELECT * FROM categories ORDER BY name').all()).results});
  if(m=p.match(/^\/files\/([a-f0-9]{32})$/)){const f=await q('SELECT type,data FROM files WHERE id=?',m[1]).first();if(!f)throw new E('Fichier introuvable',404);
   return new Response(Uint8Array.from(atob(f.data),c=>c.charCodeAt(0)),{headers:{'content-type':f.type,'cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}})}
  if(p==='/upload'&&M==='POST'){need();const f=(await r.formData()).get('file');
   if(!f||typeof f==='string'||!IMG[f.type])throw new E('Format accepté : PNG, JPEG ou WebP');if(f.size>716800)throw new E('Image trop lourde (700 Ko max)');
   if((await q('SELECT COUNT(*) c FROM files WHERE user_id=? AND created_at>?',me.id,Date.now()-864e5).first()).c>=60)throw new E("Limite quotidienne d'envois atteinte",429);
   const u8=new Uint8Array(await f.arrayBuffer());let b='';for(let i=0;i<u8.length;i+=8192)b+=String.fromCharCode(...u8.subarray(i,i+8192));
   const key=rnd(16);await q('INSERT INTO files(id,user_id,type,data,created_at) VALUES(?,?,?,?,?)',key,me.id,f.type,btoa(b),Date.now()).run();return J({key},201)}

  // ---- Applications
  if(p==='/apps'&&M==='GET'){const w=[PUB],a=[],s=Q.get('q');
   if(s){w.push('(a.name LIKE ? OR a.description LIKE ? OR a.developer_name LIKE ?)');a.push(`%${s}%`,`%${s}%`,`%${s}%`)}
   if(Q.get('cat')){w.push('c.slug=?');a.push(Q.get('cat'))}
   if(PLAT.includes(Q.get('platform'))){w.push("(','||a.platforms||',') LIKE ?");a.push(`%,${Q.get('platform')},%`)}
   return J({apps:(await q(`${SEL} WHERE ${w.join(' AND ')} ORDER BY ${O[Q.get('sort')]||O.new} LIMIT ?`,...a,Math.min(+Q.get('limit')||60,100)).all()).results})}
  if(p==='/apps'&&M==='POST'){need();const d=await clean(await body()),id=crypto.randomUUID(),n=Date.now();
   await DB.batch([q('INSERT INTO applications(id,owner_id,name,description,category_id,platforms,url,developer_name,website,github,docs,video,icon_key,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,me.id,d.name,d.description,d.category_id,d.platforms,d.url,d.developer_name,d.website,d.github,d.docs,d.video,d.icon_key,'soumise',n,n),...d.images.map(k=>q('INSERT INTO application_images(app_id,file_key) VALUES(?,?)',id,k))]);
   return J({id},201)}
  if(p==='/my/apps'){need();return J({apps:(await q(SEL+' WHERE a.owner_id=? ORDER BY a.created_at DESC',me.id).all()).results})}
  if(p==='/favorites'){need();return J({apps:(await q(SEL+` JOIN favorites f ON f.app_id=a.id WHERE f.user_id=? AND ${PUB} ORDER BY a.name`,me.id).all()).results})}
  if(m=p.match(/^\/apps\/([\w-]+)(?:\/(reviews|favorite|report))?$/)){
   const a=await q(SEL+' WHERE a.id=?',m[1]).first();if(!canSee(a))throw new E('Application introuvable',404);
   const sub=m[2],mine=!!(me&&(me.id===a.owner_id||me.role==='admin'));
   if(!sub&&M==='GET'){if(!mine)delete a.status_note;
    return J({app:a,mine,fav:me?!!await q('SELECT 1 FROM favorites WHERE user_id=? AND app_id=?',me.id,a.id).first():false,
     images:(await q('SELECT file_key FROM application_images WHERE app_id=? ORDER BY id',a.id).all()).results.map(x=>x.file_key),
     reviews:(await q('SELECT r.id,r.rating,r.comment,r.created_at,r.user_id,u.pseudo FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.app_id=? ORDER BY r.created_at DESC LIMIT 100',a.id).all()).results})}
   if(!sub&&M==='PUT'){need();if(!mine)throw new E('Accès refusé',403);const d=await clean(await body()),st=me.role==='admin'?a.status:'soumise';
    await DB.batch([q('UPDATE applications SET name=?,description=?,category_id=?,platforms=?,url=?,developer_name=?,website=?,github=?,docs=?,video=?,icon_key=?,status=?,updated_at=? WHERE id=?',d.name,d.description,d.category_id,d.platforms,d.url,d.developer_name,d.website,d.github,d.docs,d.video,d.icon_key,st,Date.now(),a.id),q('DELETE FROM application_images WHERE app_id=?',a.id),...d.images.map(k=>q('INSERT INTO application_images(app_id,file_key) VALUES(?,?)',a.id,k))]);
    return J({ok:true})}
   if(!sub&&M==='DELETE'){need();if(!mine)throw new E('Accès refusé',403);await q('DELETE FROM applications WHERE id=?',a.id).run();if(me.role==='admin')await log('app_delete',a.id);return J({ok:true})}
   if(sub==='reviews'&&M==='POST'){need();const b=await body(),rt=+b.rating,cm=(b.comment||'').toString().trim().slice(0,1000);
    if(!PUBS.includes(a.status))throw new E("Cette application n'est pas publique");if(me.id===a.owner_id)throw new E('Vous ne pouvez pas noter votre propre application');
    if(!Number.isInteger(rt)||rt<1||rt>5)throw new E('Note invalide (1 à 5)');
    await q('INSERT INTO reviews(app_id,user_id,rating,comment,created_at) VALUES(?,?,?,?,?) ON CONFLICT(app_id,user_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment',a.id,me.id,rt,cm,Date.now()).run();return J({ok:true})}
   if(sub==='favorite'){need();await(M==='DELETE'?q('DELETE FROM favorites WHERE user_id=? AND app_id=?',me.id,a.id):q('INSERT OR IGNORE INTO favorites VALUES(?,?)',me.id,a.id)).run();return J({ok:true})}
   if(sub==='report'&&M==='POST'){need();const b=await body(),why=(b.reason||'').toString().trim().slice(0,500);if(why.length<3)throw new E('Motif requis');
    await q('INSERT INTO reports(app_id,review_id,user_id,reason,created_at) VALUES(?,?,?,?,?)',a.id,+b.review_id||null,me.id,why,Date.now()).run();return J({ok:true},201)}
  }
  if(m=p.match(/^\/reviews\/(\d+)$/)){if(M==='DELETE'){need();const v=await q('SELECT * FROM reviews WHERE id=?',+m[1]).first();if(!v)throw new E('Avis introuvable',404);
   if(v.user_id!==me.id&&me.role!=='admin')throw new E('Accès refusé',403);await q('DELETE FROM reviews WHERE id=?',v.id).run();if(me.role==='admin'&&v.user_id!==me.id)await log('review_delete',v.id);return J({ok:true})}}

  if(p==='/admin-claim'&&M==='POST'){need();const b=await body(),code=env.ADMIN_CODE;
   if(!code||code.length<12)throw new E("L'accès administrateur n'est pas configuré (variable ADMIN_CODE, 12 caractères minimum)",503);
   if((await q('SELECT COUNT(*) c FROM attempts WHERE user_id=? AND at>?',me.id,Date.now()-9e5).first()).c>=5)throw new E('Trop de tentatives, réessayez dans 15 minutes',429);
   if(!await same((b.code||'').toString(),code)){await q('INSERT INTO attempts(user_id,at) VALUES(?,?)',me.id,Date.now()).run();throw new E('Code incorrect',403)}
   await q("UPDATE users SET role='admin' WHERE id=?",me.id).run();await log('admin_claim',me.id);return J({ok:true})}
  // ---- Administration
  if(p.startsWith('/admin/')){adm();
   if(p==='/admin/stats'){const c=async s=>(await q(s).first()).c;return J({users:await c('SELECT COUNT(*) c FROM users'),apps:await c('SELECT COUNT(*) c FROM applications'),pending:await c("SELECT COUNT(*) c FROM applications WHERE status IN ('soumise','en_verification')"),reviews:await c('SELECT COUNT(*) c FROM reviews'),reports:await c("SELECT COUNT(*) c FROM reports WHERE status='ouvert'")})}
   if(p==='/admin/apps'){const st=Q.get('status');return J({apps:(await q(SEL+(st?' WHERE a.status=?':'')+' ORDER BY a.created_at DESC LIMIT 200',...(st?[st]:[])).all()).results})}
   if(m=p.match(/^\/admin\/apps\/([\w-]+)\/status$/)){const b=await body();if(!ST.includes(b.status))throw new E('Statut invalide');
    await q('UPDATE applications SET status=?,status_note=?,updated_at=? WHERE id=?',b.status,(b.note||'').toString().slice(0,500)||null,Date.now(),m[1]).run();await log('status:'+b.status,m[1]);return J({ok:true})}
   if(p==='/admin/categories'&&M==='POST'){const b=await body(),n=(b.name||'').trim(),s=slug(n);if(n.length<2||!s)throw new E('Nom invalide');
    if(await q('SELECT 1 FROM categories WHERE slug=?',s).first())throw new E('Catégorie déjà existante',409);await q('INSERT INTO categories(slug,name) VALUES(?,?)',s,n).run();await log('category_add',s);return J({ok:true},201)}
   if(m=p.match(/^\/admin\/categories\/(\d+)$/)){await q('DELETE FROM categories WHERE id=?',+m[1]).run();await log('category_delete',m[1]);return J({ok:true})}
   if(p==='/admin/reports')return J({reports:(await q("SELECT r.id,r.reason,r.status,r.created_at,r.app_id,r.review_id,a.name app_name,u.pseudo reporter,rv.comment review_comment FROM reports r LEFT JOIN applications a ON a.id=r.app_id LEFT JOIN users u ON u.id=r.user_id LEFT JOIN reviews rv ON rv.id=r.review_id ORDER BY (r.status='ouvert') DESC,r.created_at DESC LIMIT 100").all()).results});
   if(m=p.match(/^\/admin\/reports\/(\d+)\/resolve$/)){await q("UPDATE reports SET status='traite' WHERE id=?",+m[1]).run();await log('report_resolve',m[1]);return J({ok:true})}
   if(p==='/admin/users')return J({users:(await q('SELECT id,email,pseudo,role,created_at FROM users ORDER BY created_at DESC LIMIT 200').all()).results});
   if(m=p.match(/^\/admin\/users\/([\w-]+)\/role$/)){const b=await body();if(!['user','admin'].includes(b.role))throw new E('Rôle invalide');if(m[1]===me.id)throw new E('Vous ne pouvez pas modifier votre propre rôle');
    await q('UPDATE users SET role=? WHERE id=?',b.role,m[1]).run();await log('role:'+b.role,m[1]);return J({ok:true})}
  }
  throw new E('Route inconnue',404);
 }catch(e){if(e instanceof E)return J({error:e.message},e.status);console.error(e);return J({error:'Erreur serveur'},500)}
}

const DDL=["CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,pseudo TEXT UNIQUE NOT NULL,pass_hash TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',bio TEXT DEFAULT '',created_at INTEGER NOT NULL)", "CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL)", "CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT UNIQUE NOT NULL,name TEXT NOT NULL)", "CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT NOT NULL,category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,platforms TEXT NOT NULL,url TEXT NOT NULL,developer_name TEXT NOT NULL,website TEXT,github TEXT,docs TEXT,video TEXT,icon_key TEXT,status TEXT NOT NULL DEFAULT 'soumise',status_note TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)", "CREATE TABLE IF NOT EXISTS application_images(id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,file_key TEXT NOT NULL)", "CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,rating INTEGER NOT NULL,comment TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,UNIQUE(app_id,user_id))", "CREATE TABLE IF NOT EXISTS favorites(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,app_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,PRIMARY KEY(user_id,app_id))", "CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,review_id INTEGER,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ouvert',created_at INTEGER NOT NULL)", "CREATE TABLE IF NOT EXISTS admin_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id TEXT NOT NULL,action TEXT NOT NULL,target TEXT,created_at INTEGER NOT NULL)", "CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status,created_at)", "CREATE INDEX IF NOT EXISTS idx_apps_owner ON applications(owner_id)", "CREATE INDEX IF NOT EXISTS idx_rev_app ON reviews(app_id)", "CREATE INDEX IF NOT EXISTS idx_sess_exp ON sessions(expires_at)", "CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,type TEXT NOT NULL,data TEXT NOT NULL,created_at INTEGER NOT NULL)", "CREATE TABLE IF NOT EXISTS attempts(user_id TEXT NOT NULL,at INTEGER NOT NULL)", "CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT)"];
let ready=false;
async function init(DB){if(ready)return;await DB.batch(DDL.map(x=>DB.prepare(x)));
 if(!await DB.prepare("SELECT 1 FROM meta WHERE k='seeded'").first())await DB.batch([DB.prepare("INSERT OR IGNORE INTO categories(slug,name) VALUES('productivite','Productivité'),('finance','Finance'),('education','Éducation'),('divertissement','Divertissement'),('sante-sport','Santé et sport'),('ia','Intelligence artificielle'),('business','Business'),('creation','Création'),('autres','Autres')"),DB.prepare("INSERT OR IGNORE INTO meta VALUES('seeded','1')")]);
 ready=true}
const same=async(a,b)=>{const x=await sha(a),y=await sha(b);let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0};
export default{async fetch(r,env){return new URL(r.url).pathname.startsWith('/api/')?api(r,env):env.ASSETS.fetch(r)}};
