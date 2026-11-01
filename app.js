// LIBRARY v2 — local prototype with chapter-based works.
// Change this temporary password before testing. Client-side password gates are NOT secure authentication.
const SITE_PASSWORD = "change-this-password";
const STORAGE_KEY = "library-prototype-works";
const SESSION_KEY = "library-prototype-unlocked";
const $ = (id) => document.getElementById(id);

let currentPage = "home";
let activeTag = "";
let currentView = "grid";
let readerWorkId = null;
let readerChapterId = null;
let readerFontSize = Number(localStorage.getItem("library-reader-font") || 18);

function countWords(s = "") {
  const div = document.createElement("div");
  div.innerHTML = sanitizeRichHTML(String(s));
  const plainText = div.textContent || "";

  return (plainText.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+/g) || []).length;
}
// ===== 富文字內容處理 =====

const ALLOWED_TAGS = [
  "P", "BR", "STRONG", "B", "EM", "I", "U",
  "H2", "H3", "BLOCKQUOTE", "UL", "OL", "LI"
];

function sanitizeRichHTML(html) {
  const doc = new DOMParser().parseFromString(
    String(html),
    "text/html"
  );

  function clean(node) {
    let result = "";

    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const tag = child.tagName;

      // 不保留不允許的標籤及其內容
      if (!ALLOWED_TAGS.includes(tag)) return;

      const content = clean(child);

      if (tag === "BR") {
        result += "<br>";
      } else {
        const safeTag = tag.toLowerCase();
        result += `<${safeTag}>${content}</${safeTag}>`;
      }
    });

    return result;
  }

  return clean(doc.body);
}

// 將舊版純文字轉成段落
function prepareEditorContent(content = "") {
  const text = String(content);

  // 判斷是否已經是富文字格式
  if (/<\/?(p|br|strong|b|em|i|u|h2|h3|blockquote|ul|ol|li)\b/i.test(text)) {
    return sanitizeRichHTML(text);
  }

  return text
    .split(/\n/)
    .map(line => `<p>${escapeHTML(line)}</p>`)
    .join("");
}

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getChapterText() {
  return $("chapterBody").innerHTML;
}
function uid(prefix = "id") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function normalizeWork(w) {
  const work = {...w};
  work.id ||= uid("work");
  work.title ||= "未命名作品";
  work.description ||= "";
  work.status ||= "創作中";
  work.category ||= "";
  work.tags = Array.isArray(work.tags) ? work.tags : [];
  work.updated = Number(work.updated || Date.now());
  if (!Array.isArray(work.chapters)) {
    const oldBody = work.body || "";
    work.chapters = oldBody.trim() ? [{
      id: uid("chapter"), title: "第一章", body: oldBody,
      status: "published", order: 1, updated: work.updated
    }] : [];
  } else {
    work.chapters = work.chapters.map((c, i) => ({
      id: c.id || uid("chapter"), title: c.title || `第${i+1}章`,
      body: c.body || "", status: c.status || "published",
      order: Number(c.order || i+1), updated: Number(c.updated || work.updated)
    }));
  }
  delete work.body;
  return work;
}
function loadWorks() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(raw)) return raw.map(normalizeWork);
  } catch (e) { console.warn("作品資料讀取失敗", e); }
  return [
    normalizeWork({id:"sample-1",title:"故事的另一端",description:"一段尚未寫完的旅程。",status:"創作中",category:"原創",tags:["奇幻","原創","未完結"],chapters:[],updated:Date.now()-86400000}),
    normalizeWork({id:"sample-2",title:"月下舊夢",description:"在月色與回憶之間，尋找遺失的答案。",status:"已完結",category:"短篇",tags:["奇幻","短篇","悲劇"],chapters:[],updated:Date.now()-172800000})
  ];
}
let works = loadWorks();

function saveWorks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(works));
  renderAll();
}
function sortedChapters(work, includeDrafts = true) {
  return [...(work?.chapters || [])]
    .filter(c => includeDrafts || c.status === "published")
    .sort((a,b) => a.order - b.order || a.updated - b.updated);
}
function workWords(work) {
  return (work.chapters || []).reduce((n,c) => n + countWords(c.body), 0);
}
function isUnlocked() { return sessionStorage.getItem(SESSION_KEY) === "yes"; }
function showPassword() { $("passwordModal").hidden = false; $("passwordInput").focus(); }
function hidePassword() { $("passwordModal").hidden = true; $("passwordError").textContent = ""; }

function navigate(page) {
  if (page !== "home" && page !== "reader" && !isUnlocked()) { showPassword(); return; }
  currentPage = page;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = $(page + "Page");
  if (target) target.classList.add("active");
  document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  $("lockedNotice").hidden = true;
  if (page === "library") renderLibrary();
  if (page === "tags") renderTags();
  window.scrollTo({top:0, behavior:"smooth"});
}

function makeCard(work) {
  const card = document.createElement("article");
  card.className = "book-card";
  const cover = document.createElement("div");
  cover.className = "book-cover";
  cover.textContent = (work.title || "？").slice(0,1);
  cover.addEventListener("click", () => openReader(work.id));
  card.appendChild(cover);
  const info = document.createElement("div"); info.className = "book-info";
  const title = document.createElement("h3"); title.textContent = work.title; title.tabIndex = 0;
  title.addEventListener("click", () => openReader(work.id));
  info.appendChild(title);
  const desc = document.createElement("p"); desc.textContent = work.description || "尚未新增簡介。"; info.appendChild(desc);
  const chapters = sortedChapters(work, false);
  const meta = document.createElement("div"); meta.className = "book-meta";
  meta.textContent = `${work.category || "未分類"} · ${work.status} · ${chapters.length} 章 · ${workWords(work).toLocaleString()} 字`;
  info.appendChild(meta);
  const tags = document.createElement("div"); tags.className = "tag-row";
  (work.tags || []).forEach(t => {
    const b = document.createElement("button"); b.className = "tag-chip"; b.textContent = "# " + t;
    b.onclick = () => { activeTag = t; navigate("tags"); }; tags.appendChild(b);
  });
  info.appendChild(tags);
  const actions = document.createElement("div"); actions.className = "card-actions";
  const read = document.createElement("button"); read.className = "text-button"; read.textContent = "開始閱讀 →";
  read.onclick = () => openReader(work.id);
  const edit = document.createElement("button"); edit.className = "text-button"; edit.textContent = "編輯作品";
  edit.onclick = () => editWork(work.id);
  actions.append(read, edit); info.appendChild(actions);
  card.appendChild(info);
  return card;
}
function renderHome() {
  $("homeWorkCount").textContent = works.length;
  $("homeChapterCount").textContent = works.reduce((n,w) => n + sortedChapters(w,false).length, 0);
  $("homeWordCount").textContent = works.reduce((n,w) => n + workWords(w), 0).toLocaleString();
  const recent = $("recentBooks"); recent.innerHTML = "";
  if (!isUnlocked()) { recent.textContent = "登入後即可查看你的作品收藏。"; return; }
  const items = [...works].sort((a,b) => b.updated-a.updated).slice(0,3);
  if (!items.length) { recent.textContent = "還沒有作品，進入創作管理新增第一部作品吧。"; return; }
  recent.className = "book-grid"; items.forEach(w => recent.appendChild(makeCard(w)));
}
function renderLibrary() {
  const query = $("searchInput").value.trim().toLowerCase();
  const sort = $("sortSelect").value;
  let list = works.filter(w => {
    const chapterText = (w.chapters || []).map(c => c.title + " " + c.body).join(" ");
    return [w.title,w.description,w.category,(w.tags||[]).join(" "),chapterText].join(" ").toLowerCase().includes(query);
  });
  if (sort === "title") list.sort((a,b) => a.title.localeCompare(b.title,"zh-Hant"));
  else if (sort === "words") list.sort((a,b) => workWords(b)-workWords(a));
  else list.sort((a,b) => b.updated-a.updated);
  const container = $("bookCollection"); container.innerHTML = "";
  container.className = "book-grid" + (currentView === "list" ? " list-view" : "");
  if (!list.length) { container.textContent = "沒有找到符合條件的作品。"; container.classList.add("empty-state"); return; }
  list.forEach(w => container.appendChild(makeCard(w)));
}
function renderTags() {
  const counts = {};
  works.forEach(w => (w.tags||[]).forEach(t => counts[t]=(counts[t]||0)+1));
  const cloud = $("tagCollection"); cloud.innerHTML = "";
  Object.entries(counts).sort((a,b) => a[0].localeCompare(b[0],"zh-Hant")).forEach(([tag,n]) => {
    const b = document.createElement("button"); b.className = "tag-chip" + (activeTag===tag?" selected":"");
    b.textContent = `# ${tag} · ${n}`; b.onclick = () => { activeTag=tag; renderTags(); }; cloud.appendChild(b);
  });
  $("tagResultTitle").textContent = activeTag ? `標籤：${activeTag}` : "所有作品";
  const result = $("tagResults"); result.innerHTML = ""; result.className = "book-grid";
  const filtered = activeTag ? works.filter(w => (w.tags||[]).includes(activeTag)) : works;
  if (!filtered.length) { result.textContent = "這個標籤目前沒有作品。"; return; }
  filtered.forEach(w => result.appendChild(makeCard(w)));
}
function renderAll() { renderHome(); if (isUnlocked()) { renderLibrary(); renderTags(); } }

function resetWorkForm() {
  $("workForm").reset(); $("workId").value = "";
  $("chapterManager").hidden = true; $("chapterForm").hidden = true;
  $("editorHeading").textContent = "創作管理";
}
function editWork(id) {
  const work = works.find(w => w.id === id); if (!work) return;
  $("workId").value = work.id; $("workTitle").value = work.title;
  $("workDescription").value = work.description || ""; $("workStatus").value = work.status || "創作中";
  $("workCategory").value = work.category || ""; $("workTags").value = (work.tags||[]).join(", ");
  $("editorHeading").textContent = "編輯作品";
  $("chapterManager").hidden = false; $("chapterWorkName").textContent = `目前管理：${work.title}`;
  renderChapterList(); navigate("editor");
}
function renderChapterList() {
  const work = works.find(w => w.id === $("workId").value);
  const list = $("chapterList"); list.innerHTML = "";
  if (!work) return;
  const chapters = sortedChapters(work);
  if (!chapters.length) { list.textContent = "目前還沒有章節，按「新增章節」開始建立。"; list.className = "chapter-list empty-state"; return; }
  list.className = "chapter-list";
  chapters.forEach(ch => {
    const row = document.createElement("div"); row.className = "chapter-row";
    const detail = document.createElement("div"); detail.className = "chapter-detail";
    const name = document.createElement("strong"); name.textContent = `${ch.order}. ${ch.title}`;
    const meta = document.createElement("span"); meta.textContent = `${ch.status==="draft"?"草稿":"已發布"} · ${countWords(ch.body).toLocaleString()} 字`;
    detail.append(name,meta);
    const actions = document.createElement("div"); actions.className = "chapter-actions";
    const up = document.createElement("button"); up.className="secondary-button compact"; up.textContent="↑"; up.title="上移";
    up.disabled = ch.order <= 1; up.onclick = () => moveChapter(work.id,ch.id,-1);
    const down = document.createElement("button"); down.className="secondary-button compact"; down.textContent="↓"; down.title="下移";
    down.disabled = ch.order >= chapters.length; down.onclick = () => moveChapter(work.id,ch.id,1);
    const edit = document.createElement("button"); edit.className="secondary-button compact"; edit.textContent="編輯";
    edit.onclick = () => editChapter(ch.id);
    const del = document.createElement("button"); del.className="secondary-button compact danger"; del.textContent="刪除";
    del.onclick = () => deleteChapter(ch.id);
    actions.append(up,down,edit,del); row.append(detail,actions); list.appendChild(row);
  });
}
function openNewChapter() {
  const work = works.find(w => w.id === $("workId").value); if (!work) return;
  $("chapterForm").reset(); $("chapterId").value = "";$("chapterBody").innerHTML = "";
  $("chapterOrder").value = sortedChapters(work).length + 1;
  $("chapterStatus").value = "published";
  $("chapterFormHeading").textContent = "新增章節";
  $("chapterWordCount").textContent = "0 字";
  $("chapterForm").hidden = false;
  $("chapterTitle").focus();
}
function editChapter(id) {
  const work = works.find(w => w.id === $("workId").value);
  const ch = work?.chapters.find(c => c.id === id); if (!ch) return;
  $("chapterId").value = ch.id;
$("chapterTitle").value = ch.title;
$("chapterStatus").value = ch.status;
$("chapterOrder").value = ch.order;

// 載入目前章節原本儲存的富文字內容
$("chapterBody").innerHTML = prepareEditorContent(ch.body);

$("chapterFormHeading").textContent = "編輯章節";

updateChapterWordCount();
$("chapterForm").hidden = false;

$("chapterForm").scrollIntoView({
  behavior: "smooth",
  block: "start"
});
  $("chapterForm").scrollIntoView({behavior:"smooth",block:"start"});
}
function moveChapter(workId, chapterId, direction) {
  const work = works.find(w => w.id === workId); if (!work) return;
  const list = sortedChapters(work);
  const index = list.findIndex(c => c.id === chapterId);
  const target = index + direction; if (target < 0 || target >= list.length) return;
  [list[index].order,list[target].order] = [list[target].order,list[index].order];
  work.chapters = list; work.updated = Date.now(); saveWorks(); renderChapterList();
}
function deleteChapter(id) {
  const work = works.find(w => w.id === $("workId").value); if (!work) return;
  if (!confirm("確定要刪除這個章節嗎？此操作無法復原。")) return;
  work.chapters = work.chapters.filter(c => c.id !== id);
  work.chapters.forEach((c,i) => c.order=i+1);
  work.updated=Date.now(); saveWorks(); renderChapterList();
}
function updateChapterWordCount() {
  $("chapterWordCount").textContent =
    `${countWords(getChapterText()).toLocaleString()} 字`;
}

function openReader(workId, chapterId = null) {
  if (!isUnlocked()) { showPassword(); return; }
  const work = works.find(w => w.id === workId); if (!work) return;
  const chapters = sortedChapters(work,false);
  if (!chapters.length) { alert("這部作品目前沒有已發布的章節。可以先到創作管理新增章節。"); return; }
  readerWorkId = workId;
  const saved = JSON.parse(localStorage.getItem("library-reading-progress") || "{}");
  readerChapterId = chapterId || saved[workId]?.chapterId || chapters[0].id;
  if (!chapters.some(c => c.id === readerChapterId)) readerChapterId = chapters[0].id;
  navigate("reader"); renderReader();
}
function renderReader() {
  const work = works.find(w => w.id === readerWorkId); if (!work) return;
  const chapters = sortedChapters(work,false);
  const index = chapters.findIndex(c => c.id === readerChapterId);
  const chapter = chapters[index]; if (!chapter) return;
  $("readerWorkTitle").textContent = work.title;
  $("readerChapterNumber").textContent = `CHAPTER ${String(index+1).padStart(2,"0")}`;
  $("readerChapterTitle").textContent = chapter.title;
  $("readerMeta").textContent = `${work.title} · ${countWords(chapter.body).toLocaleString()} 字`;
$("readerBody").innerHTML = sanitizeRichHTML(
  prepareEditorContent(chapter.body)
);  $("readerBody").style.fontSize = `${readerFontSize}px`;
  $("previousChapter").disabled = index === 0;
  $("nextChapter").textContent = index === chapters.length-1 ? "已是最後一章" : "下一章";
  $("nextChapter").disabled = index === chapters.length-1;
  const nav = $("readerChapterNav"); nav.innerHTML = "";
  chapters.forEach((c,i) => {
    const b = document.createElement("button"); b.className = "reader-chapter-link" + (c.id===chapter.id?" active":"");
    b.textContent = `${i+1}. ${c.title}`; b.onclick = () => { readerChapterId=c.id; renderReader(); };
    nav.appendChild(b);
  });
  const progress = Math.round(((index+1)/chapters.length)*100);
  $("progressLabel").textContent = `閱讀進度 ${progress}%`;
  $("progressBar").style.width = `${progress}%`;
  const store = JSON.parse(localStorage.getItem("library-reading-progress") || "{}");
  store[workId] = {chapterId:chapter.id, progress, updated:Date.now()};
  localStorage.setItem("library-reading-progress",JSON.stringify(store));
}
function setReaderTheme(value) {
  $("readerPage").dataset.readerTheme = value;
}
document.querySelectorAll("[data-page]").forEach(b => b.addEventListener("click",() => navigate(b.dataset.page)));
$("passwordForm").addEventListener("submit",e => {
  e.preventDefault();
  if ($("passwordInput").value === SITE_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY,"yes"); hidePassword(); $("lockButton").textContent="登出";
    renderAll(); navigate(currentPage==="home"?"library":currentPage);
  } else { $("passwordError").textContent="密碼不正確，請再試一次。"; $("passwordInput").select(); }
});
$("closePassword").onclick=hidePassword;
$("unlockFromNotice").onclick=showPassword;
$("lockButton").onclick=()=>{
  if (isUnlocked()) { sessionStorage.removeItem(SESSION_KEY); $("lockButton").textContent="登入"; navigate("home"); renderHome(); }
  else showPassword();
};
$("newWorkButton").onclick=()=>{resetWorkForm();navigate("editor");};
$("resetForm").onclick=resetWorkForm;
$("workForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=$("workId").value || uid("work");
  const old=works.find(w=>w.id===id);
  const work=normalizeWork({
    ...(old||{}), id, title:$("workTitle").value.trim(),
    description:$("workDescription").value.trim(), status:$("workStatus").value,
    category:$("workCategory").value.trim(),
    tags:$("workTags").value.split(",").map(t=>t.trim()).filter(Boolean),
    chapters:old?.chapters||[], updated:Date.now()
  });
  if(old) works=works.map(w=>w.id===id?work:w); else works.push(work);
  saveWorks();
  $("workId").value=id; $("chapterManager").hidden=false;
  $("chapterWorkName").textContent=`目前管理：${work.title}`;
  $("editorHeading").textContent="編輯作品";
  renderChapterList();
});
$("addChapterButton").onclick=openNewChapter;
$("cancelChapterEdit").onclick=()=>{$("chapterForm").hidden=true;};
$("chapterBody").addEventListener("input", updateChapterWordCount);
$("chapterForm").addEventListener("submit",e=>{
  e.preventDefault();
  const work=works.find(w=>w.id===$("workId").value); if(!work) return;
  const id=$("chapterId").value || uid("chapter");
  const chapter={
    id,title:$("chapterTitle").value.trim(),status:$("chapterStatus").value,
    order:Math.max(1,Number($("chapterOrder").value)||1),
    body:sanitizeRichHTML(getChapterText()),updated:Date.now()
  };
  const existing=work.chapters.find(c=>c.id===id);
  if(existing) work.chapters=work.chapters.map(c=>c.id===id?chapter:c);
  else work.chapters.push(chapter);
  work.chapters.sort((a,b)=>a.order-b.order);
  work.chapters.forEach((c,i)=>c.order=i+1);
  work.updated=Date.now(); saveWorks(); renderChapterList();
  $("chapterForm").hidden=true;
});
$("searchInput").addEventListener("input",renderLibrary);
$("sortSelect").addEventListener("change",renderLibrary);
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{
  currentView=b.dataset.view;
  document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("selected",x===b));
  renderLibrary();
});
$("clearTagFilter").onclick=()=>{activeTag="";renderTags();};
$("themeToggle").onclick=()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("library-theme",document.body.classList.contains("dark")?"dark":"light");
};
$("backToLibrary").onclick=()=>navigate("library");
$("fontDown").onclick=()=>{readerFontSize=Math.max(14,readerFontSize-1);localStorage.setItem("library-reader-font",readerFontSize);renderReader();};
$("fontUp").onclick=()=>{readerFontSize=Math.min(30,readerFontSize+1);localStorage.setItem("library-reader-font",readerFontSize);renderReader();};
$("readerTheme").onchange=e=>setReaderTheme(e.target.value);
$("previousChapter").onclick=()=>{
  const list=sortedChapters(works.find(w=>w.id===readerWorkId),false);
  const i=list.findIndex(c=>c.id===readerChapterId); if(i>0){readerChapterId=list[i-1].id;renderReader();}
};
$("nextChapter").onclick=()=>{
  const list=sortedChapters(works.find(w=>w.id===readerWorkId),false);
  const i=list.findIndex(c=>c.id===readerChapterId); if(i>=0&&i<list.length-1){readerChapterId=list[i+1].id;renderReader();}
};
if(localStorage.getItem("library-theme")==="dark")document.body.classList.add("dark");
if(isUnlocked())$("lockButton").textContent="登出";
setReaderTheme("paper");
renderAll();
// ===== 資料匯出與匯入 =====

// 匯出全部作品與閱讀進度
function exportBackup() {
  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    works: works,
    readingProgress: JSON.parse(
      localStorage.getItem("library-reading-progress") || "{}"
    )
  };

  const blob = new Blob(
    [JSON.stringify(backupData, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `library-backup-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

// 點擊匯出按鈕
$("exportBackup").addEventListener("click", exportBackup);

// 點擊匯入按鈕，開啟檔案選擇器
$("importBackupButton").addEventListener("click", () => {
  $("importBackupInput").click();
});

// 選擇備份檔案後匯入
$("importBackupInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    // 相容舊格式：直接匯出的作品陣列
    const importedWorks = Array.isArray(backup)
      ? backup
      : backup.works;

    if (!Array.isArray(importedWorks)) {
      throw new Error("找不到有效的作品資料");
    }

    if (!confirm(
      `準備匯入 ${importedWorks.length} 部作品。\n` +
      "相同 ID 的作品將由備份版本更新，新作品會加入收藏。\n" +
      "確定繼續嗎？"
    )) {
      event.target.value = "";
      return;
    }

    // 先保留目前作品，再用備份資料更新相同 ID 的作品
    const merged = new Map(
      works.map(work => [work.id, work])
    );

    importedWorks.forEach(item => {
      if (!item || typeof item !== "object") return;

      const normalized = normalizeWork(item);
      merged.set(normalized.id, normalized);
    });

    works = Array.from(merged.values());

    // 還原閱讀進度
    if (
      backup.readingProgress &&
      typeof backup.readingProgress === "object"
    ) {
      const currentProgress = JSON.parse(
        localStorage.getItem("library-reading-progress") || "{}"
      );

      localStorage.setItem(
        "library-reading-progress",
        JSON.stringify({
          ...currentProgress,
          ...backup.readingProgress
        })
      );
    }

    saveWorks();

    alert(`匯入完成！目前共有 ${works.length} 部作品。`);
  } catch (error) {
    alert("匯入失敗，請確認檔案是正確的 JSON 備份。");
    console.error(error);
  } finally {
    event.target.value = "";
  }
});
// ===== 富文字工具列 =====

// 工具列格式功能
document.querySelectorAll(".rich-toolbar button").forEach(button => {
  button.addEventListener("mousedown", event => {
    event.preventDefault();
  });

  button.addEventListener("click", () => {
    const command = button.dataset.command;
    const editor = $("chapterBody");

    editor.focus();

    if (["h2", "h3", "blockquote"].includes(command)) {
      document.execCommand("formatBlock", false, `<${command}>`);
    } else {
      document.execCommand(command, false, null);
    }

    updateChapterWordCount();
  });
});

// Enter 鍵：標題、引用等格式的段落結束後，自動切換成內文
$("chapterBody").addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.shiftKey) return;

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  let node = selection.anchorNode;
  if (node && node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  const block = node?.closest("h2, h3, blockquote");

  if (!block || !block.contains(selection.anchorNode)) return;

  // 只有游標位於該區塊最後時，才轉換成內文
  const range = selection.getRangeAt(0);
  const afterRange = range.cloneRange();
  afterRange.selectNodeContents(block);
  afterRange.setStart(range.endContainer, range.endOffset);

  if (afterRange.toString().trim() !== "") return;

  event.preventDefault();

  const paragraph = document.createElement("p");
  paragraph.innerHTML = "<br>";

  block.after(paragraph);

  const newRange = document.createRange();
  newRange.setStart(paragraph, 0);
  newRange.collapse(true);

  selection.removeAllRanges();
  selection.addRange(newRange);

  updateChapterWordCount();
});
