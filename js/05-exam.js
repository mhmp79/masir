'use strict';

/* ============================================================
   EXAM — با تگ reviewSolvable، بخش‌بندی سه‌گانه، کارت‌های قابل ادیت
   نسخه ۱.۱.۰ — collapsible calendar + top seg + analysis mode
   ============================================================ */

let examCalYear=TODAY_J.jy,examCalMonth=TODAY_J.jm;
let examMainTab='results';
let examAnswerMode=false;
let examKeyboardMode=false;
let examCursorIndex=0;
let notesSubject='';
let notesQuestionId='';
let notesShowingCorrectQuestions=false;

/* FEAT-1: a question counts as analyzed when a status and at least one piece
   of analysis content are present. Pure so it can be unit tested directly. */
function isQuestionAnalyzed(question){
  if(!question)return false;
  const status=qStatus(question);
  if(status==='pending')return false;
  const filled=(value)=>!!(value&&String(value).trim());
  const hasList=(value)=>Array.isArray(value)&&value.length>0;
  if(filled(question.note)||filled(question.questionText)||filled(question.answerText))return true;
  if(hasList(question.errorTypes)||hasList(question.specialTags))return true;
  if(question.reviewSolvable!==null&&question.reviewSolvable!==undefined)return true;
  return false;
}

function subjectAnalysisStats(questions){
  const total=questions.length;
  const analyzed=questions.filter(isQuestionAnalyzed).length;
  return{total,analyzed,remaining:total-analyzed,pct:total?Math.round(analyzed/total*100):0};
}

function analysisProgressColor(pct){
  return pct>=80?'#10b981':(pct>=40?'#f59e0b':'#f43f5e');
}

/* ⭐ تب اصلی سکشن آزمون (آزمون‌ها / تحلیل آزمون) */
let examViewMode='exams';

function applyExamViewMode(){
  const listPane=document.getElementById('examListPane');
  const analysisPane=document.getElementById('examAnalysisPane');
  const examLayout=document.getElementById('examLayout');
  if(!listPane||!analysisPane)return;
  const isAnalysis=examViewMode==='analysis';
  
  listPane.classList.toggle('hidden',isAnalysis);
  analysisPane.classList.toggle('hidden',!isAnalysis);
  
  if(examLayout) examLayout.classList.toggle('analysis-mode',isAnalysis);
  const examView=document.getElementById('view-exam');
  if(examView) examView.classList.toggle('analysis-mode',isAnalysis);
  
  document.querySelectorAll('#examModeSeg .seg-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.emode===examViewMode);
  });
  
  if(isAnalysis&&typeof renderGlobalAnalysis==='function'){
    try{ renderGlobalAnalysis(); }catch(e){ console.warn('[exam] renderGlobalAnalysis failed:',e); }
  }
}

/* ⭐ خلاصه‌ی تاریخ بالای تقویم آزمون */
function updateExamCalendarSummary(){
  const el=document.getElementById('examCalendarSummaryDate');
  if(!el)return;
  const monthExams=state.exams.filter(e=>{
    const j=parseKey(e.date);
    return j.jy===examCalYear && j.jm===examCalMonth;
  }).length;
  const totalExams=state.exams.length;
  const parts=[`${MONTHS[examCalMonth-1]} ${fa(examCalYear)}`];
  if(monthExams>0) parts.push(`${fa(monthExams)} آزمون`);
  else if(totalExams>0) parts.push(`کل: ${fa(totalExams)} آزمون`);
  el.textContent=parts.join(' • ');
}

function examNoteInfoClass(question){
  const hasNote=!!(question.note&&question.note.trim());
  const hasTags=(question.errorTypes||[]).length>0||(question.specialTags||[]).length>0||
    Object.values(question.errorDetails||{}).some(tags=>Array.isArray(tags)&&tags.length>0)||
    question.reviewSolvable===true||question.reviewSolvable===false;
  return{hasNote,hasTags};
}

/* FEAT-2: update only the affected question tile and progress row; never
   re-render the whole tab (that would steal focus from the textarea). */
function updateQuestionTile(exam,box,question){
  const tile=[...(box.querySelectorAll?box.querySelectorAll('[data-note-question]'):[])].find(
    button=>button.dataset.noteQuestion===question.id
  );
  if(tile){
    const {hasNote,hasTags}=examNoteInfoClass(question);
    tile.classList.toggle('analysis-complete',isQuestionAnalyzed(question));
    const markers=tile.querySelector('.note-question-markers');
    if(markers)markers.innerHTML=
      `${hasNote?'<i class="note-marker-note" aria-label="نکته ثبت شده">ن</i>':''}`+
      `${hasTags?'<i class="note-marker-tag" aria-label="تگ ثبت شده">ت</i>':''}`;
    tile.title=`سوال ${fa(question.number)}`+
      `${hasNote?' • نکته ثبت شده':''}${hasTags?' • تگ ثبت شده':''}`;
  }
  updateSubjectProgress(exam,box,question.subject);
}

function updateSubjectProgress(exam,box,subject){
  if(!box||!box.querySelectorAll)return;
  const option=[...box.querySelectorAll('[data-notes-subject]')].find(
    button=>button.dataset.notesSubject===subject
  );
  if(!option)return;
  const questions=getSortedQuestions(exam).filter(q=>q.subject===subject);
  const stats=subjectAnalysisStats(questions);
  const color=analysisProgressColor(stats.pct);
  const value=option.querySelector('.nsp-counts');
  if(value)value.textContent=
    `${fa(stats.total)} | ${fa(stats.analyzed)} | ${fa(stats.remaining)}`;
  const label=option.querySelector('.nsp-labels');
  if(label)label.textContent='کل | تحلیل‌شده | باقی';
  const bar=option.querySelector('.nsp-progress-fill');
  if(bar){bar.style.width=stats.pct+'%';bar.style.background=color;}
  const pct=option.querySelector('.nsp-pct');
  if(pct){pct.textContent=fa(stats.pct)+'٪';pct.style.color=color;}
}

function findNoteItem(box,questionId){
  if(!box||!box.querySelectorAll)return null;
  return [...box.querySelectorAll('.note-item[data-qid]')].find(
    item=>item.dataset.qid===questionId
  )||null;
}

function showQuestionSaving(exam,box,question){
  const item=findNoteItem(box,question.id);
  const indicator=item&&item.querySelector('.nc-save-indicator');
  updateQuestionTile(exam,box,question);
  if(!indicator)return;
  clearTimeout(indicator._savedTimer);
  clearTimeout(indicator._fadeTimer);
  indicator.textContent='⏳ saving...';
  indicator.classList.remove('saved');
}

function showQuestionSaved(exam,box,question){
  const item=findNoteItem(box,question.id);
  const indicator=item&&item.querySelector('.nc-save-indicator');
  updateQuestionTile(exam,box,question);
  if(!indicator)return;
  clearTimeout(indicator._savedTimer);
  clearTimeout(indicator._fadeTimer);
  indicator.textContent='✓ saved';
  indicator.classList.add('saved');
  indicator._fadeTimer=setTimeout(()=>{
    indicator.textContent='';
    indicator.classList.remove('saved');
  },1500);
}

function refreshQuestionCard(exam,box,question){
  const item=findNoteItem(box,question.id);
  if(!item)return;
  item.outerHTML=noteQuestionCardHTML(exam,question);
  const refreshed=findNoteItem(box,question.id);
  if(refreshed)bindNoteItemHandlers(exam,box,refreshed);
  updateQuestionTile(exam,box,question);
}

function saveQuestionEdit(exam,question,box,options){
  const opts=options||{};
  question.ts=Date.now();
  if(opts.refresh)refreshQuestionCard(exam,box,question);
  else updateQuestionTile(exam,box,question);
  save();
  if(opts.saved)showQuestionSaved(exam,box,question);
}

function analysisPercent(analyzed,total){
  if(!total||total<=0)return'—';
  return fa(Math.round((analyzed/total)*100))+'٪';
}

function examAnswerCountsBySubject(exam){
  const counts={};
  getSortedQuestions(exam).forEach(question=>{
    const subject=question.subject;
    if(!counts[subject])counts[subject]={total:0,answered:0,correct:0,wrong:0,blank:0};
    const subjectCounts=counts[subject];
    subjectCounts.total++;
    const status=qStatus(question);
    if(status==='pending')return;
    subjectCounts.answered++;
    subjectCounts[status]++;
  });
  return counts;
}

function syncExamResultsFromAnswers(exam){
  if(exam.resultsSource==='manual'||(exam.hasResults&&exam.resultsSource!=='answers'))return;
  const answerCounts=examAnswerCountsBySubject(exam);
  const subjects={};
  Object.entries(answerCounts).forEach(([name,counts])=>{
    if(!counts.answered)return;
    subjects[name]={correct:counts.correct,wrong:counts.wrong,blank:counts.blank,taraz:null};
  });
  exam.subjects=Object.keys(subjects).length?subjects:null;
  exam.hasResults=Object.keys(subjects).length>0;
  exam.includedSubjects=state.subjects.filter(subject=>subject.type==='specialized').map(subject=>subject.name);
  if(exam.hasResults)exam.resultsSource='answers';
  else delete exam.resultsSource;
}

function examAnswerResultMismatches(exam,results){
  const answerCounts=examAnswerCountsBySubject(exam);
  return Object.entries(answerCounts).reduce((mismatches,[name,counts])=>{
    if(!counts.total||counts.answered!==counts.total)return mismatches;
    const result=results&&results[name]||{};
    const resultCounts={correct:+result.correct||0,wrong:+result.wrong||0,blank:+result.blank||0};
    if(resultCounts.correct!==counts.correct||resultCounts.wrong!==counts.wrong||resultCounts.blank!==counts.blank){
      mismatches.push({name,answers:counts,results:resultCounts});
    }
    return mismatches;
  },[]);
}

function examResultMismatchHTML(exam,results=exam.subjects){
  const mismatches=examAnswerResultMismatches(exam,results);
  if(!mismatches.length)return'';
  return`<div class="exam-result-mismatch"><b>⚠️ مغایرت پاسخ و نتیجه آزمون</b>${mismatches.map(({name,answers,results:counts})=>
    `<div><strong>${esc(name)}</strong>: تعداد درست، غلط و نزده در نتیجه با پاسخ‌های ثبت‌شده هم‌خوانی ندارد. (نتیجه: ${fa(counts.correct)} درست، ${fa(counts.wrong)} غلط، ${fa(counts.blank)} نزده؛ پاسخ‌ها: ${fa(answers.correct)} درست، ${fa(answers.wrong)} غلط، ${fa(answers.blank)} نزده)</div>`
  ).join('')}</div>`;
}

function renderExamSection(){
  renderExamCalendar();
  renderExamsList();
  renderExamTagStats();
  applyExamViewMode();
}

function renderExamCalendar(){
  const el=document.getElementById('examCalTitle');
  if(el)el.textContent=`${MONTHS[examCalMonth-1]} ${fa(examCalYear)}`;
  const grid=document.getElementById('examCalGrid');
  if(!grid)return;
  const firstJdn=j2d(examCalYear,examCalMonth,1);
  const startCol=dowIndex(firstJdn);
  const len=jMonthLength(examCalYear,examCalMonth);
  let html='';
  const cell=(k,dayNum,adj)=>{
    const hasExam=examForDay(k).length>0;
    const cls=['cal-cell'];
    if(adj)cls.push('adjacent');
    if(k===TODAY_KEY)cls.push('today');
    if(hasExam)cls.push('exam-day');
    return`<div class="${cls.join(' ')}" data-key="${k}">${fa(dayNum)}${hasExam?'<i class="exam-dot"></i>':''}</div>`;
  };
  for(let i=0;i<startCol;i++){
    const jdn=firstJdn-startCol+i;
    const j=d2j(jdn);
    html+=cell(jKey(j),j.jd,true);
  }
  for(let d=1;d<=len;d++)html+=cell(keyOf(examCalYear,examCalMonth,d),d,false);
  const totalCells=startCol+len;
  const trailing=(7-(totalCells%7))%7;
  for(let i=1;i<=trailing;i++){
    const jdn=firstJdn+len-1+i;
    const j=d2j(jdn);
    html+=cell(jKey(j),j.jd,true);
  }
  grid.innerHTML=html;
  grid.querySelectorAll('.cal-cell[data-key]').forEach(c=>c.onclick=()=>{
    const k=c.dataset.key;
    const exams=examForDay(k);
    if(exams.length)openExamDetail(exams[0].id);
    else openNewExamModal(k);
  });
  updateExamCalendarSummary();
}
document.getElementById('examCalPrev').onclick=()=>{examCalMonth--;if(examCalMonth<1){examCalMonth=12;examCalYear--;}renderExamCalendar();};
document.getElementById('examCalNext').onclick=()=>{examCalMonth++;if(examCalMonth>12){examCalMonth=1;examCalYear++;}renderExamCalendar();};
document.getElementById('examCalToday').onclick=()=>{examCalYear=TODAY_J.jy;examCalMonth=TODAY_J.jm;renderExamCalendar();};

/* ⭐ NEW: روی موبایل بعد از کلیک روی روز، تقویم بسته بشه */
const _examCalGrid=document.getElementById('examCalGrid');
if(_examCalGrid){
  _examCalGrid.addEventListener('click',()=>{
    if(window.innerWidth<1024){
      const details=document.getElementById('examCalendarDetails');
      if(details)details.open=false;
    }
  });
}

/* ⭐ NEW: روی دسکتاپ تقویم اجباراً باز، روی موبایل بسته */
(function initExamCalendarState(){
  const isDesktop=window.innerWidth>=1024;
  const d=document.getElementById('examCalendarDetails');
  if(d)d.open=isDesktop;
})();

function examCardHTML(e){
  const validQs=getSortedQuestions(e);
  const answered=validQs.filter(q=>qStatus(q)!=='pending').length;
  const total=validQs.length;
  const needNotes=examNeedsAttention(e).length;
  const starredCount=validQs.filter(q=>q.starred).length;
  const badges=[];
  if(e.hasResults&&e.totalTaraz)badges.push(`<span class="ec-badge taraz">تراز ${fa(Math.round(e.totalTaraz))}</span>`);
  if(answered>0&&total>0){
    if(answered===total){
      badges.push('<span class="ec-badge answers-complete">پاسخ ثبت شده</span>');
      if(needNotes===0)badges.push('<span class="ec-badge analysis-complete">تحلیل شده</span>');
    }else{
      badges.push(`<span class="ec-badge questions">${fa(answered)}/${fa(total)} • ${fa(Math.round(answered/total*100))}٪ پاسخ ثبت شده</span>`);
    }
  }
  if(starredCount>0)badges.push(`<span class="ec-badge starred">⭐ ${fa(starredCount)}</span>`);
  const jd=parseKey(e.date);
  return`<div class="exam-card" data-id="${e.id}"><div class="exam-card-top"><div class="exam-card-main"><div class="exam-card-name">${esc(e.name)}</div><div class="exam-card-date">${fa(jd.jd)} ${MONTHS[jd.jm-1]} • ${minToStr(e.startMin)} تا ${minToStr(e.endMin)}</div></div><div class="exam-card-emoji">📝</div></div><div class="exam-card-badges">${badges.join('')}</div>${needNotes?`<div class="exam-card-attn">📝 ${fa(needNotes)} سوال نیازمند توجه</div>`:''}</div>`;
}
function renderExamsList(){
  const box=document.getElementById('examsList');
  if(!state.exams.length){box.innerHTML='<div class="exam-empty"><b>هنوز آزمونی ثبت نکردی</b>با دکمه «آزمون جدید» شروع کن.</div>';return;}
  const sorted=state.exams.slice().sort((a,b)=>jdnFromKey(b.date)-jdnFromKey(a.date));
  const recentExams=sorted.slice(0,3);
  const olderExams=sorted.slice(3);
  box.innerHTML=recentExams.map(examCardHTML).join('')+
    (olderExams.length?`<details class="exam-older-list"><summary>آزمون‌های قدیمی‌تر (${fa(olderExams.length)})</summary><div class="exam-older-list-items">${olderExams.map(examCardHTML).join('')}</div></details>`:'');
  box.querySelectorAll('.exam-card').forEach(c=>c.onclick=()=>openExamDetail(c.dataset.id));
}
function renderExamTagStats(){
  const box=document.getElementById('examTagStats');if(!box)return;
  const tagCount={};let totalWB=0;let totalTagged=0;
  const spec=specializedSubjectNames();
  state.exams.forEach(exam=>{
    if(!exam||!Array.isArray(exam.questions))return;
    exam.questions.forEach(q=>{
      if(!spec.includes(q.subject))return;
      const st=qStatus(q);if(st==='pending')return;
      const isWB=(st==='wrong'||st==='blank');if(isWB)totalWB++;
      const hasTags=(q.errorTypes&&q.errorTypes.length)||(q.specialTags&&q.specialTags.length)||(q.reviewSolvable!==null);
      if(!hasTags)return;
      if(isWB)totalTagged++;
      (q.errorTypes||[]).forEach(tagId=>{const tag=getErr(tagId);if(!tag)return;if(!tagCount[tagId])tagCount[tagId]={label:tag.label,count:0,color:errColor(tagId)};tagCount[tagId].count++;});
      (q.specialTags||[]).forEach(tagId=>{const tag=getErr(tagId);if(!tag)return;if(!tagCount[tagId])tagCount[tagId]={label:tag.label,count:0,color:errColor(tagId)};tagCount[tagId].count++;});
      if(q.reviewSolvable!==null){
        const id = q.reviewSolvable ? 'solvable' : 'not_solvable';
        if(!tagCount[id]) tagCount[id] = {label: q.reviewSolvable?'قابل حل':'غیرقابل حل', count:0, color: q.reviewSolvable?'#6ee7b7':'#fda4af'};
        tagCount[id].count++;
      }
    });
  });
  let html='';
  if(totalWB>0){
    const pct=Math.round(totalTagged/totalWB*100);
    html+=`<div class="tag-stat-row"><div class="tag-stat"><div class="tag-stat-value text-rose">${fa(totalWB)}</div><div class="tag-stat-label">غلط + نزده</div></div><div class="tag-stat"><div class="tag-stat-value text-amber">${fa(totalTagged)}</div><div class="tag-stat-label">تگ‌گذاری شده</div></div><div class="tag-stat"><div class="tag-stat-value text-cyan">${fa(pct)}٪</div><div class="tag-stat-label">پوشش تگ</div></div></div>`;
  }
  const entries=Object.entries(tagCount).sort((a,b)=>b[1].count-a[1].count);
  if(!entries.length){html+='<div class="muted exam-empty-note">هنوز تگی ثبت نشده</div>';box.innerHTML=html;return;}
  const maxCount=entries[0][1].count;
  entries.forEach(([tagId,data])=>{
    const pct=Math.round(data.count/maxCount*100);
    html+=`<div class="tag-bar-wrap"><div class="tag-bar-head"><span class="tag-bar-label" style="color:${data.color}">${esc(data.label)}</span><span class="text-muted">${fa(data.count)} بار</span></div><div class="tag-bar-track"><div class="tag-bar-fill" style="width:${pct}%;background:${data.color}"></div></div></div>`;
  });
  box.innerHTML=html;
}
document.getElementById('newExamBtn').onclick=()=>openNewExamModal();

/* ============ NEW EXAM MODAL ============ */
function openNewExamModal(presetDate,draft){
  if(!state.settings.examsEnabled){toast('اول آزمون را فعال کن');return;}
  const examSubjects=state.subjects.filter(s=>s.type==='specialized');
  if(!examSubjects.length){toast('هیچ درس تخصصی تعریف نشده');return;}
  const dateKey=presetDate||TODAY_KEY;
  const defaultDur=+(state.settings.examDuration||3);
  const defaultStartMin=draft?.startMin??8*60;
  const defaultEndMin=draft?.endMin??Math.min(1439,defaultStartMin+defaultDur*60);
  const counts={};examSubjects.forEach(s=>counts[s.name]=s.defaultQ||0);
  if(draft?.counts)Object.assign(counts,draft.counts);
  openModal(`
    <div class="modal-head">
      <div class="card-title text-amber">📝 آزمون جدید</div>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <label class="lbl mt-0">نام آزمون</label>
    <input class="input" id="exName" value="${esc(draft?draft.name:(state.settings.examName||'آزمون آزمایشی'))}" placeholder="مثلاً: آزمون ۲۲ آبان">
    <label class="lbl">تاریخ</label>
    <button class="input text-right cursor-pointer" id="exDatePicker" type="button">${esc(keyLabel(dateKey))}　📅</button>
    <div class="grid2 mt-12">
      <div><label class="lbl mt-0">شروع</label><div class="time-pair" id="exStartWrap"></div></div>
      <div><label class="lbl mt-0">پایان</label><div class="time-pair" id="exEndWrap"></div></div>
    </div>
    <div class="lbl">تعداد سوال هر درس</div>
    <div id="neSubjects" class="scroll-40vh"></div>
    <div class="row mt-16">
      <button class="btn ghost" data-close>انصراف</button>
      <button class="btn primary gold" id="neSave">ساخت</button>
    </div>
  `);
  const startTp=mountTimePair('neStart',document.getElementById('exStartWrap'),{value:defaultStartMin});
  const endTp=mountTimePair('neEnd',document.getElementById('exEndWrap'),{value:defaultEndMin});
  const box=document.getElementById('neSubjects');
  document.getElementById('exDatePicker').onclick=()=>{
    const savedCounts={...counts};
    box.querySelectorAll('.etp-count').forEach(inp=>{savedCounts[inp.dataset.subj]=Math.max(0,Math.min(200,+inp.value||0));});
    const savedDraft={
      name:document.getElementById('exName').value,
      startMin:startTp.get()??defaultStartMin,
      endMin:endTp.get()??defaultEndMin,
      counts:savedCounts
    };
    openJalaliDatePicker({
      title:'تاریخ آزمون',
      initialKey:dateKey,
      onPick:key=>openNewExamModal(key,savedDraft)
    });
  };
  const renderCounts=()=>{
    box.innerHTML=examSubjects.map(s=>`<div class="es-subj-row" style="border-color:${s.color}30;background:${s.color}06"><span class="es-dot" style="background:${s.color}"></span><span class="es-name" style="color:${s.color}">${esc(s.name)}</span><input class="etp-count" type="number" min="0" max="200" value="${counts[s.name]||0}" data-subj="${esc(s.name)}"><span class="es-unit-label">سوال</span></div>`).join('');
    box.querySelectorAll('.etp-count').forEach(inp=>inp.oninput=()=>{counts[inp.dataset.subj]=Math.max(0,Math.min(200,+inp.value||0));});
  };
  renderCounts();
  document.getElementById('neSave').onclick=()=>{
    const name=document.getElementById('exName').value.trim()||(state.settings.examName||'آزمون آزمایشی');
    const date=dateKey;
    const sMin=startTp.get();const eMin=endTp.get();
    if(sMin==null||eMin==null||eMin<=sMin){toast('ساعت‌ها معتبر نیستند');return;}
    box.querySelectorAll('.etp-count').forEach(inp=>{counts[inp.dataset.subj]=Math.max(0,Math.min(200,+inp.value||0));});
    const questions=[];let globalNum=1;
    examSubjects.forEach(subj=>{const n=counts[subj.name]||0;for(let i=0;i<n;i++)questions.push({id:uid(),subject:subj.name,number:globalNum++,grade:'',topics:[],status:'pending',errorTypes:[],errorDetails:{},specialTags:[],starred:false,questionText:'',answerText:'',reviewSolvable:null,figureRef:'',note:'',noteHidden:false,ts:Date.now()});});
    const exam={id:uid(),name,date,startMin:sMin,endMin:eMin,hasResults:false,subjects:null,includedSubjects:examSubjects.map(s=>s.name),totalTaraz:null,participants:null,rankCountry:null,rankRegion:null,topics:{},questions,ts:Date.now()};
    state.exams.push(exam);save();closeModal();renderExamSection();renderDashboard();toast('ساخته شد ✓');
    setTimeout(()=>openExamDetail(exam.id),150);
  };
}

/* ============ EXAM OVERLAY ============ */
function openExamDetail(id){
  const exam=state.exams.find(e=>e.id===id);if(!exam)return;
  ensureContinuousNumbering(exam);
  currentExamId=id;
  examMainTab='results';
  examAnswerMode=false;
  examKeyboardMode=false;
  examCursorIndex=0;
  notesSubject='';
  notesQuestionId='';
  notesShowingCorrectQuestions=false;
  document.getElementById('examOverlay').style.display='block';
  document.body.style.overflow='hidden';
  renderExamOverlay();
  document.getElementById('examOverlay').scrollTop=0;
}
function closeExamDetail(){
  document.getElementById('examOverlay').style.display='none';
  document.body.style.overflow='';
  currentExamId=null;
  renderExamSection();renderDashboard();
}
document.getElementById('closeExamOverlay').onclick=closeExamDetail;

function renderExamOverlay(){
  const exam=state.exams.find(e=>e.id===currentExamId);
  if(!exam)return;
  ensureContinuousNumbering(exam);
  const validQs=getSortedQuestions(exam);
  const answered=validQs.filter(q=>qStatus(q)!=='pending').length;
  document.getElementById('examOverlayTitle').textContent=exam.name;
  const answerLine = validQs.length>0&&answered>0 ? ` • ${fa(answered)}/${fa(validQs.length)} • ${analysisPercent(answered,validQs.length)} پاسخ ثبت شده` : '';
  document.getElementById('examOverlaySub').textContent=`${keyLabel(exam.date)} • ${minToStr(exam.startMin)} تا ${minToStr(exam.endMin)}${answerLine}`;
  document.getElementById('examSettingsBtn').onclick=()=>openExamSettingsModal(exam.id);
  const body=document.getElementById('examOverlayBody');
  body.innerHTML=`
    <div class="exam-main-tabs">
      <button data-mt="results" class="${examMainTab==='results'?'active':''}">📊 نتایج</button>
      <button data-mt="analysis" class="${examMainTab==='analysis'?'active':''}">📝 تحلیل</button>
    </div>
    <div id="examMainBody"></div>
  `;
  document.querySelectorAll('[data-mt]').forEach(b=>b.onclick=()=>{examMainTab=b.dataset.mt;renderExamOverlay();});
  const mainBody=document.getElementById('examMainBody');
  if(examMainTab==='results')renderExamResultsTab(exam,mainBody);
  else renderExamAnalysisTab(exam,mainBody);
}

function renderExamAnalysisTab(exam,box){
  const answered=getSortedQuestions(exam).some(question=>qStatus(question)!=='pending');
  if(!answered&&!examAnswerMode){
    box.innerHTML=`
      <div class="empty-state lg">
        <b>📝 هنوز پاسخی ثبت نشده</b>
        بعد از ثبت پاسخ سوال‌های آزمون، تحلیل در این بخش فعال می‌شود.
        <div class="mt-16"><button class="btn exam" id="enterExamAnswersBtn">⌨️ ثبت پاسخ آزمون</button></div>
      </div>
    `;
    document.getElementById('enterExamAnswersBtn').onclick=()=>{
      examCursorIndex=0;
      examAnswerMode=true;
      renderExamOverlay();
    };
    return;
  }
  box.innerHTML=`
    <div class="exam-answer-actions">
      <button class="btn exam" id="examAnswerModeBtn">${examAnswerMode?'✓ ذخیره پاسخ‌ها':'✎ ویرایش پاسخ‌ها'}</button>
    </div>
    <div id="examAnalysisBody"></div>
  `;
  document.getElementById('examAnswerModeBtn').onclick=()=>{
    if(examAnswerMode){
      save();
      examAnswerMode=false;
      renderExamOverlay();
      toast('پاسخ‌ها ذخیره شد ✓');
      return;
    }
    examCursorIndex=0;
    examAnswerMode=true;
    renderExamOverlay();
  };
  const analysisBody=document.getElementById('examAnalysisBody');
  if(examAnswerMode)renderExamInputTab(exam,analysisBody);
  else renderExamNotesTab(exam,analysisBody);
}

/* ============ EXAM SETTINGS MODAL ============ */
function openExamSettingsModal(id){
  const exam=state.exams.find(e=>e.id===id);
  if(!exam)return;
  const examTopics={};
  state.subjects.forEach(s=>{
    const availableTopics=new Set(subjGrades(s.name).flatMap(grade=>getTopics(s.name,grade)));
    examTopics[s.name]=(exam.topics&&exam.topics[s.name]||[]).filter(topic=>availableTopics.has(topic));
  });
  const g=d2g(jdnFromKey(exam.date));
  const dateVal=`${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;
  const specSubs=state.subjects.filter(s=>s.type==='specialized');
  const currentCounts={};
  specSubs.forEach(s=>{currentCounts[s.name]=exam.questions.filter(q=>q.subject===s.name).length;});
  openModal(`
    <div class="modal-head">
      <div class="card-title">⚙ تنظیمات آزمون</div>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <label class="lbl mt-0">نام آزمون</label>
    <input class="input" id="esExamName" value="${esc(exam.name)}">
    <label class="lbl">تاریخ</label>
    <input class="input" type="date" id="esExamDate" value="${dateVal}">
    <div class="err-sep"></div>
    <div class="err-sec-title">🔢 تعداد سوالات هر درس</div>
    <div id="esQCounts" class="mt-6"></div>
    <div class="err-sep"></div>
    <div class="err-sec-title">🎯 مباحث هر درس</div>
    <div id="examSettingsTopics" class="scroll-40vh mt-6"></div>
    <div class="row mt-16">
      <button class="btn danger es-delete-btn" id="esDeleteExam">🗑 حذف آزمون</button>
      <button class="btn primary flex-1" id="esSave">ذخیره تغییرات</button>
    </div>
  `);
  document.getElementById('esQCounts').innerHTML=specSubs.map(s=>`
    <div class="setting-row">
      <div class="sr-label" style="color:${s.color}">${esc(s.name)}</div>
      <div class="sr-control">
        <input class="input es-count-input" type="number" min="0" max="200" value="${currentCounts[s.name]}" data-subj="${esc(s.name)}">
        <span class="fs-10h text-muted">سوال</span>
      </div>
    </div>
  `).join('');
  const box=document.getElementById('examSettingsTopics');
  renderExamSettingsTopics(box,examTopics);
  document.getElementById('esSave').onclick=()=>{
    const newCounts={};
    document.querySelectorAll('.es-count-input').forEach(inp=>{newCounts[inp.dataset.subj]=Math.max(0,Math.min(200,+inp.value||0));});
    let totalAnsweredToRemove=0;
    Object.entries(newCounts).forEach(([subjName,target])=>{
      const cur=currentCounts[subjName]||0;
      if(target<cur){const subjQs=exam.questions.filter(q=>q.subject===subjName);const toRemove=subjQs.slice(target);totalAnsweredToRemove+=toRemove.filter(q=>qStatus(q)!=='pending').length;}
    });
    if(totalAnsweredToRemove>0){if(!confirm(`${fa(totalAnsweredToRemove)} سوال پاسخ‌داده‌شده حذف خواهد شد. ادامه؟`))return;}
    Object.entries(newCounts).forEach(([subjName,target])=>{
      const cur=currentCounts[subjName]||0;
      if(target>cur){const topics=exam.topics&&exam.topics[subjName]||[];const grade=topics.length===1?topicGrade(subjName,topics[0]):'';for(let i=0;i<target-cur;i++){exam.questions.push({id:uid(),subject:subjName,number:0,grade,topics:topics.slice(),status:'pending',errorTypes:[],errorDetails:{},specialTags:[],starred:false,questionText:'',answerText:'',reviewSolvable:null,figureRef:'',note:'',noteHidden:false,ts:Date.now()});}}
      else if(target<cur){const subjQs=exam.questions.filter(q=>q.subject===subjName);const toRemoveIds=new Set(subjQs.slice(target).map(q=>q.id));exam.questions=exam.questions.filter(q=>!toRemoveIds.has(q.id));}
    });
    ensureContinuousNumbering(exam);
    exam.name=document.getElementById('esExamName').value.trim()||'آزمون';
    exam.date=dateStrToKey(document.getElementById('esExamDate').value);
    const tp={};
    Object.entries(examTopics).forEach(([k,v])=>{if(Array.isArray(v)&&v.length)tp[k]=v.slice();});
    exam.topics=tp;
    applyExamTopicsToQuestions(exam);
    save();closeModal();
    if(currentExamId===id)renderExamOverlay();
    renderExamSection();renderDashboard();
    toast('تنظیمات ذخیره شد ✓');
  };
  document.getElementById('esDeleteExam').onclick=()=>{
    if(!confirm('کل این آزمون حذف شود؟'))return;
    state.exams=state.exams.filter(e=>e.id!==id);
    save();closeModal();
    if(currentExamId===id)closeExamDetail();
    if(document.getElementById('examCompareOverlay').classList.contains('show')){document.getElementById('examCompareOverlay').classList.remove('show');document.body.style.overflow='';}
    renderExamSection();renderDashboard();toast('آزمون حذف شد');
  };
}
function renderExamSettingsTopics(box,examTopics){
  const specSubs=state.subjects.filter(s=>s.type==='specialized');
  if(!specSubs.length){box.innerHTML='<div class="muted exam-topic-empty">هیچ درس تخصصی تعریف نشده.</div>';return;}
  box.innerHTML=specSubs.map(s=>{
    const grades=subjGrades(s.name);
    const selected=examTopics[s.name]||[];
    let topicsHtml='';
    grades.forEach(g=>{
      const tps=getTopics(s.name,g);
      if(!tps.length)return;
      topicsHtml+=`<div class="es-grade-label">${g}</div><div class="es-topics">${tps.map(t=>{const on=selected.includes(t);return `<button type="button" class="es-topic ${on?'on':''}" data-subj="${esc(s.name)}" data-topic="${esc(t)}" style="${on?`background:${s.color}44;border-color:${s.color};color:#fff`:''}">${esc(t)}</button>`;}).join('')}</div>`;
    });
    if(!topicsHtml)topicsHtml=`<div class="exam-topic-empty-sm">مبحثی برای این درس تعریف نشده.</div>`;
    return `<div class="es-subj"><div class="es-subj-head"><span class="es-dot" style="background:${s.color}"></span><span class="es-name" style="color:${s.color}">${esc(s.name)}</span><span class="es-count">${fa(selected.length)} مبحث</span></div>${topicsHtml}</div>`;
  }).join('');
  box.querySelectorAll('.es-topic').forEach(b=>{
    b.onclick=()=>{const subj=b.dataset.subj;const t=b.dataset.topic;if(!examTopics[subj])examTopics[subj]=[];if(examTopics[subj].includes(t))examTopics[subj]=examTopics[subj].filter(x=>x!==t);else examTopics[subj].push(t);renderExamSettingsTopics(box,examTopics);};
  });
}

function applyExamTopicsToQuestions(exam){
  if(!exam||!Array.isArray(exam.questions))return;
  exam.questions.forEach(question=>{
    /* FEAT-3: wrong/blank questions keep their own topics; only correct and
       pending questions are prefilled from the exam topic selection. */
    const status=qStatus(question);
    if(status==='wrong'||status==='blank')return;
    const topics=exam.topics&&exam.topics[question.subject];
    if(!Array.isArray(topics)||!topics.length)return;
    question.topics=topics.slice();
    if(topics.length===1){
      const grade=topicGrade(question.subject,topics[0]);
      if(grade)question.grade=grade;
    }
  });
}

/* ============ EXAM RESULTS TAB ============ */
function renderExamResultsTab(exam,box){
  if(!exam.hasResults){
    box.innerHTML=`<div class="empty-state lg"><b>📊 هنوز نتیجه‌ای ثبت نشده</b>پس از برگزاری آزمون، تراز و درصدها را وارد کن.<div class="mt-16"><button class="btn exam" id="enterResultsBtn">🎯 ثبت نتیجه آزمون</button></div></div>`;
    document.getElementById('enterResultsBtn').onclick=()=>openExamResultsModal(exam.id);
    return;
  }
  const totals=examTotals(exam);const names=examSubjectNames(exam);
  const mismatchHTML=exam.resultsSource==='answers'?'':examResultMismatchHTML(exam);
  const rows=names.map(name=>{
    const d=exam.subjects?exam.subjects[name]:null;
    if(!d)return`<tr><td>${esc(name)}</td><td colspan="6" class="text-muted">—</td></tr>`;
    const c=+d.correct||0,w=+d.wrong||0,b=+d.blank||0;
    const pctRaw=examPctFromCounts(c,w,b,false);const pctNeg=examPctFromCounts(c,w,b,true);
    return`<tr><td>${esc(name)}</td><td class="text-ok">${fa(c)}</td><td class="text-rose">${fa(w)}</td><td class="text-soft">${fa(b)}</td><td class="text-cyan">${pctRaw==null?'—':fa(Math.round(pctRaw))+'٪'}</td><td class="text-amber">${pctNeg==null?'—':fa(Math.round(pctNeg))+'٪'}</td><td>${d.taraz!=null?fa(Math.round(d.taraz)):'—'}</td></tr>`;
  }).join('');
  box.innerHTML=`${mismatchHTML}<div class="exam-progress cols-2"><div><span>تراز کل</span><b class="text-amber">${exam.totalTaraz!=null?fa(Math.round(exam.totalTaraz)):'—'}</b></div><div><span>رتبه کشوری</span><b class="text-cyan">${exam.rankCountry!=null?fa(exam.rankCountry):(exam.rank!=null?fa(exam.rank):'—')}</b></div><div><span>رتبه منطقه</span><b class="text-ok">${exam.rankRegion!=null?fa(exam.rankRegion):'—'}</b></div><div><span>شرکت‌کننده</span><b class="text-soft">${exam.participants!=null?fa(exam.participants):'—'}</b></div></div><div class="exam-progress cols-3"><div><span>درست</span><b class="text-ok">${fa(totals.c)}</b></div><div><span>غلط</span><b class="text-rose">${fa(totals.w)}</b></div><div><span>نزده</span><b class="text-soft">${fa(totals.b)}</b></div></div><div class="wr-scroll"><table class="results-table"><thead><tr><th>درس</th><th>درست</th><th>غلط</th><th>نزده</th><th>بدون منفی</th><th>با منفی</th><th>تراز</th></tr></thead><tbody>${rows}</tbody></table></div><div class="mt-14"><button class="btn exam" id="editResultsBtn">✎ ویرایش نتایج</button></div>`;
  document.getElementById('editResultsBtn').onclick=()=>openExamResultsModal(exam.id);
}

/* ============ EXAM INPUT TAB ============ */
function renderExamInputTab(exam,box){
  const sorted=getSortedQuestions(exam);
  if(!sorted.length){
    box.innerHTML=`<div class="empty-state"><b>آزمون سوالی ندارد</b>برای تحلیل سوال‌به‌سوال، از ⚙ تنظیمات آزمون، تعداد سوالات هر درس را مشخص کن.<div class="mt-16"><button class="btn exam" id="addQuestionsBtn">+ افزودن سوالات</button></div></div>`;
    document.getElementById('addQuestionsBtn').onclick=()=>openAddQuestionsModal(exam.id);
    return;
  }
  if(examCursorIndex>=sorted.length)examCursorIndex=sorted.length-1;
  if(examCursorIndex<0)examCursorIndex=0;
  let html=`<div class="fast-summary"></div>`;
  html+=`<div class="exam-fast-toolbar"><button class="mini-btn${examKeyboardMode?' exam-on':''}" id="kbToggleBtn">⌨️ کیبورد: ${examKeyboardMode?'روشن ✓':'خاموش'}</button><button class="bulk-btn grow" id="bulkCorrectBtn">✓ ثبت صحیح بقیه</button><button class="mini-btn danger-strong" id="resetInputBtn">↺ ریست</button></div>`;
  if(examKeyboardMode)html+=`<div class="fast-hint">⌨️ <b>3</b>=درست • <b>2</b>=غلط • <b>1</b>=نزده • <b>↑↓</b>=جابجایی</div>`;
  const cols=[];for(let i=0;i<sorted.length;i+=10)cols.push(sorted.slice(i,i+10));
  let gridHtml='';
  cols.forEach(col=>{
    gridHtml+='<div class="sg-col">';
    col.forEach(q=>{
      const st=qStatus(q);
      const color=subjColor(q.subject);
      const isCursor=examKeyboardMode&&sorted[examCursorIndex]&&sorted[examCursorIndex].id===q.id;
      const idx=sorted.findIndex(x=>x.id===q.id);
      const starMark = q.starred ? '<span class="q-star-mark">⭐</span>' : '';
      gridHtml+=`<div class="ist-row${isCursor?' cursor':''}" data-status="${st}" data-qid="${q.id}" data-idx="${idx}"><span class="snum" style="background:${color}">${fa(q.number)}${starMark}</span><div class="ist-btns"><button class="ist-b${st==='correct'?' on-c':''}" data-st="correct" data-qid="${q.id}">✓</button><button class="ist-b${st==='wrong'?' on-w':''}" data-st="wrong" data-qid="${q.id}">✗</button><button class="ist-b${st==='blank'?' on-n':''}" data-st="blank" data-qid="${q.id}">ن</button></div></div>`;
    });
    gridHtml+='</div>';
  });
  html+=`<div class="sheet-grid">${gridHtml}</div>`;
  box.innerHTML=html;
  const refreshInputState=()=>{
    const answered=sorted.filter(q=>qStatus(q)!=='pending');
    const c=answered.filter(q=>qStatus(q)==='correct').length;
    const w=answered.filter(q=>qStatus(q)==='wrong').length;
    const b=answered.filter(q=>qStatus(q)==='blank').length;
    box.querySelector('.fast-summary').innerHTML=`<span>ثبت‌شده: <b>${fa(answered.length)}</b>/${fa(sorted.length)}</span><span class="text-ok">✓ <b>${fa(c)}</b></span><span class="text-rose">✗ <b>${fa(w)}</b></span><span class="text-soft">ن <b>${fa(b)}</b></span>`;
    box.querySelectorAll('.ist-row').forEach(row=>{
      const question=exam.questions.find(item=>item.id===row.dataset.qid);
      if(!question)return;
      const status=qStatus(question);
      row.dataset.status=status;
      row.classList.toggle('cursor',examKeyboardMode&&sorted[examCursorIndex]&&sorted[examCursorIndex].id===question.id);
      row.querySelectorAll('.ist-b').forEach(button=>{
        button.classList.toggle('on-c',status==='correct'&&button.dataset.st==='correct');
        button.classList.toggle('on-w',status==='wrong'&&button.dataset.st==='wrong');
        button.classList.toggle('on-n',status==='blank'&&button.dataset.st==='blank');
      });
    });
  };
  refreshInputState();
  document.getElementById('kbToggleBtn').onclick=()=>{examKeyboardMode=!examKeyboardMode;renderExamOverlay();};
  box.querySelectorAll('.ist-b').forEach(btn=>{
    btn.onclick=(e)=>{
      e.stopPropagation();
      const q=exam.questions.find(x=>x.id===btn.dataset.qid);
      if(!q)return;
      const idx=sorted.findIndex(x=>x.id===q.id);
      if(idx>=0)examCursorIndex=idx;
      const st=btn.dataset.st;
      if(q.status===st)q.status='pending';else q.status=st;
      if(qStatus(q)==='correct'){q.errorTypes=[];q.errorDetails={};q.reviewSolvable=null;q.figureRef='';}
      q.ts=Date.now();syncExamResultsFromAnswers(exam);save();refreshInputState();
    };
  });
  box.querySelectorAll('.ist-row').forEach(row=>{
    row.addEventListener('click',(e)=>{
      if(e.target.closest('.ist-b'))return;
      const idx=+row.dataset.idx;
      if(idx>=0){examCursorIndex=idx;refreshInputState();}
    });
  });
  const bulk=document.getElementById('bulkCorrectBtn');
  if(bulk)bulk.onclick=()=>{exam.questions.filter(q=>qStatus(q)==='pending').forEach(q=>{q.status='correct';q.ts=Date.now();});syncExamResultsFromAnswers(exam);save();refreshInputState();toast('ثبت شد');};
  const reset=document.getElementById('resetInputBtn');
  if(reset)reset.onclick=()=>{if(!confirm('همه پاسخ‌ها ریست شوند؟'))return;exam.questions.forEach(q=>{q.status='pending';q.reviewSolvable=null;q.ts=Date.now();});syncExamResultsFromAnswers(exam);save();refreshInputState();toast('ریست شد');};
  box.refreshExamInputState=refreshInputState;
}

/* ============ EXAM NOTES TAB ============ */

/* Chip blocks are rendered by helpers so a single card can refresh its own
   chips after an auto-save without touching textareas or the question picker. */
function noteTopicChipsHTML(exam,q,color){
  const selectedExamTopics=(exam.topics&&exam.topics[q.subject])||[];
  const examTopics=q.grade
    ?selectedExamTopics.filter(topic=>getTopics(q.subject,q.grade).includes(topic))
    :selectedExamTopics;
  if(!examTopics.length)return'';
  const status=qStatus(q);
  const chips=examTopics.map(t=>{
    const on=(q.topics||[]).includes(t);
    const suggested=(status==='wrong'||status==='blank')&&!on;
    const style=on?`background:${color}44;border-color:${color};color:#fff`:'';
    return `<button type="button" class="nc-edit-topic-chip ${on?'on':''} ${suggested?'suggested':''}" data-edit-topic="${esc(t)}" data-qid="${q.id}" ${suggested?'data-suggested="1"':''} style="${style}" title="${suggested?'کلیک کنید تا فعال شود':''}">${esc(t)}${suggested?' <span class="nc-chip-plus">＋</span>':''}</button>`;
  }).join('');
  return `<div class="nc-edit-block"><div class="nc-edit-label">📚 مبحث:</div><div class="nc-edit-chips">${chips}</div></div>`;
}

function noteGeneralChipsHTML(q){
  const selected=q.errorTypes||[];
  return (state.commonErrors||[]).map(tag=>{
    const on=selected.includes(tag.id);
    const c=errColor(tag.id);
    let subHtml='';
    if(on&&tag.subOptions&&tag.subOptions.length){
      const currentSubs=(q.errorDetails&&q.errorDetails[tag.id])||[];
      subHtml=`<div class="nc-sub-chips">${tag.subOptions.map(opt=>{
        const optOn=currentSubs.includes(opt.id);
        return `<button type="button" class="nc-sub-chip ${optOn?'on':''}" data-edit-subtag="${tag.id}" data-sub-id="${opt.id}" data-qid="${q.id}" style="${optOn?`background:${c}33;border-color:${c};color:#fff`:''}">${esc(opt.label)}</button>`;
      }).join('')}</div>`;
    }
    return `<div class="nc-tag-with-subs"><button type="button" class="nc-edit-chip ${on?'on':''}" data-edit-err="${tag.id}" data-qid="${q.id}" style="${on?`background:${c}33;border-color:${c};color:#fff`:''}">${esc(tag.label)}</button>${subHtml}</div>`;
  }).join('');
}

function noteSpecialChipsHTML(q){
  return getSpecialTagsForSubject(q.subject).map(tag=>{
    const on=(q.specialTags||[]).includes(tag.id);
    return `<button type="button" class="nc-edit-chip ${on?'on':''}" data-edit-special="${tag.id}" data-qid="${q.id}" style="${on?'background:rgba(167,139,250,.35);border-color:#a78bfa;color:#fff':''}">${esc(tag.label)}</button>`;
  }).join('');
}

function noteChipSectionsHTML(exam,q,color,keys){
  const generalChipsHtml=noteGeneralChipsHTML(q);
  const specialChipsHtml=noteSpecialChipsHTML(q);
  const blocks={
    topics:noteTopicChipsHTML(exam,q,color),
    general:(generalChipsHtml?`<div class="nc-edit-block"><div class="nc-edit-label">🏷️ تگ‌های عمومی:</div><div class="nc-edit-chips">${generalChipsHtml}</div></div>`:'')+
      (specialChipsHtml?`<div class="nc-edit-block"><div class="nc-edit-label">⭐ تگ‌های تخصصی:</div><div class="nc-edit-chips">${specialChipsHtml}</div></div>`:'')
  };
  return (keys||['topics','types','general']).map(key=>blocks[key]||'').join('');
}

function noteErrorDetailsHTML(q){
  if(!q.errorDetails||!Object.keys(q.errorDetails).length)return'';
  const displayChips=[];
  Object.entries(q.errorDetails).forEach(([tagId,subs])=>{
    if(!Array.isArray(subs)||!subs.length)return;
    const tag=getErr(tagId);
    if(!tag||!tag.subOptions)return;
    const label=subs.map(sid=>{
      const opt=tag.subOptions.find(o=>o.id===sid);
      return opt?opt.label:sid;
    }).join(' · ');
    if(label)displayChips.push(`<span class="nc-subtag-display">${esc(tag.label)}: ${esc(label)}</span>`);
  });
  return displayChips.length?`<div class="nc-subtags-show">${displayChips.join('')}</div>`:'';
}

function noteSectionOrder(){return['topics','solvable','note','general','question','answer'];}

/* FEAT-2/3: one card is one independently refreshable unit. Auto-save never
   re-renders the whole notes tab, so textarea focus/caret stay untouched. */
function noteQuestionCardHTML(exam,q){
  const color=subjColor(q.subject);
  const st=qStatus(q);
  const noteFilled=!!(q.note&&q.note.trim());

  const solvableHtml=(st==='wrong'||st==='blank')
    ?`<div class="nc-solvable-row">
        <span class="nc-solvable-label">🎯 دفعه دوم:</span>
        <button type="button" class="nc-solvable-btn ${q.reviewSolvable===true?'on-ok':''}" data-solvable="true" data-qid="${q.id}">✓ قابل حل</button>
        <button type="button" class="nc-solvable-btn ${q.reviewSolvable===false?'on-bad':''}" data-solvable="false" data-qid="${q.id}">✗ غیرقابل حل</button>
      </div>`
    :'';

  const noteHtml=`<details class="nc-fold nc-note-fold" open>
    <summary>💡 نکته${noteFilled?' • ثبت شده':''}</summary>
    <textarea class="note-ta${noteFilled?' filled':''}" data-note-q="${q.id}" placeholder="درس\u200cآموخته\u200cات...">${esc(q.note||'')}</textarea>
  </details>`;
  const questionHtml=`<details class="nc-fold">
    <summary>📋 صورت سوال${q.questionText?' • ثبت شده':''}</summary>
    <textarea class="nc-qa-input nc-question-input" data-q-text="${q.id}" placeholder="متن سوال (اختیاری)...">${esc(q.questionText||'')}</textarea>
  </details>`;
  const answerHtml=`<details class="nc-fold">
    <summary>✅ پاسخ صحیح${q.answerText?' • ثبت شده':''}</summary>
    <textarea class="nc-qa-input nc-answer-input" data-a-text="${q.id}" placeholder="پاسخ صحیح (اختیاری)...">${esc(q.answerText||'')}</textarea>
  </details>`;

  const sections={
    topics:noteChipSectionsHTML(exam,q,color,['topics']),
    general:noteChipSectionsHTML(exam,q,color,['general']),
    solvable:solvableHtml,
    note:noteHtml,
    question:questionHtml,
    answer:answerHtml
  };
  const orderedBody=noteSectionOrder(q.subject).map(key=>sections[key]||'').join('');
  const starClass=q.starred?'on':'';

  return `<div class="note-item" data-qid="${q.id}">
    <div class="note-head">
      <span class="note-num" style="background:${color}">${fa(q.number)}</span>
      <span class="note-status ${st}">${STATUS_LABEL[st]}</span>
      <span class="note-topic">${esc((q.topics||[]).join(' + ')||'بدون مبحث')}</span>
      <span class="nc-save-indicator" data-save-indicator="${q.id}" aria-live="polite"></span>
      <button type="button" class="note-star-toggle ${starClass}" data-star-qid="${q.id}" title="ستاره\u200cدار">⭐</button>
      <button type="button" class="note-expand-btn" data-expand-qid="${q.id}" title="ویرایش کامل">✎</button>
      <button type="button" class="note-del" data-note-del="${q.id}" title="پنهان">×</button>
    </div>
    ${orderedBody}
    ${noteErrorDetailsHTML(q)}
  </div>`;
}

function bindNoteItemHandlers(exam,box,item){
  const examId=exam.id;
  const questionId=item.dataset.qid;
  const getQuestion=()=>{
    const current=state.exams.find(e=>e.id===examId);
    return current&&current.questions.find(x=>x.id===questionId);
  };
  const q=getQuestion();
  if(!q)return;
  const refresh=(saved)=>saveQuestionEdit(exam,q,box,{refresh:true,saved:saved});

  const star=item.querySelector('[data-star-qid]');
  if(star)star.onclick=(e)=>{e.stopPropagation();q.starred=!q.starred;refresh(false);};
  const expand=item.querySelector('[data-expand-qid]');
  if(expand)expand.onclick=(e)=>{e.stopPropagation();openQuestionNoteEditor(examId,questionId);};
  const del=item.querySelector('[data-note-del]');
  if(del)del.onclick=(e)=>{e.stopPropagation();q.noteHidden=true;q.ts=Date.now();save();renderExamNotesTab(exam,box);toast('پنهان شد');};

  item.querySelectorAll('[data-edit-topic]').forEach(btn=>{btn.onclick=(e)=>{
    e.stopPropagation();
    const topic=btn.dataset.editTopic;
    q.topics=q.topics||[];
    if(q.topics.includes(topic))q.topics=q.topics.filter(t=>t!==topic);
    else{
      q.topics.push(topic);
      const grade=topicGrade(q.subject,topic);
      if(grade)q.grade=grade;
    }
    refresh(true);
  };});

  item.querySelectorAll('[data-edit-err]').forEach(btn=>{btn.onclick=(e)=>{
    e.stopPropagation();
    const tagId=btn.dataset.editErr;
    q.errorTypes=q.errorTypes||[];
    if(q.errorTypes.includes(tagId)){
      q.errorTypes=q.errorTypes.filter(t=>t!==tagId);
      if(q.errorDetails)delete q.errorDetails[tagId];
    }else q.errorTypes.push(tagId);
    refresh(true);
  };});

  item.querySelectorAll('[data-edit-subtag]').forEach(btn=>{btn.onclick=(e)=>{
    e.stopPropagation();
    const tagId=btn.dataset.editSubtag;
    const subId=btn.dataset.subId;
    q.errorDetails=q.errorDetails||{};
    if(!Array.isArray(q.errorDetails[tagId]))q.errorDetails[tagId]=[];
    const values=q.errorDetails[tagId];
    q.errorDetails[tagId]=values.includes(subId)?values.filter(x=>x!==subId):[...values,subId];
    refresh(true);
  };});

  item.querySelectorAll('[data-edit-special]').forEach(btn=>{btn.onclick=(e)=>{
    e.stopPropagation();
    const tagId=btn.dataset.editSpecial;
    q.specialTags=q.specialTags||[];
    q.specialTags=q.specialTags.includes(tagId)
      ?q.specialTags.filter(t=>t!==tagId)
      :[...q.specialTags,tagId];
    refresh(true);
  };});

  item.querySelectorAll('[data-solvable]').forEach(btn=>{btn.onclick=(e)=>{
    e.stopPropagation();
    const value=btn.dataset.solvable==='true';
    q.reviewSolvable=q.reviewSolvable===value?null:value;
    refresh(true);
  };});

  const bindText=(selector,field)=>{
    const ta=item.querySelector(selector);
    if(!ta)return;
    let timer;
    ta.oninput=()=>{
      q[field]=ta.value;
      q.ts=Date.now();
      ta.classList.toggle('filled',!!ta.value.trim());
      const fold=ta.closest('.nc-fold');
      const summary=fold&&fold.querySelector('summary');
      if(summary&&ta.value.trim())summary.textContent=summary.textContent.replace(' • ثبت شده','')+' • ثبت شده';
      showQuestionSaving(exam,box,q);
      clearTimeout(timer);
      timer=setTimeout(()=>{
        if(field==='note')autoStarCorrectQuestion(q);
        q.ts=Date.now();
        save();
        showQuestionSaved(exam,box,q);
      },350);
    };
  };
  bindText('.note-ta','note');
  bindText('[data-q-text]','questionText');
  bindText('[data-a-text]','answerText');
}

function renderExamNotesTab(exam,box){
  const allQs=getSortedQuestions(exam);
  if(!allQs.length){box.innerHTML='<div class="empty-state">سوالی برای تحلیل نیست</div>';return;}

  const sectionBySubject={};
  allQs.forEach(question=>{
    if(!sectionBySubject[question.subject])sectionBySubject[question.subject]=[];
    sectionBySubject[question.subject].push(question);
  });
  const subjectQuestions=notesSubject?allQs.filter(question=>question.subject===notesSubject):[];
  const filtered=subjectQuestions.filter(question=>notesShowingCorrectQuestions
    ?qStatus(question)==='correct'
    :qStatus(question)==='wrong'||qStatus(question)==='blank'||
      (qStatus(question)==='correct'&&!!(question.note&&question.note.trim())));
  let html='';

  if(!notesSubject){
    html+=`<div class="note-subject-picker"><div class="note-subject-picker-title">ابتدا درس را انتخاب کن <span>• کل | تحلیل‌شده | باقی</span></div><div class="note-subject-picker-list">`+
      Object.entries(sectionBySubject).map(([subject,questions])=>{
        const stats=subjectAnalysisStats(questions);
        const color=analysisProgressColor(stats.pct);
        return `<button type="button" class="note-subject-option" data-notes-subject="${esc(subject)}">
          <span class="nsp-main"><span class="sdot" style="background:${subjColor(subject)}"></span><span class="nsp-name">${esc(subject)}</span></span>
          <span class="nsp-counts">${fa(stats.total)} | ${fa(stats.analyzed)} | ${fa(stats.remaining)}</span>
          <span class="nsp-pct" style="color:${color}">${fa(stats.pct)}٪</span>
          <span class="nsp-progress"><span class="nsp-progress-fill" style="width:${stats.pct}%;background:${color}"></span></span>
        </button>`;
      }).join('')+
    '</div></div>';
  }else{
    const selectedSubject=sectionBySubject[notesSubject];
    html+=`<button type="button" class="note-subject-back" id="changeNotesSubject">‹ انتخاب درس دیگر <span>${esc(notesSubject)} · ${fa(selectedSubject?selectedSubject.length:0)} سوال</span></button>`;
    if(notesShowingCorrectQuestions){
      html+='<button type="button" class="note-correct-back" data-return-analysis-questions>‹ بازگشت به سوال‌های غلط و نزده</button>';
    }
    html+=`<div class="note-question-picker">
      <div class="note-question-picker-title">${notesShowingCorrectQuestions?'سوال درست را برای نوشتن نکته انتخاب کن':'سوال‌های غلط و نزده'} <span>• روی مربع انتخاب‌شده بزن تا کارت بسته شود</span></div>
      <div class="note-question-grid">${filtered.map(q=>{
        const {hasNote,hasTags}=examNoteInfoClass(q);
        const analyzed=isQuestionAnalyzed(q);
          return`<button type="button" class="note-question-square note-question-${qStatus(q)} ${analyzed?'analysis-complete':''} ${q.id===notesQuestionId?'active':''}" data-note-question="${q.id}" title="سوال ${fa(q.number)}${hasNote?' • نکته ثبت شده':''}${hasTags?' • تگ ثبت شده':''}">${fa(q.number)}<span class="note-question-markers">${hasNote?'<i class="note-marker-note" aria-label="نکته ثبت شده">ن</i>':''}${hasTags?'<i class="note-marker-tag" aria-label="تگ ثبت شده">ت</i>':''}</span></button>`;
      }).join('')}${notesShowingCorrectQuestions?'':'<button type="button" class="note-question-square note-question-add" data-add-correct-note title="افزودن سوال درست برای نوشتن نکته">＋</button>'}</div>
      <div class="note-question-legend"><span><i class="note-question-legend-status note-question-correct"></i> درست</span><span><i class="note-question-legend-status note-question-wrong"></i> غلط</span><span><i class="note-question-legend-status note-question-blank"></i> نزده</span><span><i class="note-question-legend-status note-question-pending"></i> ثبت نشده</span><span><b class="note-marker-note">ن</b> نکته</span><span><b class="note-marker-tag">ت</b> تگ</span></div>
    </div>`;
    if(!notesQuestionId){
      html+=notesShowingCorrectQuestions
        ?'<div class="empty-state note-question-empty">برای نوشتن نکته، شماره‌ی یکی از سوال‌های درست را انتخاب کن.</div>'
        :'<div class="empty-state note-question-empty">سوال غلط یا نزده‌ای برای تحلیل وجود ندارد. با + یک سوال درست برای نوشتن نکته انتخاب کن.</div>';
    }

    filtered.filter(question=>question.id===notesQuestionId).forEach(q=>{
      html+=noteQuestionCardHTML(exam,q);
    });
  }
  box.innerHTML=html;

  /* ===== Handlers ===== */
  box.querySelectorAll('[data-notes-subject]').forEach(button=>button.onclick=()=>{
    notesSubject=button.dataset.notesSubject;
    notesQuestionId='';
    notesShowingCorrectQuestions=false;
    renderExamNotesTab(exam,box);
  });
  const changeNotesSubject=document.getElementById('changeNotesSubject');
  if(changeNotesSubject)changeNotesSubject.onclick=()=>{notesSubject='';notesQuestionId='';notesShowingCorrectQuestions=false;renderExamNotesTab(exam,box);};
  const returnToAnalysisQuestions=box.querySelector('[data-return-analysis-questions]');
  if(returnToAnalysisQuestions)returnToAnalysisQuestions.onclick=()=>{notesShowingCorrectQuestions=false;notesQuestionId='';renderExamNotesTab(exam,box);};
  const addCorrectNote=box.querySelector('[data-add-correct-note]');
  if(addCorrectNote)addCorrectNote.onclick=()=>{notesShowingCorrectQuestions=true;notesQuestionId='';renderExamNotesTab(exam,box);};
  box.querySelectorAll('[data-note-question]').forEach(button=>button.onclick=()=>{
    notesQuestionId=notesQuestionId===button.dataset.noteQuestion?'':button.dataset.noteQuestion;
    renderExamNotesTab(exam,box);
  });
  box.querySelectorAll('.note-item').forEach(item=>bindNoteItemHandlers(exam,box,item));
}

/* ============ QUESTION NOTE EDITOR ============ */
function openQuestionNoteEditor(examId,qId){
  const exam=state.exams.find(e=>e.id===examId);if(!exam)return;
  const q=exam.questions.find(x=>x.id===qId);if(!q)return;
  const allowedGrades=subjGrades(q.subject);
  const initialGrade=allowedGrades.length===1
    ?allowedGrades[0]
    :(allowedGrades.includes(q.grade)?q.grade:'');
  const initialTopics=q.topics.filter(topic=>getTopics(q.subject,initialGrade).includes(topic));
  const s={status:qStatus(q),grade:initialGrade,topics:initialTopics,errorTypes:[...(q.errorTypes||[])],errorDetails:JSON.parse(JSON.stringify(q.errorDetails||{})),specialTags:[...(q.specialTags||[])],starred:!!q.starred,questionText:q.questionText||'',answerText:q.answerText||'',reviewSolvable:q.reviewSolvable,figureRef:q.figureRef,note:q.note};
  const color=subjColor(q.subject);
  const specialTagsForSubject = getSpecialTagsForSubject(q.subject);

  function render(){
    const st=s.status;
    const examT=(exam.topics&&exam.topics[q.subject])||[];
    const usingExamTopics=examT.length>0;
    const gradeTopics=s.grade?getTopics(q.subject,s.grade):[];
    const topics=usingExamTopics
      ?(s.grade?examT.filter(topic=>gradeTopics.includes(topic)):examT)
      :(s.grade?gradeTopics:[]);
    const fixedProfileGrade=allowedGrades.length<=1;
    const topicChips=topics.length
      ?`<div class="nc-edit-block"><div class="nc-edit-label">📚 مبحث:</div><div class="nc-edit-chips">${topics.map(topic=>{
          const selected=s.topics.includes(topic);
          return `<button type="button" class="nc-edit-topic-chip ${selected?'on':''}" data-question-topic="${esc(topic)}" style="${selected?`background:${color}44;border-color:${color};color:#fff`:''}">${esc(topic)}</button>`;
        }).join('')}</div></div>`
      :'';
    const generalTags = state.commonErrors || [];
    const showErrSection=(st==='wrong'||st==='blank');
    const grades=allowedGrades;
    const showSolvable = showErrSection;

    const generalChipHTML = (tag) => {
      const on = s.errorTypes.includes(tag.id);
      const c = errColor(tag.id);
      const style = on ? `color:#fff;border-color:${c};background:${c}33` : '';
      let subHtml = '';
      if(on && tag.subOptions && tag.subOptions.length){
        const currentSubs = s.errorDetails[tag.id] || [];
        subHtml = `<div class="tag-sub-row">${tag.subOptions.map(opt=>{const optOn = currentSubs.includes(opt.id);return `<button type="button" class="tag-sub-btn ${optOn?'on':''}" data-tag-sub="${tag.id}" data-sub-id="${opt.id}" style="${optOn?`background:${c}44;border-color:${c};color:#fff`:''}">${esc(opt.label)}</button>`;}).join('')}</div>`;
      }
      return `<div class="tag-wrapper"><button type="button" class="err-chip ${on?'active':''}" data-err="${tag.id}" style="${style}">${esc(tag.label)}</button>${subHtml}</div>`;
    };

    const specialChipHTML = (tag) => {
      const on = s.specialTags.includes(tag.id);
      const style = on ? 'color:#fff;border-color:#a78bfa;background:rgba(167,139,250,.35)' : '';
      return `<button type="button" class="err-chip ${on?'active':''}" data-special-tag="${tag.id}" style="${style}">${esc(tag.label)}</button>`;
    };

    document.getElementById('modalContent').innerHTML=`
      <div class="modal-head">
        <div><div class="card-title">سوال ${fa(q.number)} ${s.starred?'<span class="text-amber">⭐</span>':''} <span style="color:${color}">• ${esc(q.subject)}</span></div><div class="exam-meta-line">${exam.name}</div></div>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <label class="lbl mt-0">وضعیت پاسخ</label>
      <div class="status-picker">
        <button type="button" data-st="correct" class="${st==='correct'?'active':''}">✓ درست</button>
        <button type="button" data-st="wrong" class="${st==='wrong'?'active':''}">✗ غلط</button>
        <button type="button" data-st="blank" class="${st==='blank'?'active':''}">○ نزده</button>
        <button type="button" data-st="pending" class="${st==='pending'?'active':''}">· ثبت نشده</button>
      </div>

      <div class="toggle-card ${s.starred?'starred':''} mt-12 mb-12">
        <div><div class="fw-700 fs-13">⭐ ستاره‌دار</div></div>
        <label class="switch"><input type="checkbox" id="qStarToggle" ${s.starred?'checked':''}><span></span></label>
      </div>

      ${showSolvable ? `<label class="lbl">🎯 دفعه دوم قابل حل بود؟</label>
      <div class="d-flex gap-8 mb-12">
        <button type="button" class="btn solv-yes${s.reviewSolvable===true?' on':''}" id="qSolvableYes">✓ قابل حل</button>
        <button type="button" class="btn solv-no${s.reviewSolvable===false?' on':''}" id="qSolvableNo">✗ غیرقابل حل</button>
      </div>` : ''}

      <label class="lbl">پایه</label><div class="grade-picker ${fixedProfileGrade?'grade-picker-disabled':''}" ${fixedProfileGrade?'':'id="qGradePicker"'}>${grades.map(g=>`<button type="button" ${fixedProfileGrade?'':'data-grade="'+g+'"'} class="${s.grade===g?'active':''}">${g}</button>`).join('')}</div>

      ${topicChips}
      <label class="lbl">📋 متن سوال</label>
      <textarea class="input q-field" id="qQuestionText" placeholder="متن کامل سوال...">${esc(s.questionText||'')}</textarea>
      <label class="lbl">✅ پاسخ سوال</label>
      <textarea class="input q-field answer" id="qAnswerText" placeholder="پاسخ صحیح...">${esc(s.answerText||'')}</textarea>

      ${showErrSection?`<label class="lbl mt-14">🏷️ تگ‌های عمومی</label><div class="err-grid" id="qErrorsGeneral">${generalTags.map(generalChipHTML).join('')}</div>`:`<div class="note-correct-hint boxed">${st==='correct'?'✓ سوال درست':'وضعیت را مشخص کن'}</div>`}

      ${specialTagsForSubject.length > 0 ? `<label class="lbl mt-14">⭐ تگ‌های تخصصی</label><div class="err-grid">${specialTagsForSubject.map(specialChipHTML).join('')}</div>` : ''}

      <label class="lbl">💡 نکته</label>
      <textarea class="input q-note" id="qNote" placeholder="درس‌آموخته‌ات...">${esc(s.note||'')}</textarea>
      <div class="row mt-16"><button class="btn ghost" data-close>بستن</button><button class="btn primary" id="qSave">ذخیره</button></div>
    `;
    document.querySelectorAll('#modalContent [data-close]').forEach(b=>b.onclick=closeModal);
    document.querySelectorAll('.status-picker button').forEach(b=>b.onclick=()=>{s.status=b.dataset.st;if(s.status==='correct'){s.errorTypes=[];s.errorDetails={};s.reviewSolvable=null;s.figureRef='';}render();});
    document.getElementById('qStarToggle').onchange=(e)=>{s.starred=e.target.checked;render();};

    const sy=document.getElementById('qSolvableYes');if(sy)sy.onclick=()=>{s.reviewSolvable = s.reviewSolvable===true ? null : true;render();};
    const sn=document.getElementById('qSolvableNo');if(sn)sn.onclick=()=>{s.reviewSolvable = s.reviewSolvable===false ? null : false;render();};

    const gp=document.getElementById('qGradePicker');if(gp)gp.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(s.grade===b.dataset.grade){s.grade='';}else{s.grade=b.dataset.grade;}const gradeTopics=s.grade?getTopics(q.subject,s.grade):[];const allowedTopics=examT.length?(s.grade?examT.filter(topic=>gradeTopics.includes(topic)):examT):gradeTopics;const validTopics=new Set(allowedTopics);s.topics=s.topics.filter(topic=>validTopics.has(topic));render();});
    document.querySelectorAll('#modalContent [data-question-topic]').forEach(button=>button.onclick=()=>{
      const topic=button.dataset.questionTopic;
      if(s.topics.includes(topic))s.topics=s.topics.filter(item=>item!==topic);
      else{
        s.topics.push(topic);
        if(!s.grade)s.grade=topicGrade(q.subject,topic);
      }
      render();
    });
    document.querySelectorAll('#modalContent [data-err]').forEach(b=>b.onclick=()=>{const id=b.dataset.err;if(s.errorTypes.includes(id)){s.errorTypes=s.errorTypes.filter(x=>x!==id);if(s.errorDetails[id])delete s.errorDetails[id];}else{s.errorTypes.push(id);}render();});
    document.querySelectorAll('#modalContent [data-tag-sub]').forEach(b=>b.onclick=()=>{const tagId=b.dataset.tagSub;const subId=b.dataset.subId;if(!s.errorDetails[tagId])s.errorDetails[tagId]=[];if(s.errorDetails[tagId].includes(subId))s.errorDetails[tagId]=s.errorDetails[tagId].filter(x=>x!==subId);else s.errorDetails[tagId].push(subId);render();});
    document.querySelectorAll('#modalContent [data-special-tag]').forEach(b=>b.onclick=()=>{const id=b.dataset.specialTag;if(s.specialTags.includes(id))s.specialTags=s.specialTags.filter(x=>x!==id);else s.specialTags.push(id);render();});
    const noteEl=document.getElementById('qNote');if(noteEl)noteEl.oninput=()=>{s.note=noteEl.value;};
    const qTextEl=document.getElementById('qQuestionText');if(qTextEl)qTextEl.oninput=()=>{s.questionText=qTextEl.value;};
    const aTextEl=document.getElementById('qAnswerText');if(aTextEl)aTextEl.oninput=()=>{s.answerText=aTextEl.value;};
    document.getElementById('qSave').onclick=()=>{
      const noteEl2=document.getElementById('qNote');if(noteEl2)s.note=noteEl2.value;
      const qEl=document.getElementById('qQuestionText');if(qEl)s.questionText=qEl.value;
      const aEl=document.getElementById('qAnswerText');if(aEl)s.answerText=aEl.value;
      if(s.status==='correct'){s.errorTypes=[];s.errorDetails={};s.reviewSolvable=null;}
      q.status=s.status;q.grade=s.grade;q.topics=s.topics;q.errorTypes=s.errorTypes;q.errorDetails=s.errorDetails;q.specialTags=s.specialTags;q.starred=s.starred;q.questionText=s.questionText;q.answerText=s.answerText;q.reviewSolvable=s.reviewSolvable;q.note=s.note;q.noteHidden=false;q.ts=Date.now();
      syncExamResultsFromAnswers(exam);
      autoStarCorrectQuestion(q);
      save();closeModal();
      if(currentExamId===examId)renderExamOverlay();
      renderExamSection();toast('✓ ذخیره شد');
    };
  }
  openModal('');render();
}

/* ============ KEYBOARD ============ */
document.addEventListener('keydown',(e)=>{
  if(document.getElementById('examOverlay').style.display!=='block')return;
  if(!examKeyboardMode)return;
  if(examMainTab!=='analysis'||!examAnswerMode)return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'))return;
  if(document.getElementById('modalBackdrop').classList.contains('show'))return;
  const exam=state.exams.find(x=>x.id===currentExamId);if(!exam)return;
  const sorted=getSortedQuestions(exam);if(!sorted.length)return;
  const refreshInputState=()=>{
    const box=document.getElementById('examAnalysisBody');
    if(box&&typeof box.refreshExamInputState==='function')box.refreshExamInputState();
  };
  let action=null;
  if(e.code==='Digit1'||e.code==='Numpad1')action='blank';
  else if(e.code==='Digit2'||e.code==='Numpad2')action='wrong';
  else if(e.code==='Digit3'||e.code==='Numpad3')action='correct';
  else if(e.code==='ArrowUp'){examCursorIndex=Math.max(0,examCursorIndex-1);refreshInputState();e.preventDefault();return;}
  else if(e.code==='ArrowDown'){examCursorIndex=Math.min(sorted.length-1,examCursorIndex+1);refreshInputState();e.preventDefault();return;}
  if(!action)return;e.preventDefault();
  const q=sorted[examCursorIndex];if(!q)return;
  q.status=action;if(action==='correct'){q.errorTypes=[];q.errorDetails={};q.reviewSolvable=null;}q.ts=Date.now();
  if(examCursorIndex<sorted.length-1)examCursorIndex++;
  syncExamResultsFromAnswers(exam);save();refreshInputState();
});

/* ============ RESULTS MODAL ============ */
function openExamResultsModal(id){
  const exam=state.exams.find(e=>e.id===id);if(!exam)return;
  const examSubjects=state.subjects.filter(s=>s.type==='specialized');
  const subjData=exam.subjects||{};const values={};
  examSubjects.forEach(s=>{const d=subjData[s.name]||{};values[s.name]={correct:d.correct!=null?String(d.correct):'',wrong:d.wrong!=null?String(d.wrong):'',blank:d.blank!=null?String(d.blank):'',taraz:d.taraz!=null?String(d.taraz):''};});
  openModal(`<div class="modal-head"><div class="card-title text-amber">📊 ثبت نتیجه آزمون</div><button class="icon-btn" data-close>✕</button></div><div class="wr-scroll"><table class="results-table"><thead><tr><th>درس</th><th>درست</th><th>غلط</th><th>نزده</th><th>درصد</th><th>تراز</th></tr></thead><tbody id="exResBody"></tbody><tfoot><tr class="total-row"><td class="text-amber">کل</td><td id="exTotC" class="text-ok">۰</td><td id="exTotW" class="text-rose">۰</td><td id="exTotB" class="text-soft">۰</td><td colspan="2">—</td></tr></tfoot></table></div><div id="exResultMismatchStatus"></div><div class="grid2 mt-12"><div><label class="lbl">تراز کل</label><input class="input" type="number" id="exTotalTaraz" value="${exam.totalTaraz!=null?exam.totalTaraz:''}" placeholder="مثلاً 6000"></div><div><label class="lbl">شرکت‌کننده</label><input class="input" type="number" id="exParts" value="${exam.participants!=null?exam.participants:''}" placeholder="مثلاً 50000"></div></div><div class="grid2 mt-12"><div><label class="lbl">رتبه کشوری</label><input class="input" type="number" id="exRankC" value="${exam.rankCountry!=null?exam.rankCountry:(exam.rank!=null?exam.rank:'')}"></div><div><label class="lbl">رتبه منطقه</label><input class="input" type="number" id="exRankR" value="${exam.rankRegion!=null?exam.rankRegion:''}"></div></div><button class="btn primary gold mt-18" id="exResSave">ذخیره</button>`);
  const renderBody=()=>{
    document.getElementById('exResBody').innerHTML=examSubjects.map(s=>{
      const v=values[s.name];const c=+v.correct||0,w=+v.wrong||0,b=+v.blank||0;const pct=examPctFromCounts(c,w,b,true);
      return`<tr><td>${esc(s.name)}</td><td><input class="ex-subj" type="number" min="0" data-subj="${esc(s.name)}" data-field="correct" value="${v.correct}" placeholder="—"></td><td><input class="ex-subj" type="number" min="0" data-subj="${esc(s.name)}" data-field="wrong" value="${v.wrong}" placeholder="—"></td><td><input class="ex-subj" type="number" min="0" data-subj="${esc(s.name)}" data-field="blank" value="${v.blank}" placeholder="—"></td><td class="text-cyan fw-800">${pct==null?'—':fa(Math.round(pct))+'٪'}</td><td><input class="ex-subj" type="number" min="0" data-subj="${esc(s.name)}" data-field="taraz" value="${v.taraz}" placeholder="—"></td></tr>`;
    }).join('');
    attach();
  };
  const attach=()=>{document.querySelectorAll('#exResBody .ex-subj').forEach(inp=>{inp.oninput=()=>{const row=inp.closest('tr');const sj=inp.dataset.subj;const fields=row.querySelectorAll('.ex-subj');values[sj]={correct:fields[0].value,wrong:fields[1].value,blank:fields[2].value,taraz:fields[3].value};const c=+fields[0].value||0,w=+fields[1].value||0,b=+fields[2].value||0;const pct=examPctFromCounts(c,w,b,true);row.children[4].textContent=pct==null?'—':fa(Math.round(pct))+'٪';updateTotals();};});};
  const updateMismatchWarning=()=>{
    const results={};
    examSubjects.forEach(subject=>{
      const value=values[subject.name];
      results[subject.name]={correct:value.correct,wrong:value.wrong,blank:value.blank};
    });
    document.getElementById('exResultMismatchStatus').innerHTML=examResultMismatchHTML(exam,results);
  };
  const updateTotals=()=>{let c=0,w=0,b=0;document.querySelectorAll('#exResBody .ex-subj').forEach(inp=>{const f=inp.dataset.field;const v=+inp.value||0;if(f==='correct')c+=v;else if(f==='wrong')w+=v;else if(f==='blank')b+=v;});document.getElementById('exTotC').textContent=fa(c);document.getElementById('exTotW').textContent=fa(w);document.getElementById('exTotB').textContent=fa(b);updateMismatchWarning();};
  renderBody();updateTotals();
  document.getElementById('exResSave').onclick=()=>{
    const subjects={};
    examSubjects.forEach(s=>{const v=values[s.name];if((v.correct||'').toString().trim()||(v.wrong||'').toString().trim()||(v.blank||'').toString().trim()||(v.taraz||'').toString().trim())subjects[s.name]={correct:+v.correct||0,wrong:+v.wrong||0,blank:+v.blank||0,taraz:v.taraz!==''?+v.taraz:null};});
    exam.subjects=subjects;exam.hasResults=Object.keys(subjects).length>0;exam.includedSubjects=examSubjects.map(s=>s.name);exam.resultsSource='manual';
    const t=document.getElementById('exTotalTaraz').value.trim();exam.totalTaraz=t!==''?+t:null;
    const p=document.getElementById('exParts').value.trim();exam.participants=p!==''?+p:null;
    const rc=document.getElementById('exRankC').value.trim();exam.rankCountry=rc!==''?+rc:null;
    const rr2=document.getElementById('exRankR').value.trim();exam.rankRegion=rr2!==''?+rr2:null;
    save();closeModal();renderExamOverlay();renderExamSection();renderDashboard();toast('ذخیره شد ✓');
  };
}

function openAddQuestionsModal(id){
  const exam=state.exams.find(e=>e.id===id);if(!exam)return;
  const examSubjects=state.subjects.filter(s=>s.type==='specialized');
  const counts={};examSubjects.forEach(s=>counts[s.name]=s.defaultQ||30);
  openModal(`<div class="modal-head"><div class="card-title">افزودن سوالات</div><button class="icon-btn" data-close>✕</button></div><div id="aqSubs" class="mt-6"></div><div class="row mt-16"><button class="btn ghost" data-close>انصراف</button><button class="btn primary" id="aqSave">ساخت</button></div>`);
  const box=document.getElementById('aqSubs');
  box.innerHTML=examSubjects.map(s=>`<div class="aq-row" style="border-color:${s.color}30;background:${s.color}06"><span class="es-dot" style="background:${s.color}"></span><span class="aq-subj" style="color:${s.color}">${esc(s.name)}</span><input type="number" min="0" max="200" class="aq-count" data-subj="${esc(s.name)}" value="${counts[s.name]||0}"><span class="aq-unit">سوال</span></div>`).join('');
  box.querySelectorAll('.aq-count').forEach(inp=>inp.oninput=()=>{counts[inp.dataset.subj]=Math.max(0,Math.min(200,+inp.value||0));});
  document.getElementById('aqSave').onclick=()=>{
    let globalNum=Math.max(0,...exam.questions.map(q=>q.number))+1;
    examSubjects.forEach(subj=>{const n=counts[subj.name]||0;const topics=exam.topics&&exam.topics[subj.name]||[];const grade=topics.length===1?topicGrade(subj.name,topics[0]):'';for(let i=0;i<n;i++)exam.questions.push({id:uid(),subject:subj.name,number:globalNum++,grade,topics:topics.slice(),status:'pending',errorTypes:[],errorDetails:{},specialTags:[],starred:false,questionText:'',answerText:'',reviewSolvable:null,figureRef:'',note:'',noteHidden:false,ts:Date.now()});});
    exam.includedSubjects=examSubjects.map(s=>s.name);
    save();closeModal();renderExamOverlay();renderExamSection();toast('سوالات اضافه شد');
  };
}

/* ⭐ شنونده تب آزمون‌ها / تحلیل آزمون */
document.querySelectorAll('#examModeSeg .seg-btn').forEach(btn=>{
  btn.onclick=()=>{
    examViewMode=btn.dataset.emode;
    applyExamViewMode();
  };
});


/* ============================================================
   EXAM — analysis, compare and charts
   ============================================================ */
/* ============================================================
   EXAM EXTRA — Global Analysis (به‌عنوان تب داخل سکشن آزمون)
   نسخه ۱.۰.۰ — خروج از overlay، فیلتر جدید سوالات دارای نکته/صورت/پاسخ
   ============================================================ */

/* ============ GLOBAL ANALYSIS ============ */
/* ⭐ NEW: فقط سوالاتی که نکته، صورت سوال، یا پاسخ دارن نمایش داده می‌شن */
function qHasAnalysisContent(q){
  if(!q)return false;
  if(q.note&&q.note.trim())return true;
  if(q.questionText&&q.questionText.trim())return true;
  if(q.answerText&&q.answerText.trim())return true;
  return false;
}

function renderGlobalAnalysis(){
  const body=document.getElementById('gaBody');if(!body)return;
  const spec=specializedSubjectNames();
  const allQs=[];
  state.exams.forEach(exam=>{
    if(!Array.isArray(exam.questions))return;
    exam.questions.forEach(q=>{
      if(!spec.includes(q.subject))return;
      if(qStatus(q)==='pending')return;
      /* ⭐ فیلتر جدید: تنها سوالاتی که نکته/صورت/پاسخ دارن */
      if(!qHasAnalysisContent(q))return;
      allQs.push({...q,_examId:exam.id,_examName:exam.name,_examDate:exam.date});
    });
  });
  document.getElementById('gaSub').textContent=`${fa(state.exams.length)} آزمون • ${fa(allQs.length)} سوال تحلیل‌شده`;
  if(!allQs.length){body.innerHTML='<div class="empty-state ga-empty-state"><b>هنوز سوالی تحلیل نشده</b><span>برای هر سوال یک نکته، صورت سوال، یا پاسخ صحیح ثبت کن تا در این بخش نمایش داده شود.</span></div>';return;}
  const f=window._gaFilter||(window._gaFilter={exam:'', subject:'', grade:'', topic:'', statuses:new Set(), error:'', specialTag:'', showStarred:false, showHasNote:false, showHasQuestion:false});
  let qs=allQs;
  if(f.exam)qs=qs.filter(q=>q._examId===f.exam);
  if(f.subject)qs=qs.filter(q=>q.subject===f.subject);
  if(f.grade)qs=qs.filter(q=>q.grade===f.grade);
  if(f.topic)qs=qs.filter(q=>q.topics.includes(f.topic));
  if(f.statuses.size)qs=qs.filter(q=>f.statuses.has(qStatus(q)));
  if(f.showStarred) qs=qs.filter(q=>q.starred);
  if(f.showHasNote) qs=qs.filter(q=>q.note && q.note.trim());
  if(f.showHasQuestion) qs=qs.filter(q=>q.questionText && q.questionText.trim());
  if(f.error==='none'){qs=qs.filter(q=>(!q.errorTypes||!q.errorTypes.length)&&(!q.specialTags||!q.specialTags.length));}
  else if(f.error){qs=qs.filter(q=>q.errorTypes&&q.errorTypes.includes(f.error));}
  if(f.specialTag) qs=qs.filter(q=>q.specialTags && q.specialTags.includes(f.specialTag));

  let html='<div class="flt-card">';
  html+=`<div class="flt-section"><div class="flt-label">آزمون</div><div class="flt-chips wrap"><div class="flt-chip ${!f.exam?'active':''}" data-f="exam" data-v="">همه</div>${state.exams.map(e=>`<div class="flt-chip ${f.exam===e.id?'active':''}" data-f="exam" data-v="${e.id}">${esc(e.name)}</div>`).join('')}</div></div>`;
  const allSubs=[...new Set(allQs.map(q=>q.subject))];
  html+=`<div class="flt-section"><div class="flt-label">درس</div><div class="flt-chips wrap"><div class="flt-chip ${!f.subject?'active':''}" data-f="subject" data-v="">همه</div>${allSubs.map(s=>`<div class="flt-chip ${f.subject===s?'active':''}" data-f="subject" data-v="${esc(s)}"><span class="dot" style="background:${subjColor(s)}"></span>${esc(s)}</div>`).join('')}</div></div>`;
  const grades=[...new Set(allQs.map(q=>q.grade).filter(Boolean))];
  if(grades.length)html+=`<div class="flt-section"><div class="flt-label">پایه</div><div class="flt-chips"><div class="flt-chip ${!f.grade?'active':''}" data-f="grade" data-v="">همه</div>${grades.map(g=>`<div class="flt-chip ${f.grade===g?'active':''}" data-f="grade" data-v="${g}">${g}</div>`).join('')}</div></div>`;
  const allTopics=[...new Set(allQs.flatMap(q=>q.topics))];
  if(allTopics.length)html+=`<div class="flt-section"><div class="flt-label">مبحث</div><div class="flt-chips wrap"><div class="flt-chip ${!f.topic?'active':''}" data-f="topic" data-v="">همه</div>${allTopics.map(t=>`<div class="flt-chip ${f.topic===t?'active':''}" data-f="topic" data-v="${esc(t)}">${esc(t.length>22?t.slice(0,22)+'…':t)}</div>`).join('')}</div></div>`;
  html+=`<div class="flt-section"><div class="flt-label">وضعیت</div><div class="flt-chips">${['wrong','blank','correct'].map(s=>`<div class="flt-chip ${f.statuses.has(s)?'active':''}" data-st="${s}">${STATUS_LABEL[s]}</div>`).join('')}</div></div>`;
  html+=`<div class="flt-section"><div class="flt-label">ویژگی سوال</div><div class="flt-chips wrap"><div class="flt-chip ${f.showStarred?'active':''}" data-quick="starred">⭐ ستاره‌دار</div><div class="flt-chip ${f.showHasNote?'active':''}" data-quick="hasNote">💡 نکته‌دار</div><div class="flt-chip ${f.showHasQuestion?'active':''}" data-quick="hasQuestion">📋 سوال‌دار</div></div></div>`;
  const common=state.commonErrors;
  const chip=(e)=>{const c=errColor(e.id);const on=f.error===e.id;return`<div class="flt-chip ${on?'active':''}" data-f="error" data-v="${e.id}" style="${on?'':'border-color:'+c+'44;background:'+c+'0e;color:'+c}"><span class="dot" style="background:${c}"></span>${esc(e.label)}</div>`;};
  html+=`<div class="flt-section"><div class="flt-label">تگ‌های عمومی</div><div class="flt-chips wrap"><div class="flt-chip ${!f.error?'active':''}" data-f="error" data-v="">همه</div><div class="flt-chip ${f.error==='none'?'active':''}" data-f="error" data-v="none">بدون تگ</div>${common.map(chip).join('')}</div></div>`;
  const specialTagsForFilter=[];
  state.subjects.forEach(s=>{if(Array.isArray(s.specialTags)&&(!f.subject||f.subject===s.name)){s.specialTags.forEach(t=>specialTagsForFilter.push({...t,subjectName:s.name}));}});
  if(specialTagsForFilter.length){
    html+=`<div class="flt-section"><div class="flt-label">تگ‌های تخصصی</div><div class="flt-chips wrap"><div class="flt-chip ${!f.specialTag?'active':''}" data-special="">همه</div>${specialTagsForFilter.map(t=>`<div class="flt-chip ${f.specialTag===t.id?'active':'violet'}" data-special="${t.id}">🏷️ ${esc(t.label)}</div>`).join('')}</div></div>`;
  }
  html+='</div>';
  html+=`<div class="ga-result-summary">${fa(qs.length)} مورد • ${fa(qs.filter(q=>qStatus(q)==='wrong').length)} غلط • ${fa(qs.filter(q=>qStatus(q)==='blank').length)} نزده</div>`;
  if(!qs.length)html+='<div class="empty-state"><b>سوالی نیست</b></div>';
  else{
    qs.sort((a,b)=>{if(a._examDate!==b._examDate)return a._examDate<b._examDate?1:-1;return a.number-b.number;});
    html+='<div class="d-flex flex-col gap-8">';
    html+=qs.map(q=>{
      const st=qStatus(q);const color=subjColor(q.subject);
      const tagRelevant=st==='wrong'||st==='blank';
      const errsAll=(q.errorTypes||[]).map(t=>({id:t,label:errLabel(t),color:errColor(t)})).filter(x=>getErr(x.id));

      const subTagsShow=[];
      if(q.errorDetails){
        Object.entries(q.errorDetails).forEach(([tagId, subs])=>{
          if(!Array.isArray(subs)||!subs.length) return;
          const tag = getErr(tagId);
          if(!tag || !tag.subOptions) return;
          subs.forEach(sid=>{
            const opt = tag.subOptions.find(o=>o.id===sid);
            if(opt) subTagsShow.push(`<span class="ac-err slate">${esc(tag.label)}: ${esc(opt.label)}</span>`);
          });
        });
      }
      let solvableBadge='';
      if(tagRelevant && q.reviewSolvable !== null){
        solvableBadge = q.reviewSolvable
          ? `<span class="ac-err ok">🎯 قابل حل</span>`
          : `<span class="ac-err bad">🎯 غیرقابل حل</span>`;
      }
      const specialTagsHtml=(q.specialTags||[]).map(tid=>{const tag=getErr(tid);if(!tag)return'';return `<span class="ac-err violet">⭐ ${esc(tag.label)}</span>`;}).join('');
      const starBadge = q.starred ? '<span class="ac-err star">⭐</span>' : '';
      const hasQ = q.questionText && q.questionText.trim();
      const hasA = q.answerText && q.answerText.trim();
      let qaBlock = '';
      if(hasQ){qaBlock += `<div class="ac-question-block"><div class="ac-q-label">📋 سوال</div><div class="ac-q-text">${esc(q.questionText)}</div></div>`;}
      if(hasA){qaBlock += `<button type="button" class="ac-show-answer" data-show-answer="${q.id}">👁️ نمایش پاسخ</button><div class="ac-answer-content hidden" data-answer-for="${q.id}">${esc(q.answerText)}</div>`;}
      return`<div class="analysis-card" data-qid="${q.id}" data-exam-id="${q._examId}">
        <div class="ac-head">
          ${starBadge}
          <span class="ac-num" style="background:linear-gradient(135deg,${color},${color}aa)">${fa(q.number)}</span>
          <span class="ac-subj" style="color:${color}">${esc(q.subject)}</span>
          ${q.grade?`<span class="ac-grade">${esc(q.grade)}</span>`:''}
          <span class="ac-topic">${esc(q.topics.join(' + ')||'بدون مبحث')}</span>
          <span class="st ${st}">${STATUS_LABEL[st]}</span>
          <button type="button" class="ac-edit-btn" data-edit-qid="${q.id}" data-edit-exam="${q._examId}" title="ویرایش">✎</button>
        </div>
        <div class="ac-exam-line">📝 ${esc(q._examName)}</div>
        ${tagRelevant&&(errsAll.length||specialTagsHtml||subTagsShow.length||solvableBadge)?`<div class="ac-errs">${errsAll.length?`<span class="ac-err-group">عمومی</span>${errsAll.map(e=>`<span class="ac-err" style="color:${e.color};border-color:${e.color}66;background:${e.color}18">${esc(e.label)}</span>`).join('')}`:''}${solvableBadge}${subTagsShow.join('')}${specialTagsHtml?`<span class="ac-err-group">تخصصی</span>${specialTagsHtml}`:''}</div>`:''}
        ${qaBlock}
        ${q.note&&q.note.trim()?`<div class="ac-note">${esc(q.note)}</div>`:''}
      </div>`;
    }).join('');
    html+='</div>';
  }
  body.innerHTML=html;
  body.querySelectorAll('[data-f]').forEach(chipEl=>{chipEl.onclick=()=>{const key=chipEl.dataset.f;const val=chipEl.dataset.v;f[key]=val;if(key==='subject'){f.error='';f.topic='';f.grade='';f.specialTag='';}renderGlobalAnalysis();};});
  body.querySelectorAll('[data-st]').forEach(chipEl=>{chipEl.onclick=()=>{const s=chipEl.dataset.st;if(f.statuses.has(s))f.statuses.delete(s);else f.statuses.add(s);renderGlobalAnalysis();};});
  body.querySelectorAll('[data-quick]').forEach(chipEl=>{chipEl.onclick=()=>{const k=chipEl.dataset.quick;if(k==='starred')f.showStarred=!f.showStarred;else if(k==='hasNote')f.showHasNote=!f.showHasNote;else if(k==='hasQuestion')f.showHasQuestion=!f.showHasQuestion;renderGlobalAnalysis();};});
  body.querySelectorAll('[data-special]').forEach(chipEl=>{chipEl.onclick=()=>{f.specialTag=chipEl.dataset.special;renderGlobalAnalysis();};});
  body.querySelectorAll('[data-show-answer]').forEach(btn=>{btn.onclick=(e)=>{e.stopPropagation();const ansEl=body.querySelector(`[data-answer-for="${btn.dataset.showAnswer}"]`);if(ansEl)ansEl.classList.toggle('hidden');};});
  body.querySelectorAll('[data-edit-qid]').forEach(btn=>{btn.onclick=(e)=>{e.stopPropagation();openQuestionNoteEditor(btn.dataset.editExam,btn.dataset.editQid);};});
  body.querySelectorAll('.analysis-card').forEach(card=>{card.onclick=(e)=>{if(e.target.closest('button,[data-show-answer]'))return;openQuestionNoteEditor(card.dataset.examId,card.dataset.qid);};});
}

/* ============ EXAM COMPARE ============ */
function getExamChartData(){
  return state.exams
    .filter((e)=>e.hasResults&&(e.totalTaraz!=null||(e.subjects&&Object.keys(e.subjects).length)))
    .sort((a,b)=>jdnFromKey(a.date)-jdnFromKey(b.date));
}

function openExamCompare(){
  if(!state.settings.examsEnabled){toast('اول آزمون را فعال کن');return;}
  document.getElementById('examCompareOverlay').classList.add('show');
  document.body.style.overflow='hidden';
  renderExamCompare();
}
document.getElementById('examCompareClose').onclick=()=>{document.getElementById('examCompareOverlay').classList.remove('show');document.body.style.overflow='';};

function renderExamCompare(){
  const exams=getExamChartData();
  const sub=document.getElementById('examCompareSub');
  if(sub)sub.textContent=exams.length?`${fa(exams.length)} آزمون`:'—';
  const body=document.getElementById('examCompareBody');
  if(!exams.length){body.innerHTML=`<div class="exam-empty-state"><b>هنوز نتیجه‌ای ثبت نکردی</b></div>`;return;}
  const totalTarazs=exams.map((e)=>+e.totalTaraz||0);
  const firstTaraz=totalTarazs[0];const lastTaraz=totalTarazs[totalTarazs.length-1];const delta=lastTaraz-firstTaraz;
  body.innerHTML=`
    <div class="exam-compare-toolbar"><div><b>روند آزمون‌ها</b><span>تغییرات تراز کل و هر درس را کنار هم ببین</span></div><button class="btn" id="exportExamCompareImage">🖼 خروجی تصویری</button></div>
    <div class="card exam-compare-summary">
      <div class="exam-progress cols-3">
        <div><span>تراز اول</span><b class="text-soft">${fa(Math.round(firstTaraz))}</b></div>
        <div><span>تراز آخر</span><b class="text-amber">${fa(Math.round(lastTaraz))}</b></div>
        <div><span>پیشرفت</span><b style="color:${delta>0?'#6ee7b7':delta<0?'#fda4af':'#cbd3e8'}">${delta>0?'+':''}${fa(Math.round(Math.abs(delta)))}</b></div>
      </div>
      <div class="exam-charts-row">
        <div class="exam-compare-chart"><div class="card-title">📈 تراز کل</div><div class="exam-compare-chart-frame">${renderExamTotalChartSVG(exams)}</div></div>
        <div class="exam-compare-chart"><div class="card-title">📊 تراز دروس</div><div class="exam-compare-chart-frame">${renderExamAllSubjectsChartSVG(exams)}</div></div>
      </div>
    </div>
    <div class="exam-compare-section-title"><b>📋 جزئیات هر آزمون</b><span>درصدها و تعداد پاسخ‌ها</span></div>
    ${renderExamDetailsHTML(exams)}
    <div class="exam-compare-section-title"><b>📋 جدول مقایسه</b><span>درصد هر درس در آزمون‌های ثبت‌شده</span></div>
    ${renderExamListTable(exams)}
  `;
  document.getElementById('exportExamCompareImage').onclick=exportExamCompareImage;
  body.querySelectorAll('[data-ex-edit]').forEach((b)=>{b.onclick=()=>openExamSettingsModal(b.dataset.exEdit);});
}

async function exportExamCompareImage(){
  const exams=getExamChartData();
  if(!exams.length){toast('نتیجه‌ای برای خروجی وجود ندارد.');return;}
  try{
    if(document.fonts){
      await document.fonts.load('800 42px Vazirmatn');
      await document.fonts.ready;
    }
    const subjects=state.subjects.filter(s=>s.type==='specialized'&&exams.some(e=>e.subjects&&e.subjects[s.name]));
    const rowHeight=48,tableTop=720,tableHeight=90+exams.length*rowHeight;
    const canvas=document.createElement('canvas');
    canvas.width=1400;canvas.height=tableTop+tableHeight+80;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('ساخت تصویر در این مرورگر پشتیبانی نمی‌شود.');
    const bg=ctx.createLinearGradient(0,0,1400,canvas.height);
    bg.addColorStop(0,'#111936');bg.addColorStop(1,'#070b18');
    ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='rgba(124,92,255,.13)';ctx.beginPath();ctx.arc(1320,55,220,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(34,211,238,.08)';ctx.beginPath();ctx.arc(60,canvas.height-20,240,0,Math.PI*2);ctx.fill();
    ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#fcd34d';
    ctx.font='800 42px Vazirmatn,Tahoma,sans-serif';ctx.fillText('مقایسه آزمون‌ها',1340,76);
    ctx.fillStyle='#aab4cf';ctx.font='500 22px Vazirmatn,Tahoma,sans-serif';
    ctx.fillText(profileLabel(),1340,116);
    const totalTarazs=exams.map(e=>e.totalTaraz).filter(value=>value!=null&&Number.isFinite(+value)).map(Number);
    const first=totalTarazs[0]??0,last=totalTarazs[totalTarazs.length-1]??0,delta=last-first;
    const averageTaraz=totalTarazs.length?totalTarazs.reduce((sum,value)=>sum+value,0)/totalTarazs.length:null;
    const stats=[
      {label:'تعداد آزمون',value:fa(exams.length),color:'#c7bfff'},
      {label:'میانگین تراز',value:averageTaraz==null?'—':fa(Math.round(averageTaraz)),color:'#fcd34d'},
      {label:'پیشرفت تراز',value:delta>0?`+${fa(Math.round(delta))}`:fa(Math.round(delta)),color:delta>0?'#6ee7b7':delta<0?'#fda4af':'#cbd3e8'}
    ];
    stats.forEach((s,i)=>{
      const x=960-i*400;
      ctx.fillStyle='rgba(255,255,255,.055)';ctx.fillRect(x,145,360,104);
      ctx.fillStyle='#8b94ad';ctx.font='600 18px Vazirmatn,Tahoma,sans-serif';ctx.fillText(s.label,x+330,181);
      ctx.fillStyle=s.color;ctx.font='800 32px Vazirmatn,Tahoma,sans-serif';ctx.fillText(s.value,x+330,229);
    });
    const drawChart=(box,title,series,colors)=>{
      const {x,y,w,h}=box;
      const legendRows=Math.max(1,Math.ceil(series.length/3));
      const plot={left:x+54,right:x+w-24,top:y+48,bottom:y+h-legendRows*18-48};
      ctx.fillStyle='rgba(255,255,255,.035)';ctx.fillRect(x,y,w,h);
      ctx.strokeStyle='rgba(255,255,255,.08)';ctx.strokeRect(x,y,w,h);
      ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#fcd34d';
      ctx.font='700 20px Vazirmatn,Tahoma,sans-serif';ctx.fillText(title,x+w-20,y+30);
      const vals=series.flatMap(s=>s.values.filter(v=>v!=null));
      if(!vals.length){ctx.fillStyle='#8b94ad';ctx.font='16px Vazirmatn,Tahoma,sans-serif';ctx.fillText('ترازی ثبت نشده',x+w-20,y+90);return;}
      const min=Math.min(...vals),max=Math.max(...vals),span=Math.max(300,max-min),low=Math.max(0,min-span*.12),high=max+span*.12;
      for(let i=0;i<5;i++){
        const yy=plot.top+i*(plot.bottom-plot.top)/4;
        ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(plot.left,yy);ctx.lineTo(plot.right,yy);ctx.stroke();
        ctx.fillStyle='#8b94ad';ctx.font='12px Vazirmatn,Tahoma,sans-serif';ctx.textAlign='left';ctx.fillText(fa(Math.round(high-i*(high-low)/4)),x+8,yy+4);
      }
      series.forEach((item,si)=>{
        let started=false;ctx.strokeStyle=colors[si%colors.length];ctx.lineWidth=3;ctx.beginPath();
        item.values.forEach((v,i)=>{
          if(v==null){started=false;return;}
          const px=plot.left+(exams.length===1?.5:i/(exams.length-1))*(plot.right-plot.left);
          const py=plot.bottom-((v-low)/(high-low))*(plot.bottom-plot.top);
          if(!started){ctx.moveTo(px,py);started=true;}else ctx.lineTo(px,py);
        });
        ctx.stroke();
        item.values.forEach((v,i)=>{
          if(v==null)return;
          const px=plot.left+(exams.length===1?.5:i/(exams.length-1))*(plot.right-plot.left);
          const py=plot.bottom-((v-low)/(high-low))*(plot.bottom-plot.top);
          ctx.fillStyle='#0b1022';ctx.strokeStyle=colors[si%colors.length];ctx.lineWidth=2;
          ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();ctx.stroke();
        });
      });
      exams.forEach((e,i)=>{
        const xx=plot.left+(exams.length===1?.5:i/(exams.length-1))*(plot.right-plot.left),date=parseKey(e.date);
        ctx.fillStyle='#8b94ad';ctx.font='11px Vazirmatn,Tahoma,sans-serif';ctx.textAlign='center';ctx.fillText(`${fa(date.jd)} ${MONTHS[date.jm-1].slice(0,3)}`,xx,plot.bottom+22);
      });
      const legendLeft=x+12,legendTop=plot.bottom+43,legendWidth=(w-24)/3;
      const ellipsize=(text,maxWidth)=>{
        let value=String(text);
        while(value&&ctx.measureText(value+'…').width>maxWidth)value=value.slice(0,-1);
        return value===text?value:value+'…';
      };
      ctx.save();
      ctx.beginPath();ctx.rect(legendLeft,plot.bottom+30,w-24,legendRows*18+10);ctx.clip();
      ctx.direction='rtl';ctx.textAlign='right';ctx.font='12px Vazirmatn,Tahoma,sans-serif';
      series.forEach((item,i)=>{
        const col=i%3,row=Math.floor(i/3);
        const right=x+w-18-col*legendWidth;
        const yy=legendTop+row*18;
        ctx.fillStyle=colors[i%colors.length];ctx.fillRect(right-10,yy-8,10,3);
        ctx.fillStyle='#cbd3e8';
        ctx.fillText(ellipsize(item.name,legendWidth-30),right-16,yy,legendWidth-30);
      });
      ctx.restore();
    };
    drawChart({x:60,y:280,w:620,h:360},'مقایسه تراز کل',[{name:'تراز کل',values:exams.map(e=>e.totalTaraz==null?null:+e.totalTaraz)}],['#eab308']);
    drawChart({x:720,y:280,w:620,h:360},'مقایسه تراز دروس',subjects.map(s=>({name:s.name,values:exams.map(e=>e.subjects&&e.subjects[s.name]&&e.subjects[s.name].taraz!=null?+e.subjects[s.name].taraz:null)})),subjects.map(s=>s.color));
    const left=60,right=1340,width=right-left,nameW=250,lastW=160,subjectW=(width-nameW-lastW)/Math.max(1,subjects.length);
    ctx.fillStyle='#fcd34d';ctx.direction='rtl';ctx.textAlign='right';ctx.font='800 23px Vazirmatn,Tahoma,sans-serif';
    ctx.fillText('مقایسه درصد آزمون‌ها',right,tableTop-22);
    const headers=['آزمون',...subjects.map(s=>s.name),'تراز کل'];
    const colWidths=[nameW,...subjects.map(()=>subjectW),lastW];
    let cur=right;
    headers.forEach((label,i)=>{
      const cw=colWidths[i];ctx.fillStyle='rgba(234,179,8,.15)';ctx.fillRect(cur-cw,tableTop,cw,42);
      ctx.strokeStyle='rgba(255,255,255,.08)';ctx.strokeRect(cur-cw,tableTop,cw,42);
      ctx.fillStyle=i===0||i===headers.length-1?'#fcd34d':subjColor(subjects[i-1].name);
      ctx.direction='rtl';ctx.textAlign='center';ctx.font='700 14px Vazirmatn,Tahoma,sans-serif';ctx.fillText(label,cur-cw/2,tableTop+27,Math.max(30,cw-8));
      cur-=cw;
    });
    exams.forEach((exam,row)=>{
      const y=tableTop+42+row*rowHeight;
      ctx.fillStyle=row%2?'rgba(255,255,255,.025)':'rgba(255,255,255,.055)';
      ctx.fillRect(left,y,width,rowHeight);
      let x=right;
      const j=parseKey(exam.date);
      const values=[`${exam.name} • ${fa(j.jd)} ${MONTHS[j.jm-1]}`,
        ...subjects.map(s=>{
          const d=exam.subjects&&exam.subjects[s.name];
          const pct=d?examPctFromCounts(d.correct,d.wrong,d.blank,true):null;
          return pct==null?'—':`${fa(Math.round(pct))}٪`;
        }),
        exam.totalTaraz==null?'—':fa(Math.round(exam.totalTaraz))];
      values.forEach((value,i)=>{
        const cw=colWidths[i];ctx.strokeStyle='rgba(255,255,255,.07)';ctx.strokeRect(x-cw,y,cw,rowHeight);
        ctx.fillStyle=i===0?'#cbd3e8':i===headers.length-1?'#fcd34d':subjColor(subjects[i-1].name);
        ctx.direction='rtl';ctx.textAlign='center';ctx.font='600 14px Vazirmatn,Tahoma,sans-serif';ctx.fillText(value,x-cw/2,y+28,Math.max(30,cw-8));x-=cw;
      });
    });
    ctx.fillStyle='rgba(203,211,232,.5)';ctx.font='500 15px Vazirmatn,Tahoma,sans-serif';
    ctx.textAlign='right';ctx.fillText('مسیر کنکور',1340,canvas.height-28);
    ctx.textAlign='left';ctx.fillText('Made by MH.Mahdipanah',60,canvas.height-28);
    const link=document.createElement('a');
    link.href=canvas.toDataURL('image/png');link.download='moghayese-azmoon.png';
    document.body.appendChild(link);link.click();link.remove();
  }catch(error){
    console.error('[exam compare] image export failed:',error);
    toast(error.message||'خروجی تصویری ساخته نشد.');
  }
}

function renderExamAllSubjectsChartSVG(exams){
  const spec=state.subjects.filter(s=>s.type==='specialized');
  const subjects=spec.filter(s=>exams.some(e=>e.subjects&&e.subjects[s.name]&&e.subjects[s.name].taraz!=null));
  if(!subjects.length)return`<div class="exam-empty-state">تراز درسی ثبت نشده</div>`;
  const allVals=[];
  exams.forEach(e=>{if(e.subjects)Object.entries(e.subjects).forEach(([n,d])=>{if(!spec.find(s=>s.name===n))return;if(d.taraz!=null)allVals.push(+d.taraz);});});
  if(!allVals.length)return`<div class="exam-empty-state">—</div>`;
  const W=360,H=210,padX=56,padTop=22,padBot=46;const plotL=padX+6,plotR=W-padX;
  const minV=Math.min(...allVals),maxV=Math.max(...allVals);const range=Math.max(300,maxV-minV);const lo=Math.max(0,minV-range*0.15);const hi=maxV+range*0.15;
  const centerX=(plotL+plotR)/2;const maxSpan=plotR-plotL;const spacing=exams.length>1?maxSpan/Math.max(3,exams.length-1):0;
  const X=(i)=>centerX+(i-(exams.length-1)/2)*spacing;const Y=(v)=>H-padBot-((v-lo)/(hi-lo))*(H-padTop-padBot);
  let grid='';for(let i=0;i<=4;i++){const gy=padTop+i*(H-padTop-padBot)/4;const gv=Math.round(hi-i*(hi-lo)/4);grid+=`<line x1="${plotL}" y1="${gy}" x2="${plotR}" y2="${gy}" stroke="rgba(255,255,255,.06)" stroke-dasharray="3 5"/>`;grid+=`<text x="${padX-4}" y="${gy+3}" text-anchor="end" font-size="8.5" font-family="Vazirmatn,Tahoma" fill="#8b94ad">${fa(gv)}</text>`;}
  let lines='',dots='',labels='';
  subjects.forEach((s)=>{
    const points=exams.map((e,i)=>{const d=e.subjects?e.subjects[s.name]:null;return d&&d.taraz!=null?{x:X(i),y:Y(+d.taraz),v:+d.taraz}:null;});
    let seg=[];
    points.forEach((p)=>{if(p)seg.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);else if(seg.length){if(seg.length>1)lines+=`<polyline points="${seg.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;seg=[];}});
    if(seg.length>1)lines+=`<polyline points="${seg.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    points.forEach((p)=>{if(p)dots+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="#0b1022" stroke="${s.color}" stroke-width="2"/>`;});
  });
  exams.forEach((e,i)=>{const cx=X(i);const jd=parseKey(e.date);labels+=`<text x="${cx.toFixed(1)}" y="${H-36}" text-anchor="middle" font-size="8" font-family="Vazirmatn,Tahoma" fill="#8b94ad">${fa(jd.jd)} ${MONTHS[jd.jm-1].slice(0,4)}</text>`;});
  const legend=subjects.map(s=>`<span class="chart-legend-item"><span class="chart-legend-line" style="background:${s.color}"></span>${esc(s.name)}</span>`).join('');
  return`<svg viewBox="0 0 ${W} ${H}" class="exam-chart-svg">${grid}${lines}${dots}${labels}</svg><div class="mt-8 lh-19">${legend}</div>`;
}

function renderExamDetailsHTML(exams){
  const sorted=[...exams].sort((a,b)=>jdnFromKey(b.date)-jdnFromKey(a.date));
  return sorted.map((e)=>{
    const totals=examTotals(e);const names=examSubjectNames(e);
    const rows=names.map((name)=>{
      const d=e.subjects?e.subjects[name]:null;
      if(!d)return`<tr><td>${esc(name)}</td><td colspan="6" class="text-muted">—</td></tr>`;
      const c=+d.correct||0,w=+d.wrong||0,b=+d.blank||0;
      const pctRaw=examPctFromCounts(c,w,b,false);const pctNeg=examPctFromCounts(c,w,b,true);
      return`<tr><td>${esc(name)}</td><td class="text-ok">${fa(c)}</td><td class="text-rose">${fa(w)}</td><td class="text-soft">${fa(b)}</td><td class="text-cyan">${pctRaw==null?'—':fa(Math.round(pctRaw))+'٪'}</td><td class="text-amber">${pctNeg==null?'—':fa(Math.round(pctNeg))+'٪'}</td><td>${d.taraz!=null?fa(Math.round(d.taraz)):'—'}</td></tr>`;
    }).join('');
    const jd=parseKey(e.date);const jdn=jdnFromKey(e.date);
    return`<div class="card exam-compare-detail"><div class="exam-compare-detail-head"><div class="card-title">📝 ${esc(e.name)}</div><div class="muted">${DOW[dowIndex(jdn)]} ${fa(jd.jd)} ${MONTHS[jd.jm-1]}</div></div><div class="wr-scroll"><table class="exam-list-table minw-520"><thead><tr><th>درس</th><th>درست</th><th>غلط</th><th>نزده</th><th>بدون منفی</th><th>با منفی</th><th>تراز</th></tr></thead><tbody>${rows}<tr class="total-row"><td class="text-amber">کل</td><td class="text-ok">${fa(totals.c)}</td><td class="text-rose">${fa(totals.w)}</td><td class="text-soft">${fa(totals.b)}</td><td>—</td><td>—</td><td>${e.totalTaraz!=null?fa(Math.round(e.totalTaraz)):'—'}</td></tr></tbody></table></div></div>`;
  }).join('');
}

function renderExamTotalChartSVG(exams){
  const W=360,H=210,padX=56,padTop=22,padBot=46;const plotL=padX+6,plotR=W-padX;
  const vals=exams.map((e)=>+e.totalTaraz||0);
  const minV=Math.min(...vals),maxV=Math.max(...vals);
  const range=Math.max(400,maxV-minV);const lo=Math.max(0,minV-range*0.15);const hi=maxV+range*0.15;
  const centerX=(plotL+plotR)/2;const maxSpan=plotR-plotL;const spacing=exams.length>1?maxSpan/Math.max(3,exams.length-1):0;
  const X=(i)=>centerX+(i-(exams.length-1)/2)*spacing;const Y=(v)=>H-padBot-((v-lo)/(hi-lo))*(H-padTop-padBot);
  let grid='';for(let i=0;i<=4;i++){const gy=padTop+i*(H-padTop-padBot)/4;const gv=Math.round(hi-i*(hi-lo)/4);grid+=`<line x1="${plotL}" y1="${gy}" x2="${plotR}" y2="${gy}" stroke="rgba(255,255,255,.06)" stroke-dasharray="3 5"/>`;grid+=`<text x="${padX-4}" y="${gy+3}" text-anchor="end" font-size="8.5" font-family="Vazirmatn,Tahoma" fill="#8b94ad">${fa(gv)}</text>`;}
  const pts=exams.map((e,i)=>`${X(i).toFixed(1)},${Y(+e.totalTaraz||0).toFixed(1)}`).join(' ');
  let dots='',labels='';
  exams.forEach((e,i)=>{
    const cx=X(i),cy=Y(+e.totalTaraz||0);
    dots+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="#0b1022" stroke="#eab308" stroke-width="2.6"/>`;
    const anchor=i===0?'start':i===exams.length-1?'end':'middle';
    const vx=i===0?cx+8:i===exams.length-1?cx-3:cx;
    dots+=`<text x="${vx.toFixed(1)}" y="${(cy-12).toFixed(1)}" text-anchor="${anchor}" font-size="9.5" font-family="Vazirmatn,Tahoma" font-weight="800" fill="#fcd34d">${fa(+e.totalTaraz||0)}</text>`;
    const jd=parseKey(e.date);
    labels+=`<text x="${cx.toFixed(1)}" y="${H-24}" text-anchor="middle" font-size="8" font-family="Vazirmatn,Tahoma" fill="#8b94ad">${fa(jd.jd)} ${MONTHS[jd.jm-1].slice(0,4)}</text>`;
  });
  return`<svg viewBox="0 0 ${W} ${H}" class="exam-chart-svg"><defs><linearGradient id="examTotalGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#eab308"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient></defs>${grid}<polyline points="${pts}" fill="none" stroke="url(#examTotalGrad)" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}</svg>`;
}

function renderExamListTable(exams){
  const spec=state.subjects.filter(s=>s.type==='specialized');
  const subjNames=spec.map(s=>s.name).filter(n=>exams.some(e=>e.subjects&&e.subjects[n]!=null));
  const rows=exams.map((e,i)=>{
    const jd=parseKey(e.date);const jdn=jdnFromKey(e.date);
    const totals=examTotals(e);
    const tarazStr=e.totalTaraz!=null?fa(Math.round(e.totalTaraz)):'—';
    const rankC=e.rankCountry!=null?fa(e.rankCountry):(e.rank!=null?fa(e.rank):'—');
    const rankR=e.rankRegion!=null?fa(e.rankRegion):'—';
    const partStr=e.participants!=null?fa(e.participants):'—';
    const subjCells=subjNames.map(n=>{
      const d=e.subjects?e.subjects[n]:null;
      const pct=d?examPctFromCounts(d.correct,d.wrong,d.blank,true):null;
      const col=subjColor(n);
      return`<td class="fw-700" style="color:${col}">${pct==null?'—':fa(Math.round(pct))+'٪'}</td>`;
    }).join('');
    return`<tr><td>${fa(i+1)}. ${esc(e.name)}<br><span class="exam-date-sub">${DOW[dowIndex(jdn)]} ${fa(jd.jd)} ${MONTHS[jd.jm-1]}</span></td><td class="text-ok">${fa(totals.c)}</td><td class="text-rose">${fa(totals.w)}</td><td class="text-soft">${fa(totals.b)}</td>${subjCells}<td class="text-amber fw-800">${tarazStr}</td><td class="text-cyan">${rankC}</td><td class="text-ok">${rankR}</td><td class="text-soft">${partStr}</td><td><button class="li-edit gold" data-ex-edit="${e.id}">✎</button></td></tr>`;
  }).join('');
  const subjHeaders=subjNames.map(n=>`<th style="color:${subjColor(n)}">${esc(n)}</th>`).join('');
  return`<div class="wr-scroll"><table class="exam-list-table" style="min-width:${850+subjNames.length*62}px"><thead><tr><th>آزمون</th><th>درست</th><th>غلط</th><th>نزده</th>${subjHeaders}<th>تراز</th><th>رتبه ک</th><th>رتبه م</th><th>شرکت</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}