'use strict';

/* ============================================================
   ACTIVITY — ثبت فعالیت + تب‌های خوندم / میخوام بخونم
   نسخه ۰.۹.۱۰ — default timer + days descending + header toggle
   ============================================================ */

let actSubject=state.subjects[0]?state.subjects[0].name:'';
let actQuickMin=60;
let actSelectedJDN=TODAY_JDN;
let activityMode='timer'; // ???????: ?? ??? ?????

/* ============ ACTIVITY TABS ============ */
function applyActivityTab(){
  const logPane=document.getElementById('activityLogPane');
  const timerPane=document.getElementById('activityTimerPane');
  const weeklyPane=document.getElementById('activityWeeklyPane');
  if(!logPane||!timerPane)return;
  logPane.classList.toggle('hidden',activityMode!=='log');
  timerPane.classList.toggle('hidden',activityMode!=='timer');
  if(weeklyPane) weeklyPane.classList.toggle('hidden',activityMode!=='weekly');
  document.querySelectorAll('#activityModeSeg .seg-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.amode===activityMode);
  });
  if(activityMode==='timer'){
    try{ if(typeof renderTracker==='function') renderTracker(); }catch(e){console.warn('[activity] renderTracker failed:', e);}
    try{ if(typeof updateTimerDisplay==='function') updateTimerDisplay(); }catch(e){console.warn('[activity] updateTimerDisplay failed:', e);}
  }else if(activityMode==='weekly'){
    try{ if(typeof renderWeeklyReport==='function') renderWeeklyReport(); }catch(e){console.warn('[activity] renderWeeklyReport failed:', e);}
  }
}
function setActivityMode(mode){
  if(mode!=='log'&&mode!=='timer'&&mode!=='weekly')return;
  activityMode=mode;
  applyActivityTab();
}
const _activityModeSeg = document.getElementById('activityModeSeg');
if(_activityModeSeg){
  _activityModeSeg.addEventListener('click', (e)=>{
    const btn = e.target.closest('.seg-btn[data-amode]');
    if(!btn) return;
    setActivityMode(btn.dataset.amode);
  });
}

/* ============ SUBJECT CHIPS ============ */
function updateActTestsVisibility(){
  const toggle=document.getElementById('actTestsToggle');const card=document.getElementById('actTestsToggleCard');const fields=document.getElementById('actTestFields');if(!toggle||!card||!fields)return;
  const can=subjectCanHaveTests(actSubject);
  if(!can){toggle.checked=false;card.classList.remove('on');fields.classList.add('hidden');}
}
function renderActivityHeader(){
  const j=d2j(actSelectedJDN);const dow=DOW[dowIndex(actSelectedJDN)];
  const titleEl=document.getElementById('actDateTitle');if(titleEl)titleEl.textContent=`${dow} ${fa(j.jd)} ${MONTHS[j.jm-1]}`;
  const nextBtn=document.getElementById('actNextDay');if(nextBtn)nextBtn.disabled=actSelectedJDN>=TODAY_JDN;
}

/* ============ INIT FORM ============ */
function initActivityForm(){
  renderActSubjects();
  let startTp=getTimePair('actStart');
  let endTp=getTimePair('actEnd');
  if(!startTp){
    startTp=mountTimePair('actStart',document.getElementById('actStartTime'),{
      onChange:()=>updateActDuration()
    });
    const now=new Date();let nowM=now.getHours()*60+now.getMinutes();
    nowM=Math.max(START_MIN,Math.min(END_MIN-60,Math.floor(nowM/SNAP)*SNAP));
    startTp.set(nowM);
  }
  if(!endTp){
    endTp=mountTimePair('actEnd',document.getElementById('actEndTime'),{
      onChange:()=>updateActDuration()
    });
    const s=startTp.get();const base=s!=null?s:16*60;
    endTp.set(Math.min(END_MIN,base+actQuickMin));
  }
  document.querySelectorAll('#actQuickChips .quick-chip').forEach(chip=>{
    chip.onclick=()=>{
      document.querySelectorAll('#actQuickChips .quick-chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      actQuickMin=+chip.dataset.min;
      const s=getTimePairValue('actStart');
      if(s!=null)setTimePairValue('actEnd',Math.min(END_MIN,s+actQuickMin));
      updateActDuration();
    };
  });
  renderActivityHeader();updateActDuration();updateActTestsVisibility();
  applyActivityTab();
}
document.getElementById('actPrevDay').onclick=()=>{actSelectedJDN--;renderActivityHeader();};
document.getElementById('actNextDay').onclick=()=>{if(actSelectedJDN>=TODAY_JDN)return;actSelectedJDN++;renderActivityHeader();};
document.getElementById('actTodayBtn').onclick=()=>{actSelectedJDN=TODAY_JDN;renderActivityHeader();};
function renderActSubjects(){
  const box=document.getElementById('actSubjects');const list=allSubjectsForSelect();
  if(!list.find(s=>s.name===actSubject))actSubject=list[0].name;
  box.innerHTML=list.map(s=>`<div class="chip chip-subj ${s.name===actSubject?'active':''}" data-subj="${esc(s.name)}" style="--c:${s.color};border-color:${s.color}55;background:${s.color}1a">${esc(s.name)}</div>`).join('');
  updateActTestsVisibility();
}
document.getElementById('actSubjects').addEventListener('click',(e)=>{const c=e.target.closest('.chip[data-subj]');if(!c)return;actSubject=c.dataset.subj;renderActSubjects();});
document.getElementById('actTestsToggle').addEventListener('change',(e)=>{document.getElementById('actTestsToggleCard').classList.toggle('on',e.target.checked);document.getElementById('actTestFields').classList.toggle('hidden',!e.target.checked);updateActPercent();});
['actCorrect','actWrong','actBlank'].forEach(id=>{document.getElementById(id).addEventListener('input',updateActPercent);});

function updateActPercent(){
  const c=+document.getElementById('actCorrect').value||0,w=+document.getElementById('actWrong').value||0,b=+document.getElementById('actBlank').value||0;
  const t=c+w+b;const p=t?Math.max(0,Math.round((3*c-w)/(3*t)*100)):0;
  document.getElementById('actPercentLive').textContent=fa(p)+'٪';
}
function updateActDuration(){
  const s=getTimePairValue('actStart');
  const e=getTimePairValue('actEnd');
  const d=document.getElementById('actDuration');
  if(s==null||e==null){d.textContent='مدت: —';d.style.color='';return;}
  if(e>s){d.textContent='مدت: '+hmString(e-s);d.style.color='#22d3ee';}
  else if(e===s){d.textContent='شروع و پایان برابر';d.style.color='#f43f5e';}
  else{d.textContent='پایان باید بعد از شروع باشد';d.style.color='#f43f5e';}
}

/* ============ SAVE ACTIVITY ============ */
document.getElementById('actSave').onclick=()=>{
  if(!actSubject){toast('اول یک درس اضافه کن');return;}
  const dateKey=jKey(d2j(actSelectedJDN));
  const sMin=getTimePairValue('actStart');
  const eMin=getTimePairValue('actEnd');
  if(sMin==null||eMin==null){toast('ساعت‌ها را درست وارد کن');return;}
  if(eMin<=sMin){toast('پایان باید بعد از شروع باشد');return;}
  const topic=document.getElementById('actTopic').value.trim();
  const hasTests=document.getElementById('actTestsToggle').checked&&subjectCanHaveTests(actSubject);
  const tests=hasTests?{correct:+document.getElementById('actCorrect').value||0,wrong:+document.getElementById('actWrong').value||0,blank:+document.getElementById('actBlank').value||0}:null;
  state.activities.push({id:uid(),date:dateKey,subject:actSubject,topic,startMin:sMin,endMin:eMin,minutes:eMin-sMin,tests,ts:Date.now()});
  save();
  document.getElementById('actTopic').value='';
  document.getElementById('actCorrect').value='';document.getElementById('actWrong').value='';document.getElementById('actBlank').value='';
  document.getElementById('actPercentLive').textContent='۰٪';
  document.getElementById('actTestsToggle').checked=false;
  document.getElementById('actTestsToggleCard').classList.remove('on');
  document.getElementById('actTestFields').classList.add('hidden');
  renderActivityList();renderDashboard();renderPlanCalendar();
  if(typeof renderWeeklyReport==='function') renderWeeklyReport();
  toast('ثبت شد ✓');
};

/* ============ ACTIVITY LIST ============ */
/* ترتیب: روزها نزولی (جدیدترین بالا) • فعالیت‌های داخل هر روز صعودی */
let activityExpanded=false;

function ensureActivityRecentHeader(){
  const card=document.querySelector('.activity-recent-card');
  if(!card) return null;
  let header=card.querySelector('.activity-recent-header');
  if(header) return header;
  const title=card.querySelector('.card-title');
  if(!title) return null;
  header=document.createElement('div');
  header.className='activity-recent-header';
  card.insertBefore(header,title);
  header.appendChild(title);
  title.style.margin='0';
  return header;
}
function ensureActivityToggleBtn(){
  let btn=document.getElementById('actToggleMore');
  if(btn) return btn;
  const header=ensureActivityRecentHeader();
  if(!header) return null;
  btn=document.createElement('button');
  btn.id='actToggleMore';
  btn.className='act-toggle act-toggle--sm';
  btn.type='button';
  btn.style.display='none';
  header.appendChild(btn);
  return btn;
}
function updateActivityToggleButton(dayCount){
  const btn=ensureActivityToggleBtn();
  if(!btn) return;
  if(dayCount<=1){
    btn.style.display='none';
    return;
  }
  btn.style.display='';
  if(activityExpanded){
    btn.textContent='▲ بستن';
    btn.title='فقط جدیدترین روز';
  }else{
    btn.textContent=`▼ همه (${fa(dayCount)})`;
    btn.title='نمایش همه روزها';
  }
  btn.onclick=()=>{ activityExpanded=!activityExpanded; renderActivityList(); };
}

function renderActivityList(){
  // ⭐ Sort: date descending (newest first) + startMin ascending
  const all=state.activities.slice().sort((a,b)=>{
    if(a.date!==b.date) return a.date>b.date?-1:1;
    return (a.startMin||0)-(b.startMin||0);
  });
  const now=new Date();
  const currentJdn=g2d(now.getFullYear(),now.getMonth()+1,now.getDate());
  const box=document.getElementById('actList');
  if(!box)return;
  if(!all.length){
    box.innerHTML='<div class="muted text-center act-empty-note">هنوز فعالیتی ثبت نشده.</div>';
    updateActivityToggleButton(0);
    return;
  }
  const groups={};const order=[];
  all.forEach(a=>{
    if(!groups[a.date]){groups[a.date]=[];order.push(a.date);}
    groups[a.date].push(a);
  });
  updateActivityToggleButton(order.length);
  // ⭐ Closed = only newest day (order[0])
  const groupsToShow=activityExpanded?order:order.slice(0,1);

  let html='';
  groupsToShow.forEach(k=>{
    const jdn=jdnFromKey(k);const j=parseKey(k);const diff=currentJdn-jdn;let dayTag='';
    if(diff===0)dayTag='امروز';
    else if(diff===1)dayTag='دیروز';
    else if(diff===2)dayTag='پریروز';
    else if(diff>0)dayTag=fa(diff)+' روز پیش';
    const dateLabel=`${DOW[dowIndex(jdn)]} ${fa(j.jd)} ${MONTHS[j.jm-1]}`;
    const actsInDay=groups[k];const totalDayMin=sumMinutes(actsInDay);
    html+=`<div class="agenda-group"><div class="agenda-group-head"><span>${dateLabel}</span>${dayTag?`<span class="agh-date">• ${dayTag}</span>`:''}<span class="agh-line"></span><span class="agh-date">${fa(actsInDay.length)} فعالیت • ${hmTotalStr(totalDayMin)}</span></div><ul class="act-agenda-list">`;
    // ⭐ Virtualization (BUG #8): render only first 50 items per day, with "show more" chip
    const acts=actsInDay.slice(0,50);
    acts.forEach(a=>{
      const c=subjColor(a.subject);
      const isOther=a.subject===OTHER_SUBJECT;
      const hasTopic=a.topic&&a.topic.trim();
      const displayName=isOther&&hasTopic?a.topic.trim():a.subject;
      const showTopicLine=!isOther||!hasTopic;
      let timeStr='';
      if(a.startMin!=null&&a.endMin!=null)timeStr=`${minToStr(a.startMin)} — ${minToStr(a.endMin)}`;
      let sub=timeStr?timeStr+' • ':'';sub+=fa(a.minutes)+' دقیقه';
      if(a.tests){
        const t=a.tests.correct+a.tests.wrong+a.tests.blank;
        const p=t?Math.max(0,Math.round((3*a.tests.correct-a.tests.wrong)/(3*t)*100)):0;
        sub+=` • ${fa(t)} تست • ${fa(p)}٪`;
      }
      const topicLineHtml=showTopicLine
        ? (hasTopic?`<div class="act-agenda-topic">${esc(a.topic)}</div>`:`<div class="act-agenda-topic no-topic">بدون مبحث</div>`)
        : (isOther?`<div class="act-agenda-topic other-note">📌 سایر فعالیت</div>`:'');
      html+=`<li class="act-agenda-item"><span class="act-agenda-dot" style="--c:${c}"></span><div class="act-agenda-card"><div class="act-agenda-top"><div class="min-w-0 flex-1"><div class="act-agenda-title">${esc(displayName)}</div>${topicLineHtml}</div><div class="act-agenda-actions"><button class="li-edit" data-edit="${a.id}">✎</button><button class="li-del" data-del="${a.id}">×</button></div></div><div class="act-agenda-sub">${sub}</div></div></li>`;
    });
    if(actsInDay.length>50){
      html+=`<div class="act-more-chip" data-more-day="${k}">×${actsInDay.length-50} فعالیت دیگر + نمایش بیشتر</div>`;
    }
    html+='</ul></div>';
  });
  box.innerHTML=html;
}
document.getElementById('actList').addEventListener('click',(e)=>{
  const ed=e.target.closest('[data-edit]');if(ed){const a=state.activities.find(x=>x.id===ed.dataset.edit);if(a)openEditActivityModal(a,()=>{renderActivityList();renderDashboard();renderPlanCalendar();if(typeof renderWeeklyReport==='function') renderWeeklyReport();});return;}
  const del=e.target.closest('[data-del]');if(del){state.activities=state.activities.filter(a=>a.id!==del.dataset.del);save();renderActivityList();renderDashboard();renderPlanCalendar();if(typeof renderWeeklyReport==='function') renderWeeklyReport();toast('حذف شد');}
});

/* ============ EDIT ACTIVITY ============ */
function openEditActivityModal(a,onDone,draft){
  const dateKey=draft?.date||a.date;
  const subject=draft?.subject||a.subject;
  const list=allSubjectsForSelect();const subjOpts=subjectSelectOptions(list,subject,true);
  const canTests=subjectCanHaveTests(subject);
  const testsEnabled=draft?draft.testsEnabled:!!a.tests;
  const startValue=draft?draft.startMin:a.startMin;
  const endValue=draft?draft.endMin:a.endMin;
  const topic=draft?draft.topic:(a.topic||'');
  const testCounts=draft?draft.testCounts:(a.tests||{});
  openModal(`
    <div class="modal-head">
      <div class="card-title">ویرایش فعالیت</div>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <label class="lbl mt-0">تاریخ</label>
    <button class="input text-right cursor-pointer" id="eaDatePicker" type="button">${esc(keyLabel(dateKey))}　📅</button>
    <label class="lbl">درس</label>
    <select class="input" id="eaSubject">${subjOpts}</select>
    <label class="lbl">مبحث</label>
    <input class="input" id="eaTopic" value="${esc(topic)}">
    <div class="grid2 mt-12">
      <div><label class="lbl">شروع</label><div class="time-pair" id="eaStartWrap"></div></div>
      <div><label class="lbl">پایان</label><div class="time-pair" id="eaEndWrap"></div></div>
    </div>
    <div class="toggle-card ${testsEnabled&&canTests?'on':''} mt-16 ${canTests?'':'hidden'}" id="eaTestsCard">
      <div><div class="fw-700 fs-13">تست زدم</div></div>
      <label class="switch"><input type="checkbox" id="eaTestsToggle" ${testsEnabled&&canTests?'checked':''}><span></span></label>
    </div>
    <div id="eaTestFields" class="mt-12 ${testsEnabled&&canTests?'':'hidden'}">
      <div class="grid3">
        <input class="input" id="eaCorrect" type="number" value="${testCounts.correct??''}" placeholder="درست">
        <input class="input" id="eaWrong" type="number" value="${testCounts.wrong??''}" placeholder="غلط">
        <input class="input" id="eaBlank" type="number" value="${testCounts.blank??''}" placeholder="نزده">
      </div>
    </div>
    <div class="row mt-16">
      <button class="btn danger" id="eaDel">حذف</button>
      <button class="btn primary" id="eaSave">ذخیره</button>
    </div>
    <button class="btn session-convert mt-8" id="eaConvertToSession">🔄 تبدیل به تایم‌بلاک</button>
  `);
  const startTp=mountTimePair('eaStart',document.getElementById('eaStartWrap'),{value:startValue!=null?startValue:null});
  const endTp=mountTimePair('eaEnd',document.getElementById('eaEndWrap'),{value:endValue!=null?endValue:null});
  const tgl=document.getElementById('eaTestsToggle');
  document.getElementById('eaDatePicker').onclick=()=>{
    const savedDraft={
      date:dateKey,
      subject:document.getElementById('eaSubject').value,
      topic:document.getElementById('eaTopic').value,
      startMin:startTp.get(),
      endMin:endTp.get(),
      testsEnabled:tgl.checked,
      testCounts:{
        correct:document.getElementById('eaCorrect').value,
        wrong:document.getElementById('eaWrong').value,
        blank:document.getElementById('eaBlank').value
      }
    };
    openJalaliDatePicker({
      title:'تاریخ فعالیت',
      initialKey:dateKey,
      onPick:key=>openEditActivityModal(a,onDone,{...savedDraft,date:key})
    });
  };
  tgl.onchange=()=>{document.getElementById('eaTestsCard').classList.toggle('on',tgl.checked);document.getElementById('eaTestFields').classList.toggle('hidden',!tgl.checked);};
  document.getElementById('eaSubject').onchange=(e)=>{const can=subjectCanHaveTests(e.target.value);const card=document.getElementById('eaTestsCard');card.style.display=can?'':'none';if(!can){tgl.checked=false;card.classList.remove('on');document.getElementById('eaTestFields').classList.add('hidden');}};
  document.getElementById('eaSave').onclick=()=>{
    const s=startTp.get();const e=endTp.get();
    if(s==null||e==null||e<=s){toast('ساعت‌ها معتبر نیستند');return;}
    a.date=dateKey;
    a.subject=document.getElementById('eaSubject').value;
    a.topic=document.getElementById('eaTopic').value.trim();
    a.startMin=s;a.endMin=e;a.minutes=e-s;
    if(subjectCanHaveTests(a.subject)&&tgl.checked){a.tests={correct:+document.getElementById('eaCorrect').value||0,wrong:+document.getElementById('eaWrong').value||0,blank:+document.getElementById('eaBlank').value||0};}else a.tests=null;
    save();closeModal();if(onDone)onDone();if(typeof renderWeeklyReport==='function') renderWeeklyReport();toast('ذخیره شد');
  };
  document.getElementById('eaDel').onclick=()=>{state.activities=state.activities.filter(x=>x.id!==a.id);save();closeModal();if(onDone)onDone();if(typeof renderWeeklyReport==='function') renderWeeklyReport();toast('حذف شد');};
  const convBtn=document.getElementById('eaConvertToSession');
  if(convBtn)convBtn.onclick=()=>{
    if(!confirm('این فعالیت به تایم‌بلاک تبدیل شود؟'))return;
    if(typeof window.convertActivityToSession==='function'){
      window.convertActivityToSession(a.id);
      closeModal();
      if(onDone)onDone();
      if(typeof renderPlan==='function')renderPlan();
      if(typeof renderActivityList==='function')renderActivityList();
      if(typeof renderDashboard==='function')renderDashboard();
      if(typeof renderWeeklyReport==='function')renderWeeklyReport();
      toast('به تایم‌بلاک تبدیل شد ✓');
    }else{
      toast('تابع تبدیل در دسترس نیست');
    }
  };
}
function openActivityInfo(id){const a=state.activities.find(x=>x.id===id);if(!a)return;openEditActivityModal(a,()=>{renderActivityList();renderDashboard();renderPlanCalendar();if(typeof renderWeeklyReport==='function') renderWeeklyReport();if(document.getElementById('view-plan').classList.contains('active'))renderBlocks();});}

/* ============================================================
   SLEEP
   ============================================================ */
document.getElementById('openSleepBtn').onclick=()=>openSleepModal();
let sleepSelectedJDN=TODAY_JDN;

function sleepDateLabel(key){const j=parseKey(key);return`${fa(j.jd)} ${MONTHS[j.jm-1]} ${fa(j.jy)}`;}
function refreshSleepViews(){save();renderSleepEntryList();renderDashboard();renderPlanCalendar();if(typeof renderWeeklyReport==='function') renderWeeklyReport();if(document.getElementById('view-plan')?.classList.contains('active'))renderBlocks();}

function calcSleepDuration(startMin,endMin){
  if(startMin==null||endMin==null)return null;
  if(endMin>startMin)return{dur:endMin-startMin,overnight:false};
  if(endMin<startMin)return{dur:(1440-startMin)+endMin,overnight:true};
  return{dur:0,overnight:false};
}

function openSleepModal(initialJdn,editId){
  const editing=editId?state.sleeps.find(x=>x.id===editId):null;
  sleepSelectedJDN=initialJdn!=null?initialJdn:TODAY_JDN;
  const isEditing=!!editing;
  let ranges=[];
  let loadedDayIds=new Set();
  const loadDayRanges=()=>{
    if(editing){
      ranges=[{id:editing.id,startMin:editing.startMin,endMin:editing.endMin}];
      loadedDayIds=new Set();
      return;
    }
    const dayKey=jKey(d2j(sleepSelectedJDN));
    const daySleeps=state.sleeps.filter(s=>s.date===dayKey||(s.endDate||s.date)===dayKey).sort((a,b)=>(a.startMin??0)-(b.startMin??0));
    loadedDayIds=new Set(daySleeps.map(s=>s.id));
    ranges=daySleeps.length ? daySleeps.map(s=>({id:s.id,startMin:s.startMin,endMin:s.endMin})) : [{id:uid(),startMin:23*60,endMin:7*60}];
  };
  loadDayRanges();
  openModal(`
    <div class="modal-head">
      <div class="card-title">${editing?'✏️ ویرایش خواب':'🌙 ثبت خواب'}</div>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="day-nav-mini">
      <button class="day-arrow-sm" id="slPrevDay">‹</button>
      <div class="title" id="slDayTitle">—</div>
      <button class="day-arrow-sm" id="slNextDay">›</button>
    </div>
    <div class="muted sleep-hint">
      💡 تاریخ بالا = روزی که بیدار شدی<br>
      اگر خواب از نیمه‌شب رد بشه، خودکار «شبانه» تشخیص داده می‌شه.
    </div>
    <div id="slRanges"></div>
    ${!isEditing?`<button type="button" class="btn indigo mt-6" id="slAddRange">+ افزودن بازه دیگر (مثلاً چرت)</button>`:''}
    <div class="sleep-preview" id="slPreview"></div>
    <div class="row mt-14">
      <button class="btn ghost" data-close>انصراف</button>
      <button class="btn primary" id="slSave">${editing?'ذخیره':'ثبت'}</button>
    </div>
    <div class="card-title mt-22">خواب‌های این روز</div>
    <div class="entry-list" id="slList"></div>
  `);
  const clearSlPairs=()=>{
    for(const key of Array.from(window._timePairs.keys())){
      if(key.startsWith('slStart')||key.startsWith('slEnd'))window._timePairs.delete(key);
    }
  };
  const updateDayLabel=()=>{
    const j=d2j(sleepSelectedJDN);
    document.getElementById('slDayTitle').innerHTML=`${DOW[dowIndex(sleepSelectedJDN)]} ${fa(j.jd)} ${MONTHS[j.jm-1]}`;
    document.getElementById('slNextDay').disabled=sleepSelectedJDN>=TODAY_JDN;
  };
  const updateInfo=()=>{
    ranges.forEach((r,i)=>{
      const infoEl=document.getElementById('slInfo'+i);
      if(!infoEl)return;
      const startTp=getTimePair('slStart'+i);
      const endTp=getTimePair('slEnd'+i);
      const s=startTp?startTp.get():r.startMin;
      const e=endTp?endTp.get():r.endMin;
      r.startMin=s;r.endMin=e;
      if(s==null||e==null){
        infoEl.className='sleep-range-info warn';
        infoEl.innerHTML='⚠️ ساعت شروع و پایان را وارد کن';
        return;
      }
      const calc=calcSleepDuration(s,e);
      if(!calc||calc.dur<=0||calc.dur>14*60){
        infoEl.className='sleep-range-info warn';
        infoEl.innerHTML=`⚠️ مدت نامعتبر (${calc?hmString(calc.dur):'—'})`;
        return;
      }
      infoEl.className='sleep-range-info ok';
      const typeBadge=calc.overnight
        ?`<span class="chip-mini night">🌙 شبانه</span>`
        :`<span class="chip-mini day">☀️ چرت روزانه</span>`;
      infoEl.innerHTML=`${typeBadge} مدت: <b class="text-white">${hmString(calc.dur)}</b>`;
    });
    updateTotalPreview();
  };
  const updateTotalPreview=()=>{
    const preview=document.getElementById('slPreview');
    if(!preview)return;
    let total=0;let count=0;
    ranges.forEach((r,i)=>{
      const startTp=getTimePair('slStart'+i);
      const endTp=getTimePair('slEnd'+i);
      const s=startTp?startTp.get():r.startMin;
      const e=endTp?endTp.get():r.endMin;
      if(s==null||e==null)return;
      const calc=calcSleepDuration(s,e);
      if(!calc||calc.dur<=0||calc.dur>14*60)return;
      total+=calc.dur;count++;
    });
    if(count>0&&total>0){
      preview.className='sleep-preview show';
      preview.innerHTML=`مجموع: <b>${hmString(total)}</b> در ${fa(count)} بازه`;
    }else{
      preview.className='sleep-preview';
    }
  };
  const renderRanges=()=>{
    clearSlPairs();
    const box=document.getElementById('slRanges');
    box.innerHTML=ranges.map((r,i)=>`
      <div class="sleep-range" data-rid="${r.id}" data-idx="${i}">
        <div class="sleep-range-head">
          <span class="sleep-range-title">🌙 بازه ${fa(i+1)}</span>
          ${ranges.length>1?`<button type="button" class="sleep-range-del" data-del-idx="${i}">✕ حذف</button>`:''}
        </div>
        <div class="grid2 gap-6">
          <div>
            <label class="lbl mt-0 fs-10h">شروع</label>
            <div class="time-pair" id="slStartWrap${i}"></div>
          </div>
          <div>
            <label class="lbl mt-0 fs-10h">پایان</label>
            <div class="time-pair" id="slEndWrap${i}"></div>
          </div>
        </div>
        <div class="sleep-range-info" id="slInfo${i}">—</div>
      </div>
    `).join('');
    ranges.forEach((r,i)=>{
      mountTimePair('slStart'+i,document.getElementById('slStartWrap'+i),{
        value:r.startMin,
        onChange:()=>updateInfo()
      });
      mountTimePair('slEnd'+i,document.getElementById('slEndWrap'+i),{
        value:r.endMin,
        onChange:()=>updateInfo()
      });
    });
    box.querySelectorAll('[data-del-idx]').forEach(btn=>{
      btn.onclick=()=>{
        ranges.splice(+btn.dataset.delIdx,1);
        renderRanges();
      };
    });
    updateInfo();
  };
  const reloadForSelectedDay=()=>{
    if(editing) return;
    loadDayRanges();
    renderRanges();
  };
  updateDayLabel();
  renderRanges();
  renderSleepEntryList();
  document.getElementById('slPrevDay').onclick=()=>{sleepSelectedJDN--;updateDayLabel();reloadForSelectedDay();renderSleepEntryList();};
  document.getElementById('slNextDay').onclick=()=>{if(sleepSelectedJDN<TODAY_JDN){sleepSelectedJDN++;updateDayLabel();reloadForSelectedDay();renderSleepEntryList();}};
  const addRangeBtn=document.getElementById('slAddRange');
  if(addRangeBtn)addRangeBtn.onclick=()=>{
    ranges.push({id:uid(),startMin:14*60,endMin:15*60});
    renderRanges();
  };
  document.getElementById('slSave').onclick=()=>{
    const validRanges=[];
    ranges.forEach((r,i)=>{
      const startTp=getTimePair('slStart'+i);
      const endTp=getTimePair('slEnd'+i);
      const s=startTp?startTp.get():r.startMin;
      const e=endTp?endTp.get():r.endMin;
      if(s==null||e==null)return;
      const calc=calcSleepDuration(s,e);
      if(!calc||calc.dur<=0||calc.dur>14*60)return;
      validRanges.push({id:r.id,startMin:s,endMin:e,calc});
    });
    if(!validRanges.length){toast('حداقل یک بازه معتبر وارد کن');return;}
    if(editing){
      state.sleeps=state.sleeps.filter(x=>x.id!==editing.id);
      validRanges.forEach((vr,idx)=>{
        const calc=vr.calc;
        const startKey=calc.overnight?jKey(d2j(sleepSelectedJDN-1)):jKey(d2j(sleepSelectedJDN));
        const endKey=jKey(d2j(sleepSelectedJDN));
        const isNap=!calc.overnight;
        state.sleeps.push({
          id:idx===0?editing.id:uid(),
          date:startKey,
          endDate:endKey,
          startMin:vr.startMin,
          endMin:vr.endMin,
          minutes:calc.dur,
          nap:isNap,
          ts:Date.now()
        });
      });
    }else{
      state.sleeps=state.sleeps.filter(x=>!loadedDayIds.has(x.id));
      validRanges.forEach((vr)=>{
        const calc=vr.calc;
        const startKey=calc.overnight?jKey(d2j(sleepSelectedJDN-1)):jKey(d2j(sleepSelectedJDN));
        const endKey=jKey(d2j(sleepSelectedJDN));
        const isNap=!calc.overnight;
        state.sleeps.push({
          id:loadedDayIds.has(vr.id)?vr.id:uid(),
          date:startKey,
          endDate:endKey,
          startMin:vr.startMin,
          endMin:vr.endMin,
          minutes:calc.dur,
          nap:isNap,
          ts:Date.now()
        });
      });
    }
    refreshSleepViews();
    closeModal();
    toast('ثبت شد ✓');
  };
}

function renderSleepEntryList(){
  const box=document.getElementById('slList');if(!box)return;
  const dayKey=jKey(d2j(sleepSelectedJDN));
  const list=state.sleeps.filter(s=>s.date===dayKey||(s.endDate||s.date)===dayKey).sort((a,b)=>(b.ts||0)-(a.ts||0));
  if(!list.length){box.innerHTML='<div class="muted text-center act-list-empty">خوابی ثبت نشده</div>';return;}
  box.innerHTML=list.map(s=>{
    const ov=s.date!==(s.endDate||s.date);
    const tag=ov?'شبانه':'چرت';
    return`<div class="entry-row"><div class="er-main cursor-pointer" data-edit-sleep="${s.id}"><div class="er-title">🌙 ${sleepDateLabel(s.date)}${ov?' → '+sleepDateLabel(s.endDate):''} <span class="sleep-tag">${tag}</span></div><div class="er-sub">${minToStr(s.startMin)} تا ${minToStr(s.endMin)} (${hmString(s.minutes)})</div></div><button class="li-edit" data-edit-sleep="${s.id}">✎</button><button class="er-del" data-sid="${s.id}">×</button></div>`;
  }).join('');
  box.querySelectorAll('[data-edit-sleep]').forEach(el=>el.onclick=()=>openSleepInfo(el.dataset.editSleep));
  box.querySelectorAll('[data-sid]').forEach(b=>b.onclick=()=>{state.sleeps=state.sleeps.filter(x=>x.id!==b.dataset.sid);refreshSleepViews();toast('حذف شد');});
}
function openSleepInfo(id){const s=state.sleeps.find(x=>x.id===id);if(!s)return;openSleepModal(jdnFromKey(s.endDate||s.date),s.id);}

/* ============ PHONE ============ */
document.getElementById('openPhoneBtn').onclick=()=>openPhoneModal();
let phoneSelectedJDN=TODAY_JDN;
function openPhoneModal(initialJdn){
  phoneSelectedJDN=initialJdn!=null?initialJdn:TODAY_JDN;
  openModal(`<div class="modal-head"><div class="card-title">📱 ثبت کار با گوشی</div><button class="icon-btn" data-close>✕</button></div><div class="day-nav-mini"><button class="day-arrow-sm" id="phPrevDay">‹</button><div class="title" id="phDayTitle">—</div><button class="day-arrow-sm" id="phNextDay">›</button></div><label class="lbl mt-0">مدت استفاده</label><div class="time-pair" id="phTimeWrap"></div><button class="btn primary phone-save mt-16" id="phSave">ثبت</button><div class="card-title mt-22">رکوردهای این روز</div><div class="entry-list" id="phList"></div>`);
  const phTp=mountTimePair('phTime',document.getElementById('phTimeWrap'),{});
  const updateDay=()=>{const j=d2j(phoneSelectedJDN);const dow=DOW[dowIndex(phoneSelectedJDN)];document.getElementById('phDayTitle').innerHTML=`${dow} ${fa(j.jd)} ${MONTHS[j.jm-1]}`;document.getElementById('phNextDay').disabled=phoneSelectedJDN>=TODAY_JDN;};
  updateDay();
  document.getElementById('phPrevDay').onclick=()=>{phoneSelectedJDN--;updateDay();renderPhoneEntryList();};
  document.getElementById('phNextDay').onclick=()=>{if(phoneSelectedJDN>=TODAY_JDN)return;phoneSelectedJDN++;updateDay();renderPhoneEntryList();};
  renderPhoneEntryList();
  document.getElementById('phSave').onclick=()=>{
    const dateKey=jKey(d2j(phoneSelectedJDN));
    const minutes=phTp.get()||0;
    if(minutes<=0){toast('مقدار معتبر وارد کن');return;}
    state.phones.push({id:uid(),date:dateKey,minutes,ts:Date.now()});
    save();toast('ثبت شد');renderPhoneEntryList();renderDashboard();
    if(typeof renderWeeklyReport==='function') renderWeeklyReport();
    phTp.set(null);
  };
}
function renderPhoneEntryList(){
  const box=document.getElementById('phList');if(!box)return;
  const dayKey=jKey(d2j(phoneSelectedJDN));
  const list=state.phones.filter(p=>p.date===dayKey).sort((a,b)=>(b.ts||0)-(a.ts||0));
  if(!list.length){box.innerHTML='<div class="muted text-center act-list-empty">ثبت نشده</div>';return;}
  box.innerHTML=list.map(p=>`<div class="entry-row"><div class="er-main"><div class="er-title text-red">📱 ${hmString(p.minutes)}</div></div><button class="er-del" data-pid="${p.id}">×</button></div>`).join('');
  box.querySelectorAll('[data-pid]').forEach(b=>b.onclick=()=>{state.phones=state.phones.filter(x=>x.id!==b.dataset.pid);save();renderPhoneEntryList();renderDashboard();if(typeof renderWeeklyReport==='function') renderWeeklyReport();});
}


/* ============================================================
   TEST COUNTER (activity tab)
   ============================================================ */
/* ============================================================
   TRACKER — شمارنده تست (split from 05-class-tools.js)
   ============================================================ */

let trkCounts={correct:0,wrong:0,blank:0};
let trkCoef=1/3;
const TRK_KEY='konkur-trk-v1';

function loadTracker(){
  try{
    const d=JSON.parse(localStorage.getItem(TRK_KEY)||'null');
    if(d){
      trkCounts={correct:Math.max(0,+d.correct||0),wrong:Math.max(0,+d.wrong||0),blank:Math.max(0,+d.blank||0)};
      trkCoef=+d.coef||1/3;
    }
  }catch(e){}
}
function saveTracker(){
  try{localStorage.setItem(TRK_KEY,JSON.stringify({...trkCounts,coef:trkCoef}));}catch(e){}
  try{ if(typeof window._trackerSaveHook==='function') window._trackerSaveHook(); }catch(e){}
}

function renderTracker(){
  document.querySelectorAll('.trk-input[data-input]').forEach(inp=>{
    const k=inp.dataset.input;
    inp.value=trkCounts[k]>0?String(trkCounts[k]):'';
  });
  const coef=document.getElementById('trkCoef');
  if(coef)coef.value=String(trkCoef);
  const total=trkCounts.correct+trkCounts.wrong+trkCounts.blank;
  const totalEl=document.getElementById('trkTotal');
  if(totalEl)totalEl.textContent=fa(total);
  const score=trkCounts.correct-trkCounts.wrong*trkCoef;
  const pct=total>0?(score/total*100):0;
  const pctEl=document.getElementById('trkPct');
  if(pctEl){
    pctEl.textContent=fa(pct.toFixed(1))+'٪';
    pctEl.classList.remove('negative','positive');
    if(total>0){if(pct<0)pctEl.classList.add('negative');else if(pct>0)pctEl.classList.add('positive');}
  }
  if(typeof updateUnifiedSaveState === 'function'){try{ updateUnifiedSaveState(); }catch(e){}}
}
function adjustTrack(field,delta){
  trkCounts[field]=Math.max(0,(trkCounts[field]||0)+delta);
  saveTracker();renderTracker();
}

document.querySelectorAll('.trk-btn').forEach(btn=>{
  const field=btn.closest('.trk-field').dataset.field;
  const delta=+btn.dataset.delta;
  btn.onclick=()=>adjustTrack(field,delta);
});
document.querySelectorAll('.trk-input[data-input]').forEach(inp=>{
  inp.oninput=()=>{
    const k=inp.dataset.input;
    const clean=inp.value.replace(/[^\d]/g,'').slice(0,4);
    if(clean!==inp.value)inp.value=clean;
    trkCounts[k]=clean?parseInt(clean,10):0;
    saveTracker();renderTracker();
  };
});
const _trkCoefEl=document.getElementById('trkCoef');
if(_trkCoefEl)_trkCoefEl.onchange=(e)=>{trkCoef=parseFloat(e.target.value)||0;saveTracker();renderTracker();};

const _trkClearEl=document.getElementById('trkClear');
if(_trkClearEl)_trkClearEl.onclick=()=>{trkCounts={correct:0,wrong:0,blank:0};saveTracker();renderTracker();toast('پاک شد');};

/* Keyboard shortcuts only in timer tab */
document.addEventListener('keydown',(e)=>{
  const activityView=document.getElementById('view-activity');
  const timerPane=document.getElementById('activityTimerPane');
  if(!activityView||!timerPane)return;
  if(!activityView.classList.contains('active'))return;
  if(timerPane.classList.contains('hidden'))return;
  const examOverlay=document.getElementById('examOverlay');
  if(examOverlay&&examOverlay.style.display==='block')return;
  if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;
  const t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'))return;
  if(document.getElementById('modalBackdrop').classList.contains('show'))return;
  const map={KeyQ:['correct',1],KeyA:['correct',-1],KeyW:['wrong',1],KeyS:['wrong',-1],KeyE:['blank',1],KeyD:['blank',-1]};
  const hit=map[e.code];if(!hit)return;
  e.preventDefault();adjustTrack(hit[0],hit[1]);
});