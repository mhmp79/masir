'use strict';

/* ============================================================
   DASHBOARD — داشبورد + هیت‌مپ ماهانه + گزارش تصویری با گزینه‌های خروجی
   نسخه ۱.۲.۰ — جدول جزییات: روزانه ترتیب زمانی، هفتگی جمع‌بندی درس‌ها
   ============================================================ */

let dashDay=TODAY_JDN;
let currentPie='study';

/* ============ LINE CHART ============ */
function renderLineChart(){
  const keys=weekKeysOf(dashDay);const selKey=jKey(d2j(dashDay));
  const vals=keys.map((k)=>sumMinutes(dayActs(k)));
  const W=340,H=156,padX=26,padTop=26,padBot=30;
  const maxV=Math.max(...vals,60);
  const X=(i)=>padX+i*(W-2*padX)/6;
  const Y=(v)=>H-padBot-(v/maxV)*(H-padTop-padBot);
  let grid='';
  for(let i=0;i<=3;i++){const gy=padTop+i*(H-padTop-padBot)/3;grid+=`<line x1="${padX-8}" y1="${gy}" x2="${W-padX+8}" y2="${gy}" stroke="rgba(255,255,255,.06)" stroke-dasharray="3 5"/>`;}
  const pts=vals.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area=`${X(0).toFixed(1)},${H-padBot} ${pts} ${X(6).toFixed(1)},${H-padBot}`;
  let dots='',labels='';
  vals.forEach((v,i)=>{
    const cx=X(i),cy=Y(v);const isSel=keys[i]===selKey;
    dots+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${isSel?5.8:4.6}" fill="#0b1022" stroke="url(#lineGrad)" stroke-width="${isSel?3.4:2.8}"/>`;
    if(v>0){dots+=`<text x="${cx.toFixed(1)}" y="${(cy-11).toFixed(1)}" text-anchor="middle" font-size="9" font-family="Vazirmatn,Tahoma" fill="${isSel?'#22d3ee':'#9aa4bd'}">${hmTotalStr(v)}</text>`;}
    labels+=`<text x="${cx.toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="10" font-family="Vazirmatn,Tahoma" fill="${isSel?'#22d3ee':'#7d879f'}">${DOW_SHORT[i]}</text>`;
  });
  const el=document.getElementById('lineChart'); if(!el) return;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="chart-svg"><defs><linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#7c5cff"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c5cff" stop-opacity=".35"/><stop offset="100%" stop-color="#7c5cff" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${area}" fill="url(#areaGrad)"/><polyline points="${pts}" fill="none" stroke="url(#lineGrad)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}</svg>`;
}

/* ============ MONTHLY HEATMAP ============ */
function renderMonthlyHeatmap(){
  const box = document.getElementById('monthlyHeatmap');
  if (!box) return;
  const todayJ = d2j(TODAY_JDN);
  const year = todayJ.jy;
  const month = todayJ.jm;
  const firstJdn = j2d(year, month, 1);
  const len = jMonthLength(year, month);
  const startCol = dowIndex(firstJdn);
  const days = [];
  let totalMin = 0, activeDays = 0;
  for (let d = 1; d <= len; d++) {
    const key = keyOf(year, month, d);
    const mins = sumMinutes(dayActs(key));
    days.push({ d, key, mins });
    totalMin += mins;
    if (mins > 0) activeDays++;
  }
  const levels = days.map(x => studyIntensityLevel(x.mins));
  let html = '<div class="hm-head">';
  html += `<div class="hm-month">${MONTHS[month-1]} ${fa(year)}</div>`;
  html += `<div class="hm-total">مجموع: <b>${hmTotalStr(totalMin)}</b> • ${fa(activeDays)} روز فعال</div>`;
  html += '</div>';
  html += '<div class="hm-dow">' + DOW_SHORT.map(d => `<div>${d}</div>`).join('') + '</div>';
  html += '<div class="hm-grid">';
  for (let i = 0; i < startCol; i++) html += '<div class="hm-cell empty"></div>';
  days.forEach((x, i) => {
    const isToday = x.key === TODAY_KEY;
    const cls = ['hm-cell', `lvl-${levels[i]}`];
    if (isToday) cls.push('today');
    const title = x.mins > 0
      ? `${fa(x.d)} ${MONTHS[month-1]} — ${hmTotalStr(x.mins)} مطالعه، ${studyIntensityLabel(levels[i])}`
      : `${fa(x.d)} ${MONTHS[month-1]} — بدون مطالعه`;
    html += `<div class="${cls.join(' ')}" title="${title}">${fa(x.d)}</div>`;
  });
  html += '</div>';
  html += '<div class="hm-legend">';
  html += '<span>کمتر</span>';
  [0,1,2,3,4].forEach(l => { html += `<div class="hm-legend-cell lvl-${l}" title="${studyIntensityLabel(l)}"></div>`; });
  html += '<span>بیشتر</span>';
  html += '</div>';
  box.innerHTML = html;
}

/* ============ PIE ============ */
function renderPie(){
  const acts=weekActs(dashDay);const subs=[...subjectsForPie(),{name:EXAM_SUBJECT,color:EXAM_COLOR}];
  let data;
  if(currentPie==='study'){data=subs.map((s)=>({name:s.name,color:s.color,val:sumMinutes(acts.filter((a)=>a.subject===s.name))})).filter((x)=>x.val>0);}
  else{data=subs.map((s)=>({name:s.name,color:s.color,val:acts.filter((a)=>a.subject===s.name).reduce((sum,a)=>{if(a.tests)sum+=(+a.tests.correct||0)+(+a.tests.wrong||0)+(+a.tests.blank||0);return sum;},0)})).filter((x)=>x.val>0);}
  const donut=document.getElementById('pieDonut');const center=document.getElementById('pieCenter');const legend=document.getElementById('pieLegend');
  if(!data.length){donut.style.background='rgba(255,255,255,.07)';center.innerHTML='<b>—</b><span>داده‌ای نیست</span>';legend.innerHTML='';return;}
  const total=data.reduce((s,x)=>s+x.val,0);data.forEach((x)=>x.pct=x.val/total*100);
  let acc=0;const stops=[];data.forEach((x)=>{const from=acc,to=acc+x.pct;stops.push(`${x.color} ${from.toFixed(2)}% ${to.toFixed(2)}%`);acc=to;});
  donut.style.background=`conic-gradient(${stops.join(',')})`;
  const centerVal=currentPie==='study'?hmTotalStr(total):fa(total);
  center.innerHTML=`<b>${centerVal}</b><span>${currentPie==='study'?'ساعت':'تست'}</span>`;
  legend.innerHTML=data.map((x)=>`<div class="pl-row"><span class="pl-dot" style="background:${x.color}"></span><span class="pl-name">${esc(x.name)}</span><span class="pl-pct">${fa(Math.round(x.pct))}٪</span></div>`).join('');
}

/* ============ EXAM MINI CHART ============ */
function renderExamDashChart(){
  const card=document.getElementById('examDashCard');if(!card)return;
  const exams=state.exams.filter((e)=>e.hasResults&&(e.totalTaraz!=null||(e.subjects&&Object.keys(e.subjects).length))).sort((a,b)=>jdnFromKey(a.date)-jdnFromKey(b.date));
  if(!state.settings.examsEnabled||!exams.length){card.classList.add('hidden');return;}
  card.classList.remove('hidden');
  const box=document.getElementById('examMiniChart');
  const W=340,H=180,padX=54,padTop=34,padBot=68;
  const vals=exams.map((e)=>+e.totalTaraz||0);
  const minV=Math.min(...vals);const maxV=Math.max(...vals);
  const range=Math.max(600,maxV-minV);
  const lo=Math.max(0,minV-range*0.2);const hi=maxV+range*0.2;
  const centerX=(padX+(W-padX))/2;
  const maxSpan=W-2*padX;
  const spacing=exams.length>1?maxSpan/Math.max(3,exams.length-1):0;
  const X=(i)=>centerX+(i-(exams.length-1)/2)*spacing;
  const Y=(v)=>H-padBot-((v-lo)/(hi-lo))*(H-padTop-padBot);
  let grid='';
  for(let i=0;i<=3;i++){const gy=padTop+i*(H-padTop-padBot)/3;const gv=Math.round(hi-i*(hi-lo)/3);grid+=`<line x1="${padX-6}" y1="${gy}" x2="${W-padX+6}" y2="${gy}" stroke="rgba(255,255,255,.06)" stroke-dasharray="3 5"/>`;grid+=`<text x="${padX-8}" y="${gy+3}" text-anchor="end" font-size="8" font-family="Vazirmatn,Tahoma" fill="#8b94ad">${fa(gv)}</text>`;}
  const pts=exams.map((e,i)=>`${X(i).toFixed(1)},${Y(+e.totalTaraz||0).toFixed(1)}`).join(' ');
  let dots='',labels='';
  exams.forEach((e,i)=>{
    const cx=X(i),cy=Y(+e.totalTaraz||0);
    dots+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="#0b1022" stroke="#eab308" stroke-width="2.2"/>`;
    const anchor=i===0?'start':i===exams.length-1?'end':'middle';
    const vx=i===0?cx+2:i===exams.length-1?cx-2:cx;
    const vy=cy-(i%2===0?11:20);
    dots+=`<text x="${vx.toFixed(1)}" y="${vy.toFixed(1)}" text-anchor="${anchor}" font-size="8" font-family="Vazirmatn,Tahoma" font-weight="700" fill="#fcd34d">${fa(+e.totalTaraz||0)}</text>`;
    const jd=parseKey(e.date);const ly=H-26-(i%2)*16;
    labels+=`<text x="${cx.toFixed(1)}" y="${ly}" text-anchor="middle" font-size="8" font-family="Vazirmatn,Tahoma" fill="#8b94ad">${fa(jd.jd)} ${MONTHS[jd.jm-1].slice(0,4)}</text>`;
  });
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="chart-svg"><defs><linearGradient id="examMiniGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#eab308"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient></defs>${grid}<polyline points="${pts}" fill="none" stroke="url(#examMiniGrad)" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}</svg>`;
}

/* ============ DASHBOARD ============ */
function renderDashboard(){
  const dayKey=jKey(d2j(dashDay));
  const dActs=dayActs(dayKey);const wActs=weekActs(dashDay);
  const dayMin=sumMinutes(dActs);const weekMin=sumMinutes(wActs);
  const daysLeft=Math.max(0,KONKUR_JDN-dashDay);
  const isToday=dashDay===TODAY_JDN;
  const dj=d2j(dashDay);
  document.getElementById('dashDate').textContent=`${DOW[dowIndex(dashDay)]} ${fa(dj.jd)} ${MONTHS[dj.jm-1]}`;
  document.getElementById('dashDayLabel').textContent=isToday?'امروز':(dashDay===TODAY_JDN-1?'دیروز':'روز انتخابی');
  document.getElementById('daysLeft').textContent=fa(daysLeft);
  document.getElementById('todayHours').textContent=hmTotalStr(dayMin);
  document.getElementById('todayTests').textContent=fa(sumTests(dActs));
  document.getElementById('weekHours').textContent=hmTotalStr(weekMin);
  document.getElementById('weekTests').textContent=fa(sumTests(wActs));
  document.getElementById('todayHoursLbl').textContent=isToday?'زمان فعالیت امروز':'زمان این روز';
  document.getElementById('todayTestsLbl').textContent=isToday?'تست امروز':'تست این روز';
  document.getElementById('dashNextDay').disabled=isToday;
  const weeksLeft=Math.max(0,Math.ceil(daysLeft/7));
  document.getElementById('weekBadge').textContent=`${fa(weeksLeft)} هفته تا کنکور`;
  const goalMin=(state.settings.goalHours||40)*60;
  const pct=Math.min(100,Math.round(weekMin/goalMin*100));
  const donut=document.getElementById('donut');
  donut.style.background=`conic-gradient(#7c5cff 0% ${pct}%, #22d3ee ${pct}% ${pct}%, rgba(255,255,255,.08) ${pct}% 100%)`;
  document.getElementById('donutPct').textContent=fa(pct)+'٪';
  document.getElementById('weekTotal').textContent=hmTotalStr(weekMin);
  document.getElementById('weekGoal').textContent=fa(state.settings.goalHours||40);
  renderLineChart();
  renderMonthlyHeatmap();
  renderPie();
  renderExamDashChart();
  try{ renderExamInsights(); }catch(e){ console.warn('[dashboard] exam insights failed:',e); }
}
document.getElementById('dashPrevDay').onclick=()=>{dashDay--;renderDashboard();};
document.getElementById('dashNextDay').onclick=()=>{if(dashDay>=TODAY_JDN)return;dashDay++;renderDashboard();};
document.querySelectorAll('.pie-tab').forEach((b)=>{b.addEventListener('click',()=>{currentPie=b.dataset.pie;document.querySelectorAll('.pie-tab').forEach((x)=>x.classList.toggle('active',x===b));renderPie();});});
document.getElementById('editGoalBtn').onclick=()=>{
  openModal(`<div class="modal-head"><div class="card-title">هدف هفتگی</div><button class="icon-btn" data-close>✕</button></div><label class="lbl mt-0">ساعت</label><input dir="ltr" inputmode="numeric" class="input num-input" type="text" id="goalInput" min="1" max="120" value="${state.settings.goalHours||40}"><div class="row mt-16"><button class="btn ghost" data-close>انصراف</button><button class="btn primary" id="goalSave">ذخیره</button></div>`);
  document.getElementById('goalSave').onclick=()=>{const v=Math.max(1,Math.min(120,+document.getElementById('goalInput').value||40));state.settings.goalHours=v;save();closeModal();renderDashboard();toast('ذخیره شد ✓');};
};
document.getElementById('openExamCompareBtn').onclick=()=>openExamCompare();

/* ============================================================
   REPORT — گزارش تصویری با گزینه‌های خروجی
   ============================================================ */
let reportKind='day';
let reportAnchor=TODAY_JDN;

const REPORT_DEFAULT_OPTIONS={
  stats:true,
  timeline:true,
  charts:true,
  details:true,
  sleepPhone:true
};
let reportOptions={
  day:{...REPORT_DEFAULT_OPTIONS},
  week:{...REPORT_DEFAULT_OPTIONS}
};

/* ابعاد نوار خواب/گوشی داخل بخش آمار */
const SP_STRIP_H=64;
const SP_STRIP_GAP=18;   // فاصله از ردیف دوم تا نوار
const SP_STRIP_AFTER=18; // فاصله بعد از نوار

function getReportData(kind,anchor){
  anchor=anchor==null?TODAY_JDN:anchor;
  const keys=kind==='day'?[jKey(d2j(anchor))]:weekKeysOf(anchor);
  const allActs=countedActivities(keys);
  const acts=allActs.filter((a)=>a.subject!==OTHER_SUBJECT);
  const totalMin=sumMinutes(acts);
  const tb=testsBreakdown(acts);
  const subs=[...subjectsForPie(),{name:EXAM_SUBJECT,color:EXAM_COLOR}];
  const per=subs.map((s)=>({name:s.name,color:s.color,min:sumMinutes(acts.filter((a)=>a.subject===s.name))})).filter((x)=>x.min>0);
  const tot=totalMin||1;
  per.forEach((p)=>{p.pct=Math.round(p.min/tot*100);p.hours=p.min/60;});
  const perTest=subs.map((s)=>{const subActs=acts.filter((a)=>a.subject===s.name);const t=subActs.reduce((sum,a)=>sum+(a.tests?(a.tests.correct+a.tests.wrong+a.tests.blank):0),0);return{name:s.name,color:s.color,val:t};}).filter((x)=>x.val>0);
  const totTest=perTest.reduce((s,x)=>s+x.val,0)||1;
  perTest.forEach((x)=>x.pct=Math.round(x.val/totTest*100));
  let startMin=null,endMin=null;
  acts.forEach((a)=>{if(a.startMin!=null)startMin=startMin==null?a.startMin:Math.min(startMin,a.startMin);if(a.endMin!=null)endMin=endMin==null?a.endMin:Math.max(endMin,a.endMin);});
  const actsWithTime=acts.filter((a)=>a.startMin!=null&&a.endMin!=null);

  let timelineOtherActs=[];
  let timelineSleeps=[];
  if(kind==='day'){
    const dayKey=keys[0];
    timelineOtherActs=allActs.filter(a=>a.subject===OTHER_SUBJECT&&a.startMin!=null&&a.endMin!=null);
    state.sleeps.forEach(s=>{
      const endDate=s.endDate||s.date;
      const isStart=s.date===dayKey;
      const isEnd=endDate===dayKey;
      if(!isStart&&!isEnd)return;
      let top,bottom;
      if(s.date===endDate){
        if(!isStart)return;
        top=Math.max(s.startMin,START_MIN);
        bottom=Math.min(s.endMin,END_MIN);
      }else if(isStart){
        top=Math.max(s.startMin,START_MIN);
        bottom=Math.min(1440,END_MIN);
      }else{
        top=Math.max(0,START_MIN);
        bottom=Math.min(s.endMin,END_MIN);
      }
      if(bottom<=top)return;
      timelineSleeps.push({...s,_timelineStart:top,_timelineEnd:bottom});
    });
  }

  return{
    kind,keys,totalMin,
    tests:{c:tb.c,w:tb.w,b:tb.b},
    testTotal:tb.t,testPct:tb.pct,
    per,perTest,startMin,endMin,
    subtitle:kind==='day'?dayLabel(anchor):weekLabel(anchor),
    title:kind==='day'?'گزارش روز':'گزارش هفته',
    daysLeft:Math.max(0,KONKUR_JDN-anchor),
    anchor,
    acts:actsWithTime,
    allActs:acts,
    timelineOtherActs,timelineSleeps
  };
}

function reportCardHTML(d){
  const rows=d.per.length?d.per.map((p)=>`<div class="rc-row"><div class="n" style="color:${p.color}">${esc(p.name)}</div><div class="t"><div class="f" style="width:${p.pct}%;background:linear-gradient(90deg,${p.color},${p.color}88)"></div></div><div class="v">${fa(p.pct)}٪</div></div>`).join(''):'<div class="muted report-empty">داده‌ای ثبت نشده</div>';
  const leftLabel=d.kind==='day'?`${fa(d.daysLeft)} روز مانده`:`${fa(Math.ceil(d.daysLeft/7))} هفته مانده`;
  return`<div class="report-card"><div class="rc-head"><div class="rc-title">${d.title}</div><div class="rc-sub">${d.subtitle}</div></div><div class="rc-stats"><div class="rc-stat"><b>${hmTotalStr(d.totalMin)}</b><span>ساعت مطالعه</span></div><div class="rc-stat"><b>${fa(d.testTotal)}</b><span>تست زده</span></div><div class="rc-stat"><b>${fa(d.testPct)}٪</b><span>درصد تست</span></div></div>${rows}<div class="report-footline">کنکور ۱۴۰۶ • ۱۱ تیر — ${leftLabel}</div><div class="report-madeby">Made by MH.Mahdipanah</div></div>`;
}

function renderReportToggles(){
  const box=document.getElementById('reportToggles');
  if(!box)return;
  const opts=reportOptions[reportKind];
  const items=[
    {key:'stats',label:'📊 آمار'},
    {key:'sleepPhone',label:'😴 خواب و گوشی'},
    {key:'timeline',label:'⏰ تایم‌لاین'},
    {key:'charts',label:'🥧 نمودار'},
    {key:'details',label:'📝 جزییات'}
  ];
  box.innerHTML=items.map((it)=>{
    const active=opts[it.key];
    const disabled=it.key==='sleepPhone'&&!opts.stats;
    return`<button type="button" class="report-toggle ${active?'active':''} ${disabled?'disabled':''}" data-opt="${it.key}" ${disabled?'disabled':''}>${it.label}</button>`;
  }).join('');
  box.querySelectorAll('.report-toggle').forEach((btn)=>{
    if(btn.disabled)return;
    btn.onclick=()=>{
      const key=btn.dataset.opt;
      opts[key]=!opts[key];
      renderReportToggles();
      if(reportKind==='day') renderDayReportPreview();
    };
  });
}

function openReport(kind){
  reportKind=kind||'day';
  reportAnchor=TODAY_JDN;
  openModal(`
    <div class="modal-head report-modal-head">
      <div class="wr-top-right">
        <div class="wr-logo report-modal-logo">📊</div>
        <div class="min-w-0">
          <div class="card-title mb-0">گزارش تصویری</div>
          <div class="wr-sub">پیشنمایش و دانلود خروجی روزانه / هفتگی</div>
        </div>
      </div>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="seg" id="reportSeg">
      <button class="seg-btn" data-kind="day">روز</button>
      <button class="seg-btn" data-kind="week">هفته</button>
    </div>
    <div class="report-nav">
      <button class="rn-btn" id="rPrev">›</button>
      <div class="rn-label">
        <div id="rLabel"></div>
        <div id="rToday">برو به امروز</div>
      </div>
      <button class="rn-btn" id="rNext">‹</button>
    </div>
    <div class="card-title my-14-8 fs-11h" id="reportTogglesTitle">📊 بخش‌های خروجی تصویری</div>
    <div class="report-toggles" id="reportToggles"></div>
    <div id="reportBody"></div>
    <button class="btn primary mt-6" id="dlReport">⬇ دانلود تصویر گزارش روز</button>
    <div class="report-madeby">Made by MH.Mahdipanah</div>
  `);
  document.getElementById('modalContent').classList.add('report-modal', 'plan-export-modal');
  document.querySelectorAll('#reportSeg .seg-btn').forEach((b)=>{b.onclick=()=>{reportKind=b.dataset.kind;updateReportView();};});
  document.getElementById('rPrev').onclick=()=>{reportAnchor-=(reportKind==='day'?1:7);updateReportView();};
  document.getElementById('rNext').onclick=()=>{const step=(reportKind==='day'?1:7);if(reportAnchor+step>TODAY_JDN)return;reportAnchor+=step;updateReportView();};
  document.getElementById('rToday').onclick=()=>{reportAnchor=TODAY_JDN;updateReportView();};
  updateReportView();
}

function renderDayReportPreview(){
  const bodyEl=document.getElementById('reportBody');
  if(!bodyEl||reportKind!=='day')return;
  const token=(bodyEl._reportToken=(bodyEl._reportToken||0)+1);
  bodyEl.innerHTML='<div class="muted report-empty">در حال ساخت پیش‌نمایش گزارش روزانه...</div>';
  generateDailyReportCanvas('day',reportAnchor,reportOptions.day).then((cv)=>{
    if(bodyEl._reportToken!==token) return;
    try{
      const url=cv.toDataURL('image/png');
      bodyEl.innerHTML=`<div class="cwr-preview plan-preview"><img src="${url}" alt="پیش‌نمایش گزارش روزانه"></div>`;
    }catch(e){
      bodyEl.innerHTML='<div class="muted report-empty">خطا در نمایش پیش‌نمایش</div>';
    }
  }).catch(()=>{
    if(bodyEl._reportToken!==token) return;
    bodyEl.innerHTML='<div class="muted report-empty">خطا در ساخت پیش‌نمایش</div>';
  });
}

function updateReportView(){
  document.querySelectorAll('#reportSeg .seg-btn').forEach((b)=>b.classList.toggle('active',b.dataset.kind===reportKind));
  const togglesTitle=document.getElementById('reportTogglesTitle');
  const togglesBox=document.getElementById('reportToggles');
  const bodyEl=document.getElementById('reportBody');
  const dlBtn=document.getElementById('dlReport');
  const rToday=document.getElementById('rToday');
  const isWeek=reportKind==='week';

  if(isWeek){
    if(togglesTitle) togglesTitle.classList.add('hidden');
    if(togglesBox) togglesBox.classList.add('hidden');
    if(typeof wrAnchor!=='undefined') wrAnchor=reportAnchor;
    if(bodyEl){
      const token=(bodyEl._reportToken=(bodyEl._reportToken||0)+1);
      bodyEl.innerHTML='<div class="muted report-empty">در حال ساخت پیش‌نمایش گزارش هفتگی...</div>';
      if(typeof generateWeeklyReportCanvas==='function'){
        generateWeeklyReportCanvas().then((cv)=>{
          if(bodyEl._reportToken!==token) return;
          try{
            const url=cv.toDataURL('image/png');
            bodyEl.innerHTML=`<div class="cwr-preview plan-preview"><img src="${url}" alt="پیش‌نمایش گزارش هفتگی"></div>`;
          }catch(e){
            bodyEl.innerHTML='<div class="muted report-empty">خطا در نمایش پیش‌نمایش</div>';
          }
        }).catch(()=>{
          if(bodyEl._reportToken!==token) return;
          bodyEl.innerHTML='<div class="muted report-empty">خطا در ساخت پیش‌نمایش</div>';
        });
      }else{
        bodyEl.innerHTML='<div class="muted report-empty">تابع گزارش هفتگی در دسترس نیست</div>';
      }
    }
    document.getElementById('rLabel').textContent=(typeof wrWeekRangeText==='function')?wrWeekRangeText():weekLabel(reportAnchor);
    document.getElementById('rNext').disabled=reportAnchor>=weekStartJdn(TODAY_JDN);
    if(rToday){ rToday.textContent='برو به این هفته'; rToday.classList.toggle('hidden', reportAnchor>=weekStartJdn(TODAY_JDN)); }
    if(dlBtn){
      dlBtn.textContent='⬇ دانلود گزارش تصویری هفته (PNG)';
      dlBtn.onclick=()=>{ if(typeof wrAnchor!=='undefined') wrAnchor=reportAnchor; if(typeof downloadWeeklyImage==='function') downloadWeeklyImage(); };
    }
    return;
  }

  if(togglesTitle) togglesTitle.classList.remove('hidden');
  if(togglesBox) togglesBox.classList.remove('hidden');
  renderReportToggles();
  document.getElementById('rLabel').textContent=dayLabel(reportAnchor);
  document.getElementById('rNext').disabled=reportAnchor>=TODAY_JDN;
  if(rToday){ rToday.textContent='برو به امروز'; rToday.classList.toggle('hidden', reportAnchor>=TODAY_JDN); }
  if(dlBtn){
    dlBtn.textContent='⬇ دانلود گزارش تصویری روز';
    dlBtn.onclick=()=>downloadReportImage(reportKind,reportAnchor,reportOptions[reportKind]);
  }
  renderDayReportPreview();
}

/* ============ HELPERS ============ */
function rr(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

function drawSectionDivider(x,W,pad,y){
  const lineY=y-14;
  if(lineY<400)return;
  const grad=x.createLinearGradient(pad,0,W-pad,0);
  grad.addColorStop(0,'rgba(255,255,255,0)');
  grad.addColorStop(.5,'rgba(255,255,255,.18)');
  grad.addColorStop(1,'rgba(255,255,255,0)');
  x.strokeStyle=grad;x.lineWidth=1.5;
  x.beginPath();x.moveTo(pad,lineY);x.lineTo(W-pad,lineY);x.stroke();
  x.fillStyle='rgba(255,255,255,.25)';
  x.beginPath();x.arc(W/2,lineY,2.5,0,Math.PI*2);x.fill();
}

/* ============================================================
   HEIGHT MEASURE
   ============================================================ */
function measureStatsHeight(opts){
  // ردیف۱ + ردیف۲ = 332 | نوار خواب/گوشی: gap(18)+strip(64)+after(18) = 100
  return 332 + (opts.sleepPhone ? 100 : 0);
}

function measureChartsHeight(d){
  const maxLegend=Math.max(d.per.length,d.perTest.length,3);
  return 490 + maxLegend*32;
}

function measureDetailsHeight(d){
  const acts=(d.allActs||[]).filter(a=>(a.minutes||0)>0);
  if(!acts.length) return 160;
  const count = d.kind==='day' ? acts.length : new Set(acts.map(a=>a.subject)).size;
  // عنوان(90) + هدر(54) + ردیف‌ها(48) + جمع(64) + فاصله(30)
  return 90 + 54 + count*48 + 64 + 30;
}

/* ============================================================
   SECTION DRAWERS
   ============================================================ */
function drawReportTitleSection(x,W,pad,y,d){
  const R=W-pad;
  x.fillStyle='rgba(255,255,255,.5)';
  x.font='600 30px Vazirmatn, Tahoma, sans-serif';
  x.fillText('مسیر کنکور  •  کارنامه مطالعه',R,pad+26);
  x.fillStyle='#fff';
  x.font='800 68px Vazirmatn, Tahoma, sans-serif';
  x.fillText(d.title,R,pad+100);
  x.fillStyle='rgba(255,255,255,.62)';
  x.font='500 30px Vazirmatn, Tahoma, sans-serif';
  x.fillText(d.subtitle,R,pad+152);
  x.fillStyle='rgba(34,211,238,.85)';
  x.font='700 26px Vazirmatn, Tahoma, sans-serif';
  x.fillText(profileLabel(),R,pad+198);
  return 350;
}

/* ============================================================
   TIME RANGE BLOCK — شروع ↔ پایان (بدون مدت)
   ============================================================ */
function drawTimeRangeBox(x,bx,by,bw,bh,startMin,endMin){
  rr(x,bx,by,bw,bh,26);
  const bgGrad=x.createLinearGradient(bx,by,bx+bw,by);
  bgGrad.addColorStop(0,'rgba(252,211,77,.10)');
  bgGrad.addColorStop(.5,'rgba(255,255,255,.06)');
  bgGrad.addColorStop(1,'rgba(110,231,183,.12)');
  x.fillStyle=bgGrad;x.fill();
  x.strokeStyle='rgba(255,255,255,.16)';x.lineWidth=2;x.stroke();

  const cy=by+bh/2-6;
  const padIn=42;

  /* راست = شروع */
  const startX=bx+bw-padIn;
  x.textAlign='right';x.textBaseline='middle';
  x.fillStyle='#6ee7b7';
  x.font='800 48px Vazirmatn, Tahoma, sans-serif';
  const startTxt=startMin!=null?minToStr(startMin):'—';
  x.fillText(startTxt,startX,cy);
  const startW=x.measureText(startTxt).width;
  x.fillStyle='rgba(110,231,183,.75)';
  x.font='600 16px Vazirmatn, Tahoma, sans-serif';
  x.fillText('⏰ شروع مطالعه',startX,cy+36);

  /* چپ = پایان */
  const endX=bx+padIn;
  x.textAlign='left';
  x.fillStyle='#fcd34d';
  x.font='800 48px Vazirmatn, Tahoma, sans-serif';
  const endTxt=endMin!=null?minToStr(endMin):'—';
  x.fillText(endTxt,endX,cy);
  const endW=x.measureText(endTxt).width;
  x.fillStyle='rgba(252,211,77,.75)';
  x.font='600 16px Vazirmatn, Tahoma, sans-serif';
  x.fillText('⏹ پایان مطالعه',endX,cy+36);

  /* خط اتصال (بدون چیپ مدت) */
  const lineR=startX-startW-24;
  const lineL=endX+endW+24;
  if(lineR<=lineL+10)return;

  const lineGrad=x.createLinearGradient(lineR,0,lineL,0);
  lineGrad.addColorStop(0,'rgba(110,231,183,.85)');
  lineGrad.addColorStop(1,'rgba(252,211,77,.85)');
  x.strokeStyle=lineGrad;x.lineWidth=2.5;
  x.setLineDash([8,6]);
  x.beginPath();x.moveTo(lineR,cy);x.lineTo(lineL,cy);x.stroke();
  x.setLineDash([]);

  x.fillStyle='#6ee7b7';x.beginPath();x.arc(lineR,cy,5,0,Math.PI*2);x.fill();
  x.fillStyle='#fcd34d';x.beginPath();x.arc(lineL,cy,5,0,Math.PI*2);x.fill();
}

/* ============================================================
   STATS — ردیف۱: فعالیت+تست | ردیف۲: شروع/پایان | نوار خواب/گوشی
   ============================================================ */
function drawReportStatsSection(x,W,pad,y0,d,opts){
  const isDay=d.kind==='day';
  const statH=140,statGap=22;
  const totalW=W-pad*2;

  const testW=Math.round(totalW*0.32);
  const activityW=totalW-testW-statGap;
  const testX=pad;
  const activityX=pad+testW+statGap;

  const drawBox=(bx,by,bw,bh,value,label,color,icon)=>{
    rr(x,bx,by,bw,bh,26);
    x.fillStyle='rgba(255,255,255,.07)';x.fill();
    x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=2;x.stroke();
    x.textAlign='center';x.textBaseline='middle';
    x.fillStyle=color;
    x.font='800 52px Vazirmatn, Tahoma, sans-serif';
    x.fillText(value,bx+bw/2,by+bh/2-14);
    x.fillStyle='rgba(255,255,255,.55)';
    x.font='500 22px Vazirmatn, Tahoma, sans-serif';
    x.fillText(label,bx+bw/2,by+bh/2+36);
    if(icon){
      x.textAlign='right';
      x.fillStyle=color;
      x.font='700 26px Vazirmatn, Tahoma, sans-serif';
      x.fillText(icon,bx+bw-18,by+22);
    }
  };

  drawBox(activityX,y0,activityW,statH,hmTotalStr(d.totalMin),'ساعت فعالیت','#c7bfff');
  drawBox(testX,y0,testW,statH,fa(d.testTotal),'تست زده','#4de2f5');
  const row2Y=y0+statH+statGap;

  if(isDay){
    drawTimeRangeBox(x,pad,row2Y,totalW,statH,d.startMin,d.endMin);
  }else{
    drawBox(activityX,row2Y,activityW,statH,hmTotalStr(Math.round(d.totalMin/7)),'میانگین فعالیت روزانه','#6ee7b7');
    drawBox(testX,row2Y,testW,statH,fa((d.testTotal/7).toFixed(1)),'میانگین تست روزانه','#fcd34d');
  }

  let endY=row2Y+statH+SP_STRIP_AFTER;

  if(opts.sleepPhone){
    const stripY=row2Y+statH+SP_STRIP_GAP;
    drawSleepPhoneStrip(x,W,pad,stripY,d);
    endY=stripY+SP_STRIP_H+SP_STRIP_AFTER;
  }

  return endY;
}

/* ============================================================
   SLEEP / PHONE STRIP — داخل بخش آمار، متن وسط‌چین
   ============================================================ */
function drawSleepPhoneStrip(x,W,pad,boxY,d){
  let sleepTotal=0,phoneTotal=0;
  d.keys.forEach(k=>{
    state.sleeps.filter(sl=>sl.date===k).forEach(sl=>{sleepTotal+=(+sl.minutes||0);});
    state.phones.filter(p=>p.date===k).forEach(p=>{phoneTotal+=(+p.minutes||0);});
  });

  const innerW=W-pad*2;
  const boxX=pad, boxW=innerW, boxH=SP_STRIP_H;

  rr(x,boxX,boxY,boxW,boxH,18);
  const bg=x.createLinearGradient(boxX,boxY,boxX+boxW,boxY);
  bg.addColorStop(0,'rgba(252,165,165,.10)');   // چپ = گوشی
  bg.addColorStop(.5,'rgba(255,255,255,.03)');
  bg.addColorStop(1,'rgba(165,180,252,.10)');   // راست = خواب
  x.fillStyle=bg;x.fill();
  x.strokeStyle='rgba(255,255,255,.10)';x.lineWidth=1.5;x.stroke();

  const midX=boxX+boxW/2;
  x.strokeStyle='rgba(255,255,255,.14)';x.lineWidth=1.5;
  x.beginPath();x.moveTo(midX,boxY+12);x.lineTo(midX,boxY+boxH-12);x.stroke();

  /* راست = خواب (وسط‌چین در نیمه راست) */
  const rCx=boxX+boxW*0.75;
  x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='rgba(165,180,252,.85)';
  x.font='600 14px Vazirmatn, Tahoma, sans-serif';
  x.fillText('🌙 مجموع خواب',rCx,boxY+18);
  x.fillStyle='#a5b4fc';
  x.font='800 26px Vazirmatn, Tahoma, sans-serif';
  x.fillText(sleepTotal>0?hmString(sleepTotal):'—',rCx,boxY+44);

  /* چپ = گوشی (وسط‌چین در نیمه چپ) */
  const lCx=boxX+boxW*0.25;
  x.fillStyle='rgba(252,165,165,.85)';
  x.font='600 14px Vazirmatn, Tahoma, sans-serif';
  x.fillText('📱 مجموع گوشی',lCx,boxY+18);
  x.fillStyle='#fca5a5';
  x.font='800 26px Vazirmatn, Tahoma, sans-serif';
  x.fillText(phoneTotal>0?hmString(phoneTotal):'—',lCx,boxY+44);

  return boxY+boxH;
}

/* ============================================================
   TIMELINE — روز
   ============================================================ */
/* Canvas timeline must use the same minute axis as the hour grid. The DOM
   layout helper widens short blocks for readability, which shifts later blocks
   away from their real times in an image; overlapping items use lanes instead. */
function reportTimelineExactLayout(items,tlW,startMin,endMin,minWidth){
  const domainStart=+startMin||0,domainEnd=+endMin||domainStart+1440;
  const span=Math.max(1,domainEnd-domainStart);
  const pxPerMin=tlW/span;
  const minVisualWidth=Math.max(0,+minWidth||0);
  const list=(items||[]).filter(Boolean).map((item,index)=>{
    const start=+(item.startMin!=null?item.startMin:item.start)||0;
    const end=item.endMin!=null?+item.endMin:start+(+item.durMin||0);
    return {...item,index,start,end:Math.max(start,end)};
  }).filter(item=>item.end>domainStart&&item.start<domainEnd)
    .sort((a,b)=>a.start-b.start||a.end-b.end||a.index-b.index);
  const laneEnds=[];
  list.forEach(item=>{
    const start=Math.max(domainStart,item.start),end=Math.min(domainEnd,item.end);
    const left=(start-domainStart)*pxPerMin;
    const right=(end-domainStart)*pxPerMin;
    const exactWidth=Math.max(1,right-left);
    /* Short blocks get just enough visual width for a name. Their start stays
       on the real minute axis and overlaps move to a lane instead of shifting
       later blocks into the wrong hour. */
    const visualWidth=Math.max(minVisualWidth,exactWidth);
    let lane=laneEnds.findIndex(laneEnd=>laneEnd<=left+.5);
    if(lane<0){lane=laneEnds.length;laneEnds.push(0);}
    laneEnds[lane]=left+visualWidth;
    item._layoutStart=start;item._layoutEnd=end;
    item.left=left;item.width=visualWidth;item.exactWidth=exactWidth;item._lane=lane;
  });
  return {blocks:list,lanes:Math.max(1,laneEnds.length),pxPerMin};
}

/* The image timeline keeps the hour axis as the only clock reference. A block
   only needs the item name; printing start/end times inside it made short
   blocks unreadable and visually crowded. */
function reportTimelineItemName(item){
  if(!item)return '';
  if(item._kind==='sleep')return '🌙 خواب';
  if(item._kind==='other'&&item.topic)return item.topic;
  return item.subject||item.topic||'';
}

function drawReportTimelineDaySection(x,W,pad,y0,d){
  const R=W-pad;
  x.textAlign='right';
  x.fillStyle='#fff';
  x.font='700 34px Vazirmatn, Tahoma, sans-serif';
  x.fillText('تایم‌لاین فعالیت‌ها',R,y0+28);
  x.textAlign='left';
  x.fillStyle='rgba(255,255,255,.4)';
  x.font='500 20px Vazirmatn, Tahoma, sans-serif';
  x.fillText(`${minToStr(START_MIN)} تا ${minToStr(END_MIN)}`,pad+10,y0+28);

  const tlLeft=pad+10,tlRight=W-pad-10;
  const tlW=tlRight-tlLeft;
  const tlTop=y0+60,tlH=160;
  const totalRange=Math.max(1,END_MIN-START_MIN);

  rr(x,tlLeft,tlTop,tlW,tlH,22);
  const trackGrad=x.createLinearGradient(tlLeft,tlTop,tlLeft,tlTop+tlH);
  trackGrad.addColorStop(0,'rgba(255,255,255,.10)');
  trackGrad.addColorStop(.5,'rgba(255,255,255,.05)');
  trackGrad.addColorStop(1,'rgba(255,255,255,.02)');
  x.fillStyle=trackGrad;x.fill();
  x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=2;x.stroke();

  const tickStep=180;
  for(let m=Math.ceil(START_MIN/tickStep)*tickStep;m<=END_MIN;m+=tickStep){
    const hx=tlLeft+(m-START_MIN)/totalRange*tlW;
    x.beginPath();x.moveTo(hx,tlTop+10);x.lineTo(hx,tlTop+tlH-10);
    x.strokeStyle='rgba(255,255,255,.08)';x.lineWidth=1;x.stroke();
    const clampedHx=Math.max(tlLeft+24,Math.min(tlRight-24,hx));
    x.textAlign='center';x.textBaseline='top';
    x.fillStyle='rgba(255,255,255,.42)';
    x.font='500 17px Vazirmatn, Tahoma, sans-serif';
    x.fillText(minToStr(m),clampedHx,tlTop+tlH+12);
  }

  const blockY=tlTop+30,blockH=tlH-60;
  const allTimelineItems=[
    ...d.acts.map(a=>({...a,_kind:'study'})),
    ...(d.timelineOtherActs||[]).map(a=>({...a,_kind:'other'})),
    ...(d.timelineSleeps||[]).map(s=>({...s,startMin:s._timelineStart,endMin:s._timelineEnd,_kind:'sleep'}))
  ];

  if(!allTimelineItems.length){
    x.textAlign='center';x.textBaseline='middle';
    x.fillStyle='rgba(255,255,255,.35)';
    x.font='500 22px Vazirmatn, Tahoma, sans-serif';
    x.fillText('مطالعه‌ای ثبت نشده',tlLeft+tlW/2,tlTop+tlH/2);
  }else{
    /* Blocks stay on the real minute axis; overlaps use vertical lanes so a
       later activity is never pushed under the wrong hour label. */
    const layout=reportTimelineExactLayout(allTimelineItems,tlW,START_MIN,END_MIN,28);
    const by=blockY+2;
    const laneH=Math.max(12,Math.min(30,Math.floor((blockH-4)/layout.lanes)));
    const bh=Math.max(8,laneH-4);
    const rad=Math.min(8,bh/2);

    layout.blocks.forEach(a=>{
      const bx=tlLeft+a.left;
      const bw=Math.max(1,Math.min(a.width,tlLeft+tlW-bx));
      const byLane=by+a._lane*laneH;
      if(bw<=0||byLane+bh>tlTop+tlH-4)return;
      const label=reportTimelineItemName(a);

      if(a._kind==='sleep'){
        x.save();
        rr(x,bx+1,byLane,bw-2,bh,rad);
        x.fillStyle='rgba(99,102,241,.28)';x.fill();
        x.clip();
        x.strokeStyle='rgba(99,102,241,.70)';x.lineWidth=2;
        for(let i=-bh;i<bw+bh;i+=8){x.beginPath();x.moveTo(bx+i,byLane);x.lineTo(bx+i+bh,byLane+bh);x.stroke();}
        x.restore();
        rr(x,bx+1,byLane,bw-2,bh,rad);
        x.strokeStyle='rgba(99,102,241,.88)';x.lineWidth=2;x.stroke();
        if(bw>26&&bh>10){
          x.save();
          rr(x,bx+1,byLane,bw-2,bh,rad);x.clip();
          x.fillStyle='#c7d2fe';
          x.font='700 10px Vazirmatn, Tahoma, sans-serif';
          x.textAlign='center';x.textBaseline='middle';
          x.fillText(label,bx+bw/2,byLane+bh/2);
          x.restore();
        }
      }else{
        const c=subjColor(a.subject);
        const isOther=a._kind==='other';
        x.save();
        x.shadowColor=c+'aa';
        x.shadowBlur=18;x.shadowOffsetY=2;
        rr(x,bx+1,byLane,bw-2,bh,rad);
        const grad=x.createLinearGradient(bx,byLane,bx,byLane+bh);
        grad.addColorStop(0,c+'ee');
        grad.addColorStop(.5,c+'bb');
        grad.addColorStop(1,c+'88');
        x.fillStyle=grad;x.fill();
        x.restore();
        rr(x,bx+1,byLane,bw-2,bh,rad);
        if(isOther){
          x.strokeStyle='rgba(255,255,255,.7)';x.lineWidth=1.8;
          x.setLineDash([4,3]);x.stroke();x.setLineDash([]);
        }else{
          x.strokeStyle='rgba(255,255,255,.4)';x.lineWidth=1.5;x.stroke();
        }
        if(bw>26&&bh>10){
          let name=label;
          while(name.length>1&&x.measureText(name).width>bw-10)name=name.slice(0,-1);
          if(name!==label&&name.length>1)name+='…';
          x.fillStyle='#fff';
          x.font='700 10px Vazirmatn, Tahoma, sans-serif';
          x.textAlign='center';x.textBaseline='middle';
          x.fillText(name,bx+bw/2,byLane+bh/2);
        }
      }
    });
  }

  return y0+290;
}

/* ============================================================
   TIMELINE — هفته
   ============================================================ */
function drawReportTimelineWeekSection(x,W,pad,y0,d){
  const R=W-pad;
  x.textAlign='right';
  x.fillStyle='#fff';
  x.font='700 34px Vazirmatn, Tahoma, sans-serif';
  x.fillText('⏰ تایم‌لاین هفته',R,y0+28);

  let minT=6*60,maxT=24*60;
  d.keys.forEach(k=>{
    countedActivities([k]).filter(a=>a.subject!==OTHER_SUBJECT&&a.startMin!=null&&a.endMin!=null).forEach(a=>{
      if(a.startMin<minT)minT=a.startMin;
      if(a.endMin>maxT)maxT=a.endMin;
    });
  });
  minT=Math.floor(minT/60)*60;
  maxT=Math.ceil(maxT/60)*60;
  if(maxT<=minT)maxT=minT+60;

  const labelW=155,totalW=130;
  const barL=pad+totalW;
  const barR=R-labelW;
  const barW=barR-barL;
  const rowH=52;
  const rangeMin=maxT-minT;

  x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#8b94ad';x.font='500 15px Vazirmatn, Tahoma, sans-serif';
  for(let h=Math.ceil(minT/60);h*60<=maxT;h+=3){
    const hx=barL+((h*60-minT)/rangeMin)*barW;
    x.fillText(fa(h)+':۰۰',hx,y0+56+15);
  }

  const startY=y0+56+32;

  d.keys.forEach((k,i)=>{
    const rowY=startY+i*rowH;
    const jd=parseKey(k);
    const jdn=jdnFromKey(k);
    const isToday=k===TODAY_KEY;

    x.textAlign='right';x.textBaseline='middle';
    x.fillStyle=isToday?'#22d3ee':'#cbd3e8';
    x.font='800 18px Vazirmatn, Tahoma, sans-serif';
    x.fillText(DOW[dowIndex(jdn)],R,rowY+rowH/2-9);
    x.fillStyle='#8b94ad';
    x.font='500 13px Vazirmatn, Tahoma, sans-serif';
    x.fillText(`${fa(jd.jd)} ${MONTHS[jd.jm-1]}`,R,rowY+rowH/2+11);

    rr(x,barL,rowY+10,barW,rowH-20,8);
    x.fillStyle='rgba(255,255,255,.04)';x.fill();

    const dayActs=countedActivities([k]).filter(a=>a.subject!==OTHER_SUBJECT&&a.startMin!=null&&a.endMin!=null);
    let dayTotal=0;
    dayActs.forEach(a=>{dayTotal+=(+a.minutes||0);});
    const rowLayout=layoutTimelineBlocks(dayActs,barW,{
      startMin:minT,endMin:maxT,minWidth:12,minGap:2
    });
    rowLayout.blocks.forEach(a=>{
      const c=subjColor(a.subject);
      const x1=barL+a.left;
      const w=Math.max(1,Math.min(a.width,barL+barW-x1));
      x.fillStyle=c;
      x.fillRect(x1,rowY+10,w,rowH-20);
    });

    x.textAlign='center';x.textBaseline='middle';
    x.fillStyle=dayTotal>0?'#4de2f5':'#4b5470';
    x.font='800 17px Vazirmatn, Tahoma, sans-serif';
    x.fillText(dayTotal>0?hmString(dayTotal):'—',pad+totalW/2,rowY+rowH/2);
  });

  const legendY=startY+7*rowH+25;
  const specSubs=state.subjects.filter(s=>s.type==='specialized'&&d.per.some(p=>p.name===s.name&&p.min>0));
  x.textAlign='right';x.textBaseline='middle';x.font='600 15px Vazirmatn, Tahoma, sans-serif';
  let lx=R;
  specSubs.forEach(s=>{
    const labelWidth=x.measureText(s.name).width+24;
    x.fillStyle=s.color;
    x.fillRect(lx-12,legendY-6,12,4);
    x.fillStyle='#cbd3e8';
    x.textAlign='right';
    x.fillText(s.name,lx-18,legendY);
    lx-=labelWidth+18;
    if(lx<pad+60)return;
  });

  return y0+56+32+7*rowH+70;
}

/* ============================================================
   CHARTS
   ============================================================ */
function drawReportChartsSection(x,W,pad,y0,d){
  const R=W-pad;
  x.textAlign='right';
  x.fillStyle='#fff';
  x.font='700 34px Vazirmatn, Tahoma, sans-serif';
  x.fillText('سهم دروس',R,y0+28);

  const donutTitleY=y0+28;
  const donutCY=donutTitleY+185;
  const outerR=135,innerR=82;
  const donut1CX=W*0.72;
  const donut2CX=W*0.28;

  const drawDonut=(cx2,cy2,oR,iR,data)=>{
    const total=data.reduce((s,dd)=>s+(dd.val||0),0);
    if(!data.length||total<=0){
      x.beginPath();x.arc(cx2,cy2,oR,0,Math.PI*2);x.arc(cx2,cy2,iR,0,Math.PI*2,true);
      x.fillStyle='rgba(255,255,255,.07)';x.fill();
    }else{
      let st=-Math.PI/2;
      data.forEach((dd)=>{
        const ang=(dd.val/total)*Math.PI*2;
        x.beginPath();x.arc(cx2,cy2,oR,st,st+ang);x.arc(cx2,cy2,iR,st+ang,st,true);x.closePath();
        x.fillStyle=dd.color;x.fill();
        st+=ang;
      });
    }
  };
  drawDonut(donut1CX,donutCY,outerR,innerR,d.per.map(p=>({color:p.color,val:p.min})));
  drawDonut(donut2CX,donutCY,outerR,innerR,d.perTest.map(p=>({color:p.color,val:p.val})));

  x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#fff';x.font='800 38px Vazirmatn, Tahoma, sans-serif';
  x.fillText(hmTotalStr(d.totalMin),donut1CX,donutCY-12);
  x.fillStyle='rgba(255,255,255,.55)';x.font='500 20px Vazirmatn, Tahoma, sans-serif';
  x.fillText('ساعت',donut1CX,donutCY+24);
  x.fillStyle='#fff';x.font='800 38px Vazirmatn, Tahoma, sans-serif';
  x.fillText(fa(d.testTotal),donut2CX,donutCY-12);
  x.fillStyle='rgba(255,255,255,.55)';x.font='500 20px Vazirmatn, Tahoma, sans-serif';
  x.fillText('تست',donut2CX,donutCY+24);

  x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='rgba(255,255,255,.75)';
  x.font='700 25px Vazirmatn, Tahoma, sans-serif';
  x.fillText('سهم مطالعه',donut1CX,donutCY+outerR+45);
  x.fillText('سهم تست',donut2CX,donutCY+outerR+45);

  const legendStartY=donutCY+outerR+80;
  const itemH=32;
  const drawLegend=(cx2,list,mode)=>{
    if(!list.length){
      x.textAlign='center';x.textBaseline='middle';
      x.fillStyle='rgba(255,255,255,.4)';
      x.font='500 20px Vazirmatn, Tahoma, sans-serif';
      x.fillText('داده‌ای نیست',cx2,legendStartY+itemH/2);
      return;
    }
    list.forEach((dd,i)=>{
      const y=legendStartY+i*itemH;
      x.beginPath();x.arc(cx2+145,y,7,0,Math.PI*2);
      x.fillStyle=dd.color;x.fill();
      x.textAlign='right';x.textBaseline='middle';
      x.fillStyle='#cfd6ea';
      x.font='600 18px Vazirmatn, Tahoma, sans-serif';
      let nm=dd.name;
      while(x.measureText(nm).width>85&&nm.length>2)nm=nm.slice(0,-1);
      if(nm!==dd.name)nm=nm.slice(0,-1)+'…';
      x.fillText(nm,cx2+130,y);
      x.textAlign='center';x.fillStyle='#4de2f5';x.font='700 15px Vazirmatn, Tahoma, sans-serif';
      if(mode==='study')x.fillText(hmTotalStr(dd.min),cx2-15,y);
      else x.fillText(fa(dd.val)+' تست',cx2-15,y);
      x.textAlign='left';x.fillStyle='rgba(255,255,255,.7)';x.font='700 16px Vazirmatn, Tahoma, sans-serif';
      x.fillText(fa(Math.round(dd.pct))+'٪',cx2-145,y);
    });
  };
  drawLegend(donut1CX,d.per,'study');
  drawLegend(donut2CX,d.perTest,'test');

  const maxLegend=Math.max(d.per.length,d.perTest.length,1);
  return legendStartY+maxLegend*itemH+30;
}

/* ============================================================
   DETAILS — جدول بازطراحی‌شده با ستون «جمع تست»
   ============================================================ */
function drawReportDetailsSection(x,W,pad,y0,d){
  const R=W-pad;
  const innerW=W-pad*2;
  const isDay=d.kind==='day';

  const acts=(d.allActs||[]).filter(a=>(a.minutes||0)>0);
  const count=isDay?acts.length:new Set(acts.map(a=>a.subject)).size;

  /* عنوان */
  x.textAlign='right';x.textBaseline='middle';
  x.fillStyle='#fff';
  x.font='700 34px Vazirmatn, Tahoma, sans-serif';
  x.fillText('📝 جزییات مطالعه',R,y0+28);

  x.textAlign='left';
  x.fillStyle='rgba(255,255,255,.45)';
  x.font='600 16px Vazirmatn, Tahoma, sans-serif';
  x.fillText(`${fa(count)} ${isDay?'فعالیت':'درس'}`,pad,y0+28);

  x.textAlign='right';
  x.fillStyle='rgba(255,255,255,.35)';
  x.font='500 16px Vazirmatn, Tahoma, sans-serif';
  x.fillText(isDay?'ترتیب زمانی فعالیت‌ها':'جمع‌بندی هفتگی دروس',R,y0+60);

  let y=y0+90;

  if(!acts.length){
    x.textAlign='center';x.textBaseline='middle';
    x.fillStyle='rgba(255,255,255,.4)';
    x.font='500 22px Vazirmatn, Tahoma, sans-serif';
    x.fillText('فعالیتی ثبت نشده',W/2,y+30);
    return y+70;
  }

  /* ساخت ردیف‌ها */
  let rows;
  if(isDay){
    rows=acts.slice().sort((a,b)=>(a.startMin||0)-(b.startMin||0)).map(a=>({
      subject:a.subject,
      topic:a.topic||'بدون مبحث',
      minutes:a.minutes||0,
      c:a.tests?a.tests.correct||0:0,
      w:a.tests?a.tests.wrong||0:0,
      b:a.tests?a.tests.blank||0:0
    }));
  }else{
    const grouped={};
    acts.forEach(a=>{
      if(!grouped[a.subject])grouped[a.subject]={minutes:0,c:0,w:0,b:0,topics:new Set()};
      grouped[a.subject].minutes+=(a.minutes||0);
      if(a.tests){grouped[a.subject].c+=a.tests.correct||0;grouped[a.subject].w+=a.tests.wrong||0;grouped[a.subject].b+=a.tests.blank||0;}
      if(a.topic&&String(a.topic).trim())grouped[a.subject].topics.add(String(a.topic).trim());
    });
    const subjOrder=state.subjects.map(s=>s.name);
    const names=Object.keys(grouped).sort((a,b)=>{
      const ia=subjOrder.indexOf(a),ib=subjOrder.indexOf(b);
      return(ia<0?999:ia)-(ib<0?999:ib);
    });
    rows=names.map(name=>{
      const g=grouped[name];
      const topicsArr=[...g.topics];
      let topicStr;
      if(!topicsArr.length)topicStr='—';
      else if(topicsArr.length===1)topicStr=topicsArr[0];
      else{
        const shown=topicsArr.slice(0,3).join(' · ');
        topicStr=topicsArr.length>3?`${shown} · +${fa(topicsArr.length-3)}`:shown;
      }
      return{subject:name,topic:topicStr,minutes:g.minutes,c:g.c,w:g.w,b:g.b};
    });
  }

  /* ستون‌ها (RTL از راست به چپ) */
  const cols=[
    {key:'subject', w:120, label:'درس'},
    {key:'topic',   w:290, label:'مبحث'},
    {key:'dur',     w:90,  label:'مدت'},
    {key:'c',       w:60,  label:'صحیح'},
    {key:'w',       w:60,  label:'غلط'},
    {key:'b',       w:60,  label:'نزده'},
    {key:'total',   w:90,  label:'جمع تست'},
    {key:'pctRaw',  w:110, label:'بدون منفی'},
    {key:'pctNeg',  w:110, label:'با منفی'}
  ];
  const colX={};
  let cursor=R;
  cols.forEach(c=>{colX[c.key]=cursor;cursor-=c.w;});
  const centerOf=(key)=>{
    const c=cols.find(cc=>cc.key===key);
    return colX[key]-c.w/2;
  };

  const headerH=54;
  const rowH=48;
  const gtH=64;
  const tableTop=y;
  const tableH=headerH+rows.length*rowH+gtH;

  /* قاب بیرونی */
  rr(x,pad,tableTop,innerW,tableH,18);
  x.fillStyle='rgba(255,255,255,.025)';x.fill();

  x.save();
  rr(x,pad,tableTop,innerW,tableH,18);
  x.clip();

  /* هدر */
  const hGrad=x.createLinearGradient(pad,tableTop,pad+innerW,tableTop);
  hGrad.addColorStop(0,'rgba(124,92,255,.32)');
  hGrad.addColorStop(1,'rgba(34,211,238,.18)');
  x.fillStyle=hGrad;x.fillRect(pad,tableTop,innerW,headerH);

  x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#fff';
  x.font='800 17px Vazirmatn, Tahoma, sans-serif';
  cols.forEach(c=>{
    x.fillText(c.label,colX[c.key]-c.w/2,tableTop+headerH/2);
  });

  x.strokeStyle='rgba(255,255,255,.16)';x.lineWidth=1;
  for(let i=1;i<cols.length;i++){
    const boundary=colX[cols[i].key];
    x.beginPath();x.moveTo(boundary,tableTop+8);x.lineTo(boundary,tableTop+headerH-8);x.stroke();
  }

  /* ردیف‌ها */
  let gtMin=0,gtC=0,gtW=0,gtB=0;
  rows.forEach((r,idx)=>{
    const rowY=tableTop+headerH+idx*rowH;

    x.fillStyle=idx%2===0?'rgba(255,255,255,.035)':'rgba(255,255,255,.012)';
    x.fillRect(pad,rowY,innerW,rowH);
    x.fillStyle='rgba(255,255,255,.05)';
    x.fillRect(pad,rowY+rowH-1,innerW,1);

    x.strokeStyle='rgba(255,255,255,.05)';x.lineWidth=1;
    for(let i=1;i<cols.length;i++){
      const boundary=colX[cols[i].key];
      x.beginPath();x.moveTo(boundary,rowY+6);x.lineTo(boundary,rowY+rowH-6);x.stroke();
    }

    const color=subjColor(r.subject);
    const c=r.c||0,w=r.w||0,b=r.b||0,t=c+w+b;
    gtMin+=(+r.minutes||0);gtC+=c;gtW+=w;gtB+=b;
    const cy=rowY+rowH/2;

    /* درس */
    x.textAlign='right';x.textBaseline='middle';
    x.fillStyle=color;
    x.beginPath();x.arc(R-14,cy,6,0,Math.PI*2);x.fill();
    x.font='700 16px Vazirmatn, Tahoma, sans-serif';
    let subjTxt=r.subject;
    const maxSubjW=120-34;
    while(x.measureText(subjTxt).width>maxSubjW&&subjTxt.length>3)subjTxt=subjTxt.slice(0,-1);
    if(subjTxt!==r.subject)subjTxt+='…';
    x.fillText(subjTxt,R-28,cy);

    /* مبحث */
    x.fillStyle='#cbd3e8';
    x.font='600 15px Vazirmatn, Tahoma, sans-serif';
    let topic=r.topic||'بدون مبحث';
    const maxTopicW=290-24;
    while(x.measureText(topic).width>maxTopicW&&topic.length>3)topic=topic.slice(0,-1);
    if(topic!==(r.topic||'بدون مبحث'))topic+='…';
    x.fillText(topic,colX.topic-12,cy);

    /* مدت */
    x.textAlign='center';
    x.fillStyle='#4de2f5';
    x.font='700 16px Vazirmatn, Tahoma, sans-serif';
    x.fillText(hmString(r.minutes),centerOf('dur'),cy);

    /* صحیح/غلط/نزده */
    const drawNum=(key,val,color2)=>{
      x.fillStyle=val>0?color2:'#4b5470';
      x.font='700 16px Vazirmatn, Tahoma, sans-serif';
      x.fillText(val>0?fa(val):'—',centerOf(key),cy);
    };
    drawNum('c',c,'#6ee7b7');
    drawNum('w',w,'#fda4af');
    drawNum('b',b,'#cbd3e8');

    /* جمع تست */
    x.fillStyle=t>0?'#7dd3fc':'#4b5470';
    x.font='800 16px Vazirmatn, Tahoma, sans-serif';
    x.fillText(t>0?fa(t):'—',centerOf('total'),cy);

    /* درصدها داخل پیل */
    const drawPctPill=(key,val)=>{
      const cx2=centerOf(key);
      if(t<=0){
        x.fillStyle='#4b5470';x.font='700 16px Vazirmatn, Tahoma, sans-serif';
        x.fillText('—',cx2,cy);return;
      }
      let fg,bg;
      if(val>=60){fg='#6ee7b7';bg='rgba(110,231,183,.14)';}
      else if(val>=30){fg='#fcd34d';bg='rgba(252,211,77,.14)';}
      else{fg='#fda4af';bg='rgba(253,164,175,.14)';}
      const pillW=64,pillH=28;
      rr(x,cx2-pillW/2,cy-pillH/2,pillW,pillH,14);
      x.fillStyle=bg;x.fill();
      x.strokeStyle=fg+'66';x.lineWidth=1;x.stroke();
      x.fillStyle=fg;x.font='800 15px Vazirmatn, Tahoma, sans-serif';
      x.textAlign='center';x.textBaseline='middle';
      x.fillText(fa(val)+'٪',cx2,cy);
    };
    drawPctPill('pctRaw',t>0?Math.round(c/t*100):0);
    drawPctPill('pctNeg',t>0?Math.max(0,Math.round((3*c-w)/(3*t)*100)):0);
  });

  /* جمع کل */
  const gtY=tableTop+headerH+rows.length*rowH;
  x.fillStyle='rgba(234,179,8,.16)';
  x.fillRect(pad,gtY,innerW,gtH);
  x.fillStyle='rgba(234,179,8,.6)';
  x.fillRect(pad,gtY,innerW,2);

  x.strokeStyle='rgba(255,255,255,.06)';x.lineWidth=1;
  for(let i=1;i<cols.length;i++){
    const boundary=colX[cols[i].key];
    x.beginPath();x.moveTo(boundary,gtY+8);x.lineTo(boundary,gtY+gtH-8);x.stroke();
  }

  const gcy=gtY+gtH/2;
  x.textAlign='right';x.textBaseline='middle';
  x.fillStyle='#fcd34d';
  x.font='800 22px Vazirmatn, Tahoma, sans-serif';
  x.fillText('🎯 مجموع کل',R-20,gcy);

  x.textAlign='center';
  x.fillStyle='#4de2f5';
  x.font='800 18px Vazirmatn, Tahoma, sans-serif';
  x.fillText(hmString(gtMin),centerOf('dur'),gcy);

  x.fillStyle='#6ee7b7';
  x.fillText(gtC>0?fa(gtC):'—',centerOf('c'),gcy);
  x.fillStyle='#fda4af';
  x.fillText(gtW>0?fa(gtW):'—',centerOf('w'),gcy);
  x.fillStyle='#cbd3e8';
  x.fillText(gtB>0?fa(gtB):'—',centerOf('b'),gcy);

  const gtT=gtC+gtW+gtB;
  x.fillStyle=gtT>0?'#7dd3fc':'#4b5470';
  x.font='800 18px Vazirmatn, Tahoma, sans-serif';
  x.fillText(gtT>0?fa(gtT):'—',centerOf('total'),gcy);

  const drawGrandPill=(key,val)=>{
    const cx2=centerOf(key);
    if(gtT<=0){x.fillStyle='#4b5470';x.font='700 18px Vazirmatn, Tahoma, sans-serif';x.fillText('—',cx2,gcy);return;}
    let fg,bg;
    if(val>=60){fg='#6ee7b7';bg='rgba(110,231,183,.2)';}
    else if(val>=30){fg='#fcd34d';bg='rgba(252,211,77,.2)';}
    else{fg='#fda4af';bg='rgba(253,164,175,.2)';}
    const pillW=68,pillH=30;
    rr(x,cx2-pillW/2,gcy-pillH/2,pillW,pillH,15);
    x.fillStyle=bg;x.fill();
    x.strokeStyle=fg+'88';x.lineWidth=1.2;x.stroke();
    x.fillStyle=fg;x.font='800 16px Vazirmatn, Tahoma, sans-serif';
    x.textAlign='center';x.textBaseline='middle';
    x.fillText(fa(val)+'٪',cx2,gcy);
  };
  drawGrandPill('pctRaw',gtT>0?Math.round(gtC/gtT*100):0);
  drawGrandPill('pctNeg',gtT>0?Math.max(0,Math.round((3*gtC-gtW)/(3*gtT)*100)):0);

  x.restore();

  /* قاب بیرونی */
  rr(x,pad,tableTop,innerW,tableH,18);
  x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=1.5;x.stroke();

  return tableTop+tableH+30;
}

/* ============================================================
   FOOTER
   ============================================================ */
function drawReportFooter(x,W,pad,H,d){
  x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#22d3ee';
  x.font='700 32px Vazirmatn, Tahoma, sans-serif';
  if(d.kind==='day')x.fillText(`${fa(d.daysLeft)} روز تا کنکور`,W/2,H-155);
  else{const weeksLeft=Math.ceil(d.daysLeft/7);x.fillText(`${fa(weeksLeft)} هفته تا کنکور`,W/2,H-155);}
  x.fillStyle='rgba(255,255,255,.4)';
  x.font='500 22px Vazirmatn, Tahoma, sans-serif';
  x.fillText('کنکور ۱۴۰۶  •  ۱۱ تیر',W/2,H-110);
  x.fillStyle='rgba(255,255,255,.32)';
  x.font='600 20px Vazirmatn, Tahoma, sans-serif';
  x.fillText('Made by MH.Mahdipanah',W/2,H-55);
}

/* ============================================================
    DAILY REPORT IMAGE (CANVAS)
    ============================================================ */
async function generateDailyReportCanvas(kind,anchor,options){
  const opts=Object.assign({},REPORT_DEFAULT_OPTIONS,options||{});
  const d=getReportData(kind,anchor);
  if(document.fonts&&document.fonts.ready){try{await document.fonts.ready;}catch(e){}}
  const isDay=d.kind==='day';
  const W=1080;
  const pad=45;

  const heights={
    title:350,
    stats:opts.stats?measureStatsHeight(opts):0,
    timeline:opts.timeline?(isDay?290:(56+32+7*52+70)):0,
    charts:opts.charts?measureChartsHeight(d):0,
    details:opts.details?measureDetailsHeight(d):0,
    footer:180
  };
  const H=pad+Object.values(heights).reduce((s,v)=>s+v,0)+pad;

  const cv=document.createElement('canvas');
  cv.width=W;cv.height=H;
  const x=cv.getContext('2d');

  const g=x.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#0b1024');g.addColorStop(.5,'#101733');g.addColorStop(1,'#080d1c');
  x.fillStyle=g;x.fillRect(0,0,W,H);
  let rg=x.createRadialGradient(W*.86,40,0,W*.86,40,720);
  rg.addColorStop(0,'rgba(124,92,255,.55)');rg.addColorStop(1,'rgba(124,92,255,0)');
  x.fillStyle=rg;x.fillRect(0,0,W,H);
  rg=x.createRadialGradient(70,H-60,0,70,H-60,640);
  rg.addColorStop(0,'rgba(34,211,238,.34)');rg.addColorStop(1,'rgba(34,211,238,0)');
  x.fillStyle=rg;x.fillRect(0,0,W,H);
  x.direction='rtl';x.textBaseline='middle';x.textAlign='right';

  let y=pad;
  y=drawReportTitleSection(x,W,pad,y,d);

  if(opts.stats){
    y=drawReportStatsSection(x,W,pad,y,d,opts);
  }
  if(opts.timeline){
    if(opts.stats)drawSectionDivider(x,W,pad,y);
    y=isDay
      ?drawReportTimelineDaySection(x,W,pad,y,d)
      :drawReportTimelineWeekSection(x,W,pad,y,d);
  }
  if(opts.charts){
    if(opts.stats||opts.timeline)drawSectionDivider(x,W,pad,y);
    y=drawReportChartsSection(x,W,pad,y,d);
  }
  if(opts.details){
    if(opts.stats||opts.timeline||opts.charts)drawSectionDivider(x,W,pad,y);
    drawReportDetailsSection(x,W,pad,y,d);
  }

  drawReportFooter(x,W,pad,H,d);

  return cv;
}

async function downloadReportImage(kind,anchor,options){
  const cv=await generateDailyReportCanvas(kind,anchor,options);
  const j=d2j(anchor);
  cv.toBlob((blob)=>{
    if(!blob){toast('خطا در تولید تصویر');return;}
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`report-${kind}-${j.jy}-${pad2(j.jm)}-${pad2(j.jd)}.png`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast('تصویر دانلود شد ✓');
  },'image/png');
}
