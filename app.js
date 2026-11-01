// LIBRARY prototype. Change this temporary password before testing.
// IMPORTANT: This client-side password is only a visual gate, NOT secure authentication.
// Before publishing, replace it with Supabase Auth + Row Level Security.
const SITE_PASSWORD = "1133841";
const STORAGE_KEY = "library-prototype-works";
const SESSION_KEY = "library-prototype-unlocked";

const $ = (id) => document.getElementById(id);
let currentPage = "home";
let activeTag = "";
let currentView = "grid";

const sampleWorks = [
  {id:"sample-1",title:"故事的另一端",description:"一段尚未寫完的旅程。",status:"創作中",category:"原創",tags:["奇幻","原創","未完結"],body:"",updated:Date.now()-86400000},
  {id:"sample-2",title:"月下舊夢",description:"在月色與回憶之間，尋找遺失的答案。",status:"已完結",category:"短篇",tags:["奇幻","短篇","悲劇"],body:"",updated:Date.now()-172800000}
];
let works = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || sampleWorks;

function saveWorks(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(works)); renderAll(); }
function isUnlocked(){ return sessionStorage.getItem(SESSION_KEY) === "yes"; }
function showPassword(){ $("passwordModal").hidden = false; $("passwordInput").focus(); }
function hidePassword(){ $("passwordModal").hidden = true; $("passwordError").textContent = ""; }

function navigate(page){
  if(page !== "home" && !isUnlocked()){ showPassword(); return; }
  currentPage = page;
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const target = $(page+"Page");
  if(target) target.classList.add("active");
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("lockedNotice").hidden = true;
  if(page==="library") renderLibrary();
  if(page==="tags") renderTags();
  window.scrollTo({top:0,behavior:"smooth"});
}

function makeCard(work){
  const card=document.createElement("article"); card.className="book-card";
  const cover=document.createElement("div"); cover.className="book-cover"; cover.textContent=work.title.slice(0,1); card.appendChild(cover);
  const info=document.createElement("div"); info.className="book-info";
  const title=document.createElement("h3"); title.textContent=work.title; info.appendChild(title);
  const desc=document.createElement("p"); desc.textContent=work.description||"尚未新增簡介。"; info.appendChild(desc);
  const meta=document.createElement("div"); meta.className="book-meta"; meta.textContent=`${work.category||"未分類"} · ${work.status} · ${countWords(work.body||"")} 字`; info.appendChild(meta);
  const tags=document.createElement("div"); tags.className="tag-row";
  (work.tags||[]).forEach(t=>{const b=document.createElement("button");b.className="tag-chip";b.textContent="# "+t;b.onclick=()=>{activeTag=t;navigate("tags")};tags.appendChild(b)});
  info.appendChild(tags); card.appendChild(info); return card;
}
function countWords(s){return (s.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+/g)||[]).length}
function renderHome(){
  $("homeWorkCount").textContent=works.length;
  $("homeChapterCount").textContent=0;
  $("homeWordCount").textContent=works.reduce((n,w)=>n+countWords(w.body||""),0).toLocaleString();
  const recent=$("recentBooks"); recent.innerHTML="";
  if(!isUnlocked()){recent.textContent="登入後即可查看你的作品收藏。";return}
  const items=[...works].sort((a,b)=>b.updated-a.updated).slice(0,3);
  if(!items.length){recent.textContent="還沒有作品，進入創作管理新增第一部作品吧。";return}
  recent.className="book-grid";items.forEach(w=>recent.appendChild(makeCard(w)));
}
function renderLibrary(){
  const query=$("searchInput").value.trim().toLowerCase();
  const sort=$("sortSelect").value;
  let list=works.filter(w=>[w.title,w.description,w.category,(w.tags||[]).join(" "),w.body||""].join(" ").toLowerCase().includes(query));
  if(sort==="title")list.sort((a,b)=>a.title.localeCompare(b.title,"zh-Hant"));
  else if(sort==="words")list.sort((a,b)=>countWords(b.body||"")-countWords(a.body||""));
  else list.sort((a,b)=>b.updated-a.updated);
  const container=$("bookCollection");container.innerHTML="";container.className="book-grid"+(currentView==="list"?" list-view":"");
  if(!list.length){container.textContent="沒有找到符合條件的作品。";container.classList.add("empty-state");return}
  list.forEach(w=>container.appendChild(makeCard(w)));
}
function renderTags(){
  const counts={};works.forEach(w=>(w.tags||[]).forEach(t=>counts[t]=(counts[t]||0)+1));
  const cloud=$("tagCollection");cloud.innerHTML="";
  Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0],"zh-Hant")).forEach(([tag,n])=>{
    const b=document.createElement("button");b.className="tag-chip"+(activeTag===tag?" selected":"");b.textContent=`# ${tag} · ${n}`;
    b.onclick=()=>{activeTag=tag;renderTags()};cloud.appendChild(b);
  });
  $("tagResultTitle").textContent=activeTag?`標籤：${activeTag}`:"所有作品";
  const result=$("tagResults");result.innerHTML="";result.className="book-grid";
  const filtered=activeTag?works.filter(w=>(w.tags||[]).includes(activeTag)):works;
  if(!filtered.length){result.textContent="這個標籤目前沒有作品。";return}
  filtered.forEach(w=>result.appendChild(makeCard(w)));
}
function renderAll(){renderHome();if(isUnlocked()){renderLibrary();renderTags()}}
function resetForm(){
  $("workForm").reset();$("workId").value="";
}
function editWork(work){
  $("workId").value=work.id;$("workTitle").value=work.title;$("workDescription").value=work.description||"";
  $("workStatus").value=work.status||"創作中";$("workCategory").value=work.category||"";
  $("workTags").value=(work.tags||[]).join(", ");$("workBody").value=work.body||"";
  navigate("editor");
}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
$("passwordForm").addEventListener("submit",e=>{
  e.preventDefault();
  if($("passwordInput").value===SITE_PASSWORD){
    sessionStorage.setItem(SESSION_KEY,"yes");hidePassword();
    $("lockButton").textContent="登出";navigate(currentPage==="home"?"library":currentPage);renderAll();
  }else{$("passwordError").textContent="密碼不正確，請再試一次。";$("passwordInput").select()}
});
$("closePassword").onclick=hidePassword;
$("unlockFromNotice").onclick=showPassword;
$("lockButton").onclick=()=>{if(isUnlocked()){sessionStorage.removeItem(SESSION_KEY);$("lockButton").textContent="登入";navigate("home");renderHome()}else showPassword()};
$("newWorkButton").onclick=()=>{resetForm();navigate("editor")};
$("resetForm").onclick=resetForm;
$("workForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=$("workId").value||"work-"+Date.now();
  const old=works.find(w=>w.id===id);
  const work={id,title:$("workTitle").value.trim(),description:$("workDescription").value.trim(),status:$("workStatus").value,category:$("workCategory").value.trim(),tags:$("workTags").value.split(",").map(t=>t.trim()).filter(Boolean),body:$("workBody").value,updated:Date.now()};
  if(old)works=works.map(w=>w.id===id?work:w);else works.push(work);
  saveWorks();resetForm();navigate("library");
});
$("searchInput").addEventListener("input",renderLibrary);
$("sortSelect").addEventListener("change",renderLibrary);
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{currentView=b.dataset.view;document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("selected",x===b));renderLibrary()});
$("clearTagFilter").onclick=()=>{activeTag="";renderTags()};
$("themeToggle").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("library-theme",document.body.classList.contains("dark")?"dark":"light")};
if(localStorage.getItem("library-theme")==="dark")document.body.classList.add("dark");
if(isUnlocked())$("lockButton").textContent="登出";
renderAll();
