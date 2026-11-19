'use strict';

/* ============================================================
   CLASS — ثبت کلاس‌ها
   نسخه ۰.۹.۰
   ============================================================ */

let clsSubject=state.subjects[0]?state.subjects[0].name:'';

function getClassData(name){
  if(!state.classes[name])state.classes[name]={total:20,sessions:{}};
  const subj=state.subjects.find(s=>s.name===name);
  if(subj){
    const total=subj.sessions||0;
    /* این تابع درون رندر فراخوانی میشود؛ نباید هر بار مقدار را بنویسد،
       چون نوشتن روی state ردیابی شده یک تغییر محلی ثبت میکند و بعد از هر
       دریافت، ارسال و دریافت دوباره به دنبال آن میآید (چرخهٔ بیهوده).
       فقط زمانی بنویس که مقدار واقعاً فرق دارد. */
    if(state.classes[name].total!==total)state.classes[name].total=total;
  }
  return state.classes[name];
}

function getGradeShort(grade){
  if(!grade) return '';
  const map={'دهم':'۱۰','یازدهم':'۱۱','دوازدهم':'۱۲'};
  return map[grade]||grade;
}
function getChapterShort(topic){
  if(!topic) return '';
  const m=String(topic).match(/فصل\s+([۰-۹0-9]+)/);
  if(m) return m[1];
  return '';
}

function renderClass(){
  const activeSubjects=state.subjects.filter(s=>(s.sessions||0)>0);
  const box=document.getElementById('clsSubjects');
  const sessBox=document.getElementById('clsSessions');
  const barEl=document.getElementById('clsProgressBar');
  const pTxt=document.getElementById('clsProgressTxt');
  const dTxt=document.getElementById('clsDownTxt');
  const toggleBtn=document.getElementById('clsViewToggle');
  if(toggleBtn){
    const mode=state.settings.classViewMode||'compact';
    toggleBtn.textContent=mode==='compact'?'🔲 نمایش گسترده':'👁️ نمایش فشرده';
  }
  if(!activeSubjects.length){
    box.innerHTML='<div class="muted">درسی با جلسه تعریف نشده.</div>';
    sessBox.innerHTML='';barEl.style.width='0%';
    pTxt.textContent='۰ از ۰ جلسه دیده شده';dTxt.textContent='۰ دانلود';
    return;
  }
  if(!activeSubjects.find(s=>s.name===clsSubject))clsSubject=activeSubjects[0].name;
  box.innerHTML=activeSubjects.map(s=>`<div class="chip chip-subj ${s.name===clsSubject?'active':''}" data-subj="${esc(s.name)}" style="--c:${s.color};border-color:${s.color}55;background:${s.color}1a">${esc(s.name)}</div>`).join('');

  const c=getClassData(clsSubject);
  const subj=state.subjects.find(s=>s.name===clsSubject);
  const availGrades=subj&&subj.grades&&subj.grades.length?subj.grades:GRADES;
  let watched=0,downloaded=0;
  for(let i=1;i<=c.total;i++){const s=c.sessions[i]||{};if(s.watched)watched++;if(s.watched||s.downloaded||s.watching)downloaded++;}
  const pct=c.total>0?Math.round(watched/c.total*100):0;
  barEl.style.width=pct+'%';
  pTxt.textContent=`${fa(watched)} از ${fa(c.total)} (${fa(pct)}٪)`;
  dTxt.textContent=`${fa(downloaded)} دانلود`;

  const mode=state.settings.classViewMode||'compact';
  sessBox.innerHTML=mode==='compact'?renderClassCompact(c):renderClassExpanded(c,availGrades);
}

function renderClassExpanded(c,availGrades){
  let cards='';
  for(let i=1;i<=c.total;i++){
    const s=c.sessions[i]||{};
    const w=!!s.watched;const viewing=!!s.watching&&!w;const d=!!s.downloaded||w||viewing;
    const status=w?'✓ دیده شده':viewing?'▶ درحال دیدن':d?'⬇ دانلود':'ثبت وضعیت';
    const stateClass=w?'is-watched':viewing?'is-watching':d?'is-downloaded':'';
    const grade=s.grade||'';const topic=s.topic||'';const sessionName=s.name||'';
    const gradeOpts=['',...availGrades].map(g=>`<option value="${g}" ${grade===g?'selected':''}>${g||'— پایه —'}</option>`).join('');
    const topicOptions=grade?(getTopics(clsSubject,grade)||[]):[];
    const topicOpts=`<option value="">— انتخاب مبحث —</option>${topicOptions.map(t=>`<option value="${esc(t)}" ${topic===t?'selected':''}>${esc(t.length>28?t.slice(0,28)+'…':t)}</option>`).join('')}${topic&&!topicOptions.includes(topic)?`<option value="${esc(topic)}" selected>${esc(topic.length>28?topic.slice(0,28)+'…':topic)}</option>`:''}`;

    cards+=`<div class="cls-card ${w?'watched':viewing?'watching':d?'downloaded':''}" data-i="${i}">
      <div class="cls-card-head"><span class="cls-card-num">${fa(i)}</span><span class="cls-card-dot ${w?'watched':viewing?'watching':d?'downloaded':'pending'}"></span></div>
      <label class="cls-card-name-label">نام جلسه</label>
      <input class="cls-card-name" data-i="${i}" data-field="name" value="${esc(sessionName)}" placeholder="مثلاً: جلسه اول - مقدمه">
      <div class="cls-card-topic-label">پایه و مبحث</div>
      <div class="cls-card-row">
        <select data-i="${i}" data-field="grade" title="پایه">${gradeOpts}</select>
        <select data-i="${i}" data-field="topic" title="مبحث">${topicOpts}</select>
      </div>
      <button type="button" class="cls-card-status ${stateClass}" data-status-index="${i}">${status}</button>
    </div>`;
  }
  return `<div class="cls-grid">${cards}<button type="button" class="cls-add-session cls-card" data-add-session aria-label="افزودن جلسه" title="افزودن جلسه"><span>＋</span><small>جلسه جدید</small></button></div>`;
}

function renderClassCompact(c){
  let cells='';
  for(let i=1;i<=c.total;i++){
    const s=c.sessions[i]||{};
    const w=!!s.watched;const viewing=!!s.watching&&!w;const d=!!s.downloaded||w||viewing;
    const cls=['cls-compact-cell'];
    if(w)cls.push('watched');else if(viewing)cls.push('watching');else if(d)cls.push('downloaded');
    const metaParts=[getGradeShort(s.grade),getChapterShort(s.topic)].filter(Boolean);
    const metaLine=metaParts.length?`<span class="cls-compact-meta">${metaParts.join(' · ')}</span>`:'';
    const metaTitleParts=[];if(s.grade)metaTitleParts.push(s.grade);if(s.topic)metaTitleParts.push(s.topic);
    const titleBase=s.name||('جلسه '+fa(i));
    const title=metaTitleParts.length?`${titleBase} (${metaTitleParts.join(' · ')})`:titleBase;
    cells+=`<button type="button" class="${cls.join(' ')}" data-compact-i="${i}" title="${esc(title)}"><span class="cls-compact-dot"></span><span class="cls-compact-num">${fa(i)}</span>${metaLine}</button>`;
  }
  return `<div class="cls-compact-wrap">
    <div class="cls-compact-legend">
      <span class="cc-leg"><span class="cc-dot watched"></span> دیده شده</span>
      <span class="cc-leg"><span class="cc-dot watching"></span> درحال دیدن</span>
      <span class="cc-leg"><span class="cc-dot downloaded"></span> دانلود</span>
      <span class="cc-leg"><span class="cc-dot pending"></span> بدون وضعیت</span>
    </div>
    <div class="cls-compact-grid">${cells}<button type="button" class="cls-compact-cell cls-add-session" data-add-session aria-label="افزودن جلسه" title="افزودن جلسه"><span>＋</span></button></div>
    <div class="muted text-center mt-10 fs-10h">برای ویرایش روی هر جلسه بزن</div>
  </div>`;
}

document.getElementById('clsSubjects').addEventListener('click',(e)=>{const c=e.target.closest('.chip[data-subj]');if(!c)return;clsSubject=c.dataset.subj;renderClass();});
document.getElementById('clsSessions').addEventListener('input',(e)=>{
  const t=e.target.closest('[data-field="name"]');if(!t)return;
  const c=getClassData(clsSubject);const i=t.dataset.i;
  c.sessions[i]=c.sessions[i]||{};c.sessions[i].name=t.value;save();
});
document.getElementById('clsSessions').addEventListener('change',(e)=>{
  const gradeEl=e.target.closest('[data-field="grade"]');
  const topicEl=e.target.closest('[data-field="topic"]');
  if(!gradeEl&&!topicEl)return;
  const c=getClassData(clsSubject);const i=(gradeEl||topicEl).dataset.i;
  c.sessions[i]=c.sessions[i]||{};
  if(gradeEl){c.sessions[i].grade=gradeEl.value;if(c.sessions[i].topic&&!getTopics(clsSubject,gradeEl.value).includes(c.sessions[i].topic))c.sessions[i].topic='';}
  if(topicEl){c.sessions[i].topic=topicEl.value;}
  save();renderClass();
});
document.getElementById('clsSessions').addEventListener('click',(e)=>{
  if(e.target.closest('[data-add-session]')){
    const c=getClassData(clsSubject);c.total++;
    const subj=state.subjects.find(s=>s.name===clsSubject);if(subj)subj.sessions=c.total;
    save();renderClass();return;
  }
  const btn=e.target.closest('[data-status-index]');
  if(btn){
    const c=getClassData(clsSubject);const i=btn.dataset.statusIndex;
    c.sessions[i]=c.sessions[i]||{};const session=c.sessions[i];
    if(!session.downloaded&&!session.watching&&!session.watched)session.downloaded=true;
    else if(session.downloaded&&!session.watching&&!session.watched)session.watching=true;
    else if(session.watching&&!session.watched){session.watching=false;session.watched=true;}
    else{session.watched=false;session.watching=false;session.downloaded=false;}
    save();renderClass();return;
  }
  const cell=e.target.closest('[data-compact-i]');
  if(cell){openCompactClassEditor(clsSubject,cell.dataset.compactI);}
});
document.getElementById('clsViewToggle').onclick=()=>{
  const cur=state.settings.classViewMode||'compact';
  state.settings.classViewMode=cur==='compact'?'expanded':'compact';
  save();renderClass();
};

function openCompactClassEditor(subjectName, i){
  const c=getClassData(subjectName);const s=c.sessions[i]||{};
  const subj=state.subjects.find(x=>x.name===subjectName);
  const availGrades=subj&&subj.grades&&subj.grades.length?subj.grades:GRADES;
  const grade=s.grade||'';const topic=s.topic||'';const sessionName=s.name||'';
  const color=subjColor(subjectName);
  const gradeOpts=['',...availGrades].map(g=>`<option value="${g}" ${grade===g?'selected':''}>${g||'— پایه —'}</option>`).join('');
  const topicOptions=grade?(getTopics(subjectName,grade)||[]):[];
  const topicOpts=`<option value="">— انتخاب مبحث —</option>${topicOptions.map(t=>`<option value="${esc(t)}" ${topic===t?'selected':''}>${esc(t.length>32?t.slice(0,32)+'…':t)}</option>`).join('')}${topic&&!topicOptions.includes(topic)?`<option value="${esc(topic)}" selected>${esc(topic)}</option>`:''}`;
  openModal(`
    <div class="modal-head"><div class="card-title" style="color:${color}">جلسه ${fa(i)} — ${esc(subjectName)}</div><button class="icon-btn" data-close>✕</button></div>
    <label class="lbl mt-0">نام جلسه</label>
    <input class="input" id="ccmName" value="${esc(sessionName)}" placeholder="مثلاً: جلسه اول - مقدمه">
    <label class="lbl">پایه و مبحث</label>
    <div class="grid2"><select class="input" id="ccmGrade">${gradeOpts}</select><select class="input" id="ccmTopic">${topicOpts}</select></div>
    <div class="lbl mt-14">وضعیت</div>
    <div class="cls-status-choices">
      <button type="button" class="mini-btn cls-status-btn${s.watched?' is-watched':''}" id="ccmWatched">✓ دیده شده</button>
      <button type="button" class="mini-btn cls-status-btn${s.watching&&!s.watched?' is-watching':''}" id="ccmWatching">▶ درحال دیدن</button>
      <button type="button" class="mini-btn cls-status-btn${s.downloaded&&!s.watched&&!s.watching?' is-downloaded':''}" id="ccmDownloaded">⬇ دانلود</button>
      <button type="button" class="mini-btn cls-status-btn" id="ccmNone">○ بدون وضعیت</button>
    </div>
    <div class="row mt-16"><button class="btn ghost" data-close>انصراف</button><button class="btn primary" id="ccmSave">ذخیره</button></div>
  `);
  document.getElementById('ccmGrade').onchange=(e)=>{
    const newGrade=e.target.value;const tps=getTopics(subjectName,newGrade)||[];
    document.getElementById('ccmTopic').innerHTML=`<option value="">— انتخاب مبحث —</option>${tps.map(t=>`<option value="${esc(t)}">${esc(t.length>32?t.slice(0,32)+'…':t)}</option>`).join('')}`;
  };
  let watched=!!s.watched, watching=!!s.watching&&!s.watched, downloaded=!!s.downloaded;
  const refreshBtns=()=>{
    document.getElementById('ccmWatched').classList.toggle('is-watched', watched);
    document.getElementById('ccmWatching').classList.toggle('is-watching', watching);
    document.getElementById('ccmDownloaded').classList.toggle('is-downloaded', downloaded&&!watched&&!watching);
  };
  document.getElementById('ccmWatched').onclick=()=>{watched=!watched;if(watched){downloaded=true;watching=false;}refreshBtns();};
  document.getElementById('ccmWatching').onclick=()=>{watching=!watching;if(watching){downloaded=true;watched=false;}refreshBtns();};
  document.getElementById('ccmDownloaded').onclick=()=>{if(watched||watching)return;downloaded=!downloaded;refreshBtns();};
  document.getElementById('ccmNone').onclick=()=>{watched=false;watching=false;downloaded=false;refreshBtns();};
  document.getElementById('ccmSave').onclick=()=>{
    c.sessions[i]=c.sessions[i]||{};
    c.sessions[i].name=document.getElementById('ccmName').value.trim();
    c.sessions[i].grade=document.getElementById('ccmGrade').value;
    c.sessions[i].topic=document.getElementById('ccmTopic').value;
    c.sessions[i].watched=watched;c.sessions[i].watching=watching;c.sessions[i].downloaded=downloaded;
    save();closeModal();renderClass();toast('ذخیره شد ✓');
  };
}