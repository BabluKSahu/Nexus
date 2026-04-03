// ====== UTILITIES ======
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);
const timeAgo=ts=>{const s=Math.floor((Date.now()-ts)/1000);if(s<60)return'just now';const m=Math.floor(s/60);if(m<60)return m+'m ago';const h=Math.floor(m/60);if(h<24)return h+'h ago';const d=Math.floor(h/24);if(d<30)return d+'d ago';const mo=Math.floor(d/30);if(mo<12)return mo+'mo ago';return Math.floor(mo/12)+'y ago'};
const escapeHtml=t=>{const d=document.createElement('div');d.textContent=t;return d.innerHTML};
const avatarColor=name=>{let h=0;for(let i=0;i<name.length;i++)h=name.charCodeAt(i)+((h<<5)-h);const c=['#FF6B35','#00D4AA','#6C5CE7','#FD79A8','#00B894','#E17055','#0984E3','#FDCB6E','#E84393','#55A3F0'];return c[Math.abs(h)%c.length]};
const hotScore=p=>{const age=(Date.now()-p.createdAt)/3600000;return(p.upvotes-p.downvotes)/Math.pow(age+2,1.5)};
const truncate=(s,n)=>s.length>n?s.slice(0,n)+'...':s;

// SHA-256 Hash for passwords
async function hashPwd(pwd,salt){const enc=new TextEncoder();const data=enc.encode(salt+pwd);const buf=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')}

// ====== DATABASE (IndexedDB) ======
class NexusDB{
  constructor(){this.db=null;this.DB_NAME='NexusCommunity';this.DB_VERSION=3}
  async init(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(this.DB_NAME,this.DB_VERSION);
      req.onupgradeneeded=e=>{
        const db=e.target.result;
        const stores=['users','communities','posts','comments','votes','memberships','saves'];
        stores.forEach(name=>{
          if(!db.objectStoreNames.contains(name)){
            const store=db.createObjectStore(name,{keyPath:'id'});
            if(name==='users')store.createIndex('username','username',{unique:true});
            if(name==='users')store.createIndex('email','email',{unique:true});
            if(name==='communities')store.createIndex('name','name',{unique:true});
            if(name==='posts')store.createIndex('communityId','communityId',{unique:false});
            if(name==='posts')store.createIndex('authorId','authorId',{unique:false});
            if(name==='comments')store.createIndex('postId','postId',{unique:false});
            if(name==='comments')store.createIndex('parentId','parentId',{unique:false});
            if(name==='votes')store.createIndex('userId_targetId_targetType',['userId','targetId','targetType'],{unique:true});
            if(name==='memberships')store.createIndex('userId_communityId',['userId','communityId'],{unique:true});
            if(name==='saves')store.createIndex('userId_postId',['userId','postId'],{unique:true});
          }
        });
      };
      req.onsuccess=e=>{this.db=e.target.result;resolve()};
      req.onerror=e=>reject(e.target.error);
    });
  }
  _tx(store,mode='readonly'){return this.db.transaction(store,mode).objectStore(store)}
  async put(store,data){return new Promise((r,j)=>{const req=this._tx(store,'readwrite').put(data);req.onsuccess=()=>r(data);req.onerror=e=>j(e.target.error)})}
  async get(store,id){return new Promise((r,j)=>{const req=this._tx(store).get(id);req.onsuccess=()=>r(req.result);req.onerror=e=>j(e.target.error)})}
  async getAll(store){return new Promise((r,j)=>{const req=this._tx(store).getAll();req.onsuccess=()=>r(req.result||[]);req.onerror=e=>j(e.target.error)})}
  async getByIndex(store,idx,val){return new Promise((r,j)=>{const req=this._tx(store).index(idx).getAll(val);req.onsuccess=()=>r(req.result||[]);req.onerror=e=>j(e.target.error)})}
  async getOneByIndex(store,idx,val){return new Promise((r,j)=>{const req=this._tx(store).index(idx).get(val);req.onsuccess=()=>r(req.result);req.onerror=e=>j(e.target.error)})}
  async delete(store,id){return new Promise((r,j)=>{const req=this._tx(store,'readwrite').delete(id);req.onsuccess=()=>r();req.onerror=e=>j(e.target.error)})}
  async count(store){return new Promise((r,j)=>{const req=this._tx(store).count();req.onsuccess=()=>r(req.result);req.onerror=e=>j(e.target.error)})}
}

const db=new NexusDB();

// ====== SEED DATA ======
const SEED_COMMUNITIES=[
  {id:uid(),name:'technology',displayName:'Technology',description:'Cutting-edge tech news, programming discussions, and innovation trends.',color:'#0984E3',icon:'fa-microchip',memberCount:0,createdBy:'__system__',createdAt:Date.now()-86400000*30,rules:['Be civil and respectful','No spam or self-promotion','Stay on topic']},
  {id:uid(),name:'gaming',displayName:'Gaming',description:'All things gaming — PC, console, mobile, indie, AAA. Share your experiences.',color:'#6C5CE7',icon:'fa-gamepad',memberCount:0,createdBy:'__system__',createdAt:Date.now()-86400000*25,rules:['No piracy','Tag spoilers','Be respectful to all players']},
  {id:uid(),name:'science',displayName:'Science',description:'Scientific discoveries, research papers, and evidence-based discussions.',color:'#00B894',icon:'fa-flask',memberCount:0,createdBy:'__system__',createdAt:Date.now()-86400000*20,rules:['Cite sources when possible','No pseudoscience','Be open to discussion']},
  {id:uid(),name:'creative',displayName:'Creative Arts',description:'Digital art, illustration, photography, design — share your creative work.',color:'#E84393',icon:'fa-palette',memberCount:0,createdBy:'__system__',createdAt:Date.now()-86400000*15,rules:['Original work only or credit the artist','Constructive feedback only','No AI-generated art without disclosure']},
  {id:uid(),name:'worldnews',displayName:'World News',description:'Breaking news and major events from around the globe. Stay informed.',color:'#E17055',icon:'fa-globe',memberCount:0,createdBy:'__system__',createdAt:Date.now()-86400000*10,rules:['Use original source titles','No editorialized titles','No duplicate posts']},
  {id:uid(),name:'books',displayName:'Books & Literature',description:'Book recommendations, reviews, and literary discussions for all genres.',color:'#FDCB6E',icon:'fa-book',memberCount:0,createdBy:'__system__',createdAt:Date.now()-86400000*5,rules:['No spoiler without warning','Respect all genres','Be constructive in reviews']}
];

const SEED_USERS=[
  {id:uid(),username:'techguru',email:'tech@example.com',passwordHash:'',salt:'',avatar:'',bio:'Full-stack developer. Open source enthusiast. Building the future.',karma:342,createdAt:Date.now()-86400000*20},
  {id:uid(),username:'pixelartist',email:'pixel@example.com',passwordHash:'',salt:'',avatar:'',bio:'Digital artist and illustrator. Commissions open.',karma:218,createdAt:Date.now()-86400000*15},
  {id:uid(),username:'sciencenerd',email:'science@example.com',passwordHash:'',salt:'',avatar:'',bio:'Physics grad student. Science communicator. Questions welcome.',karma:567,createdAt:Date.now()-86400000*10},
  {id:uid(),username:'bookworm42',email:'book@example.com',passwordHash:'',salt:'',avatar:'',bio:'Avid reader. 200+ books this year. Fantasy & sci-fi lover.',karma:189,createdAt:Date.now()-86400000*8}
];

const SEED_POSTS_DATA=[
  {ci:0,ai:0,title:'WebAssembly is changing how we think about browser performance',content:'After spending months porting a computationally heavy image processing pipeline to WASM, the results are staggering. We saw a 15x performance improvement over pure JavaScript. The compilation toolchain has matured significantly with wasm-pack and wasm-bindgen. If you haven\'t explored WASM yet, now is the time. The ecosystem is ready.',flair:'Discussion',type:'text',h:4,link:'',img:''},
  {ci:0,ai:2,title:'New study reveals quantum computing breakthrough in error correction',content:'Researchers at MIT have demonstrated a new approach to quantum error correction that reduces the overhead by 90%. This could bring practical quantum computing years closer than expected. The paper, published in Nature, shows that their surface code implementation maintains coherence times 10x longer than previous methods.',flair:'News',type:'text',h:12,link:'',img:''},
  {ci:1,ai:1,title:'Just finished a 2-year indie game project — here are the lessons learned',content:'After two years of solo development, my pixel-art metroidvania is finally releasing next month. Here are the top lessons: scope creep is real (cut 40% of planned features), playtest early and often, and take breaks seriously — burnout nearly killed this project. The game has over 80 hand-crafted levels and an original soundtrack.',flair:'Dev Log',type:'text',h:8,link:'',img:''},
  {ci:2,ai:2,title:'James Webb captures most detailed image of early universe yet',content:'The latest JWST deep field image reveals galaxies forming just 300 million years after the Big Bang. The level of detail is unprecedented — we can now see individual star-forming regions in galaxies from when the universe was only 2% of its current age. This data is rewriting our understanding of early galaxy formation.',flair:'Discovery',type:'text',h:20,link:'',img:''},
  {ci:3,ai:1,title:'Shared my latest digital painting — ethereal forest at twilight',content:'Spent about 30 hours on this piece using Procreate and Photoshop. The challenge was getting the light rays to feel natural while maintaining the mystical atmosphere. Used a limited palette of blues, purples, and warm yellows to unify the composition. Feedback always appreciated!',flair:'Art',type:'text',h:6,link:'',img:'https://picsum.photos/seed/forest42/800/500.jpg'},
  {ci:4,ai:0,title:'Global renewable energy capacity surpasses fossil fuels for first time',content:'In a historic milestone, global renewable energy installed capacity has officially surpassed that of fossil fuels. Solar and wind alone accounted for 90% of new power capacity added in 2024. The cost of solar panels has dropped 97% since 2000, making clean energy the cheapest option in most markets worldwide.',flair:'Breaking',type:'text',h:15,link:'',img:''},
  {ci:5,ai:3,title:'The best sci-fi books that predicted modern technology accurately',content:'Looking back at sci-fi that got it right: Asimov\'s multivacs predicted AI assistants, Neuromancer nailed cyberspace, and Snow Crash foresaw the metaverse. What are your favorite accurate predictions from sci-fi literature? I\'m building a reading list focused on prescient science fiction.',flair:'Recommendations',type:'text',h:3,link:'',img:''},
  {ci:0,ai:0,title:'Why I switched from React to Svelte for production apps',content:'After using React for 5 years, I made the switch to Svelte for our company\'s new product. The bundle size dropped by 60%, build times went from 45s to 3s, and the code is significantly more readable. Svelte\'s compile-time approach means no virtual DOM overhead. The learning curve is gentle — our team was productive within a week.',flair:'Opinion',type:'text',h:7,link:'',img:''},
  {ci:2,ai:2,title:'CRISPR gene therapy shows promising results for sickle cell disease',content:'Clinical trial results published today show that CRISPR-based gene therapy has effectively cured sickle cell disease in 94% of treated patients after 18 months of follow-up. Patients who previously had monthly crises are now symptom-free. This represents one of the most successful applications of gene editing in medicine to date.',flair:'Research',type:'text',h:18,link:'',img:''},
  {ci:1,ai:1,title:'The evolution of game difficulty — from arcade quarters to adaptive systems',content:'Game difficulty design has undergone a massive transformation. From the quarter-eating difficulty of arcade games to modern adaptive difficulty systems like Resident Evil 4\'s dynamic difficulty adjustment. What\'s the right balance between challenge and accessibility? Should all games have difficulty options?',flair:'Discussion',type:'text',h:5,link:'',img:''}
];

const SEED_COMMENTS_DATA=[
  {pi:0,ai:2,text:'This is exactly what I\'ve been seeing in my own benchmarks. The gap between WASM and JS for numeric workloads is enormous. Have you tried comparing with Rust vs C++ compiled to WASM?',d:0,h:3},
  {pi:0,ai:0,text:'Great writeup! One thing I\'d add — the debugging experience has also improved a lot. Chrome DevTools now has proper WASM debugging support with source maps.',d:0,h:2},
  {pi:0,ai:2,text:'@techguru Yes, Rust compiled to WASM was about 5% faster than C++ in our case, and the memory safety guarantees gave us fewer headaches during development.',d:1,h:4},
  {pi:2,ai:0,text:'Congrats on finishing! Two years of solo dev is no small feat. What engine did you use?',d:0,h:2},
  {pi:2,ai:1,text:'Custom engine built with Love2D / Lua. Wanted full control over the rendering pipeline for the pixel art aesthetic.',d:1,h:1},
  {pi:3,ai:2,text:'The 300 million year mark is mind-blowing. We\'re literally looking at the dawn of galaxy formation. Can\'t wait to see what the next deep field reveals.',d:0,h:8},
  {pi:4,ai:3,text:'This is absolutely gorgeous. The color palette really works — those warm yellows against the cool blues create such depth. Would love to see a process video!',d:0,h:3},
  {pi:5,ai:0,text:'97% cost drop since 2000 is insane. At this rate, the transition to renewables will accelerate even further. The economics are undeniable now.',d:0,h:5},
  {pi:8,ai:2,text:'94% cure rate is unprecedented for a genetic disease. This could change millions of lives, especially in sub-Saharan Africa where sickle cell is most prevalent.',d:0,h:12},
  {pi:8,ai:0,text:'The cost of treatment is still the barrier though. Last I checked, this therapy costs over $2 million per patient. We need to solve the accessibility problem too.',d:0,h:7}
];

let seeded=false;
async function seedData(){
  if(seeded)return;
  const count=await db.count('communities');
  if(count>0){seeded=true;return}
  // Seed communities
  for(const c of SEED_COMMUNITIES){c.memberCount=Math.floor(Math.random()*5000)+500;await db.put('communities',c)}
  // Seed users
  for(const u of SEED_USERS){u.salt=uid();u.passwordHash=await hashPwd('demo123',u.salt);await db.put('users',u)}
  // Seed posts
  const users=await db.getAll('users');
  const comms=await db.getAll('communities');
  const posts=[];
  for(const pd of SEED_POSTS_DATA){
    const p={id:uid(),communityId:comms[pd.ci].id,authorId:users[pd.ai].id,title:pd.title,content:pd.content,type:pd.type,link:pd.link,imageUrl:pd.img,flair:pd.flair,upvotes:pd.h+Math.floor(Math.random()*20),downvotes:Math.floor(Math.random()*3),commentCount:0,createdAt:Date.now()-3600000*(pd.h+Math.random()*48),updatedAt:Date.now()};
    posts.push(p);
    await db.put('posts',p);
    // Update author karma
    users[pd.ai].karma+=p.upvotes;
    await db.put('users',users[pd.ai]);
  }
  // Seed comments
  for(const cd of SEED_COMMENTS_DATA){
    const c={id:uid(),postId:posts[cd.pi].id,parentId:cd.d===0?null:posts[cd.pi].id+'_r'+cd.d,authorId:users[cd.ai].id,content:cd.text,upvotes:cd.h,downvotes:0,createdAt:Date.now()-3600000*(cd.h+Math.random()*24)};
    await db.put('comments',c);
    posts[cd.pi].commentCount++;
    await db.put('posts',posts[cd.pi]);
    users[cd.ai].karma+=cd.h;
    await db.put('users',users[cd.ai]);
  }
  seeded=true;
}

// ====== STATE ======
let state={currentUser:null,currentRoute:'',sort:'hot',searchQuery:''};

// ====== AUTH ======
async function register(username,email,password){
  if(!username||username.length<3)throw new Error('Username must be at least 3 characters');
  if(!/^[a-zA-Z0-9_]+$/.test(username))throw new Error('Username can only contain letters, numbers, and underscores');
  if(!email||!email.includes('@'))throw new Error('Valid email required');
  if(password.length<6)throw new Error('Password must be at least 6 characters');
  const existing=await db.getOneByIndex('users','username',username);
  if(existing)throw new Error('Username already taken');
  const existingEmail=await db.getOneByIndex('users','email',email);
  if(existingEmail)throw new Error('Email already registered');
  const salt=uid();
  const hash=await hashPwd(password,salt);
  const user={id:uid(),username,email,passwordHash:hash,salt,avatar:'',bio:'',karma:1,createdAt:Date.now()};
  await db.put('users',user);
  localStorage.setItem('nexus_session',user.id);
  state.currentUser=user;
  return user;
}
async function login(username,password){
  const user=await db.getOneByIndex('users','username',username);
  if(!user)throw new Error('User not found');
  const hash=await hashPwd(password,user.salt);
  if(hash!==user.passwordHash)throw new Error('Incorrect password');
  localStorage.setItem('nexus_session',user.id);
  state.currentUser=user;
  return user;
}
async function logout(){localStorage.removeItem('nexus_session');state.currentUser=null}
async function restoreSession(){
  const sid=localStorage.getItem('nexus_session');
  if(!sid)return null;
  const user=await db.get('users',sid);
  if(user){state.currentUser=user;return user}
  localStorage.removeItem('nexus_session');return null;
}

// ====== VOTING ======
async function vote(targetId,targetType,value){
  if(!state.currentUser)return showToast('Please log in to vote','error');
  const vKey=state.currentUser.id+'_'+targetId+'_'+targetType;
  const existing=await db.get('votes',vKey);
  const store=targetType==='post'?'posts':'comments';
  const item=await db.get(store,targetId);
  if(!item)return;
  if(existing){
    if(existing.value===value){await db.delete('votes',vKey);item.upvotes-=value;item.downvotes+=value}
    else{item.upvotes-=existing.value;item.downvotes+=existing.value;item.upvotes+=value;item.downvotes-=value;existing.value=value;await db.put('votes',existing)}
  }else{item.upvotes+=value;item.downvotes-=value;await db.put('votes',{id:vKey,userId:state.currentUser.id,targetId,targetType,value})}
  await db.put(store,item);
  if(targetType==='post'){const author=await db.get('users',item.authorId);if(author&&author.id!==state.currentUser.id){author.karma+=value-(existing?existing.value:0);await db.put('users',author)}}
  return item;
}

// ====== SAVE/BOOKMARK ======
async function toggleSave(postId){
  if(!state.currentUser)return showToast('Please log in to save posts','error');
  const sKey=state.currentUser.id+'_'+postId;
  const existing=await db.get('saves',sKey);
  if(existing){await db.delete('saves',sKey);return false}
  await db.put('saves',{id:sKey,userId:state.currentUser.id,postId,createdAt:Date.now()});return true;
}
async function isSaved(postId){
  if(!state.currentUser)return false;
  const sKey=state.currentUser.id+'_'+postId;
  const s=await db.get('saves',sKey);return!!s;
}

// ====== MEMBERSHIP ======
async function joinCommunity(commId){
  if(!state.currentUser)return showToast('Please log in','error');
  const mKey=state.currentUser.id+'_'+commId;
  const existing=await db.get('memberships',mKey);
  if(existing){await db.delete('memberships',mKey);const c=await db.get('communities',commId);if(c){c.memberCount=Math.max(0,c.memberCount-1);await db.put('communities',c)}return false}
  await db.put('memberships',{id:mKey,userId:state.currentUser.id,communityId:commId,role:'member',joinedAt:Date.now()});
  const c=await db.get('communities',commId);if(c){c.memberCount++;await db.put('communities',c)}return true;
}
async function isMember(commId){
  if(!state.currentUser)return false;
  const mKey=state.currentUser.id+'_'+commId;
  const m=await db.get('memberships',mKey);return!!m;
}

// ====== SEO ======
const SEO={
  update(title,desc,path=''){
    document.title=title+' — Nexus Community';
    let m=document.querySelector('meta[name="description"]');if(m)m.content=desc;
    let og=document.querySelector('meta[property="og:title"]');if(og)og.content=title+' — Nexus Community';
    let ogd=document.querySelector('meta[property="og:description"]');if(ogd)ogd.content=desc;
    let ogu=document.querySelector('meta[property="og:url"]');if(ogu)ogu.content='https://babluksahu.github.io/Nexus/'+path;
    let can=document.querySelector('link[rel="canonical"]');if(can)can.href='https://babluksahu.github.io/Nexus/'+path;
    // JSON-LD update for pages
    let ld=document.getElementById('dynamic-ld');if(ld)ld.remove();
    ld=document.createElement('script');ld.id='dynamic-ld';ld.type='application/ld+json';
    ld.textContent=JSON.stringify({"@context":"https://schema.org","@type":"WebPage","name":title,"description":desc,"url":"https://babluksahu.github.io/Nexus/"+path,"isPartOf":{"@type":"WebSite","name":"Nexus Community","url":"https://babluksahu.github.io/Nexus/"}});
    document.head.appendChild(ld);
  },
  home(){this.update('Nexus Community','A free open-source community platform for sharing, discussing, and discovering content together.')} ,
  community(c){this.update(c.displayName,'Join '+c.displayName+' — '+c.description,'c/'+c.name)},
  post(p){this.update(p.title,truncate(p.content,160),'post/'+p.id)},
  profile(u){this.update(u.username+"'s Profile",'View posts and activity by '+u.username+' on Nexus Community.','u/'+u.username)},
  search(q){this.update('Search: '+q,'Search results for "'+q+'" on Nexus Community.','search?q='+encodeURIComponent(q))}
};

// ====== ROUTER ======
function navigate(hash){window.location.hash=hash}
function getRoute(){const h=window.location.hash.slice(1)||'/';return h}
function parseRoute(route){
  const parts=route.split('/').filter(Boolean);
  if(!parts.length)return{page:'home'};
  if(parts[0]==='c'&&parts[1])return{page:'community',name:parts[1],sort:parts[2]||'hot'};
  if(parts[0]==='post'&&parts[1])return{page:'post',id:parts[1]};
  if(parts[0]==='u'&&parts[1])return{page:'profile',username:parts[1]};
  if(parts[0]==='search')return{page:'search',q:decodeURIComponent(parts.slice(1).join('/'))};
  if(parts[0]==='create-post')return{page:'create-post',community:parts[1]||''};
  if(parts[0]==='create-community')return{page:'create-community'};
  if(parts[0]==='saved')return{page:'saved'};
  return{page:'home'};
}

// ====== TOAST ======
function showToast(msg,type='info'){
  const c=$('#toast-container');
  const t=document.createElement('div');t.className='toast '+type;
  const icons={success:'fa-check-circle',error:'fa-exclamation-circle',info:'fa-info-circle'};
  t.innerHTML='<i class="fas '+icons[type]+'"></i><span>'+escapeHtml(msg)+'</span>';
  c.appendChild(t);
  setTimeout(()=>{t.style.animation='toastOut .3s ease forwards';setTimeout(()=>t.remove(),300)},3000);
}

// ====== MODAL ======
function openModal(html){$('#modal-content').innerHTML=html;$('#modal-overlay').classList.add('show')}
function closeModal(){$('#modal-overlay').classList.remove('show');$('#modal-content').innerHTML=''}
 $('#modal-overlay').addEventListener('click',e=>{if(e.target===$('#modal-overlay'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

// ====== RENDER: NAVBAR ======
function renderNav(){
  const a=$('#nav-actions');
  if(state.currentUser){
    a.innerHTML=`
      <button class="btn btn-primary btn-sm" onclick="navigate('#/create-post')" aria-label="Create post"><i class="fas fa-plus"></i><span class="hidden sm:inline">Create Post</span></button>
      <div style="position:relative">
        <button class="btn-ghost" onclick="this.nextElementSibling.classList.toggle('hidden')" aria-label="User menu" style="border-radius:50%;width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center">
          <div class="avatar" style="width:32px;height:32px;font-size:13px;background:${avatarColor(state.currentUser.username)}">${state.currentUser.username[0]}</div>
        </button>
        <div class="hidden" style="position:absolute;right:0;top:44px;background:var(--surface);border:1px solid var(--border);border-radius:10px;min-width:200px;box-shadow:var(--shadow);z-index:50;overflow:hidden" id="user-dropdown">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
            <div style="font-weight:700;font-size:14px">${escapeHtml(state.currentUser.username)}</div>
            <div style="font-size:12px;color:var(--text-m)">${state.currentUser.karma} karma</div>
          </div>
          <button class="sidebar-link" onclick="navigate('#/u/${state.currentUser.username}');closeDropdowns()"><i class="fas fa-user"></i>My Profile</button>
          <button class="sidebar-link" onclick="navigate('#/saved');closeDropdowns()"><i class="fas fa-bookmark"></i>Saved Posts</button>
          <button class="sidebar-link" onclick="navigate('#/create-community');closeDropdowns()"><i class="fas fa-plus-circle"></i>Create Community</button>
          <div style="border-top:1px solid var(--border)"><button class="sidebar-link" onclick="showBackupModal();closeDropdowns()" style="color:var(--text-m)"><i class="fas fa-cloud-arrow-up"></i>Backup / Restore</button></div>
          <div style="border-top:1px solid var(--border)"><button class="sidebar-link" onclick="handleLogout()" style="color:var(--red)"><i class="fas fa-sign-out-alt"></i>Log Out</button></div>
        </div>
      </div>`;
  }else{
    a.innerHTML=`<button class="btn btn-outline btn-sm" onclick="showLoginModal()">Log In</button><button class="btn btn-primary btn-sm" onclick="showRegisterModal()">Sign Up</button>`;
  }
}
function closeDropdowns(){$$('#user-dropdown').forEach(d=>d.classList.add('hidden'))}
document.addEventListener('click',e=>{if(!e.target.closest('#user-dropdown')&&!e.target.closest('[aria-label="User menu"]'))closeDropdowns()});

// ====== RENDER: SIDEBAR LEFT ======
function renderSidebarLeft(){
  const sl=$('#sidebar-left');
  const route=parseRoute(getRoute());
  let communityLinks='';
  SEED_COMMUNITIES.slice(0,5).forEach(c=>{
    communityLinks+=`<button class="sidebar-link ${route.page==='community'&&route.name===c.name?'active':''}" onclick="navigate('#/c/${c.name}')"><div style="width:22px;height:22px;border-radius:5px;background:${c.color}20;color:${c.color};display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0"><i class="fas ${c.icon}"></i></div><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.displayName}</span></button>`;
  });
  sl.innerHTML=`
    <nav class="sidebar-nav" aria-label="Main navigation">
      <button class="sidebar-link ${route.page==='home'?'active':''}" onclick="navigate('#/')"><i class="fas fa-home"></i>Home Feed</button>
      <button class="sidebar-link ${route.page==='saved'?'active':''}" onclick="navigate('#/saved')"><i class="fas fa-bookmark"></i>Saved</button>
      <div class="sidebar-heading">My Communities</div>
      ${communityLinks}
      <button class="sidebar-link" onclick="navigate('#/create-community')" style="color:var(--accent)"><i class="fas fa-plus"></i>Create Community</button>
      <div class="sidebar-heading">Topics</div>
      ${SEED_COMMUNITIES.slice(5).map(c=>`<button class="sidebar-link ${route.page==='community'&&route.name===c.name?'active':''}" onclick="navigate('#/c/${c.name}')"><div style="width:22px;height:22px;border-radius:5px;background:${c.color}20;color:${c.color};display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0"><i class="fas ${c.icon}"></i></div><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.displayName}</span></button>`).join('')}
    </nav>`;
}

// ====== RENDER: SIDEBAR RIGHT ======
function renderSidebarRight(extra=''){
  const sr=$('#sidebar-right');
  const trendingCommunities=SEED_COMMUNITIES.map(c=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer" onclick="navigate('#/c/${c.name}')"><div style="width:32px;height:32px;border-radius:8px;background:${c.color}20;color:${c.color};display:flex;align-items:center;justify-content:center"><i class="fas ${c.icon}"></i></div><div><div style="font-weight:600;font-size:13px">${c.displayName}</div><div style="font-size:11px;color:var(--text-m)">${c.memberCount.toLocaleString()} members</div></div></div>`).join('');
  sr.innerHTML=`
    <div class="card" style="padding:16px;margin-bottom:16px">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:12px">Trending Communities</h3>
      ${trendingCommunities}
    </div>
    <div class="card" style="padding:16px;margin-bottom:16px">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:8px">About Nexus</h3>
      <p style="font-size:13px;color:var(--text-s);line-height:1.6">Nexus is a free, open-source community platform. No ads, no tracking, no cost. Your data stays on your device.</p>
    </div>
    <div class="card" style="padding:12px;font-size:11px;color:var(--text-m);line-height:1.8">
      <a href="#/" style="color:var(--text-m)">Home</a> · <a href="#/create-community" style="color:var(--text-m)">Create Community</a><br>
      Nexus Community &copy; ${new Date().getFullYear()}
    </div>
    ${extra}`;
}

// ====== RENDER: VOTE BUTTONS ======
function voteHtml(targetId,targetType,currentVote,score){
  return `<div class="vote-col">
    <button class="vote-btn up ${currentVote===1?'active':''}" onclick="event.stopPropagation();handleVote('${targetId}','${targetType}',1)" aria-label="Upvote"><i class="fas fa-arrow-up"></i></button>
    <span class="vote-count" id="vc-${targetId}">${score>=0?score:0}</span>
    <button class="vote-btn down ${currentVote===-1?'active':''}" onclick="event.stopPropagation();handleVote('${targetId}','${targetType}',-1)" aria-label="Downvote"><i class="fas fa-arrow-down"></i></button>
  </div>`;
}

// ====== RENDER: POST CARD ======
async function renderPostCard(post,showCommunity=true){
  const author=await db.get('users',post.authorId);
  const community=showCommunity?await db.get('communities',post.communityId):null;
  let currentVote=0;
  if(state.currentUser){
    const vk=state.currentUser.id+'_'+post.id+'_post';
    const v=await db.get('votes',vk);if(v)currentVote=v.value;
  }
  const saved=await isSaved(post.id);
  const score=post.upvotes-post.downvotes;
  const flairHtml=post.flair?`<span class="flair" style="background:var(--accent-bg);color:var(--accent)">${escapeHtml(post.flair)}</span>`:'';
  const imgHtml=post.imageUrl?`<img src="${post.imageUrl}" alt="${escapeHtml(post.title)}" class="post-image" loading="lazy" onerror="this.style.display='none'">`:'';
  const linkHtml=post.type==='link'&&post.link?`<a href="${escapeHtml(post.link)}" target="_blank" rel="noopener noreferrer" class="post-preview" style="color:var(--teal);display:block;margin-bottom:8px"><i class="fas fa-external-link-alt" style="font-size:12px"></i> ${escapeHtml(post.link)}</a>`:'';

  return `<article class="card post-card fade-up" onclick="navigate('#/post/${post.id}')" role="article" aria-label="${escapeHtml(post.title)}">
    ${voteHtml(post.id,'post',currentVote,score)}
    <div class="post-body">
      <div class="post-meta">
        ${community?`<span class="tag-link" onclick="event.stopPropagation();navigate('#/c/${community.name}')"><i class="fas ${community.icon}" style="color:${community.color};font-size:11px"></i> ${escapeHtml(community.displayName)}</span><span style="color:var(--text-m)">·</span>`:''}
        <span>Posted by <span class="tag-link" onclick="event.stopPropagation();navigate('#/u/${author?author.username:'[deleted]'}')">${author?escapeHtml(author.username):'[deleted]'}</span></span>
        <span>· ${timeAgo(post.createdAt)}</span>
        ${flairHtml}
      </div>
      <h3 class="post-title">${escapeHtml(post.title)}</h3>
      ${imgHtml}${linkHtml}
      ${post.type==='text'?`<p class="post-preview">${escapeHtml(post.content)}</p>`:''}
      <div class="post-actions" onclick="event.stopPropagation()">
        <button class="post-action" onclick="navigate('#/post/${post.id}')"><i class="fas fa-comment"></i>${post.commentCount||0} Comments</button>
        <button class="post-action ${saved?'saved':''}" onclick="handleSave('${post.id}',this)"><i class="fas fa-bookmark"></i>${saved?'Saved':'Save'}</button>
        <button class="post-action" onclick="handleShare('${post.id}')"><i class="fas fa-share"></i>Share</button>
      </div>
    </div>
  </article>`;
}

// ====== RENDER: COMMENT ======
async function renderComment(comment,depth=0){
  const author=await db.get('users',comment.authorId);
  let currentVote=0;
  if(state.currentUser){const vk=state.currentUser.id+'_'+comment.id+'_comment';const v=await db.get('votes',vk);if(v)currentVote=v.value}
  const score=comment.upvotes-comment.downvotes;
  const children=await db.getByIndex('comments','parentId',comment.id);
  const collapsed=depth>4?'collapsed-thread':'';

  let childrenHtml='';
  if(children.length>0&&depth<6){
    const sorted=children.sort((a,b)=>(b.upvotes-b.downvotes)-(a.upvotes-a.downvotes));
    childrenHtml=`<div class="comment-thread">${(await Promise.all(sorted.map(c=>renderComment(c,depth+1)))).join('')}</div>`;
  }else if(children.length>0){
    childrenHtml=`<div class="comment-thread" style="opacity:.6"><button class="btn-ghost btn-sm" onclick="this.parentElement.classList.remove('collapsed-thread');this.remove()" style="font-size:12px"><i class="fas fa-level-down-alt"></i> Continue thread (${children.length} replies)</button></div>`;
  }

  return `<div class="comment fade-up" id="comment-${comment.id}" style="animation-delay:${depth*50}ms">
    ${voteHtml(comment.id,'comment',currentVote,score)}
    <div class="comment-body">
      <div class="comment-header">
        <div class="avatar" style="width:24px;height:24px;font-size:10px;background:${author?avatarColor(author.username):'#555'}">${author?author.username[0]:'?'}</div>
        <span class="tag-link" onclick="navigate('#/u/${author?author.username:'[deleted]'}')">${author?escapeHtml(author.username):'[deleted]'}</span>
        <span style="color:var(--text-m)">${timeAgo(comment.createdAt)}</span>
      </div>
      <div class="comment-content">${escapeHtml(comment.content)}</div>
      <div class="comment-actions">
        <button class="post-action" onclick="showReplyForm('${comment.id}')"><i class="fas fa-reply"></i>Reply</button>
      </div>
      <div id="reply-form-${comment.id}"></div>
      ${childrenHtml}
    </div>
  </div>`;
}

// ====== PAGE: HOME ======
async function renderHome(sort='hot'){
  SEO.home();
  const posts=await db.getAll('posts');
  let sorted;
  if(sort==='new')sorted=posts.sort((a,b)=>b.createdAt-a.createdAt);
  else if(sort==='top')sorted=posts.sort((a,b)=>(b.upvotes-b.downvotes)-(a.upvotes-a.downvotes));
  else sorted=posts.sort((a,b)=>hotScore(b)-hotScore(a));

  let postsHtml='';
  if(sorted.length===0){
    postsHtml=`<div class="empty-state"><i class="fas fa-feather-alt"></i><p>No posts yet. Be the first to share something!</p><button class="btn btn-primary" onclick="navigate('#/create-post')" style="margin-top:16px">Create a Post</button></div>`;
  }else{
    postsHtml=(await Promise.all(sorted.map(p=>renderPostCard(p,true)))).join('');
  }

  $('#main-content').innerHTML=`
    <section aria-label="Home feed" class="hero-bg" style="padding:20px 0">
      <div class="card" style="padding:16px;margin-bottom:16px;cursor:pointer;display:flex;align-items:center;gap:12px" onclick="${state.currentUser?`navigate('#/create-post')`:`showLoginModal()`}">
        <div class="avatar" style="width:40px;height:40px;background:${state.currentUser?avatarColor(state.currentUser.username):'var(--border)'}">${state.currentUser?state.currentUser.username[0]:'<i class=\"fas fa-user\" style=\"font-size:16px;color:var(--text-m)\"></i>'}</div>
        <span style="color:var(--text-m);font-size:15px">Create a post</span>
      </div>
      <div class="tabs" role="tablist">
        <button class="tab ${sort==='hot'?'active':''}" onclick="state.sort='hot';renderPage()" role="tab"><i class="fas fa-fire" style="margin-right:4px"></i>Hot</button>
        <button class="tab ${sort==='new'?'active':''}" onclick="state.sort='new';renderPage()" role="tab"><i class="fas fa-clock" style="margin-right:4px"></i>New</button>
        <button class="tab ${sort==='top'?'active':''}" onclick="state.sort='top';renderPage()" role="tab"><i class="fas fa-trophy" style="margin-right:4px"></i>Top</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">${postsHtml}</div>
    </section>`;
  renderSidebarLeft();renderSidebarRight();renderNav();updateMobileNav('home');
}

// ====== PAGE: COMMUNITY ======
async function renderCommunity(name,sort='hot'){
  const community=await db.getOneByIndex('communities','name',name);
  if(!community){$('#main-content').innerHTML='<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Community not found</p></div>';return}
  SEO.community(community);
  const joined=await isMember(community.id);
  const posts=await db.getByIndex('posts','communityId',community.id);
  let sorted;
  if(sort==='new')sorted=posts.sort((a,b)=>b.createdAt-a.createdAt);
  else if(sort==='top')sorted=posts.sort((a,b)=>(b.upvotes-b.downvotes)-(a.upvotes-a.downvotes));
  else sorted=posts.sort((a,b)=>hotScore(b)-hotScore(a));

  const rulesHtml=community.rules?community.rules.map((r,i)=>`<div style="font-size:13px;color:var(--text-s);padding:4px 0"><span style="font-weight:700;color:var(--text);margin-right:6px">${i+1}.</span>${escapeHtml(r)}</div>`).join(''):'';

  let postsHtml='';
  if(sorted.length===0)postsHtml='<div class="empty-state"><i class="fas fa-feather-alt"></i><p>No posts in this community yet.</p></div>';
  else postsHtml=(await Promise.all(sorted.map(p=>renderPostCard(p,false)))).join('');

  $('#main-content').innerHTML=`
    <section aria-label="${escapeHtml(community.displayName)}">
      <div class="community-banner" style="background:linear-gradient(135deg,${community.color},${community.color}88,${community.color}44)"></div>
      <div class="community-info">
        <div class="community-icon-large" style="background:${community.color};color:#fff"><i class="fas ${community.icon}"></i></div>
        <div style="flex:1;min-width:0">
          <h1 style="font-size:22px;font-weight:700">${escapeHtml(community.displayName)}</h1>
          <p style="font-size:13px;color:var(--text-s)">n/${escapeHtml(community.name)} · ${community.memberCount.toLocaleString()} members</p>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          ${state.currentUser?`<button class="btn ${joined?'btn-outline':'btn-primary'} btn-sm" onclick="handleJoin('${community.id}',this)">${joined?'Joined':'Join'}</button>`:''}
          ${state.currentUser?`<button class="btn btn-outline btn-sm" onclick="navigate('#/create-post/${community.name}')"><i class="fas fa-plus"></i>Post</button>`:''}
        </div>
      </div>
      <p style="font-size:14px;color:var(--text-s);margin-bottom:16px;line-height:1.6">${escapeHtml(community.description)}</p>
      <div class="tabs" role="tablist">
        <button class="tab ${sort==='hot'?'active':''}" onclick="navigate('#/c/${name}/hot')"><i class="fas fa-fire" style="margin-right:4px"></i>Hot</button>
        <button class="tab ${sort==='new'?'active':''}" onclick="navigate('#/c/${name}/new')"><i class="fas fa-clock" style="margin-right:4px"></i>New</button>
        <button class="tab ${sort==='top'?'active':''}" onclick="navigate('#/c/${name}/top')"><i class="fas fa-trophy" style="margin-right:4px"></i>Top</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">${postsHtml}</div>
    </section>`;

  renderSidebarLeft();
  renderSidebarRight(`<div class="card" style="padding:16px;margin-bottom:16px"><h3 style="font-size:14px;font-weight:700;margin-bottom:8px">About Community</h3><p style="font-size:13px;color:var(--text-s);margin-bottom:12px">${escapeHtml(community.description)}</p><div style="display:flex;gap:16px;font-size:13px;margin-bottom:12px"><div><span style="font-weight:700">${community.memberCount.toLocaleString()}</span><br><span style="color:var(--text-m)">Members</span></div><div><span style="font-weight:700">${(community.memberCount/4).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}</span><br><span style="color:var(--text-m)">Online</span></div></div>${rulesHtml?`<div class="divider"></div><h4 style="font-size:13px;font-weight:700;margin-bottom:8px">Community Rules</h4>${rulesHtml}`:''}</div>`);
  renderNav();updateMobileNav('communities');
}

// ====== PAGE: POST DETAIL ======
async function renderPost(postId){
  const post=await db.get('posts',postId);
  if(!post){$('#main-content').innerHTML='<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Post not found</p></div>';return}
  SEO.post(post);
  const author=await db.get('users',post.authorId);
  const community=await db.get('communities',post.communityId);
  let currentVote=0;
  if(state.currentUser){const vk=state.currentUser.id+'_'+post.id+'_post';const v=await db.get('votes',vk);if(v)currentVote=v.value}
  const score=post.upvotes-post.downvotes;
  const saved=await isSaved(post.id);
  const flairHtml=post.flair?`<span class="flair" style="background:var(--accent-bg);color:var(--accent)">${escapeHtml(post.flair)}</span>`:'';
  const imgHtml=post.imageUrl?`<img src="${post.imageUrl}" alt="${escapeHtml(post.title)}" style="width:100%;max-height:500px;object-fit:cover;border-radius:8px;margin:12px 0" loading="lazy" onerror="this.style.display='none'">`:'';
  const linkHtml=post.type==='link'&&post.link?`<a href="${escapeHtml(post.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--teal);font-size:14px;display:inline-block;margin:8px 0"><i class="fas fa-external-link-alt" style="font-size:12px"></i> ${escapeHtml(post.link)}</a>`:'';

  const comments=await db.getByIndex('comments','postId',post.id);
  const topComments=comments.filter(c=>!c.parentId).sort((a,b)=>(b.upvotes-b.downvotes)-(a.upvotes-a.downvotes));
  const commentsHtml=(await Promise.all(topComments.map(c=>renderComment(c,0)))).join('');

  $('#main-content').innerHTML=`
    <section aria-label="Post: ${escapeHtml(post.title)}">
      <article class="card fade-up" style="padding:16px;margin-bottom:16px">
        <div style="display:flex;gap:8px">
          ${voteHtml(post.id,'post',currentVote,score)}
          <div style="flex:1;min-width:0">
            <div class="post-meta">
              ${community?`<span class="tag-link" onclick="navigate('#/c/${community.name}')"><i class="fas ${community.icon}" style="color:${community.color};font-size:11px"></i> ${escapeHtml(community.displayName)}</span><span style="color:var(--text-m)">·</span>`:''}
              <span>Posted by <span class="tag-link" onclick="navigate('#/u/${author?author.username:'[deleted]'}')">${author?escapeHtml(author.username):'[deleted]'}</span></span>
              <span>· ${timeAgo(post.createdAt)}</span>
              ${flairHtml}
            </div>
            <h1 style="font-size:24px;font-weight:700;line-height:1.3;margin:8px 0">${escapeHtml(post.title)}</h1>
            ${imgHtml}${linkHtml}
            <div style="font-size:15px;line-height:1.7;color:var(--text);white-space:pre-wrap;margin:8px 0">${escapeHtml(post.content)}</div>
            <div class="divider"></div>
            <div class="post-actions">
              <button class="post-action"><i class="fas fa-comment"></i>${post.commentCount||0} Comments</button>
              <button class="post-action ${saved?'saved':''}" onclick="handleSave('${post.id}',this)"><i class="fas fa-bookmark"></i>${saved?'Saved':'Save'}</button>
              <button class="post-action" onclick="handleShare('${post.id}')"><i class="fas fa-share"></i>Share</button>
              ${state.currentUser&&state.currentUser.id===post.authorId?`<button class="post-action" onclick="handleDeletePost('${post.id}')" style="color:var(--red);margin-left:auto"><i class="fas fa-trash"></i>Delete</button>`:''}
            </div>
          </div>
        </div>
      </article>
      ${state.currentUser?`
        <div class="card fade-up" style="padding:16px;margin-bottom:16px">
          <div style="display:flex;gap:10px;align-items:flex-start">
            <div class="avatar" style="width:32px;height:32px;font-size:12px;background:${avatarColor(state.currentUser.username)};margin-top:2px">${state.currentUser.username[0]}</div>
            <div style="flex:1">
              <textarea id="new-comment" placeholder="What are your thoughts?" rows="3" style="margin-bottom:8px"></textarea>
              <div style="display:flex;justify-content:flex-end"><button class="btn btn-primary btn-sm" onclick="handleAddComment('${post.id}',null)">Comment</button></div>
            </div>
          </div>
        </div>
      `:`<div class="card" style="padding:16px;margin-bottom:16px;text-align:center"><p style="color:var(--text-m);font-size:14px"><a href="javascript:showLoginModal()">Log in</a> to join the conversation</p></div>`}
      <div style="margin-bottom:8px;font-weight:700;font-size:15px">${comments.length} Comment${comments.length!==1?'s':''}</div>
      <div class="card" style="padding:8px 16px">${commentsHtml||'<div class="empty-state" style="padding:24px"><i class="fas fa-comment-slash"></i><p>No comments yet. Start the discussion!</p></div>'}</div>
    </section>`;
  renderSidebarLeft();
  renderSidebarRight(`<div class="card" style="padding:16px"><h3 style="font-size:14px;font-weight:700;margin-bottom:12px">Post Info</h3><div style="font-size:13px;color:var(--text-s);line-height:2"><div><i class="fas fa-arrow-up" style="width:18px;color:var(--accent)"></i> ${score} upvotes</div><div><i class="fas fa-comment" style="width:18px;color:var(--teal)"></i> ${post.commentCount||0} comments</div><div><i class="fas fa-clock" style="width:18px"></i> ${timeAgo(post.createdAt)}</div><div><i class="fas fa-user" style="width:18px"></i> Posted by <span class="tag-link">${author?escapeHtml(author.username):'[deleted]'}</span></div></div></div>`);
  renderNav();updateMobileNav('home');
}

// ====== PAGE: PROFILE ======
async function renderProfile(username){
  const user=await db.getOneByIndex('users','username',username);
  if(!user){$('#main-content').innerHTML='<div class="empty-state"><i class="fas fa-user-slash"></i><p>User not found</p></div>';return}
  SEO.profile(user);
  const posts=await db.getByIndex('posts','authorId',user.id);
  posts.sort((a,b)=>b.createdAt-a.createdAt);
  const postsHtml=posts.length?(await Promise.all(posts.map(p=>renderPostCard(p,true)))):'<div class="empty-state"><i class="fas fa-feather-alt"></i><p>No posts yet</p></div>';

  $('#main-content').innerHTML=`
    <section aria-label="${escapeHtml(user.username)}'s profile">
      <div class="card fade-up" style="padding:24px;margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div class="avatar" style="width:72px;height:72px;font-size:28px;background:${avatarColor(user.username)}">${user.username[0]}</div>
        <div style="flex:1;min-width:200px">
          <h1 style="font-size:24px;font-weight:700">${escapeHtml(user.username)}</h1>
          <p style="font-size:14px;color:var(--text-s);margin-top:4px">${escapeHtml(user.bio)||'No bio yet'}</p>
          <div style="display:flex;gap:16px;margin-top:8px;font-size:13px;color:var(--text-m)">
            <span><i class="fas fa-arrow-up" style="color:var(--accent)"></i> ${user.karma} karma</span>
            <span><i class="fas fa-calendar"></i> Joined ${timeAgo(user.createdAt)}</span>
            <span><i class="fas fa-file-alt"></i> ${posts.length} posts</span>
          </div>
        </div>
      </div>
      <h2 style="font-size:16px;font-weight:700;margin-bottom:12px">Posts by ${escapeHtml(user.username)}</h2>
      <div style="display:flex;flex-direction:column;gap:8px">${postsHtml}</div>
    </section>`;
  renderSidebarLeft();renderSidebarRight();renderNav();updateMobileNav('profile');
}

// ====== PAGE: SEARCH ======
async function renderSearch(query){
  if(!query){$('#main-content').innerHTML='<div class="empty-state"><i class="fas fa-search"></i><p>Enter a search term to find posts and communities</p></div>';renderSidebarLeft();renderSidebarRight();renderNav();return}
  SEO.search(query);
  const q=query.toLowerCase();
  const posts=await db.getAll('posts');
  const communities=await db.getAll('communities');
  const matchedPosts=posts.filter(p=>p.title.toLowerCase().includes(q)||p.content.toLowerCase().includes(q)).sort((a,b)=>hotScore(b)-hotScore(a));
  const matchedComms=communities.filter(c=>c.displayName.toLowerCase().includes(q)||c.description.toLowerCase().includes(q)||c.name.toLowerCase().includes(q));

  let commsHtml='';
  if(matchedComms.length){
    commsHtml=`<h3 style="font-size:15px;font-weight:700;margin-bottom:8px">Communities</h3><div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">${matchedComms.map(c=>`<div class="card" style="padding:12px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="navigate('#/c/${c.name}')"><div style="width:36px;height:36px;border-radius:8px;background:${c.color}20;color:${c.color};display:flex;align-items:center;justify-content:center"><i class="fas ${c.icon}"></i></div><div><div style="font-weight:600;font-size:14px">${escapeHtml(c.displayName)}</div><div style="font-size:12px;color:var(--text-m)">${c.memberCount.toLocaleString()} members</div></div></div>`).join('')}</div>`;
  }

  let postsHtml='';
  if(matchedPosts.length){
    postsHtml=`<h3 style="font-size:15px;font-weight:700;margin-bottom:8px">Posts (${matchedPosts.length})</h3><div style="display:flex;flex-direction:column;gap:8px">${(await Promise.all(matchedPosts.map(p=>renderPostCard(p,true))))}</div>`;
  }

  const noResults=!matchedComms.length&&!matchedPosts.length;

  $('#main-content').innerHTML=`
    <section aria-label="Search results">
      <div style="margin-bottom:16px"><h1 style="font-size:20px;font-weight:700">Search results for "${escapeHtml(query)}"</h1></div>
      ${noResults?'<div class="empty-state"><i class="fas fa-search"></i><p>No results found. Try different keywords.</p></div>':''}
      ${commsHtml}${postsHtml}
    </section>`;
  renderSidebarLeft();renderSidebarRight();renderNav();updateMobileNav('search');
}

// ====== PAGE: SAVED ======
async function renderSaved(){
  if(!state.currentUser){showToast('Please log in to view saved posts','error');navigate('#/');return}
  SEO.update('Saved Posts','Your bookmarked posts on Nexus Community.','saved');
  const saves=await db.getByIndex('saves','userId',state.currentUser.id);
  let postsHtml='';
  if(saves.length){
    const posts=await Promise.all(saves.map(s=>db.get('posts',s.postId)));
    const valid=posts.filter(Boolean);
    postsHtml=(await Promise.all(valid.map(p=>renderPostCard(p,true))))||'';
  }
  $('#main-content').innerHTML=`
    <section aria-label="Saved posts">
      <h1 style="font-size:22px;font-weight:700;margin-bottom:16px"><i class="fas fa-bookmark" style="color:var(--teal);margin-right:8px"></i>Saved Posts</h1>
      ${!saves.length||!postsHtml?'<div class="empty-state"><i class="fas fa-bookmark"></i><p>No saved posts yet. Bookmark posts to find them here later.</p></div>':`<div style="display:flex;flex-direction:column;gap:8px">${postsHtml}</div>`}
    </section>`;
  renderSidebarLeft();renderSidebarRight();renderNav();updateMobileNav('home');
}

// ====== PAGE: CREATE POST ======
async function renderCreatePost(communityName=''){
  if(!state.currentUser){showLoginModal();return}
  SEO.update('Create Post','Share your thoughts with the Nexus community.','create-post');
  const communities=await db.getAll('communities');
  const optionsHtml=communities.map(c=>`<option value="${c.name}" ${c.name===communityName?'selected':''}>${c.displayName}</option>`).join('');
  $('#main-content').innerHTML=`
    <section aria-label="Create post">
      <div class="card fade-up" style="padding:24px;max-width:680px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:20px">Create a Post</h1>
        <div class="form-group">
          <label for="post-community">Community</label>
          <select id="post-community">${optionsHtml}</select>
        </div>
        <div class="form-group">
          <label for="post-title">Title</label>
          <input type="text" id="post-title" placeholder="An interesting title for your post" maxlength="300">
          <div id="post-title-error" class="form-error"></div>
        </div>
        <div class="form-group">
          <label for="post-flair">Flair (optional)</label>
          <input type="text" id="post-flair" placeholder="e.g. Discussion, News, Question">
        </div>
        <div class="form-group">
          <label>Post Type</label>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <button class="btn btn-sm btn-primary" id="type-text-btn" onclick="setPostType('text')">Text</button>
            <button class="btn btn-sm btn-outline" id="type-image-btn" onclick="setPostType('image')">Image</button>
            <button class="btn btn-sm btn-outline" id="type-link-btn" onclick="setPostType('link')">Link</button>
          </div>
        </div>
        <div class="form-group" id="post-content-group">
          <label for="post-content">Content</label>
          <textarea id="post-content" placeholder="Share your thoughts..." rows="6"></textarea>
        </div>
        <div class="form-group hidden" id="post-image-group">
          <label for="post-image">Image</label>
          <input type="file" id="post-image" accept="image/*" onchange="previewPostImage(this)">
          <img id="post-image-preview" class="img-preview hidden">
        </div>
        <div class="form-group hidden" id="post-link-group">
          <label for="post-link">URL</label>
          <input type="url" id="post-link" placeholder="https://example.com">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-outline" onclick="navigate('#/')">Cancel</button>
          <button class="btn btn-primary" onclick="handleCreatePost()">Post</button>
        </div>
      </div>
    </section>`;
  renderSidebarLeft();renderSidebarRight();renderNav();
}
let currentPostType='text';
function setPostType(type){
  currentPostType=type;
  ['text','image','link'].forEach(t=>{
    document.getElementById('type-'+t+'-btn').className='btn btn-sm '+(t===type?'btn-primary':'btn-outline');
    document.getElementById('post-'+t+'-group').classList.toggle('hidden',t!==type);
  });
}
function previewPostImage(input){
  const file=input.files[0];if(!file)return;
  if(file.size>5*1024*1024){showToast('Image must be under 5MB','error');input.value='';return}
  const reader=new FileReader();
  reader.onload=e=>{const img=$('#post-image-preview');img.src=e.target.result;img.classList.remove('hidden')};
  reader.readAsDataURL(file);
}

// ====== PAGE: CREATE COMMUNITY ======
async function renderCreateCommunity(){
  if(!state.currentUser){showLoginModal();return}
  SEO.update('Create Community','Start your own community on Nexus.','create-community');
  const colors=['#E17055','#0984E3','#6C5CE7','#00B894','#E84393','#FDCB6E','#00CEC9','#D63031','#636E72','#FD79A8'];
  const icons=['fa-hashtag','fa-code','fa-music','fa-camera','fa-film','fa-utensils','fa-plane','fa-heart','fa-star','fa-bolt','fa-leaf','fa-graduation-cap'];
  $('#main-content').innerHTML=`
    <section aria-label="Create community">
      <div class="card fade-up" style="padding:24px;max-width:680px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:20px">Create a Community</h1>
        <div class="form-group">
          <label for="comm-name">Name (URL slug)</label>
          <input type="text" id="comm-name" placeholder="my_awesome_community" maxlength="21" style="text-transform:lowercase">
          <div style="font-size:11px;color:var(--text-m);margin-top:4px">Letters, numbers, underscores only. 3-21 characters.</div>
          <div id="comm-name-error" class="form-error"></div>
        </div>
        <div class="form-group">
          <label for="comm-display">Display Name</label>
          <input type="text" id="comm-display" placeholder="My Awesome Community" maxlength="50">
        </div>
        <div class="form-group">
          <label for="comm-desc">Description</label>
          <textarea id="comm-desc" placeholder="What is your community about?" rows="3" maxlength="200"></textarea>
        </div>
        <div class="form-group">
          <label>Color</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="comm-colors">${colors.map((c,i)=>`<div onclick="selectCommColor('${c}',this)" style="width:36px;height:36px;border-radius:8px;background:${c};cursor:pointer;border:3px solid ${i===0?'var(--text)':'transparent'};transition:border-color .15s" data-color="${c}"></div>`).join('')}</div>
        </div>
        <div class="form-group">
          <label>Icon</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="comm-icons">${icons.map((ic,i)=>`<div onclick="selectCommIcon('${ic}',this)" style="width:40px;height:40px;border-radius:8px;background:var(--surface);border:2px solid ${i===0?'var(--accent)':'var(--border)'};cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;color:var(--text-s)" data-icon="${ic}"><i class="fas ${ic}"></i></div>`).join('')}</div>
        </div>
        <div class="form-group">
          <label for="comm-rules">Rules (one per line, optional)</label>
          <textarea id="comm-rules" placeholder="Be respectful&#10;No spam&#10;Stay on topic" rows="3"></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-outline" onclick="navigate('#/')">Cancel</button>
          <button class="btn btn-primary" onclick="handleCreateCommunity()">Create Community</button>
        </div>
      </div>
    </section>`;
  renderSidebarLeft();renderSidebarRight();renderNav();
}
let selectedCommColor='#E17055',selectedCommIcon='fa-hashtag';
function selectCommColor(c,el){selectedCommColor=c;$$('#comm-colors > div').forEach(d=>d.style.borderColor='transparent');el.style.borderColor='var(--text)'}
function selectCommIcon(ic,el){selectedCommIcon=ic;$$('#comm-icons > div').forEach(d=>{d.style.borderColor='var(--border)';d.style.color='var(--text-s)'});el.style.borderColor='var(--accent)';el.style.color='var(--accent)'}

// ====== EVENT HANDLERS ======
async function handleVote(targetId,targetType,value){
  const result=await vote(targetId,targetType,value);
  if(!result)return;
  const el=$('#vc-'+targetId);
  if(el){const s=result.upvotes-result.downvotes;el.textContent=s>=0?s:0;el.style.transform='scale(1.3)';setTimeout(()=>el.style.transform='scale(1)',150)}
  // Re-render vote buttons
  const card=el?.closest('.post-card')||el?.closest('.comment');
  if(card){
    const upBtn=card.querySelector('.vote-btn.up');const downBtn=card.querySelector('.vote-btn.down');
    if(upBtn&&downBtn){
      upBtn.classList.toggle('active',value===1&&!(result._wasSame));downBtn.classList.toggle('active',value===-1&&!(result._wasSame));
    }
  }
}
async function handleSave(postId,btn){
  const saved=await toggleSave(postId);
  if(btn){btn.classList.toggle('saved',saved);btn.innerHTML=`<i class="fas fa-bookmark"></i>${saved?'Saved':'Save'}`}
  showToast(saved?'Post saved':'Post unsaved','success');
}
function handleShare(postId){
  const url=window.location.origin+window.location.pathname+'#/post/'+postId;
  if(navigator.share){navigator.share({title:'Check out this post on Nexus',url})}
  else{navigator.clipboard.writeText(url).then(()=>showToast('Link copied to clipboard','success')).catch(()=>showToast('Could not copy link','error'))}
}
async function handleJoin(commId,btn){
  const joined=await joinCommunity(commId);
  if(btn){btn.className='btn '+(joined?'btn-outline':'btn-primary')+' btn-sm';btn.textContent=joined?'Joined':'Join'}
  showToast(joined?'Joined community':'Left community','success');
}
async function handleAddComment(postId,parentId){
  const textarea=parentId?document.querySelector('#reply-form-'+parentId+' textarea'):$('#new-comment');
  if(!textarea||!textarea.value.trim()){showToast('Comment cannot be empty','error');return}
  const comment={id:uid(),postId,parentId,authorId:state.currentUser.id,content:textarea.value.trim(),upvotes:1,downvotes:0,createdAt:Date.now()};
  await db.put('comments',comment);
  const post=await db.get('posts',postId);post.commentCount++;await db.put('posts',post);
  state.currentUser.karma++;await db.put('users',state.currentUser);
  showToast('Comment posted','success');
  renderPost(postId);
}
function showReplyForm(parentId){
  const container=$('#reply-form-'+parentId);
  if(container.innerHTML){container.innerHTML='';return}
  container.innerHTML=`<div style="margin-top:8px;display:flex;gap:8px"><textarea placeholder="Write a reply..." rows="2" style="flex:1;min-height:60px"></textarea><button class="btn btn-primary btn-sm" onclick="handleAddComment('${postId}','${parentId}')" style="align-self:flex-end">Reply</button></div>`;
}
async function handleCreatePost(){
  const commName=$('#post-community').value;
  const title=$('#post-title').value.trim();
  const flair=$('#post-flair').value.trim();
  const content=$('#post-content')?.value?.trim()||'';
  const link=$('#post-link')?.value?.trim()||'';
  const fileInput=$('#post-image');
  const errorEl=$('#post-title-error');

  if(!title||title.length<5){errorEl.textContent='Title must be at least 5 characters';return}
  errorEl.textContent='';

  let imageUrl='';
  if(currentPostType==='image'&&fileInput&&fileInput.files[0]){
    imageUrl=await new Promise((r)=>{const reader=new FileReader();reader.onload=e=>r(e.target.result);reader.readAsDataURL(fileInput.files[0])});
  }
  if(currentPostType==='link'&&!link){showToast('Please enter a URL','error');return}
  if(currentPostType==='text'&&!content){showToast('Please add some content','error');return}

  const community=await db.getOneByIndex('communities','name',commName);
  if(!community){showToast('Community not found','error');return}

  const post={id:uid(),communityId:community.id,authorId:state.currentUser.id,title,content,type:currentPostType,link:currentPostType==='link'?link:'',imageUrl,flair,upvotes:1,downvotes:0,commentCount:0,createdAt:Date.now(),updatedAt:Date.now()};
  await db.put('posts',post);
  state.currentUser.karma++;await db.put('users',state.currentUser);
  showToast('Post created','success');
  navigate('#/post/'+post.id);
}
async function handleDeletePost(postId){
  openModal(`<h2 style="font-size:18px;font-weight:700;margin-bottom:12px">Delete Post</h2><p style="color:var(--text-s);margin-bottom:20px">Are you sure? This cannot be undone.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-sm" style="background:var(--red);color:#fff" onclick="confirmDeletePost('${postId}')">Delete</button></div>`);
}
async function confirmDeletePost(postId){
  const post=await db.get('posts',postId);if(!post)return;
  // Delete comments
  const comments=await db.getByIndex('comments','postId',postId);
  for(const c of comments)await db.delete('comments',c.id);
  await db.delete('posts',postId);
  closeModal();showToast('Post deleted','success');navigate('#/');
}
async function handleCreateCommunity(){
  const name=$('#comm-name').value.trim().toLowerCase();
  const display=$('#comm-display').value.trim();
  const desc=$('#comm-desc').value.trim();
  const rulesText=$('#comm-rules').value.trim();
  const errorEl=$('#comm-name-error');

  if(!name||name.length<3||!/^[a-z0-9_]+$/.test(name)){errorEl.textContent='Invalid name. Use letters, numbers, underscores. 3-21 chars.';return}
  errorEl.textContent='';
  if(!display){showToast('Display name required','error');return}

  const existing=await db.getOneByIndex('communities','name',name);
  if(existing){errorEl.textContent='This community name is already taken';return}

  const rules=rulesText?rulesText.split('\n').filter(Boolean):[];
  const community={id:uid(),name,displayName:display,description:desc||'',color:selectedCommColor,icon:selectedCommIcon,memberCount:1,createdBy:state.currentUser.id,createdAt:Date.now(),rules};
  await db.put('communities',community);
  await joinCommunity(community.id);
  showToast('Community created','success');
  navigate('#/c/'+name);
}
async function handleLogout(){
  await logout();renderNav();showToast('Logged out','info');navigate('#/');
}

// ====== AUTH MODALS ======
function showLoginModal(){
  openModal(`
    <h2 style="font-size:22px;font-weight:700;margin-bottom:4px">Welcome Back</h2>
    <p style="color:var(--text-m);font-size:14px;margin-bottom:20px">Log in to your Nexus account</p>
    <div class="form-group"><label for="login-user">Username</label><input type="text" id="login-user" placeholder="your_username"></div>
    <div class="form-group"><label for="login-pass">Password</label><input type="password" id="login-pass" placeholder="Enter your password"></div>
    <div id="login-error" class="form-error" style="margin-bottom:8px"></div>
    <button class="btn btn-primary" style="width:100%" onclick="handleLogin()">Log In</button>
    <div class="divider"></div>
    <p style="text-align:center;font-size:14px;color:var(--text-s)">New to Nexus? <a href="javascript:closeModal();showRegisterModal()">Sign up</a></p>
    <div style="margin-top:12px;padding:12px;background:var(--card);border-radius:8px;font-size:12px;color:var(--text-m)">
      <strong>Demo accounts:</strong><br>techguru / demo123<br>pixelartist / demo123<br>sciencenerd / demo123<br>bookworm42 / demo123
    </div>`);
  setTimeout(()=>{const el=$('#login-user');if(el)el.focus()},100);
}
async function handleLogin(){
  const username=$('#login-user').value.trim();
  const password=$('#login-pass').value;
  try{await login(username,password);closeModal();renderNav();showToast('Welcome back, '+username+'!','success');renderPage()}
  catch(e){$('#login-error').textContent=e.message}
}
function showRegisterModal(){
  openModal(`
    <h2 style="font-size:22px;font-weight:700;margin-bottom:4px">Join Nexus</h2>
    <p style="color:var(--text-m);font-size:14px;margin-bottom:20px">Create your free account</p>
    <div class="form-group"><label for="reg-user">Username</label><input type="text" id="reg-user" placeholder="your_username"></div>
    <div class="form-group"><label for="reg-email">Email</label><input type="email" id="reg-email" placeholder="you@example.com"></div>
    <div class="form-group"><label for="reg-pass">Password</label><input type="password" id="reg-pass" placeholder="Min 6 characters"></div>
    <div id="reg-error" class="form-error" style="margin-bottom:8px"></div>
    <button class="btn btn-primary" style="width:100%" onclick="handleRegister()">Create Account</button>
    <div class="divider"></div>
    <p style="text-align:center;font-size:14px;color:var(--text-s)">Already have an account? <a href="javascript:closeModal();showLoginModal()">Log in</a></p>`);
  setTimeout(()=>{const el=$('#reg-user');if(el)el.focus()},100);
}
async function handleRegister(){
  const username=$('#reg-user').value.trim();
  const email=$('#reg-email').value.trim();
  const password=$('#reg-pass').value;
  try{await register(username,email,password);closeModal();renderNav();showToast('Welcome to Nexus, '+username+'!','success');renderPage()}
  catch(e){$('#reg-error').textContent=e.message}
}

// ====== GITHUB BACKUP / RESTORE ======
function showBackupModal(){
  openModal(`
    <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">Backup & Restore</h2>
    <p style="color:var(--text-m);font-size:13px;margin-bottom:20px">Export your data or restore from a GitHub Gist backup.</p>
    <div style="margin-bottom:16px">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:8px"><i class="fas fa-download" style="color:var(--teal);margin-right:6px"></i>Export Data</h3>
      <p style="font-size:13px;color:var(--text-s);margin-bottom:8px">Download all your data as a JSON file.</p>
      <button class="btn btn-teal btn-sm" onclick="exportData()">Download Backup</button>
    </div>
    <div class="divider"></div>
    <div style="margin-bottom:16px">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:8px"><i class="fas fa-upload" style="color:var(--accent);margin-right:6px"></i>Import Data</h3>
      <p style="font-size:13px;color:var(--text-s);margin-bottom:8px">Restore from a previously downloaded JSON file.</p>
      <input type="file" id="import-file" accept=".json" style="max-width:280px">
      <button class="btn btn-primary btn-sm" onclick="importData()" style="margin-top:8px">Restore</button>
    </div>
    <div class="divider"></div>
    <div>
      <h3 style="font-size:15px;font-weight:600;margin-bottom:8px"><i class="fab fa-github" style="margin-right:6px"></i>GitHub Gist Sync</h3>
      <p style="font-size:13px;color:var(--text-m);margin-bottom:8px">Backup to a GitHub Gist for cloud storage. Requires a Personal Access Token with gist scope.</p>
      <div class="form-group"><label for="gist-token">GitHub PAT (gist scope)</label><input type="password" id="gist-token" placeholder="ghp_xxxxxxxxxxxx"></div>
      <div class="form-group"><label for="gist-id">Gist ID (leave empty for new)</label><input type="text" id="gist-id" placeholder="Optional"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-sm" onclick="backupToGist()"><i class="fas fa-cloud-arrow-up"></i>Backup</button>
        <button class="btn btn-outline btn-sm" onclick="restoreFromGist()"><i class="fas fa-cloud-arrow-down"></i>Restore</button>
      </div>
    </div>
    <div class="divider"></div>
    <button class="btn btn-sm" style="background:var(--red);color:#fff" onclick="clearAllData()"><i class="fas fa-trash"></i>Clear All Data</button>
  `);
}
async function exportData(){
  const data={};
  for(const store of['users','communities','posts','comments','votes','memberships','saves']){data[store]=await db.getAll(store)}
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='nexus-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
  URL.revokeObjectURL(url);showToast('Backup downloaded','success');
}
async function importData(){
  const file=$('#import-file')?.files[0];if(!file){showToast('Select a file first','error');return}
  try{
    const text=await file.text();const data=JSON.parse(text);
    for(const store of['users','communities','posts','comments','votes','memberships','saves']){
      if(!data[store])continue;
      for(const item of data[store]){await db.put(store,item)}
    }
    seeded=true;showToast('Data restored successfully','success');closeModal();renderPage();
  }catch(e){showToast('Invalid backup file','error')}
}
async function backupToGist(){
  const token=$('#gist-token')?.value;if(!token){showToast('Enter your GitHub token','error');return}
  const data={};for(const store of['users','communities','posts','comments','votes','memberships','saves']){data[store]=await db.getAll(store)}
  const gistId=$('#gist-id')?.value;
  const url=gistId?`https://api.github.com/gists/${gistId}`:'https://api.github.com/gists';
  const method=gistId?'PATCH':'POST';
  const body={description:'Nexus Community Backup - '+new Date().toISOString().slice(0,10),public:false,files:{'nexus-data.json':{content:JSON.stringify(data)}}};
  try{
    const res=await fetch(url,{method,headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github.v3+json'},body:JSON.stringify(body)});
    const result=await res.json();
    if(result.id){showToast('Backup saved to Gist: '+result.id,'success');$('#gist-id').value=result.id}
    else throw new Error(result.message||'Failed');
  }catch(e){showToast('Gist backup failed: '+e.message,'error')}
}
async function restoreFromGist(){
  const token=$('#gist-token')?.value;const gistId=$('#gist-id')?.value;
  if(!token||!gistId){showToast('Enter token and Gist ID','error');return}
  try{
    const res=await fetch(`https://api.github.com/gists/${gistId}`,{headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github.v3+json'}});
    const gist=await res.json();
    const file=gist.files['nexus-data.json'];if(!file)throw new Error('File not found in gist');
    const data=JSON.parse(file.content);
    for(const store of['users','communities','posts','comments','votes','memberships','saves']){
      if(!data[store])continue;for(const item of data[store]){await db.put(store,item)}
    }
    seeded=true;showToast('Restored from Gist','success');closeModal();renderPage();
  }catch(e){showToast('Restore failed: '+e.message,'error')}
}
async function clearAllData(){
  openModal(`<h2 style="font-size:18px;font-weight:700;margin-bottom:12px;color:var(--red)">Danger: Clear All Data</h2><p style="color:var(--text-s);margin-bottom:20px">This will permanently delete ALL communities, posts, comments, and user accounts. This cannot be undone.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-outline btn-sm" onclick="showBackupModal()">Cancel</button><button class="btn btn-sm" style="background:var(--red);color:#fff" onclick="confirmClearAll()">Delete Everything</button></div>`);
}
async function confirmClearAll(){
  for(const store of['saves','votes','comments','posts','memberships','communities','users']){
    const items=await db.getAll(store);for(const item of items){await db.delete(store,item.id)}
  }
  seeded=false;localStorage.removeItem('nexus_session');state.currentUser=null;
  closeModal();showToast('All data cleared','info');await seedData();renderPage();
}

// ====== MOBILE NAV ======
function updateMobileNav(active){
  $$('#mobile-nav .nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===active));
}
 $$('#mobile-nav .nav-item').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const nav=btn.dataset.nav;
    if(nav==='home')navigate('#/');
    else if(nav==='communities')navigate('#/c/technology');
    else if(nav==='create'){state.currentUser?navigate('#/create-post'):showLoginModal()}
    else if(nav==='search')$('#nav-search').focus();
    else if(nav==='profile'){state.currentUser?navigate('#/u/'+state.currentUser.username):showLoginModal()}
  });
});

// ====== NAV SEARCH ======
 $('#nav-search').addEventListener('keydown',e=>{
  if(e.key==='Enter'){const q=e.target.value.trim();if(q)navigate('#/search/'+encodeURIComponent(q))}
});

// ====== MAIN RENDER ======
async function renderPage(){
  const route=getRoute();
  const parsed=parseRoute(route);
  state.currentRoute=route;

  switch(parsed.page){
    case'home':await renderHome(state.sort);break;
    case'community':await renderCommunity(parsed.name,parsed.sort);break;
    case'post':await renderPost(parsed.id);break;
    case'profile':await renderProfile(parsed.username);break;
    case'search':await renderSearch(parsed.q);break;
    case'create-post':await renderCreatePost(parsed.community);break;
    case'create-community':await renderCreateCommunity();break;
    case'saved':await renderSaved();break;
    default:await renderHome(state.sort);
  }
}

// ====== INIT ======
async function init(){
  try{
    await db.init();
    await seedData();
    await restoreSession();
    renderNav();
    window.addEventListener('hashchange',()=>renderPage());
    renderPage();
  }catch(e){
    console.error('Init error:',e);
    $('#main-content').innerHTML=`<div class="empty-state"><i class="fas fa-exclamation-circle" style="color:var(--red)"></i><p>Failed to initialize. Please ensure your browser supports IndexedDB.</p><p style="font-size:13px;margin-top:8px;color:var(--text-m)">${escapeHtml(e.message)}</p></div>`;
  }
}
init();
