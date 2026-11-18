'use strict';

/* ============================================================
   OVERVIEW — optimized rendering (delegated events + mobile-only cards)
   ============================================================ */

let ovTab='specialized';
let ovMql=null;

function ovIsMobile(){ return window.matchMedia('(max-width:767px)').matches; }

/* روی دسکتاپ جدول باید کامل داخل کارت جا شود؛ اگر از ارتفاع/عرض کارت بیشتر شد
   با zoom کوچک می‌شود تا نه اسکرول افقی و نه عمودی ایجاد شود. */
let ovFitRAF=0;
function fitOverviewTable(){
  if(ovIsMobile())return;
  const scroll=document.querySelector('#view-overview .ov-scroll');
  const table=scroll&&scroll.querySelector('.ov-table');
  if(!scroll||!table)return;
  table.style.zoom='';
  /* فقط جدول عمومی فیت می‌شود؛ جدول تخصصی اسکرول عمودی عادی دارد */
  if(!scroll.classList.contains('ov-scroll-fit'))return;
  const cw=scroll.clientWidth, ch=scroll.clientHeight;
  if(!cw||!ch)return;
  const tw=table.scrollWidth||cw;
  const th=table.scrollHeight;
  if(!th)return;
  const scale=Math.min(1,cw/tw,ch/th);
  if(scale<0.999)table.style.zoom=String(Math.floor(scale*1000)/1000);
}
function scheduleOverviewFit(){
  if(ovFitRAF)return;
  ovFitRAF=requestAnimationFrame(()=>{ovFitRAF=0;fitOverviewTable();});
}
window.addEventListener('resize',scheduleOverviewFit);

let ovFitRO=null;
function observeOverviewScroll(){
  if(ovFitRO){ovFitRO.disconnect();ovFitRO=null;}
  if(ovIsMobile()||typeof ResizeObserver==='undefined')return;
  const scroll=document.querySelector('#view-overview .ov-scroll');
  if(!scroll)return;
  ovFitRO=new ResizeObserver(scheduleOverviewFit);
  ovFitRO.observe(scroll);
}

function setupOverviewBreakpoint(){
  if(ovMql) return;
  ovMql=window.matchMedia('(max-width:767px)');
  const onChange=()=>{
    const view=document.getElementById('view-overview');
    if(view&&view.classList.contains('active')) renderOverview();
  };
  if(ovMql.addEventListener) ovMql.addEventListener('change',onChange);
  else if(ovMql.addListener) ovMql.addListener(onChange);
}

function cssEsc(v){
  return (window.CSS&&CSS.escape)?CSS.escape(String(v)):String(v).replace(/["\\]/g,'\\$&');
}

function bindOverviewTabs(){
  const wrap=document.querySelector('.overview-tabs');
  if(!wrap||wrap._ovTabsBound)return;
  wrap._ovTabsBound=true;
  wrap.addEventListener('click',e=>{
    const btn=e.target.closest('[data-ovt]');
    if(!btn)return;
    ovTab=btn.dataset.ovt;
    wrap.querySelectorAll('[data-ovt]').forEach(b=>b.classList.toggle('active',b===btn));
    renderOverview();
  });
}
bindOverviewTabs();

function renderOverview(){
  setupOverviewBreakpoint();
  bindOverviewTabs();
  const body=document.getElementById('overviewBody');
  if(!body)return;
  try{
    if(ovTab==='specialized')renderSpecializedOverview(body);
    else renderGeneralOverview(body);
    bindOverviewDelegation(body);
    fitOverviewTable();
    observeOverviewScroll();
  }catch(err){
    console.error('Overview render error:',err);
    body.innerHTML=`<div class="empty-state"><b>خطا در نمایش</b>${esc(err.message||'خطای نامشخص')}</div>`;
  }
}

function ovAttrs(kind,subj,grade,extra){
  return `data-kind="${kind}" data-subj="${esc(subj)}" data-grade="${esc(grade)}"${extra||''}`;
}

/* ============ SPECIALIZED ============ */
function renderSpecializedOverview(body){
  const specSubs=state.subjects.filter(s=>s.type==='specialized');
  if(!specSubs.length){
    body.innerHTML='<div class="empty-state"><b>درس تخصصی نداری</b></div>';
    return;
  }
  const hasTopics=specSubs.some(s=>subjGrades(s.name).some(g=>(getTopics(s.name,g)||[]).length>0));
  if(!hasTopics){
    body.innerHTML='<div class="empty-state"><b>هنوز مبحثی ثبت نشده</b></div>';
    return;
  }

  if(ovIsMobile()){
    body.innerHTML=`<div class="card ov-table-card">${renderSpecializedMobile(specSubs)}${ovLegendSpecialized()}</div>`;
    return;
  }

  let maxCh=0;
  specSubs.forEach(subj=>{
    subjGrades(subj.name).forEach(g=>{
      const tps=getTopics(subj.name,g)||[];
      if(tps.length>maxCh) maxCh=tps.length;
    });
  });
  maxCh=Math.max(maxCh,1);

  let headerCells=`<th class="ov-row-label" colspan="2">درس / پایه</th>`;
  for(let i=0;i<maxCh;i++) headerCells+=`<th class="ov-ch-head">فصل ${fa(i+1)}</th>`;

  let bodyRows='';
  specSubs.forEach(subj=>{
    const grades=subjGrades(subj.name);
    const rowGroups=[];
    grades.forEach(grade=>{
      const topics=getTopics(subj.name,grade)||[];
      if(!topics.length)return;
      rowGroups.push({grade,topics});
    });
    if(!rowGroups.length)return;

    const totalRows=rowGroups.length;
    const gradeCounts={};
    rowGroups.forEach(r=>{gradeCounts[r.grade]=(gradeCounts[r.grade]||0)+1;});
    const seenGrade={};

    rowGroups.forEach((r,ri)=>{
      const tps=r.topics;
      let cells='';
      for(let i=0;i<maxCh;i++){
        if(i>=tps.length){
          const span=maxCh-i;
          cells+=`<td class="ov-cell ov-empty"${span>1?` colspan="${span}"`:''}></td>`;
          break;
        }
        cells+=renderSpecializedCell(subj,r.grade,tps[i]);
      }
      const subjCell=ri===0
        ?`<td class="ov-subj-cell" rowspan="${totalRows}" style="border-right:3px solid ${subj.color}"><div class="ov-subj-name" style="color:${subj.color}">${esc(subj.name)}</div><div class="ov-subj-count">${fa(rowGroups.length)} پایه</div></td>`
        :'';
      const first=!seenGrade[r.grade];
      if(first) seenGrade[r.grade]=true;
      let gradeCell='';
      if(first){
        const studied=tps.filter(t=>isChapterStudied(subj.name,r.grade,t)).length;
        const pct=tps.length?Math.round((studied/tps.length)*100):0;
        gradeCell=`<td class="ov-grade-cell" rowspan="${gradeCounts[r.grade]}"><span>${esc(r.grade)}</span><small><span data-hcount>${fa(studied)}/${fa(tps.length)}</span> — <span data-hpct>${fa(pct)}%</span></small></td>`;
      }
      bodyRows+=`<tr data-subj="${esc(subj.name)}" data-grade="${esc(r.grade)}">${subjCell}${gradeCell}${cells}</tr>`;
    });
  });

  body.innerHTML=`
    <div class="card ov-table-card">
      <div class="ov-scroll">
        <table class="ov-table ov-table-specialized"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
      </div>
      ${ovLegendSpecialized()}
    </div>
  `;
}

function ovLegendSpecialized(){
  return `<div class="ov-legend"><span class="ov-leg"><span class="ov-dot">✓</span> مطالعه شده</span><span class="ov-leg ov-leg-hint">کلیک روی خانه = ثبت درصد و مرور</span></div>`;
}

function renderSpecializedMobile(specSubs){
  let html='<div class="ov-mobile-cards ov-mobile-cards-specialized">';
  specSubs.forEach(subj=>{
    const rowGroups=[];
    subjGrades(subj.name).forEach(grade=>{
      const topics=getTopics(subj.name,grade)||[];
      if(!topics.length)return;
      rowGroups.push({grade,topics});
    });
    rowGroups.forEach(r=>{
      html+=`<section class="ov-mobile-group" style="--ov-color:${subj.color}"><header><b>${esc(subj.name)}</b><span>${esc(r.grade)}</span></header><div class="ov-mobile-grid">`;
      r.topics.forEach(topic=>{
        const m=specializedCellModel(subj,r.grade,topic);
        const cls=m.cls.filter(c=>c!=='ov-cell').join(' ');
        html+=`<div class="ov-mobile-topic ${cls}" ${ovAttrs('spec',subj.name,r.grade,` data-topic="${esc(topic)}"`)}>${m.inner}</div>`;
      });
      html+='</div></section>';
    });
  });
  html+='</div>';
  return html;
}

function specializedCellModel(subj,grade,topic){
  const sections=getChapterSections(subj.name,grade,topic);
  const hasSections=sections.length>0;
  const studied=isChapterStudied(subj.name,grade,topic);
  const reviewCount=studied?getChapterReviewCount(subj.name,grade,topic):0;
  const checks=studied?reviewChecks(Math.max(1,reviewCount)):'';
  const progress=getChapterProgress(subj.name,grade,topic);
  const last=getChapterLastReview(subj.name,grade,topic);
  const cls=['ov-cell'];
  if(studied)cls.push('studied');
  if(hasSections)cls.push('has-sections');
  if(progress>0&&progress<100)cls.push('in-progress');
  let dateStr='';
  if(last&&(reviewCount>0||progress>0)){
    const lbl=safeReviewDateLabel(last);
    if(lbl)dateStr=`<div class="ov-cell-date">${lbl}</div>`;
  }
  const displayTopic=topic.replace(/^فصل\s+\S+\s*:\s*/,'');
  let innerHtml='';
  if(hasSections){
    innerHtml+=`<div class="ov-chapter-name">${checks}${esc(displayTopic)}</div>`;
    innerHtml+=`<div class="ov-sections-list">${sections.map(sec=>{
      const secRec=getSectionRecord(subj.name,grade,topic,sec);
      const secStudied=secRec&&secRec.studied;
      const secProgress=getEffectiveProgress(secRec);
      const secReviewCount=secRec&&secRec.reviews?secRec.reviews.length:0;
      const secChecks=secStudied?reviewChecks(Math.max(1,secReviewCount)):'';
      const secDisplay=sec.replace(/^گفتار\s+\S+\s*:\s*/,'');
      const secCls=['ov-section-item'];
      if(secStudied)secCls.push('studied');
      else if(secProgress>0&&secProgress<100)secCls.push('in-progress');
      const secPercentBadge=secProgress>0&&secProgress<100?`<span class="ov-sec-pct">${fa(secProgress)}٪</span>`:'';
      return `<div class="${secCls.join(' ')}" data-sec="${esc(sec)}"><div class="ov-sec-content">${secChecks}<span>${esc(secDisplay)}</span>${secPercentBadge}</div></div>`;
    }).join('')}</div>`;
    if(dateStr)innerHtml+=dateStr;
  }else{
    const pctBadge=progress>0&&progress<100?`<span class="ov-cell-pct">${fa(progress)}٪</span>`:'';
    innerHtml=`<div class="ov-cell-content">${checks}${pctBadge}<div class="ov-cell-title">${esc(displayTopic)}</div>${dateStr}</div>`;
  }
  return {cls,inner:`<div class="ov-cell-inner">${innerHtml}</div>`};
}

function renderSpecializedCell(subj,grade,topic){
  const m=specializedCellModel(subj,grade,topic);
  return `<td class="${m.cls.join(' ')}" style="--cc:${subj.color}" ${ovAttrs('spec',subj.name,grade,` data-topic="${esc(topic)}"`)}>${m.inner}</td>`;
}

/* ============ GENERAL ============ */
function renderGeneralOverview(body){
  const genSubs=state.subjects.filter(s=>s.type==='general'&&isGeneralSubjectAvailableInField(s,state.profile.field));
  if(!genSubs.length){
    body.innerHTML='<div class="empty-state"><b>درس عمومی نداری</b></div>';
    return;
  }

  if(ovIsMobile()){
    body.innerHTML=`<div class="card ov-table-card">${renderGeneralMobile(genSubs)}<div class="ov-legend"><span class="ov-leg"><span class="ov-dot">✓</span> مطالعه شده</span><span class="ov-leg text-amber">◐ آزاد</span><span class="ov-leg ov-leg-hint">کلیک روی درس = ثبت درصد</span></div></div>`;
    return;
  }

  let headerCells=`<th class="ov-row-label" colspan="2">درس / پایه</th>`;
  for(let i=1;i<=10;i++) headerCells+=`<th class="ov-ch-head">${fa(i)}</th>`;

  let bodyRows='';
  genSubs.forEach(group=>{
    const orderedRows=[];
    const visibleGeneralGrades=state.profile.grade==='دوازدهم'
        ?(state.settings.includeEleventhFinal?GENERAL_GRADES:['دوازدهم'])
      :GENERAL_GRADES.includes(state.profile.grade)?[state.profile.grade]:[];
    const groupTotalLessons=visibleGeneralGrades.reduce(
        (sum,grade)=>sum+getSubjectLessons(group.name,grade),0
    );
    visibleGeneralGrades.forEach(grade=>{
      const totalLessons=getSubjectLessons(group.name,grade);
      if(totalLessons<=0)return;
      const rowCount=Math.ceil(totalLessons/10);
      for(let r=0;r<rowCount;r++){
        orderedRows.push({grade,startLesson:r*10,count:Math.min(10,totalLessons-r*10)});
      }
    });

    if(!orderedRows.length){
      let cells='';for(let i=0;i<10;i++)cells+=`<td class="ov-cell ov-empty"></td>`;
      bodyRows+=`<tr><td class="ov-subj-cell" style="border-right:3px solid ${group.color}"><div class="ov-subj-name" style="color:${group.color}">${esc(group.name)}</div><div class="ov-subj-count">بدون درس</div></td><td class="ov-grade-cell">—</td>${cells}</tr>`;
      return;
    }

    const totalRows=orderedRows.length;
    const gradeCounts={};
    orderedRows.forEach(r=>{gradeCounts[r.grade]=(gradeCounts[r.grade]||0)+1;});
    const seenGrade={};

    orderedRows.forEach((row,i)=>{
      let cells='';
      const lessonsCount=getSubjectLessons(group.name,row.grade);
      for(let c=0;c<10;c++){
        const lessonIdx=row.startLesson+c;
        if(c>=row.count||lessonIdx>=lessonsCount){
          const span=10-c;
          cells+=`<td class="ov-cell ov-empty"${span>1?` colspan="${span}"`:''}></td>`;
          break;
        }
        if(isFreeLesson(group.name,row.grade,lessonIdx)){
          cells+=`<td class="ov-cell ov-lesson-cell free" ${ovAttrs('gen',group.name,row.grade,` data-lesson="${lessonIdx}"`)}><div class="ov-cell-inner"><div class="ov-cell-title">${fa(lessonIdx+1)}</div><div class="ov-cell-date text-amber">آزاد</div></div></td>`;
          continue;
        }
        cells+=renderGeneralCell(group,row.grade,lessonIdx);
      }

      const subjCell=i===0
        ?`<td class="ov-subj-cell" rowspan="${totalRows}" style="border-right:3px solid ${group.color}"><div class="ov-subj-name" style="color:${group.color}">${esc(generalSubjectDisplayName(group.name))}</div><div class="ov-subj-count">${fa(groupTotalLessons)} درس</div></td>`
        :'';
      const first=!seenGrade[row.grade];
      if(first)seenGrade[row.grade]=true;
      let gradeCell='';
      if(first){
        const gradeTotal=getSubjectLessons(group.name,row.grade);
        let gradeStudied=0;
        for(let li=0;li<gradeTotal;li++) if(isLessonFullyStudied(group.name,row.grade,li)) gradeStudied++;
        gradeCell=`<td class="ov-grade-cell" rowspan="${gradeCounts[row.grade]}"><span>${esc(row.grade)}</span><small><span data-hcount>${fa(gradeStudied)}/${fa(gradeTotal)}</span></small></td>`;
      }
      bodyRows+=`<tr data-subj="${esc(group.name)}" data-grade="${esc(row.grade)}">${subjCell}${gradeCell}${cells}</tr>`;
    });
  });

  body.innerHTML=`
    <div class="card ov-table-card">
      <div class="ov-scroll ov-scroll-fit"><table class="ov-table ov-table-general"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>
      <div class="ov-legend"><span class="ov-leg"><span class="ov-dot">✓</span> مطالعه شده</span><span class="ov-leg text-amber">◐ آزاد</span><span class="ov-leg ov-leg-hint">کلیک روی درس = ثبت درصد</span></div>
    </div>
  `;
}

function renderGeneralMobile(genSubs){
  let html='<div class="ov-mobile-cards ov-mobile-cards-general">';
  const visibleGeneralGrades=state.profile.grade==='دوازدهم'
      ?(state.settings.includeEleventhFinal?GENERAL_GRADES:['دوازدهم'])
    :GENERAL_GRADES.includes(state.profile.grade)?[state.profile.grade]:[];
  genSubs.forEach(group=>{
    visibleGeneralGrades.forEach(grade=>{
      const total=getSubjectLessons(group.name,grade);
      if(total<=0)return;
      html+=`<section class="ov-mobile-group" style="--ov-color:${group.color}"><header><b>${esc(generalSubjectDisplayName(group.name))}</b><span>${esc(grade)}</span></header><div class="ov-mobile-grid">`;
      for(let i=0;i<total;i++){
        if(isFreeLesson(group.name,grade,i)){
          html+=`<div class="ov-mobile-topic ov-lesson-cell free" ${ovAttrs('gen',group.name,grade,` data-lesson="${i}"`)}><div class="ov-cell-inner"><div class="ov-cell-title">${fa(i+1)}</div><div class="ov-cell-date text-amber">آزاد</div></div></div>`;
          continue;
        }
        const m=generalCellModel(group,grade,i);
        const cls=m.cls.filter(c=>c!=='ov-cell'&&c!=='ov-lesson-cell').join(' ');
        html+=`<div class="ov-mobile-topic ov-lesson-cell ${cls}" ${ovAttrs('gen',group.name,grade,` data-lesson="${i}"`)}>${m.inner}</div>`;
      }
      html+='</div></section>';
    });
  });
  html+='</div>';
  return html;
}

/* ============ DELEGATED EVENTS ============ */
function bindOverviewDelegation(body){
  if(body._ovDelegated)return;
  body._ovDelegated=true;
  body.addEventListener('click',e=>{
    const secEl=e.target.closest('.ov-section-item');
    if(secEl){
      const host=secEl.closest('[data-kind]');
      if(!host)return;
      e.stopPropagation();
      const kind=host.dataset.kind;
      const subj=host.dataset.subj;
      const grade=host.dataset.grade;
      const topic=host.dataset.topic;
      const lesson=host.dataset.lesson;
      if(kind==='spec'&&topic) openTopicOverviewModal(subj,grade,topic,secEl.dataset.sec);
      else if(kind==='gen'&&lesson!=null) openLessonOverviewModal(subj,grade,parseInt(lesson,10),secEl.dataset.sec);
      return;
    }
    const cell=e.target.closest('[data-kind]');
    if(!cell||cell.classList.contains('free')||cell.classList.contains('ov-empty'))return;
    const kind=cell.dataset.kind;
    const subj=cell.dataset.subj;
    const grade=cell.dataset.grade;
    const topic=cell.dataset.topic;
    const lesson=cell.dataset.lesson;
    if(kind==='spec'&&topic) openTopicOverviewModal(subj,grade,topic);
    else if(kind==='gen'&&lesson!=null) openLessonOverviewModal(subj,grade,parseInt(lesson,10));
  });
}

/* ============ TARGETED REFRESH ============ */
function refreshOverviewCell(kind,subj,grade,key){
  const body=document.getElementById('overviewBody');
  if(!body)return;
  const selector=kind==='spec'
    ? `[data-kind="spec"][data-subj="${cssEsc(subj)}"][data-grade="${cssEsc(grade)}"][data-topic="${cssEsc(key)}"]`
    : `[data-kind="gen"][data-subj="${cssEsc(subj)}"][data-grade="${cssEsc(grade)}"][data-lesson="${key}"]`;
  const nodes=body.querySelectorAll(selector);
  if(!nodes.length)return;
  const subjObj=state.subjects.find(s=>s.name===subj);
  if(!subjObj)return;
  const tdHtml=kind==='spec'
    ? renderSpecializedCell(subjObj,grade,key)
    : renderGeneralCell(subjObj,grade,parseInt(key,10));
  const tmp=document.createElement('template');
  tmp.innerHTML=tdHtml.trim();
  const src=tmp.content.firstElementChild;
  if(!src)return;
  nodes.forEach(node=>{
    if(node.classList.contains('ov-mobile-topic')){
      const base=kind==='gen'?['ov-mobile-topic','ov-lesson-cell']:['ov-mobile-topic'];
      const extra=[...src.classList].filter(c=>c!=='ov-cell'&&c!=='ov-lesson-cell');
      node.className=[...base,...extra].join(' ');
      node.innerHTML=src.innerHTML;
    }else{
      node.className=src.className;
      node.title=src.title||'';
      node.innerHTML=src.innerHTML;
    }
  });
  refreshOverviewGradeHeader(kind,subj,grade);
  scheduleOverviewFit();
}

function refreshOverviewGradeHeader(kind,subj,grade){
  const body=document.getElementById('overviewBody');
  if(!body)return;
  let total,studied=0,pct;
  if(kind==='spec'){
    const topics=getTopics(subj,grade)||[];
    total=topics.length;
    studied=topics.filter(t=>isChapterStudied(subj,grade,t)).length;
  }else{
    total=getSubjectLessons(subj,grade);
    for(let i=0;i<total;i++) if(isLessonFullyStudied(subj,grade,i)) studied++;
  }
  pct=total?Math.round((studied/total)*100):0;
  const sel=`tr[data-subj="${cssEsc(subj)}"][data-grade="${cssEsc(grade)}"], .ov-mobile-group[data-subj="${cssEsc(subj)}"][data-grade="${cssEsc(grade)}"]`;
  body.querySelectorAll(sel).forEach(el=>{
    const hc=el.querySelector('[data-hcount]');
    if(hc) hc.textContent=`${fa(studied)}/${fa(total)}`;
    const hp=el.querySelector('[data-hpct]');
    if(hp) hp.textContent=`${fa(pct)}%`;
  });
}

function generalCellModel(group, grade, lessonIdx){
  const sections = getLessonSections(group.name, grade, lessonIdx);
  const hasSections = sections.length > 0;
  const studied = isLessonFullyStudied(group.name, grade, lessonIdx);
  const reviewCount = studied ? getLessonReviewCount(group.name, grade, lessonIdx) : 0;
  const checks = studied ? reviewChecks(Math.max(1, reviewCount)) : '';
  const progress = getLessonEffectiveProgress(group.name, grade, lessonIdx);
  const last = getLessonLastReview(group.name, grade, lessonIdx);
  const cls = ['ov-cell','ov-lesson-cell'];
  if(studied) cls.push('studied');
  if(hasSections) cls.push('has-sections');
  if(progress > 0 && progress < 100) cls.push('in-progress');
  let dateStr='';
  if(last && (reviewCount > 0 || progress > 0)){
    const lbl = safeReviewDateLabel(last);
    if(lbl) dateStr = `<div class="ov-cell-date">${lbl}</div>`;
  }

  let innerHtml='';
  if(hasSections){
    innerHtml += `<div class="ov-lesson-name">${checks}درس ${fa(lessonIdx+1)}</div>`;
    innerHtml += `<div class="ov-sections-list">${sections.map(sec=>{
      const secRec = getLessonSectionRecord(group.name, grade, lessonIdx, sec);
      const secStudied = secRec && secRec.studied;
      const secProgress = getEffectiveProgress(secRec);
      const secReviewCount = secRec && secRec.reviews ? secRec.reviews.length : 0;
      const secChecks = secStudied ? reviewChecks(Math.max(1, secReviewCount)) : '';
      const secCls = ['ov-section-item'];
      if(secStudied) secCls.push('studied');
      else if(secProgress > 0 && secProgress < 100) secCls.push('in-progress');
      const secPercentBadge = secProgress > 0 && secProgress < 100 ? `<span class="ov-sec-pct">${fa(secProgress)}٪</span>` : '';
      return `<div class="${secCls.join(' ')}" data-sec="${esc(sec)}"><div class="ov-sec-content">${secChecks}<span>${esc(sec)}</span>${secPercentBadge}</div></div>`;
    }).join('')}</div>`;
    if(dateStr) innerHtml += dateStr;
  } else {
    const pctBadge = progress > 0 && progress < 100 ? `<span class="ov-cell-pct">${fa(progress)}٪</span>` : '';
    innerHtml = `<div class="ov-cell-content">${checks}${pctBadge}<div class="ov-cell-title">${fa(lessonIdx+1)}</div>${dateStr}</div>`;
  }

  return {cls, inner:`<div class="ov-cell-inner">${innerHtml}</div>`};
}

function renderGeneralCell(group, grade, lessonIdx){
  const m = generalCellModel(group, grade, lessonIdx);
  return `<td class="${m.cls.join(' ')}" style="--cc:${group.color}" data-kind="gen" data-subj="${esc(group.name)}" data-grade="${esc(grade)}" data-lesson="${lessonIdx}">${m.inner}</td>`;
}

/* ============ PROGRESS SLIDER HTML ============ */
function progressSliderHtml(currentProgress, inputId){
  const val = Math.max(0, Math.min(100, Math.round((currentProgress||0)/5)*5));
  return `
    <div class="progress-slider-wrap">
      <div class="progress-slider-head">
        <span class="ps-label">📊 درصد تکمیل</span>
        <span class="ps-value" id="${inputId}Value">${fa(val)}٪</span>
      </div>
      <input type="range" class="progress-slider" id="${inputId}" min="0" max="100" step="5" value="${val}">
      <div class="progress-slider-marks">
        <span>۰</span><span>۵۰</span><span>۱۰۰</span>
      </div>
    </div>
  `;
}

function bindProgressSlider(inputId, onChange){
  const slider = document.getElementById(inputId);
  const valueEl = document.getElementById(inputId + 'Value');
  if(!slider) return;
  slider.addEventListener('input', () => {
    const val = parseInt(slider.value, 10);
    if(valueEl) valueEl.textContent = fa(val) + '٪';
  });
  slider.addEventListener('change', () => {
    const val = parseInt(slider.value, 10);
    onChange(val);
  });
}

/* ============ TOPIC MODAL (تخصصی) ============ */
function openTopicOverviewModal(subject, grade, topic, sectionName){
  const sections = getChapterSections(subject, grade, topic);
  const hasSections = sections.length > 0;

  if(sectionName){
    const rec = getSectionRecord(subject, grade, topic, sectionName) || {studied:false, reviews:[]};
    const reviews = rec.reviews || [];
    const studied = rec.studied;
    const progress = getEffectiveProgress(rec);
    const lastReview = reviews.length ? reviews[reviews.length-1].date : null;
    const secDisplay = sectionName.replace(/^گفتار\s+\S+\s*:\s*/,'');
    openModal(`
      <div class="modal-head">
        <div class="card-title" style="color:${subjColor(subject)}">${esc(subject)} — ${esc(topic.replace(/^فصل\s+\S+\s*:\s*/,''))}</div>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="muted mb-12">${esc(secDisplay)}</div>
      ${progressSliderHtml(progress, 'secProgressSlider')}
      <div class="toggle-card ${studied?'on':''} mb-12">
        <div>
          <div class="fw-700 fs-13">${studied?'✓ مطالعه شده':'هنوز تیک نخورده'}</div>
          ${(lastReview && reviews.length > 0)?`<div class="fs-10h text-muted mt-3">آخرین مرور: ${safeReviewDateLabel(lastReview)}</div>`:''}
        </div>
        <label class="switch"><input type="checkbox" id="sectionStudiedToggle" ${studied?'checked':''}><span></span></label>
      </div>
      <div class="card-title my-14-8 fs-11h">📅 تاریخچه مرورها (${fa(reviews.length)})</div>
      ${reviews.length?reviews.slice().reverse().map((r,i)=>`
        <div class="setting-row review-row">
          <div class="sr-label fs-11h">${safeReviewDateLabel(r.date)||'—'}</div>
          <div class="sr-control"><button class="mini-btn danger review-del" data-del-review="${reviews.length-1-i}">✕</button></div>
        </div>
      `).join(''):'<div class="empty-state sm">هنوز مروری ثبت نشده</div>'}
      <div class="review-add-row">
        <button class="btn primary flex-2" id="addReviewToday">+ امروز</button>
        <button class="btn ghost flex-1 p-0" id="addReviewWithDate">📅</button>
      </div>
      <div class="row mt-8"><button class="btn ghost" data-close>بستن</button></div>
    `);
    bindProgressSlider('secProgressSlider', (val)=>{
      setSectionProgress(subject, grade, topic, sectionName, val);
      const tgl = document.getElementById('sectionStudiedToggle');
      if(tgl) tgl.checked = val >= 100;
      refreshOverviewCell('spec', subject, grade, topic);
    });
    document.getElementById('sectionStudiedToggle').onchange=(e)=>{
      const newVal = e.target.checked ? 100 : 0;
      setSectionProgress(subject, grade, topic, sectionName, newVal);
      const slider = document.getElementById('secProgressSlider');
      if(slider) slider.value = newVal;
      const valEl = document.getElementById('secProgressSliderValue');
      if(valEl) valEl.textContent = fa(newVal) + '٪';
      refreshOverviewCell('spec', subject, grade, topic);
    };
    document.getElementById('addReviewToday').onclick=()=>{
      addReviewToSection(subject, grade, topic, sectionName, TODAY_KEY);
      closeModal(); refreshOverviewCell('spec', subject, grade, topic); toast('مرور امروز ثبت شد ✓');
    };
    document.getElementById('addReviewWithDate').onclick=()=>{
      openJalaliDatePicker({title:'تاریخ مرور', onPick:(key)=>{
        addReviewToSection(subject, grade, topic, sectionName, key);
        refreshOverviewCell('spec', subject, grade, topic); toast('مرور ثبت شد ✓');
      }});
    };
    document.querySelectorAll('[data-del-review]').forEach(btn=>{
      btn.onclick=()=>{
        const idx=parseInt(btn.dataset.delReview,10);
        const newRec = getSectionRecord(subject, grade, topic, sectionName);
        if(!newRec || !newRec.reviews) return;
        newRec.reviews.splice(idx,1);
        if(newRec.reviews.length === 0 && getEffectiveProgress(newRec) === 0) newRec.studied = false;
        setSectionRecord(subject, grade, topic, sectionName, newRec);
        closeModal(); refreshOverviewCell('spec', subject, grade, topic);
      };
    });
    return;
  }

  /* مودال کلی فصل */
  const chapterRec = getTopicRecord(subject, grade, topic) || {studied:false, reviews:[], sections:{}};
  const chapterReviews = chapterRec.reviews || [];
  const studied = chapterRec.studied;
  const progress = getChapterProgress(subject, grade, topic);
  const lastReview = getChapterLastReview(subject, grade, topic);

  openModal(`
    <div class="modal-head">
      <div class="card-title" style="color:${subjColor(subject)}">${esc(subject)} — ${esc(grade||'')}</div>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="muted ov-modal-desc">${esc(topic)}</div>
    ${!hasSections ? progressSliderHtml(progress, 'chapterProgressSlider') : `<div class="muted ov-pct-summary">درصد کلی: <b>${fa(progress)}٪</b> (میانگین گفتارها)</div>`}
    ${hasSections ? `
      <div class="card-title my-14-8 fs-11h">🎯 گفتارها</div>
      <div class="topic-sections-edit-list">${sections.map((sec,idx)=>{
        const rec = getSectionRecord(subject,grade,topic,sec);
        const secStudied = rec && rec.studied;
        const secProgress = getEffectiveProgress(rec);
        const secReviewCount = rec && rec.reviews ? rec.reviews.length : 0;
        const secDisplay = sec.replace(/^گفتار\s+\S+\s*:\s*/,'');
        const pctBadge = (secProgress > 0 && secProgress < 100) ? `<span class="tse-pct">${fa(secProgress)}٪</span>` : '';
        return `<div class="topic-section-edit-row${secStudied?' on':''}" data-sectap="${idx}">
          <span class="tse-label">${esc(secDisplay)}</span>
          ${pctBadge}
          <span class="tse-checks">${secStudied ? reviewChecks(Math.max(1, secReviewCount)) : ''}</span>
        </div>`;
      }).join('')}</div>
      <div class="muted ov-click-hint">برای تنظیم درصد هر گفتار، روی آن کلیک کن</div>
    ` : `
      <div class="toggle-card ${studied?'on':''} mb-12">
        <div>
          <div class="fw-700 fs-13">${studied?'✓ مطالعه شده':'هنوز تیک نخورده'}</div>
          ${(lastReview && chapterReviews.length > 0)?`<div class="fs-10h text-muted mt-3">آخرین مرور: ${safeReviewDateLabel(lastReview)}</div>`:''}
        </div>
        <label class="switch"><input type="checkbox" id="chapterStudiedToggle" ${studied?'checked':''}><span></span></label>
      </div>
      <div class="card-title my-14-8 fs-11h">📅 تاریخچه مرورها (${fa(chapterReviews.length)})</div>
      ${chapterReviews.length?chapterReviews.slice().reverse().map((r,i)=>`
        <div class="setting-row review-row">
          <div class="sr-label fs-11h">${safeReviewDateLabel(r.date)||'—'}</div>
          <div class="sr-control"><button class="mini-btn danger review-del" data-del-review="${chapterReviews.length-1-i}">✕</button></div>
        </div>
      `).join(''):'<div class="empty-state sm">هنوز مروری ثبت نشده</div>'}
      <div class="review-add-row">
        <button class="btn primary flex-2" id="addChapterToday">+ امروز</button>
        <button class="btn ghost flex-1 p-0" id="addChapterWithDate">📅</button>
      </div>
    `}
    <div class="row mt-14"><button class="btn ghost" data-close>بستن</button></div>
  `);

  if(!hasSections){
    bindProgressSlider('chapterProgressSlider', (val)=>{
      setChapterProgress(subject, grade, topic, val);
      const tgl = document.getElementById('chapterStudiedToggle');
      if(tgl) tgl.checked = val >= 100;
      refreshOverviewCell('spec', subject, grade, topic);
    });
  }

  const chapterToggle = document.getElementById('chapterStudiedToggle');
  if(chapterToggle) chapterToggle.onchange=(e)=>{
    const newVal = e.target.checked ? 100 : 0;
    setChapterProgress(subject, grade, topic, newVal);
    const slider = document.getElementById('chapterProgressSlider');
    if(slider) slider.value = newVal;
    const valEl = document.getElementById('chapterProgressSliderValue');
    if(valEl) valEl.textContent = fa(newVal) + '٪';
    refreshOverviewCell('spec', subject, grade, topic);
  };
  const chapterTodayBtn = document.getElementById('addChapterToday');
  if(chapterTodayBtn) chapterTodayBtn.onclick=()=>{
    addReviewToTopic(subject, grade, topic, TODAY_KEY);
    closeModal(); refreshOverviewCell('spec', subject, grade, topic); toast('مرور امروز ثبت شد ✓');
  };
  const chapterDateBtn = document.getElementById('addChapterWithDate');
  if(chapterDateBtn) chapterDateBtn.onclick=()=>{
    openJalaliDatePicker({title:'تاریخ مرور', onPick:(key)=>{
      addReviewToTopic(subject, grade, topic, key);
      refreshOverviewCell('spec', subject, grade, topic); toast('مرور ثبت شد ✓');
    }});
  };
  document.querySelectorAll('[data-del-review]').forEach(btn=>{
    btn.onclick=()=>{
      const idx=parseInt(btn.dataset.delReview,10);
      const newRec = getTopicRecord(subject,grade,topic);
      if(!newRec || !newRec.reviews) return;
      newRec.reviews.splice(idx,1);
      if(newRec.reviews.length === 0 && getEffectiveProgress(newRec) === 0) newRec.studied = false;
      setTopicRecord(subject,grade,topic,newRec);
      closeModal(); refreshOverviewCell('spec', subject, grade, topic);
    };
  });
  document.querySelectorAll('[data-sectap]').forEach(row=>{
    row.onclick=()=>{
      const idx = parseInt(row.dataset.sectap,10);
      closeModal();
      setTimeout(()=>openTopicOverviewModal(subject, grade, topic, sections[idx]), 50);
    };
  });
}

/* ============ LESSON MODAL (عمومی) ============ */
function openLessonOverviewModal(subject, grade, lessonIdx, sectionName){
  const subj=state.subjects.find(x=>x.name===subject);
  if(!subj)return;
  const sections = getLessonSections(subject, grade, lessonIdx);
  const hasSections = sections.length > 0;

  if(sectionName){
    const rec=getLessonSectionRecord(subject,grade,lessonIdx,sectionName) || {studied:false,reviews:[]};
    const reviews = rec.reviews || [];
    const studied = rec.studied;
    const progress = getEffectiveProgress(rec);
    const lastReview = reviews.length ? reviews[reviews.length-1].date : null;
    openModal(`
      <div class="modal-head">
        <div class="card-title" style="color:${subj.color}">${esc(subject)} — ${esc(grade)} — درس ${fa(lessonIdx+1)}</div>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="muted mb-12">${esc(sectionName)}</div>
      ${progressSliderHtml(progress, 'lsSecSlider')}
      <div class="toggle-card ${studied?'on':''} mb-12">
        <div>
          <div class="fw-700 fs-13">${studied?'✓ مطالعه شده':'هنوز تیک نخورده'}</div>
          ${(lastReview && reviews.length > 0)?`<div class="fs-10h text-muted mt-3">آخرین مرور: ${safeReviewDateLabel(lastReview)}</div>`:''}
        </div>
        <label class="switch"><input type="checkbox" id="secStudiedToggle" ${studied?'checked':''}><span></span></label>
      </div>
      <div class="card-title my-14-8 fs-11h">📅 تاریخچه مرورها (${fa(reviews.length)})</div>
      ${reviews.length?reviews.slice().reverse().map((r,i)=>`
        <div class="setting-row review-row">
          <div class="sr-label fs-11h">${safeReviewDateLabel(r.date)||'—'}</div>
          <div class="sr-control"><button class="mini-btn danger review-del" data-del-review="${reviews.length-1-i}">✕</button></div>
        </div>
      `).join(''):'<div class="empty-state sm">هنوز مروری ثبت نشده</div>'}
      <div class="review-add-row">
        <button class="btn primary flex-2" id="addSecToday">+ امروز</button>
        <button class="btn ghost flex-1 p-0" id="addSecWithDate">📅</button>
      </div>
      <div class="row mt-8"><button class="btn ghost" data-close>بستن</button></div>
    `);
    bindProgressSlider('lsSecSlider', (val)=>{
      setLessonSectionProgress(subject, grade, lessonIdx, sectionName, val);
      const tgl = document.getElementById('secStudiedToggle');
      if(tgl) tgl.checked = val >= 100;
      refreshOverviewCell('gen', subject, grade, lessonIdx);
    });
    document.getElementById('secStudiedToggle').onchange=(e)=>{
      const newVal = e.target.checked ? 100 : 0;
      setLessonSectionProgress(subject, grade, lessonIdx, sectionName, newVal);
      const slider = document.getElementById('lsSecSlider');
      if(slider) slider.value = newVal;
      const valEl = document.getElementById('lsSecSliderValue');
      if(valEl) valEl.textContent = fa(newVal) + '٪';
      refreshOverviewCell('gen', subject, grade, lessonIdx);
    };
    document.getElementById('addSecToday').onclick=()=>{
      addReviewToLessonSection(subject,grade,lessonIdx,sectionName,TODAY_KEY);
      closeModal(); refreshOverviewCell('gen', subject, grade, lessonIdx); toast('مرور امروز ثبت شد ✓');
    };
    document.getElementById('addSecWithDate').onclick=()=>{
      openJalaliDatePicker({title:'تاریخ مرور', onPick:(key)=>{
        addReviewToLessonSection(subject,grade,lessonIdx,sectionName,key);
        refreshOverviewCell('gen', subject, grade, lessonIdx); toast('مرور ثبت شد ✓');
      }});
    };
    document.querySelectorAll('[data-del-review]').forEach(btn=>{
      btn.onclick=()=>{
        const idx=parseInt(btn.dataset.delReview,10);
        const newRec = getLessonSectionRecord(subject,grade,lessonIdx,sectionName);
        if(!newRec || !newRec.reviews) return;
        newRec.reviews.splice(idx,1);
        if(newRec.reviews.length === 0 && getEffectiveProgress(newRec) === 0) newRec.studied = false;
        setLessonSectionRecord(subject,grade,lessonIdx,sectionName,newRec);
        closeModal(); refreshOverviewCell('gen', subject, grade, lessonIdx);
      };
    });
    return;
  }

  /* مودال کلی درس */
  const rec=getLessonRecord(subject,grade,lessonIdx) || {studied:false, reviews:[], sections:{}};
  const reviews=rec.reviews||[];
  const studied=rec.studied||false;
  const progress = getLessonEffectiveProgress(subject, grade, lessonIdx);
  const lastReview=rec.lastReview||null;

  openModal(`
    <div class="modal-head">
      <div class="card-title" style="color:${subj.color}">${esc(subject)} — ${esc(grade)} — درس ${fa(lessonIdx+1)}</div>
      <button class="icon-btn" data-close>✕</button>
    </div>
    ${!hasSections ? progressSliderHtml(progress, 'lessonProgressSlider') : `<div class="muted ov-pct-summary">درصد کلی: <b>${fa(progress)}٪</b> (میانگین زیرمبحث‌ها)</div>`}
    ${hasSections ? `
      <div class="card-title my-14-8 fs-11h">✂️ زیرمبحث‌ها</div>
      <div class="topic-sections-edit-list">${sections.map((sec,idx)=>{
        const secRec = getLessonSectionRecord(subject,grade,lessonIdx,sec);
        const secStudied = secRec && secRec.studied;
        const secProgress = getEffectiveProgress(secRec);
        const secReviewCount = secRec && secRec.reviews ? secRec.reviews.length : 0;
        const pctBadge = (secProgress > 0 && secProgress < 100) ? `<span class="tse-pct">${fa(secProgress)}٪</span>` : '';
        return `<div class="topic-section-edit-row${secStudied?' on':''}" data-sectap="${idx}">
          <span class="tse-label">${esc(sec)}</span>
          ${pctBadge}
          <span class="tse-checks">${secStudied ? reviewChecks(Math.max(1, secReviewCount)) : ''}</span>
        </div>`;
      }).join('')}</div>
      <div class="muted ov-click-hint">برای تنظیم درصد، روی زیرمبحث کلیک کن</div>
    ` : `
      <div class="toggle-card ${studied?'on':''} mb-12">
        <div>
          <div class="fw-700 fs-13">${studied?'✓ مطالعه شده':'هنوز مطالعه نشده'}</div>
          ${(lastReview && reviews.length > 0)?`<div class="fs-10h text-muted mt-3">آخرین مرور: ${safeReviewDateLabel(lastReview)}</div>`:''}
        </div>
        <label class="switch"><input type="checkbox" id="lessonStudiedToggle" ${studied?'checked':''}><span></span></label>
      </div>
      <div class="card-title my-14-8 fs-11h">📅 تاریخچه مرورها (${fa(reviews.length)})</div>
      ${reviews.length ? reviews.slice().reverse().map((r,i)=>`<div class="setting-row review-row"><div class="sr-label fs-11h">${safeReviewDateLabel(r.date)||'—'}</div><div class="sr-control"><button class="mini-btn danger review-del" data-del-review="${reviews.length-1-i}">✕</button></div></div>`).join('') : '<div class="empty-state sm">هنوز مروری ثبت نشده</div>'}
      <div class="review-add-row">
        <button class="btn primary flex-2" id="addLessonToday">+ امروز</button>
        <button class="btn ghost flex-1 p-0" id="addLessonWithDate">📅</button>
      </div>
    `}
    <div class="row mt-8"><button class="btn ghost" data-close>بستن</button></div>
  `);

  if(!hasSections){
    bindProgressSlider('lessonProgressSlider', (val)=>{
      setLessonProgress(subject, grade, lessonIdx, val);
      const tgl = document.getElementById('lessonStudiedToggle');
      if(tgl) tgl.checked = val >= 100;
      refreshOverviewCell('gen', subject, grade, lessonIdx);
    });
  }

  const lessonToggle = document.getElementById('lessonStudiedToggle');
  if(lessonToggle) lessonToggle.onchange=(e)=>{
    const newVal = e.target.checked ? 100 : 0;
    setLessonProgress(subject, grade, lessonIdx, newVal);
    const slider = document.getElementById('lessonProgressSlider');
    if(slider) slider.value = newVal;
    const valEl = document.getElementById('lessonProgressSliderValue');
    if(valEl) valEl.textContent = fa(newVal) + '٪';
    refreshOverviewCell('gen', subject, grade, lessonIdx);
  };
  const lessonToday = document.getElementById('addLessonToday');
  if(lessonToday) lessonToday.onclick=()=>{
    addReviewToLesson(subject,grade,lessonIdx,TODAY_KEY);
    closeModal();refreshOverviewCell('gen', subject, grade, lessonIdx);toast('مرور امروز ثبت شد ✓');
  };
  const lessonDate = document.getElementById('addLessonWithDate');
  if(lessonDate) lessonDate.onclick=()=>{
    openJalaliDatePicker({title:'تاریخ مرور', onPick:(key)=>{
      addReviewToLesson(subject,grade,lessonIdx,key);
      refreshOverviewCell('gen', subject, grade, lessonIdx); toast('مرور ثبت شد ✓');
    }});
  };
  document.querySelectorAll('[data-del-review]').forEach(btn=>{
    btn.onclick=()=>{
      const idx=parseInt(btn.dataset.delReview,10);
      const newRec=getLessonRecord(subject,grade,lessonIdx);
      if(!newRec || !newRec.reviews) return;
      newRec.reviews.splice(idx,1);
      if(newRec.reviews.length === 0 && getEffectiveProgress(newRec) === 0) newRec.studied = false;
      newRec.lastReview=newRec.reviews.length?newRec.reviews[newRec.reviews.length-1].date:null;
      setLessonRecord(subject,grade,lessonIdx,newRec);
      closeModal();refreshOverviewCell('gen', subject, grade, lessonIdx);
    };
  });
  document.querySelectorAll('[data-sectap]').forEach(row=>{
    row.onclick=()=>{
      const idx = parseInt(row.dataset.sectap,10);
      closeModal();
      setTimeout(()=>openLessonOverviewModal(subject, grade, lessonIdx, sections[idx]), 50);
    };
  });
}