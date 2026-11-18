'use strict';

/* ============================================================
   REPORTS — گزارش هفتگی جامع (جدول جامع) + خروجی PNG
   قابل استفاده در بخش فعالیت و داشبورد
   ============================================================ */

let wrAnchor=TODAY_JDN;
const wrWeekStart=()=>weekStartJdn(wrAnchor);
function wrKeys(){const s=wrWeekStart();return Array.from({length:7},(_,i)=>jKey(d2j(s+i))); }
function wrWeekRangeText(){const s=wrWeekStart();const a=d2j(s),b=d2j(s+6);return`${fa(a.jd)} ${MONTHS[a.jm-1]} تا ${fa(b.jd)} ${MONTHS[b.jm-1]} ${fa(b.jy)}`; }

function computeWeeklyData(){
  const keys=wrKeys();
  const dayInfo=keys.map(k=>{const j=parseKey(k);const jdn=j2d(j.jy,j.jm,j.jd);return{key:k,dayName:DOW[dowIndex(jdn)],dateNum:j.jd,month:MONTHS[j.jm-1]};});
  const allWeekActs=countedActivities(keys);
  const studyWeekActs=allWeekActs.filter(a=>a.subject!==OTHER_SUBJECT);
  const otherWeekActs=allWeekActs.filter(a=>a.subject===OTHER_SUBJECT);
  const subs=[...subjectsForPie(),{name:EXAM_SUBJECT,color:EXAM_COLOR}];
  const subjects=subs.map(s=>{
    const days=keys.map(k=>{const acts=studyWeekActs.filter(a=>a.subject===s.name&&a.date===k);const topics=[...new Set(acts.map(a=>a.topic).filter(Boolean))];const time=sumMinutes(acts);const tb=testsBreakdown(acts);return{topics,time,...tb};});
    const all=studyWeekActs.filter(a=>a.subject===s.name);const totalTB=testsBreakdown(all);
    return{name:s.name,color:s.color,days,total:{time:sumMinutes(all),...totalTB}};
  });
  const otherData=keys.map(k=>{
    const acts=otherWeekActs.filter(a=>a.date===k);
    const topics=[...new Set(acts.map(a=>a.topic).filter(Boolean))];
    return{topics,time:sumMinutes(acts)};
  });
  const otherTotalTime=sumMinutes(otherWeekActs);
  const dailyTotals=keys.map(k=>{const acts=studyWeekActs.filter(a=>a.date===k);const tb=testsBreakdown(acts);return{time:sumMinutes(acts),...tb};});
  const dailyOther=keys.map(k=>sumMinutes(otherWeekActs.filter(a=>a.date===k)));
  const dailySleep=keys.map(k=>{const sleeps=state.sleeps.filter(s=>s.date===k);return{sleeps,total:sleeps.reduce((sum,s)=>sum+(+s.minutes||0),0)};});
  const dailyPhone=keys.map(k=>{const list=state.phones.filter(p=>p.date===k);return{total:list.reduce((s,p)=>s+(+p.minutes||0),0)};});
  const grand={time:dailyTotals.reduce((s,d)=>s+d.time,0),c:dailyTotals.reduce((s,d)=>s+d.c,0),w:dailyTotals.reduce((s,d)=>s+d.w,0),b:dailyTotals.reduce((s,d)=>s+d.b,0),otherTime:otherTotalTime};
  grand.t=grand.c+grand.w+grand.b;
  grand.pct=grand.t?Math.max(0,Math.round((3*grand.c-grand.w)/(3*grand.t)*100)):0;
  grand.allTime=grand.time+grand.otherTime;
  subjects.forEach(s=>{s.total.share=grand.time>0?Math.round(s.total.time/grand.time*100):0;});
  return{keys,dayInfo,subjects,otherData,otherTotalTime,dailyTotals,dailyOther,dailySleep,dailyPhone,grand,sleepWeekly:dailySleep.reduce((s,d)=>s+d.total,0),phoneWeekly:dailyPhone.reduce((s,d)=>s+d.total,0)};
}

function buildWeeklyTableHTML(data){
  const headCells=data.dayInfo.map(d=>`<th class="day-head"><div class="day-name">${d.dayName}</div><div class="day-date">${fa(d.dateNum)} ${d.month}</div></th>`).join('');
  const testBadge=(c,w,b)=>(c||w||b)?`<span class="meta-badge t-test">د${fa(c)} غ${fa(w)} ن${fa(b)}</span>`:'';

  const rows=data.subjects.map(s=>{
    const isExam=s.name===EXAM_SUBJECT;
    const cells=s.days.map((d,i)=>{
      const k=data.keys[i];
      const empty=!d.topics.length&&!d.time&&!d.t;
      const cellClass='day-cell'+(empty?' empty':'')+(isExam?'':' editable');
      const timeCompact=d.time>0?hmTotalStr(d.time):'';
      if(empty)return`<td class="${cellClass}" data-subj="${esc(s.name)}" data-key="${k}"><span class="cell-time-compact">—</span><span class="cell-full text-dim">—</span></td>`;
      const topicsHTML=d.topics.length?`<div class="topic-list">${d.topics.map(t=>`<div class="topic-item" title="${esc(t)}">${esc(t)}</div>`).join('')}</div>`:'';
      const badges=[];
      if(d.time>0)badges.push(`<span class="meta-badge">⏱ ${hmString(d.time)}</span>`);
      if(d.t>0)badges.push(testBadge(d.c,d.w,d.b));
      const detailHTML=`${topicsHTML}<div class="meta-badges">${badges.join('')}</div>`;
      const compactHTML=`<span class="cell-time-compact">${timeCompact||'—'}</span>`;
      return`<td class="${cellClass}" data-subj="${esc(s.name)}" data-key="${k}">${compactHTML}<div class="cell-full">${detailHTML}</div></td>`;
    }).join('');
    const totBadges=[];
    if(s.total.time>0){totBadges.push(`<span class="meta-badge">⏱ ${hmString(s.total.time)}</span>`);} 
    if(s.total.t>0)totBadges.push(`<span class="meta-badge t-test">📝 ${fa(s.total.t)}</span>`);
    const totCompact=s.total.time>0?hmTotalStr(s.total.time):'—';
    const totHTML=totBadges.length?`<span class="cell-time-compact">${totCompact}</span><div class="cell-full"><div class="meta-badges center">${totBadges.join('')}</div></div>`:'<span class="cell-time-compact">—</span><span class="cell-full text-dim">—</span>';
    return`<tr><td class="subj-col"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-left:6px;background:${s.color};vertical-align:middle"></span><b class="wr-subject-name">${esc(s.name)}</b></td>${cells}<td class="total-col">${totHTML}</td></tr>`;
  }).join('');

  const otherCells=data.otherData.map((d,i)=>{
    const k=data.keys[i];
    const empty=!d.topics.length&&!d.time;
    const cls='day-cell'+(empty?' empty':'')+' editable';
    const timeCompact=d.time>0?hmTotalStr(d.time):'';
    if(empty)return`<td class="${cls}" data-subj="${esc(OTHER_SUBJECT)}" data-key="${k}"><span class="cell-time-compact">—</span><span class="cell-full text-dim">—</span></td>`;
    const topicsHTML=d.topics.length?`<div class="topic-list">${d.topics.map(t=>`<div class="topic-item" title="${esc(t)}">${esc(t)}</div>`).join('')}</div>`:'';
    const badges=d.time>0?`<span class="meta-badge">⏱ ${hmString(d.time)}</span>`:'';
    return`<td class="${cls}" data-subj="${esc(OTHER_SUBJECT)}" data-key="${k}"><span class="cell-time-compact">${timeCompact}</span><div class="cell-full">${topicsHTML}<div class="meta-badges">${badges}</div></div></td>`;
  }).join('');
  const otherTotalBadge=data.otherTotalTime>0?`<span class="cell-time-compact">${hmTotalStr(data.otherTotalTime)}</span><div class="cell-full"><span class="meta-badge slate">⏱ ${hmString(data.otherTotalTime)}</span></div>`:'<span class="text-dim">—</span>';
  const otherRow=`<tr><td class="subj-col" style="color:${OTHER_COLOR}"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-left:6px;background:${OTHER_COLOR};vertical-align:middle"></span><b class="wr-subject-name">${esc(OTHER_SUBJECT)}</b></td>${otherCells}<td class="total-col other">${otherTotalBadge}</td></tr>`;

  const totalCells=data.dailyTotals.map((d)=>{
    if(!d.time&&!d.t)return`<td class="day-cell text-dim"><span class="cell-time-compact">—</span><span class="cell-full">—</span></td>`;
    const badges=[];
    if(d.time)badges.push(`<span class="meta-badge">⏱ ${hmString(d.time)}</span>`);
    if(d.t)badges.push(`<span class="meta-badge t-test">📝 ${fa(d.t)}</span>`);
    const compact=d.time?hmTotalStr(d.time):'—';
    return`<td class="day-cell"><span class="cell-time-compact">${compact}</span><div class="cell-full"><div class="meta-badges center">${badges.join('')}</div></div></td>`;
  }).join('');
  const grandBadges=[];
  if(data.grand.time)grandBadges.push(`<span class="meta-badge">⏱ ${hmString(data.grand.time)}</span>`);
  if(data.grand.t)grandBadges.push(`<span class="meta-badge t-test">📝 ${fa(data.grand.t)}</span>`);
  const grandCompact=data.grand.time?hmTotalStr(data.grand.time):'—';
  const grandHTML=grandBadges.length?`<span class="cell-time-compact">${grandCompact}</span><div class="cell-full">${grandBadges.join('')}</div>`:'<span class="cell-time-compact">—</span><span class="cell-full">—</span>';
  const totalsRow=`<tr class="totals-row"><td class="subj-col">مجموع روز</td>${totalCells}<td class="total-col">${grandHTML}</td></tr>`;

  const sleepCells=data.dailySleep.map((d,i)=>{const k=data.keys[i];if(!d.sleeps.length)return`<td class="info-cell sleep-cell text-dim" data-sleep-key="${k}">—</td>`;const items=d.sleeps.map(s=>`<div class="sleep-entry">😴 ${minToStr(s.startMin)} تا ${minToStr(s.endMin)}</div>`).join('');return`<td class="info-cell sleep-cell" data-sleep-key="${k}">${items}</td>`;}).join('');
  const sleepRow=`<tr class="info-row"><td class="subj-col text-indigo">😴 خواب</td>${sleepCells}<td class="total-col sleep">${data.sleepWeekly>0?'😴 '+hmString(data.sleepWeekly):'—'}</td></tr>`;

  const phoneCells=data.dailyPhone.map((d,i)=>{const k=data.keys[i];if(!d.total)return`<td class="info-cell phone-cell text-dim" data-phone-key="${k}">—</td>`;return`<td class="info-cell phone-cell" data-phone-key="${k}"><span class="phone-time">📱 ${hmString(d.total)}</span></td>`;}).join('');
  const phoneRow=`<tr class="info-row phone-row"><td class="subj-col text-red">📱 گوشی</td>${phoneCells}<td class="total-col phone">${data.phoneWeekly>0?'📱 '+hmString(data.phoneWeekly):'—'}</td></tr>`;

  return `<div class="wr-scroll"><table class="wr-table"><thead><tr><th class="subj-col">درس</th>${headCells}<th class="total-col">مجموع</th></tr></thead><tbody>${rows}${otherRow}${totalsRow}${sleepRow}${phoneRow}</tbody></table></div>`;
}

function weeklyReportShellHTML(innerTable){
  const isCurrent=wrWeekStart()>=weekStartJdn(TODAY_JDN);
  const disabled=isCurrent?' disabled':'';
  const todayHidden=isCurrent?' hidden':'';
  return `
    <div class="cwr-shell">
      <div class="cwr-nav">
        <button class="wr-nav-btn cwr-prev" type="button">‹</button>
        <div class="cwr-center">
          <div class="cwr-label">${esc(wrWeekRangeText())}</div>
          <button class="wr-today-btn cwr-today" type="button"${todayHidden}>هفته جاری</button>
        </div>
        <button class="wr-nav-btn cwr-next" type="button"${disabled}>›</button>
      </div>
      <div class="card p-0 overflow-hidden cwr-body">${innerTable}</div>
    </div>`;
}

function renderWeeklyReportInto(container){
  if(!container) return;
  const data=computeWeeklyData();
  container.innerHTML=weeklyReportShellHTML(buildWeeklyTableHTML(data));
  const prev=container.querySelector('.cwr-prev');
  const next=container.querySelector('.cwr-next');
  const today=container.querySelector('.cwr-today');
  if(prev) prev.onclick=()=>{wrAnchor-=7;renderWeeklyReport();};
  if(next) next.onclick=()=>{if(wrWeekStart()>=weekStartJdn(TODAY_JDN))return;wrAnchor+=7;renderWeeklyReport();};
  if(today) today.onclick=()=>{wrAnchor=TODAY_JDN;renderWeeklyReport();};
}

function renderWeeklyReport(){
  const hosts=[
    document.getElementById('activityWeeklyReport'),
    document.getElementById('dashWeeklyReport')
  ].filter(Boolean);
  hosts.forEach(renderWeeklyReportInto);
}
function renderWeeklyComprehensiveReports(){ renderWeeklyReport(); }

function openWeeklyReport(){
  if(typeof openReport==='function') openReport('week');
}

/* ============ CELL EDITOR (event delegation) ============ */
let cellEditorState=null;

document.addEventListener('click',(e)=>{
  const cell=e.target.closest('.cwr-body .day-cell.editable[data-subj]');
  if(cell){ if(cell.dataset.subj===EXAM_SUBJECT) return; openCellEditor(cell.dataset.subj,cell.dataset.key); return; }
  const sleepCell=e.target.closest('.cwr-body [data-sleep-key]');
  if(sleepCell){ openSleepModal(jdnFromKey(sleepCell.dataset.sleepKey)); return; }
  const phoneCell=e.target.closest('.cwr-body [data-phone-key]');
  if(phoneCell){ openPhoneTotalEditor(phoneCell.dataset.phoneKey); return; }
});

function openCellEditor(subjName,dayKey){
  const jd=parseKey(dayKey);
  const jdn=jdnFromKey(dayKey);
  const dateLabel=`${DOW[dowIndex(jdn)]} ${fa(jd.jd)} ${MONTHS[jd.jm-1]}`;
  const existing=state.activities.filter((a)=>a.subject===subjName&&a.date===dayKey);
  cellEditorState={subjName,dayKey,acts:existing.map((a)=>({id:a.id,startMin:a.startMin,endMin:a.endMin,topic:a.topic||'',tests:a.tests?{...a.tests}:null}))};
  if(!cellEditorState.acts.length){
    let s;
    if(dayKey===TODAY_KEY){const now=new Date();const nowMin=Math.floor((now.getHours()*60+now.getMinutes())/15)*15;s=Math.max(START_MIN,Math.min(END_MIN-60,nowMin));}
    else s=16*60;
    cellEditorState.acts.push({id:uid(),startMin:s,endMin:Math.min(END_MIN,s+60),topic:'',tests:null});
  }
  openModal(`
    <div class="modal-head"><div class="card-title">${esc(subjName)} <span class="report-subj-date">— ${dateLabel}</span></div><button class="icon-btn" data-close>✕</button></div>
    <div id="cellEditorBody"></div>
    <button type="button" id="addActBtn" class="btn cyan mt-10">+ افزودن فعالیت جدید</button>
    <div class="row mt-12"><button class="btn ghost" data-close>انصراف</button><button class="btn primary" id="saveCellBtn">ذخیره</button></div>
  `);
  renderCellEditorBody();
  document.getElementById('addActBtn').onclick=()=>{
    syncCellEditorState();
    const last=cellEditorState.acts[cellEditorState.acts.length-1];
    let s=START_MIN;
    if(last&&last.endMin!=null)s=Math.min(END_MIN-60,last.endMin);
    cellEditorState.acts.push({id:uid(),startMin:s,endMin:Math.min(END_MIN,s+60),topic:'',tests:null});
    renderCellEditorBody();
  };
  document.getElementById('saveCellBtn').onclick=()=>{
    const body=document.getElementById('cellEditorBody');
    const cards=body.querySelectorAll('.cell-act-card');
    const newActs=[];
    let hasError=false;
    const canTests=subjectCanHaveTests(cellEditorState.subjName);
    cards.forEach((card,i)=>{
      const s=getTimePairValue('ceStart'+i);
      const e=getTimePairValue('ceEnd'+i);
      if(s==null||e==null||e<=s){hasError=true;return;}
      const topic=card.querySelector('[data-field="topic"]').value.trim();
      const hasTests=canTests&&card.querySelector('[data-field="hasTests"]').checked;
      const tests=hasTests?{correct:+card.querySelector('[data-field="correct"]').value||0,wrong:+card.querySelector('[data-field="wrong"]').value||0,blank:+card.querySelector('[data-field="blank"]').value||0}:null;
      newActs.push({id:cellEditorState.acts[i].id,date:cellEditorState.dayKey,subject:cellEditorState.subjName,topic,startMin:s,endMin:e,minutes:e-s,tests,ts:Date.now()});
    });
    if(hasError){toast('ساعت‌ها معتبر نیستند');return;}
    state.activities=state.activities.filter((a)=>!(a.subject===cellEditorState.subjName&&a.date===cellEditorState.dayKey));
    state.activities.push(...newActs);
    save();closeModal();
    renderWeeklyReport();renderDashboard();renderActivityList();renderPlanCalendar();
    if(document.getElementById('view-plan')&&document.getElementById('view-plan').classList.contains('active')&&typeof planViewMode!=='undefined'&&planViewMode==='timeline'&&typeof renderBlocks==='function')renderBlocks();
    toast('ذخیره شد ✓');
  };
}
function renderCellEditorBody(){
  const body=document.getElementById('cellEditorBody');
  if(!body||!cellEditorState)return;
  for(const key of Array.from(window._timePairs.keys())){
    if(key.startsWith('ceStart')||key.startsWith('ceEnd'))window._timePairs.delete(key);
  }
  if(!cellEditorState.acts.length){body.innerHTML=`<div class="muted cell-empty-note">فعالیتی ثبت نشده.</div>`;return;}
  const canTests=subjectCanHaveTests(cellEditorState.subjName);
  body.innerHTML=cellEditorState.acts.map((act,i)=>{
    const hasTests=canTests&&!!act.tests;
    return`<div class="cell-act-card" data-idx="${i}">
        <div class="cell-act-head">
          <span class="cell-act-title">فعالیت ${fa(i+1)}</span>
          <button type="button" data-del-row class="cell-act-del">حذف</button>
        </div>
        <div class="grid2 gap-6">
          <div><label class="lbl mt-0 fs-10">شروع</label><div class="time-pair" id="ceStartWrap${i}"></div></div>
          <div><label class="lbl mt-0 fs-10">پایان</label><div class="time-pair" id="ceEndWrap${i}"></div></div>
        </div>
        <input class="input cell-topic-input" data-field="topic" value="${esc(act.topic||'')}" placeholder="مبحث (اختیاری)">
        <div class="toggle-row ${hasTests?'on':''} ${canTests?'':'hidden'}">
          <div class="tr-title">ثبت تست</div>
          <label class="switch"><input type="checkbox" data-field="hasTests" ${hasTests?'checked':''}><span></span></label>
        </div>
        <div data-tests-fields class="grid3 cell-tests-grid ${hasTests?'':'hidden'}">
          <input class="input cell-test-input" type="number" data-field="correct" value="${hasTests?act.tests.correct:''}" placeholder="درست">
          <input class="input cell-test-input" type="number" data-field="wrong" value="${hasTests?act.tests.wrong:''}" placeholder="غلط">
          <input class="input cell-test-input" type="number" data-field="blank" value="${hasTests?act.tests.blank:''}" placeholder="نزده">
        </div>
      </div>`;
  }).join('');
  cellEditorState.acts.forEach((act,i)=>{
    mountTimePair('ceStart'+i,document.getElementById('ceStartWrap'+i),{value:act.startMin});
    mountTimePair('ceEnd'+i,document.getElementById('ceEndWrap'+i),{value:act.endMin});
  });
  body.querySelectorAll('[data-field="hasTests"]').forEach((cb)=>{
    cb.onchange=()=>{
      const card=cb.closest('.cell-act-card');
      const idx=+card.dataset.idx;
      syncCellEditorState();
      cellEditorState.acts[idx].tests=cb.checked?{correct:0,wrong:0,blank:0}:null;
      renderCellEditorBody();
    };
  });
  body.querySelectorAll('[data-del-row]').forEach((btn)=>{btn.onclick=()=>{const idx=+btn.closest('.cell-act-card').dataset.idx;syncCellEditorState();cellEditorState.acts.splice(idx,1);renderCellEditorBody();};});
}
function syncCellEditorState(){
  const body=document.getElementById('cellEditorBody');
  if(!body||!cellEditorState)return;
  body.querySelectorAll('.cell-act-card').forEach((card)=>{
    const idx=+card.dataset.idx;
    const act=cellEditorState.acts[idx];
    if(!act)return;
    const s=getTimePairValue('ceStart'+idx);
    const e=getTimePairValue('ceEnd'+idx);
    if(s!=null)act.startMin=s;
    if(e!=null)act.endMin=e;
    act.topic=card.querySelector('[data-field="topic"]').value;
    const tToggle = card.querySelector('[data-field="hasTests"]');
    if (tToggle) {
      if (tToggle.checked) {
        const cEl = card.querySelector('[data-field="correct"]');
        const wEl = card.querySelector('[data-field="wrong"]');
        const bEl = card.querySelector('[data-field="blank"]');
        act.tests = {
          correct: cEl ? (+cEl.value || 0) : 0,
          wrong: wEl ? (+wEl.value || 0) : 0,
          blank: bEl ? (+bEl.value || 0) : 0
        };
      } else {
        act.tests = null;
      }
    }
  });
}

/* ============ PHONE TOTAL EDITOR ============ */
function openPhoneTotalEditor(dayKey){
  const jdn=jdnFromKey(dayKey);
  const existing=state.phones.filter(p=>p.date===dayKey);
  const total=existing.reduce((s,p)=>s+(+p.minutes||0),0);
  openModal(`
    <div class="modal-head"><div class="card-title">📱 ویرایش گوشی — ${dayLabel(jdn)}</div><button class="icon-btn" data-close>✕</button></div>
    <label class="lbl mt-0">مدت استفاده</label>
    <div class="time-pair" id="phEditWrap"></div>
    <div class="muted text-center mt-10 fs-10h">${existing.length?`مجموع فعلی: ${hmString(total)} — ${fa(existing.length)} رکورد`:'هنوز ثبت نشده'}</div>
    <div class="row mt-16">
      ${existing.length?`<button class="btn danger" id="phEditDel">پاک کردن</button>`:''}
      <button class="btn primary" id="phEditSave">ذخیره</button>
    </div>
  `);
  const tp=mountTimePair('phEdit',document.getElementById('phEditWrap'),{value:total});
  document.getElementById('phEditSave').onclick=()=>{
    const minutes=tp.get()||0;
    state.phones=state.phones.filter(p=>p.date!==dayKey);
    if(minutes>0)state.phones.push({id:uid(),date:dayKey,minutes,ts:Date.now()});
    save();closeModal();renderWeeklyReport();renderDashboard();toast('ذخیره شد ✓');
  };
  const delBtn=document.getElementById('phEditDel');
  if(delBtn)delBtn.onclick=()=>{state.phones=state.phones.filter(p=>p.date!==dayKey);save();closeModal();renderWeeklyReport();renderDashboard();toast('پاک شد');};
}

/* ============================================================
   WEEKLY REPORT IMAGE (PNG)
   ============================================================ */
async function generateWeeklyReportCanvas(){
  const data=computeWeeklyData();
  if(document.fonts&&document.fonts.ready){try{await document.fonts.ready;}catch(e){}}

  const allSubjectsList = state.subjects;
  const generalNames = allSubjectsList.filter(s=>s.type!=='specialized').map(s=>s.name);
  const generalRows = data.subjects.filter(s=>generalNames.includes(s.name));
  const specializedRows = data.subjects.filter(s=>!generalNames.includes(s.name) && s.name!==EXAM_SUBJECT);
  const examRow = data.subjects.find(s=>s.name===EXAM_SUBJECT);
  const displaySubjects = [...specializedRows];
  if(generalRows.length){
    const combined = {
      name:'عمومی', color:'#a78bfa', isGeneralCombined:true, memberNames:generalRows.map(g=>g.name),
      days: data.keys.map((k,i)=>{
        const topics=[];let time=0,c=0,w=0,b=0;
        generalRows.forEach(g=>{
          g.days[i].topics.forEach(t=>topics.push(g.name+': '+t));
          time += g.days[i].time||0;
          c += g.days[i].c||0;
          w += g.days[i].w||0;
          b += g.days[i].b||0;
        });
        return {topics,time,c,w,b,t:c+w+b};
      }),
      total: (()=>{let time=0,c=0,w=0,b=0;generalRows.forEach(g=>{time+=g.total.time||0;c+=g.total.c||0;w+=g.total.w||0;b+=g.total.b||0;});return {time,c,w,b,t:c+w+b,share:0};})()
    };
    displaySubjects.push(combined);
  }
  if(examRow) displaySubjects.push(examRow);

  const pad=44;
  const subjColW=150,dayColW=178,totalColW=185;
  const headH=80,otherRowH=110,totalsRowH=112,sleepRowH=78,phoneRowH=66;

  const cv=document.createElement('canvas');
  const cx=cv.getContext('2d');

  const topicFont = '500 15px Vazirmatn, Tahoma, sans-serif';
  const topicLineH = 20;
  const maxTopicsPerCell = 3;
  const maxLinesPerTopic = 2;

  const rowHeights = displaySubjects.map(s => {
    let maxCellH = 120;
    s.days.forEach(d => {
      let h = 20;
      cx.font = topicFont;
      const topicsToShow = d.topics.slice(0, maxTopicsPerCell);
      topicsToShow.forEach(t => {
        const lines = wrapText(cx, t, dayColW - 24, maxLinesPerTopic);
        h += lines.length * topicLineH;
      });
      if(d.time > 0) h += 22;
      if(d.t > 0) h += 22;
      h += 20;
      if(h > maxCellH) maxCellH = h;
    });
    return Math.max(120, Math.min(300, maxCellH));
  });

  const tableW=subjColW+dayColW*7+totalColW;
  const tableH=headH+rowHeights.reduce((s,h)=>s+h,0)+otherRowH+totalsRowH+sleepRowH+phoneRowH;
  const titleH=400;const footerH=90;
  const W=tableW+pad*2;const H=titleH+tableH+footerH+pad*2;
  cv.width=W;cv.height=H;
  const bg=cx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#0b1024');bg.addColorStop(.5,'#101733');bg.addColorStop(1,'#080d1c');cx.fillStyle=bg;cx.fillRect(0,0,W,H);
  let rg=cx.createRadialGradient(W*.85,30,0,W*.85,30,850);rg.addColorStop(0,'rgba(124,92,255,.48)');rg.addColorStop(1,'rgba(124,92,255,0)');cx.fillStyle=rg;cx.fillRect(0,0,W,H);
  cx.direction='rtl';cx.textBaseline='middle';const R=W-pad;

  const pLabel = profileLabel();

  cx.textAlign='right';
  cx.fillStyle='rgba(255,255,255,.55)';
  cx.font='600 26px Vazirmatn, Tahoma, sans-serif';
  cx.fillText('مسیر کنکور — گزارش هفتگی جامع دروس', R, pad+26);

  cx.fillStyle='#fff';
  cx.font='800 54px Vazirmatn, Tahoma, sans-serif';
  cx.fillText('گزارش هفتگی', R, pad+100);

  cx.fillStyle='rgba(255,255,255,.62)';
  cx.font='500 26px Vazirmatn, Tahoma, sans-serif';
  cx.fillText(wrWeekRangeText(), R, pad+152);

  cx.fillStyle='#22d3ee';
  cx.font='700 24px Vazirmatn, Tahoma, sans-serif';
  cx.fillText(`${fa(Math.max(0,KONKUR_JDN-wrAnchor))} روز تا کنکور`, R, pad+198);

  cx.fillStyle='rgba(34,211,238,.85)';
  cx.font='700 22px Vazirmatn, Tahoma, sans-serif';
  cx.fillText(pLabel, R, pad+248);

  const drawTriplet=(c,w,b,cxPos,y,size)=>{
    cx.textBaseline='middle';cx.textAlign='center';cx.font='700 '+size+'px Vazirmatn, Tahoma, sans-serif';
    const dT='د'+fa(c),ghT='غ'+fa(w),nT='ن'+fa(b);
    const dW=cx.measureText(dT).width,ghW=cx.measureText(ghT).width,nW=cx.measureText(nT).width;
    const gap=Math.round(size*0.55);
    const total=dW+ghW+nW+gap*2;
    let xL=cxPos-total/2;
    cx.fillStyle='#cbd3e8';cx.fillText(nT,xL+nW/2,y);xL+=nW+gap;
    cx.fillStyle='#fda4af';cx.fillText(ghT,xL+ghW/2,y);xL+=ghW+gap;
    cx.fillStyle='#6ee7b7';cx.fillText(dT,xL+dW/2,y);
  };
  const drawCell=(x,y,w,h,text,opts)=>{opts=opts||{};if(opts.bg){cx.fillStyle=opts.bg;cx.fillRect(x,y,w,h);}cx.strokeStyle='rgba(255,255,255,.07)';cx.lineWidth=1;cx.strokeRect(x+.5,y+.5,w-1,h-1);if(text){cx.fillStyle=opts.color||'#e8ecf7';cx.font=(opts.bold?'800 ':'500 ')+(opts.fontSize||20)+'px Vazirmatn, Tahoma, sans-serif';cx.textAlign=opts.align||'right';cx.textBaseline='middle';const tx=opts.align==='center'?x+w/2:opts.align==='left'?x+12:x+w-12;cx.fillText(text,tx,y+h/2);}};

  const tblLeft=pad;const totalLeft=tblLeft;const day1Left=totalLeft+totalColW;const subjLeft=day1Left+dayColW*7;
  let tblY=titleH;

  drawCell(totalLeft,tblY,totalColW,headH,'مجموع هفته',{bg:'rgba(34,211,238,.12)',color:'#4de2f5',bold:true,align:'center',fontSize:20});
  data.dayInfo.forEach((d,i)=>{
    const x=day1Left+(6-i)*dayColW;
    drawCell(x,tblY,dayColW,headH,'',{bg:'rgba(255,255,255,.05)'});
    cx.textAlign='center';cx.textBaseline='middle';
    cx.fillStyle='#cfd6ea';cx.font='700 20px Vazirmatn, Tahoma, sans-serif';
    cx.fillText(d.dayName,x+dayColW/2,tblY+28);
    cx.fillStyle='rgba(255,255,255,.5)';cx.font='500 16px Vazirmatn, Tahoma, sans-serif';
    cx.fillText(`${fa(d.dateNum)} ${d.month}`,x+dayColW/2,tblY+56);
  });
  drawCell(subjLeft,tblY,subjColW,headH,'درس',{bg:'rgba(255,255,255,.05)',color:'#cfd6ea',bold:true,align:'right',fontSize:20});
  tblY+=headH;

  displaySubjects.forEach((s, sIdx)=>{
    const rowH = rowHeights[sIdx];
    drawCell(subjLeft,tblY,subjColW,rowH,'',{bg:'rgba(255,255,255,.03)'});
    cx.fillStyle=s.color;cx.beginPath();cx.arc(subjLeft+subjColW-24,tblY+rowH/2,8,0,Math.PI*2);cx.fill();
    cx.fillStyle='#fff';cx.textAlign='right';cx.textBaseline='middle';cx.font='700 18px Vazirmatn, Tahoma, sans-serif';
    cx.fillText(s.name,subjLeft+subjColW-46,tblY+rowH/2,subjColW-66);
    s.days.forEach((d,i)=>{
      const x=day1Left+(6-i)*dayColW;
      drawCell(x,tblY,dayColW,rowH,'',{bg:'rgba(255,255,255,.02)'});
      if(!d.topics.length&&!d.time&&!d.t){cx.textAlign='center';cx.fillStyle='#4b5470';cx.font='500 24px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',x+dayColW/2,tblY+rowH/2);return;}
      let ty=tblY+26;
      if(d.topics.length){
        cx.textAlign='center';cx.fillStyle='#cbd3e8';cx.font=topicFont;
        const topicsToShow = d.topics.slice(0, maxTopicsPerCell);
        topicsToShow.forEach(t=>{
          const lines = wrapText(cx, t, dayColW - 24, maxLinesPerTopic);
          lines.forEach(line => { cx.fillText(line, x + dayColW/2, ty); ty += topicLineH; });
        });
      }
      if(d.time>0){cx.textAlign='center';cx.fillStyle='#4de2f5';cx.font='700 16px Vazirmatn, Tahoma, sans-serif';cx.fillText('⏱ '+hmString(d.time),x+dayColW/2,ty);ty+=22;}
      if(d.t>0)drawTriplet(d.c,d.w,d.b,x+dayColW/2,ty,14);
    });
    drawCell(totalLeft,tblY,totalColW,rowH,'',{bg:'rgba(124,92,255,.08)'});
    cx.textAlign='center';cx.textBaseline='middle';const cy=tblY+rowH/2;
    const lines=[];
    if(s.total.time>0)lines.push({t:'⏱ '+hmString(s.total.time),c:'#4de2f5',f:'700 18px'});
    if(s.total.t>0)lines.push({t:'📝 '+fa(s.total.t)+' تست',c:'#7dd3fc',f:'700 16px'});
    if(!lines.length){cx.fillStyle='#4b5470';cx.font='500 22px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',totalLeft+totalColW/2,cy);}
    else lines.forEach((ln,idx)=>{const y=cy+(idx-(lines.length-1)/2)*26;cx.fillStyle=ln.c;cx.font=ln.f+' Vazirmatn, Tahoma, sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(ln.t,totalLeft+totalColW/2,y);});
    tblY+=rowH;
  });

  drawCell(subjLeft,tblY,subjColW,otherRowH,'',{bg:'rgba(148,163,184,.08)'});
  cx.fillStyle=OTHER_COLOR;cx.beginPath();cx.arc(subjLeft+subjColW-24,tblY+otherRowH/2,8,0,Math.PI*2);cx.fill();
  cx.fillStyle='#cbd3e8';cx.textAlign='right';cx.textBaseline='middle';cx.font='700 18px Vazirmatn, Tahoma, sans-serif';
  cx.fillText(OTHER_SUBJECT,subjLeft+subjColW-46,tblY+otherRowH/2,subjColW-66);
  data.otherData.forEach((d,i)=>{
    const x=day1Left+(6-i)*dayColW;
    drawCell(x,tblY,dayColW,otherRowH,'',{bg:'rgba(148,163,184,.04)'});
    if(!d.topics.length&&!d.time){cx.textAlign='center';cx.fillStyle='#4b5470';cx.font='500 22px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',x+dayColW/2,tblY+otherRowH/2);return;}
    let ty=tblY+22;
    if(d.topics.length){
      cx.textAlign='center';cx.fillStyle='#cbd3e8';cx.font='500 14px Vazirmatn, Tahoma, sans-serif';
      d.topics.slice(0,2).forEach(t=>{
        const lines = wrapText(cx, t, dayColW - 24, 2);
        lines.forEach(line => { cx.fillText(line,x+dayColW/2,ty); ty+=20; });
      });
    }
    if(d.time>0){cx.textAlign='center';cx.fillStyle='#cbd3e8';cx.font='700 15px Vazirmatn, Tahoma, sans-serif';cx.fillText('⏱ '+hmString(d.time),x+dayColW/2,ty);}
  });
  drawCell(totalLeft,tblY,totalColW,otherRowH,'',{bg:'rgba(148,163,184,.10)'});
  cx.textAlign='center';cx.textBaseline='middle';
  if(data.otherTotalTime>0){cx.fillStyle='#cbd3e8';cx.font='700 17px Vazirmatn, Tahoma, sans-serif';cx.fillText('⏱ '+hmString(data.otherTotalTime),totalLeft+totalColW/2,tblY+otherRowH/2);}
  else{cx.fillStyle='#4b5470';cx.font='500 22px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',totalLeft+totalColW/2,tblY+otherRowH/2);}
  tblY+=otherRowH;

  drawCell(subjLeft,tblY,subjColW,totalsRowH,'',{bg:'rgba(124,92,255,.16)'});
  cx.fillStyle='#fff';cx.textAlign='right';cx.textBaseline='middle';cx.font='800 21px Vazirmatn, Tahoma, sans-serif';
  cx.fillText('مجموع روز',subjLeft+subjColW-24,tblY+totalsRowH/2);
  data.dailyTotals.forEach((d,i)=>{
    const x=day1Left+(6-i)*dayColW;
    drawCell(x,tblY,dayColW,totalsRowH,'',{bg:'rgba(124,92,255,.06)'});
    if(!d.time&&!d.t){cx.textAlign='center';cx.fillStyle='#4b5470';cx.font='500 22px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',x+dayColW/2,tblY+totalsRowH/2);return;}
    let ty=tblY+28;
    if(d.time>0){cx.textAlign='center';cx.fillStyle='#4de2f5';cx.font='700 17px Vazirmatn, Tahoma, sans-serif';cx.fillText('⏱ '+hmString(d.time),x+dayColW/2,ty);ty+=26;}
    if(d.t>0)drawTriplet(d.c,d.w,d.b,x+dayColW/2,ty,15);
  });
  drawCell(totalLeft,tblY,totalColW,totalsRowH,'',{bg:'rgba(124,92,255,.16)'});
  cx.textAlign='center';cx.textBaseline='middle';
  const gcy=tblY+totalsRowH/2;
  const glines=[];
  if(data.grand.time>0)glines.push({t:'⏱ '+hmString(data.grand.time),c:'#4de2f5',f:'800 20px'});
  if(data.grand.t>0)glines.push({t:'📝 '+fa(data.grand.t)+' تست',c:'#7dd3fc',f:'700 17px'});
  if(!glines.length){cx.fillStyle='#4b5470';cx.font='500 22px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',totalLeft+totalColW/2,gcy);}
  else glines.forEach((ln,idx)=>{const y=gcy+(idx-(glines.length-1)/2)*28;cx.fillStyle=ln.c;cx.font=ln.f+' Vazirmatn, Tahoma, sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(ln.t,totalLeft+totalColW/2,y);});
  tblY+=totalsRowH;

  drawCell(subjLeft,tblY,subjColW,sleepRowH,'',{bg:'rgba(99,102,241,.16)'});
  cx.fillStyle='#a5b4fc';cx.textAlign='right';cx.textBaseline='middle';cx.font='700 20px Vazirmatn, Tahoma, sans-serif';
  cx.fillText('😴 خواب',subjLeft+subjColW-24,tblY+sleepRowH/2);
  data.dailySleep.forEach((d,i)=>{
    const x=day1Left+(6-i)*dayColW;
    drawCell(x,tblY,dayColW,sleepRowH,'',{bg:'rgba(99,102,241,.06)'});
    if(!d.sleeps.length){cx.textAlign='center';cx.fillStyle='#4b5470';cx.font='500 20px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',x+dayColW/2,tblY+sleepRowH/2);return;}
    let ty=tblY+20;
    d.sleeps.forEach(s=>{
      cx.textAlign='center';cx.fillStyle='#a5b4fc';cx.font='700 14px Vazirmatn, Tahoma, sans-serif';
      cx.fillText(`😴 ${minToStr(s.startMin)} تا ${minToStr(s.endMin)}`,x+dayColW/2,ty);
      ty+=20;
    });
  });
  drawCell(totalLeft,tblY,totalColW,sleepRowH,'',{bg:'rgba(99,102,241,.16)'});
  cx.textAlign='center';cx.textBaseline='middle';
  if(data.sleepWeekly>0){cx.fillStyle='#a5b4fc';cx.font='800 20px Vazirmatn, Tahoma, sans-serif';cx.fillText('😴 '+hmString(data.sleepWeekly),totalLeft+totalColW/2,tblY+sleepRowH/2);}
  else{cx.fillStyle='#4b5470';cx.font='500 22px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',totalLeft+totalColW/2,tblY+sleepRowH/2);}
  tblY+=sleepRowH;

  drawCell(subjLeft,tblY,subjColW,phoneRowH,'',{bg:'rgba(239,68,68,.16)'});
  cx.fillStyle='#fca5a5';cx.textAlign='right';cx.textBaseline='middle';cx.font='700 20px Vazirmatn, Tahoma, sans-serif';
  cx.fillText('📱 گوشی',subjLeft+subjColW-24,tblY+phoneRowH/2);
  data.dailyPhone.forEach((d,i)=>{
    const x=day1Left+(6-i)*dayColW;
    drawCell(x,tblY,dayColW,phoneRowH,'',{bg:'rgba(239,68,68,.06)'});
    if(!d.total){cx.textAlign='center';cx.fillStyle='#4b5470';cx.font='500 20px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',x+dayColW/2,tblY+phoneRowH/2);return;}
    cx.textAlign='center';cx.fillStyle='#fca5a5';cx.font='700 15px Vazirmatn, Tahoma, sans-serif';
    cx.fillText('📱 '+hmString(d.total),x+dayColW/2,tblY+phoneRowH/2);
  });
  drawCell(totalLeft,tblY,totalColW,phoneRowH,'',{bg:'rgba(239,68,68,.16)'});
  cx.textAlign='center';cx.textBaseline='middle';
  if(data.phoneWeekly>0){cx.fillStyle='#fca5a5';cx.font='800 20px Vazirmatn, Tahoma, sans-serif';cx.fillText('📱 '+hmString(data.phoneWeekly),totalLeft+totalColW/2,tblY+phoneRowH/2);}
  else{cx.fillStyle='#4b5470';cx.font='500 22px Vazirmatn, Tahoma, sans-serif';cx.fillText('—',totalLeft+totalColW/2,tblY+phoneRowH/2);}
  tblY+=phoneRowH;

  cx.textAlign='center';cx.textBaseline='middle';
  cx.fillStyle='rgba(255,255,255,.32)';
  cx.font='600 20px Vazirmatn, Tahoma, sans-serif';
  cx.fillText('Made by MH.Mahdipanah', W/2, H-40);

  return cv;
}

async function downloadWeeklyImage(){
  if(typeof generateWeeklyReportCanvas!=='function') return;
  const cv=await generateWeeklyReportCanvas();
  cv.toBlob((blob)=>{if(!blob){toast('??? ?? ????? ?????');return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;const j=d2j(wrAnchor);a.download=`weekly-report-${j.jy}-${pad2(j.jm)}-${pad2(j.jd)}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('????? ?????? ?? ?');},'image/png');
}
