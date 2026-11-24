'use strict';

/* ============================================================
   SETTINGS — paged: home → account / subjects / exam / backup / danger
   Profile, account and automatic-sync status live on one page.
   Sync UI is rendered by 12-sql-sync.js → renderSyncUI()
   ============================================================ */

/* ============ PAGED NAVIGATION ============ */
let settingsPage = 'home';
let deferredInstallPrompt = null;
function isAppInstalled(){
  try{
    if(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if(window.navigator && window.navigator.standalone) return true;
  }catch(e){}
  return false;
}
function renderInstallAppButton(){
  const btn = document.getElementById('installAppBtn');
  const sub = document.getElementById('installAppSub');
  if(!btn) return;
  const installed = isAppInstalled();
  const canPrompt = !!deferredInstallPrompt;
  const isiOS = /iphone|ipad|ipod/i.test(String(navigator.userAgent||''));
  btn.hidden = installed || (!canPrompt && !isiOS);
  btn.disabled = false;
  if(sub){
    sub.textContent = canPrompt
      ? 'افزودن مسیر به صفحه اصلی'
      : (isiOS ? 'در Safari: Share سپس Add to Home Screen' : 'افزودن مسیر به صفحه اصلی');
  }
  btn.onclick = async () => {
    if(!deferredInstallPrompt){
      if(isiOS) toast('برای نصب: در Safari دکمه Share را بزنید و Add to Home Screen را انتخاب کنید.');
      return;
    }
    try{
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
    }catch(e){}
    deferredInstallPrompt = null;
    renderInstallAppButton();
  };
}
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  renderInstallAppButton();
});
window.addEventListener('appinstalled', ()=>{
  deferredInstallPrompt = null;
  renderInstallAppButton();
});
function setSettingsPage(page){
  const overlay=document.getElementById('settingsOverlay');
  if(!overlay) return;
  const pages=overlay.querySelectorAll('.settings-page');
  if(!pages.length) return;
  settingsPage=Array.from(pages).some(p=>p.dataset.page===page)?page:'home';
  pages.forEach(p=>{
    const active=p.dataset.page===settingsPage;
    p.classList.toggle('active',active);
    p.hidden=!active;
  });
  overlay.scrollTop=0;
  const body=document.getElementById('settingsBody');
  if(body) body.scrollTop=0;
  if(settingsPage==='home') updateHomeSyncState();
}
document.querySelectorAll('#settingsBody [data-go]').forEach(btn=>{
  btn.addEventListener('click',()=>setSettingsPage(btn.dataset.go));
});
function updateHomeSyncState(){
  const el=document.getElementById('homeSyncState');
  if(!el) return;
  const loggedIn=typeof isLoggedIn==='function'&&isLoggedIn();
  el.textContent=loggedIn?'همگامسازی فعال':'برای همگامسازی وارد شوید';
}
/* ============ PROFILE ============ */
function renderProfileSection(){
  const p = state.profile || {};
  const displayNameEl = document.getElementById('profileDisplayName');
  const heroNameEl = document.getElementById('profileHeroName');
  const heroAvatarEl = document.getElementById('profileHeroAvatar');
  const badgeEl = document.getElementById('accountProfileBadge');
  const editBtn = document.getElementById('editProfileBtn');
  const displayFieldEl = document.getElementById('profileDisplayField');
  const displayGradeEl = document.getElementById('profileDisplayGrade');
  const fnEl = document.getElementById('setFirstName');
  const lnEl = document.getElementById('setLastName');
  const fEl = document.getElementById('setField');
  const gEl = document.getElementById('setGrade');
  const client = window.sqlSync || window.masirSqlSync || null;
  const loggedIn = !!(client && typeof client.isLoggedIn === 'function' && client.isLoggedIn());
  const user = loggedIn && client && typeof client.getUser === 'function' ? (client.getUser() || {}) : {};
  const phone = loggedIn && client && typeof client.getLoggedInPhone === 'function'
    ? String(client.getLoggedInPhone() || '') : '';
  const fullName = [p.firstName,p.lastName].filter(Boolean).join(' ');
  const profileMetaEl = document.getElementById('profileSummaryMeta');
  if(displayNameEl) displayNameEl.textContent = loggedIn ? (fullName || 'نام ثبت نشده') : 'حساب کاربری';
  if(heroNameEl) heroNameEl.textContent = fullName || 'نام ثبت نشده';
  if(heroAvatarEl) heroAvatarEl.textContent = String(p.firstName || p.displayName || 'M').trim().charAt(0) || 'M';
  if(profileMetaEl) profileMetaEl.hidden = !loggedIn;
  if(editBtn){
    editBtn.textContent = loggedIn ? 'ویرایش حساب' : 'ورود به حساب';
    editBtn.title = editBtn.textContent;
    editBtn.setAttribute('aria-label', editBtn.textContent);
    editBtn.classList.toggle('profile-login-btn', !loggedIn);
  }
  if(loggedIn && user){
    if(typeof user.firstName === 'string') p.firstName = user.firstName.slice(0,40);
    if(typeof user.lastName === 'string') p.lastName = user.lastName.slice(0,40);
    if(['تجربی','ریاضی','انسانی'].includes(user.field)) p.field = user.field;
    if(['دهم','یازدهم','دوازدهم'].includes(user.grade)) p.grade = user.grade;
    if(state && state.profile){
      state.profile.firstName = p.firstName;
      state.profile.lastName = p.lastName;
      state.profile.field = p.field || state.profile.field;
      state.profile.grade = p.grade || state.profile.grade;
    }
  }
  const phoneEl = document.getElementById('profileHeroPhone');
  if(phoneEl){
    phoneEl.textContent = phone || 'شماره متصل نشده';
    phoneEl.dir = phone ? 'ltr' : 'rtl';
  }
  if(badgeEl){
    badgeEl.textContent = loggedIn ? '✓ متصل' : 'مهمان';
    badgeEl.classList.toggle('connected', loggedIn);
  }
  if(displayFieldEl) displayFieldEl.textContent = `رشته: ${p.field || 'تجربی'}`;
  if(displayGradeEl) displayGradeEl.textContent = `پایه: ${p.grade || 'دوازدهم'}`;
  if(fnEl) fnEl.value = p.firstName || '';
  if(lnEl) lnEl.value = p.lastName || '';
  if(fEl) fEl.value = p.field || 'تجربی';
  if(gEl) gEl.value = p.grade || 'دوازدهم';
  updateProfileHint();
  try{ if(typeof renderSyncUI==='function') renderSyncUI(); }catch(e){}
}

const _editProfileBtn = document.getElementById('editProfileBtn');
if(_editProfileBtn) _editProfileBtn.onclick = () => {
  const client = window.sqlSync || window.masirSqlSync || null;
  const loggedIn = !!(client && typeof client.isLoggedIn === 'function' && client.isLoggedIn());
  if(!loggedIn){
    try{ if(window.masirAuth && typeof window.masirAuth.show === 'function') window.masirAuth.show('login'); }catch(e){}
    return;
  }
  setSettingsPage('account');
};

const _cancelProfileEditBtn = document.getElementById('cancelProfileEditBtn');
if(_cancelProfileEditBtn) _cancelProfileEditBtn.onclick = renderProfileSection;

function updateProfileHint(){
  const hint = document.getElementById('profileFieldHint');
  if(!hint) return;
  const fieldEl = document.getElementById('setField');
  if(!fieldEl) return;
  const newField = fieldEl.value;
  const gradeEl=document.getElementById('setGrade');
  const newGrade=gradeEl?gradeEl.value:(state.profile&&state.profile.grade)||'دوازدهم';
  const currentField = (state.profile && state.profile.field) || 'تجربی';
  const currentGrade=(state.profile&&state.profile.grade)||'دوازدهم';
  if(newField===currentField&&newGrade===currentGrade){hint.innerHTML='';return;}
  const currentSpecials = state.subjects.filter(s => s.type === 'specialized').map(s => s.name);
  const newSpecials = fieldSpecializedSubjects(newField,newGrade);
  const toRemove = newField===currentField?[]:currentSpecials.filter(n => !newSpecials.includes(n));
  const toAdd = newSpecials.filter(n => !currentSpecials.includes(n));
  const parts = [];
  if(newField!==currentField&&toRemove.length) parts.push(`<b class="text-rose">حذف:</b> ${toRemove.map(esc).join('، ')}`);
  if(toAdd.length) parts.push(`<b class="text-ok">اضافه:</b> ${toAdd.map(esc).join('، ')}`);
  if(parts.length) hint.innerHTML = '⚠️ با ذخیره پروفایل، فهرست دروس تخصصی بر اساس رشته و پایه به‌روزرسانی می‌شود: ' + parts.join(' • ');
  else hint.innerHTML = '';
}

const _setFieldEl = document.getElementById('setField');
if(_setFieldEl) _setFieldEl.onchange = updateProfileHint;
const _setGradeEl = document.getElementById('setGrade');
if(_setGradeEl) _setGradeEl.onchange = updateProfileHint;

const _saveProfileBtn = document.getElementById('saveProfileBtn');
if(_saveProfileBtn) _saveProfileBtn.onclick = async () => {
  const btn = _saveProfileBtn;
  const firstName = (document.getElementById('setFirstName').value || '').trim().slice(0, 40);
  const lastName  = (document.getElementById('setLastName').value || '').trim().slice(0, 40);
  const field     = document.getElementById('setField').value;
  const grade     = document.getElementById('setGrade').value;
  const currentField = (state.profile && state.profile.field) || 'تجربی';
  const currentGrade = (state.profile && state.profile.grade) || 'دوازدهم';

  if(field !== currentField){
    const currentSpecials = state.subjects.filter(s => s.type === 'specialized').map(s => s.name);
    const newSpecials = fieldSpecializedSubjects(field,grade);
    const toRemove = currentSpecials.filter(n => !newSpecials.includes(n));
    if(toRemove.length > 0){
      const actCount = state.activities.filter(a => toRemove.includes(a.subject)).length;
      const qCount = state.exams.reduce((s, e) => s + ((e.questions || []).filter(q => toRemove.includes(q.subject)).length), 0);
      const msg = `⚠️ با تغییر رشته، دروس تخصصی زیر حذف می‌شوند:\n\n${toRemove.join('، ')}\n\n${actCount} فعالیت و ${qCount} سوال آزمون مرتبط هم حذف خواهند شد.\n\nآیا مطمئنی؟`;
      if(!confirm(msg)) return;
    }
  }

  const client = window.sqlSync || window.masirSqlSync || null;
  const loggedIn = !!(client && typeof client.isLoggedIn === 'function' && client.isLoggedIn());
  const prevLabel = btn.textContent;
  if(loggedIn && client && typeof client.updateProfile === 'function'){
    btn.disabled = true;
    btn.textContent = 'در حال ذخیره…';
    try {
      await client.updateProfile({ firstName, lastName, field, grade });
    } catch (error) {
      console.error('[profile] server save failed:', error);
      toast('ذخیره در سرور ناموفق بود: ' + (error && error.message ? error.message : 'خطا'));
      btn.disabled = false;
      btn.textContent = prevLabel;
      return;
    }
    btn.disabled = false;
    btn.textContent = prevLabel;
  }

  state.profile = {
    id: state.profile.id || '',
    role:'student',
    firstName, lastName, field, grade
  };
  if(field!==currentField||grade!==currentGrade){
    applyFieldChange(field,{grade,preserveExisting:field===currentField});
  } else {
    save();
  }
  toast(loggedIn ? 'پروفایل ذخیره و همگام شد ✓' : 'پروفایل ذخیره شد ✓');
  renderProfileSection();
  try{ renderSubjectManager(); }catch(e){}
  try{ renderSettingsPanel(); }catch(e){}
};

/* ============ SUBJECT MANAGER ============ */
function isDefaultSubject(name){
  return !!state&&isFieldManagedGeneralSubject(name,state.profile.field);
}

function renderSubjectManager(){
  const box=document.getElementById('subjectManager');if(!box)return;
  if(!state || !Array.isArray(state.subjects) || !state.subjects.length){
    box.innerHTML='<div class="muted text-center p-14">درسی تعریف نشده</div>';
    return;
  }
  const fieldSubjects=FIELD_SPECIALIZED_SUBJECTS[state.profile.field]||[];
  const gradeEligibleNames=new Set(fieldSpecializedSubjects(state.profile.field,state.profile.grade));
  const isVisible=subject=>subject.type!=='specialized'||!fieldSubjects.includes(subject.name)||gradeEligibleNames.has(subject.name);
  const specialized=state.subjects.filter(subject=>subject.type==='specialized'&&isVisible(subject));
  const general=state.subjects.filter(subject=>subject.type!=='specialized'&&isVisible(subject)&&isGeneralSubjectAvailableInField(subject,state.profile.field));
  const subjectRowHTML=s=>{
    if(!s) return '';
    const isSpec=s.type==='specialized';
    const isLocked=isDefaultSubject(s.name);
    const isFixed=isSpec||isLocked;
    const rowClasses=['subj-row',isSpec?'is-specialized':'is-general',isFixed?'is-fixed':'has-delete'];
    let info;
    if(isSpec){info=((s.grades||[]).length)+' پایه';}
    else{
      let sum=0;
      try{sum=GRADES.reduce((acc,g)=>acc+(getSubjectLessons(s.name,g)||0),0);}
      catch(e){const lbg=(s.lessonsByGrade&&typeof s.lessonsByGrade==='object')?s.lessonsByGrade:{};sum=GRADES.reduce((acc,g)=>acc+(+lbg[g]||0),0);}
      info=fa(sum)+' درس';
    }
    const displayName=isSpec?s.name:generalSubjectDisplayName(s.name);
    return '<div class="'+rowClasses.join(' ')+'" data-name="'+esc(s.name)+'" data-type="'+(isSpec?'specialized':'general')+'">'+
      '<button type="button" class="subj-order-handle" aria-label="جابجایی '+esc(s.name)+'" title="برای جابجایی بکش">⠿</button>'+
      '<input type="color" class="subj-color" value="'+(s.color||'#7c5cff')+'" data-name="'+esc(s.name)+'">'+
      (isFixed
        ?'<span class="subj-name subj-name-static" title="نام درس ثابت است">'+esc(displayName)+'</span>'
        :'<input class="subj-name" value="'+esc(s.name)+'" data-name="'+esc(s.name)+'" placeholder="نام" aria-label="نام درس">')+
      (isFixed
        ?'<span class="subj-type-label '+(isSpec?'spec':'gen')+'">'+(isSpec?'تخصصی':'عمومی')+'</span>'
        :'<button type="button" class="subj-type-btn gen" data-name="'+esc(s.name)+'" title="'+info+'">عمومی</button>')+
      '<button type="button" class="subj-adv" data-name="'+esc(s.name)+'" title="تنظیمات پیشرفته">⚙</button>'+
    (isFixed?'':'<button type="button" class="subj-del" data-name="'+esc(s.name)+'" aria-label="حذف درس '+esc(s.name)+'">×</button>')+
    '</div>';
  };
  /* FEAT-6: custom subject groups are used when set; otherwise keep the
     built-in specialized/general separation. */
  const groups=new Map();
  [...specialized,...general].forEach(subject=>{
    const label=subject.group?subject.group:(subject.type==='specialized'?'دروس تخصصی':'دروس عمومی');
    if(!groups.has(label))groups.set(label,[]);
    groups.get(label).push(subject);
  });
  box.innerHTML=[...groups.entries()].map(([label,subjects])=>
    `<div class="subject-group-label">${esc(label)}</div>`+subjects.map(subjectRowHTML).join('')
  ).join('');
}

document.getElementById('subjectManager').addEventListener('change',(e)=>{
  const colorEl=e.target.closest('.subj-color');
  if(colorEl){
    const s=state.subjects.find(x=>x.name===colorEl.dataset.name);
    if(s){s.color=colorEl.value;save();renderSubjectManager();try{refreshAll();}catch(e){console.warn('[subjects] refreshAll failed:', e)}}
    return;
  }
  const nameEl=e.target.closest('.subj-name');
  if(nameEl){
    const old=nameEl.dataset.name;const newN=nameEl.value.trim();
    const subject=state.subjects.find(x=>x.name===old);
    if(subject&&(subject.type==='specialized'||isDefaultSubject(old))){nameEl.value=old;return;}
    if(!newN||newN===old){nameEl.value=old;return;}
    if(state.subjects.some(s=>s.name===newN)){toast('نام تکراری');nameEl.value=old;return;}
    const s=subject;
    if(s){
      s.name=newN;
      if(state.classes[old]){state.classes[newN]=state.classes[old];delete state.classes[old];}
      state.activities.forEach(a=>{if(a.subject===old)a.subject=newN;});
      state.plan&&Object.values(state.plan).forEach(list=>list.forEach(b=>{if(b.subject===old)b.subject=newN;}));
      state.reserved.forEach(r=>{if(r.subject===old)r.subject=newN;});
      state.exams.forEach(e2=>{
        if(e2.subjects&&e2.subjects[old]){e2.subjects[newN]=e2.subjects[old];delete e2.subjects[old];}
        if(Array.isArray(e2.includedSubjects))e2.includedSubjects=e2.includedSubjects.map(n=>n===old?newN:n);
        if(Array.isArray(e2.questions))e2.questions.forEach(q=>{if(q.subject===old)q.subject=newN;});
        if(e2.topics&&e2.topics[old]){e2.topics[newN]=e2.topics[old];delete e2.topics[old];}
      });
      save();renderSubjectManager();try{refreshAll();}catch(_){}
      toast('نام تغییر کرد');
    }
  }
});

document.getElementById('subjectManager').addEventListener('click',(e)=>{
  const typeBtn=e.target.closest('.subj-type-btn');
  if(typeBtn){
    if(typeBtn.dataset.locked==='1'){toast('درس‌های دیفالت قابل تغییر نوع نیستند');return;}
    const s=state.subjects.find(x=>x.name===typeBtn.dataset.name);
    if(s){
      s.type=s.type==='specialized'?'general':'specialized';
      if(s.type==='general'&&(!s.lessonsByGrade || ['دهم','یازدهم','دوازدهم'].every(g=>!s.lessonsByGrade[g]))){
        s.lessonsByGrade={'دهم':0,'یازدهم':20,'دوازدهم':0};s.lessons=20;
      }
      if(s.type==='general'&&!s.freeLessons){s.freeLessons={'دهم':[],'یازدهم':[],'دوازدهم':[]};}
      if(s.type==='specialized'&&(!s.grades||!s.grades.length))s.grades=['دهم','یازدهم','دوازدهم'];
      state.subjects=keepSpecializedSubjectsFirst(state.subjects);
      save();renderSubjectManager();try{refreshAll();}catch(_){}
      toast(s.type==='specialized'?'تخصصی':'عمومی');
    }
    return;
  }
  const adv=e.target.closest('.subj-adv');
  if(adv){openSubjectAdvancedModal(adv.dataset.name);return;}
  const del=e.target.closest('.subj-del');
  if(del){
    const name=del.dataset.name;
    if(isDefaultSubject(name)){toast('درس‌های عمومی ثابت قابل حذف نیستند');return;}
    if(!confirm('درس «'+name+'» حذف شود؟ همه فعالیت‌ها و آزمون‌های مرتبط هم حذف می‌شوند.'))return;
    state.subjects=state.subjects.filter(s=>s.name!==name);
    delete state.classes[name];
    state.activities=state.activities.filter(a=>a.subject!==name);
    state.reserved=state.reserved.filter(r=>r.subject!==name);
    Object.values(state.plan).forEach(list=>{for(let i=list.length-1;i>=0;i--)if(list[i].subject===name)list.splice(i,1);});
    state.exams.forEach(exam=>{
      if(exam.subjects)delete exam.subjects[name];
      if(Array.isArray(exam.includedSubjects))exam.includedSubjects=exam.includedSubjects.filter(subject=>subject!==name);
      if(Array.isArray(exam.questions))exam.questions=exam.questions.filter(question=>question.subject!==name);
      if(exam.topics)delete exam.topics[name];
    });
    save();renderSubjectManager();try{refreshAll();}catch(_){}
    toast('حذف شد');
  }
});

/* Drag-drop reordering for subjects */
let subjectDragState=null;
const subjectManager=document.getElementById('subjectManager');
subjectManager.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('.subj-order-handle');
  if(!handle)return;
  const row=handle.closest('.subj-row');
  if(!row)return;
  event.preventDefault();
  subjectDragState={row,type:row.dataset.type,moved:false};
  row.classList.add('dragging');
  if(handle.setPointerCapture)handle.setPointerCapture(event.pointerId);
});
subjectManager.addEventListener('pointermove',event=>{
  if(!subjectDragState)return;
  const target=document.elementFromPoint(event.clientX,event.clientY);
  const targetRow=target&&target.closest('.subj-row');
  if(!targetRow||targetRow===subjectDragState.row||targetRow.dataset.type!==subjectDragState.type)return;
  const rect=targetRow.getBoundingClientRect();
  if(event.clientY<rect.top+rect.height/2)targetRow.before(subjectDragState.row);
  else targetRow.after(subjectDragState.row);
  subjectDragState.moved=true;
});
const finishSubjectDrag=()=>{
  if(!subjectDragState)return;
  const drag=subjectDragState;
  subjectDragState=null;
  drag.row.classList.remove('dragging');
  if(!drag.moved)return;
  const visibleNames=[...subjectManager.querySelectorAll('.subj-row[data-type="'+drag.type+'"]')].map(row=>row.dataset.name);
  const visibleSet=new Set(visibleNames);
  const group=state.subjects.filter(subject=>subject.type===drag.type);
  const reordered=visibleNames.map(name=>group.find(subject=>subject.name===name)).filter(Boolean);
  reordered.push(...group.filter(subject=>!visibleSet.has(subject.name)));
  const otherGroup=state.subjects.filter(subject=>subject.type!==drag.type);
  state.subjects=drag.type==='specialized'?reordered.concat(otherGroup):otherGroup.concat(reordered);
  save();
  refreshAll();
  toast('ترتیب درس‌ها ذخیره شد');
};
subjectManager.addEventListener('pointerup',finishSubjectDrag);
subjectManager.addEventListener('pointercancel',finishSubjectDrag);

document.getElementById('addSubjectBtn').onclick=()=>{
  const baseName='درس جدید';let name=baseName,i=2;
  while(state.subjects.some(s=>s.name===name))name=baseName+' '+(i++);
  const colors=['#6d5efc','#22d3ee','#f59e0b','#10b981','#ec4899','#a78bfa','#14b8a6','#f43f5e','#8b5cf6','#eab308'];
  const color=colors[Math.floor(Math.random()*colors.length)];
  state.subjects.push({
    name,color,sessions:20,lessons:20,
    lessonsByGrade:{'دهم':0,'یازدهم':20,'دوازدهم':0},
    freeLessons:{'دهم':[],'یازدهم':[],'دوازدهم':[]},
    type:'general',defaultQ:0,grades:['دهم','یازدهم','دوازدهم'],
    topics:{'دهم':[],'یازدهم':[],'دوازدهم':[]},
    chapterSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    lessonSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    errors:[],specialTags:[],questionTypes:[],emphasis:'note',group:'',lessonRecords:{},topicRecords:{}
  });
  state.classes[name]={total:20,sessions:{}};
  save();renderSubjectManager();try{refreshAll();}catch(_){}
  toast('درس اضافه شد');
};

/* ============ ADVANCED MODAL ============ */
function openSubjectAdvancedModal(name){
  const s=state.subjects.find(x=>x.name===name);if(!s)return;
  const isGeneral=s.type==='general';
  const isLocked=isDefaultSubject(name);
  const GLOCAL=['یازدهم','دوازدهم'];

  if(isGeneral){
    const currentByGrade = (s.lessonsByGrade && typeof s.lessonsByGrade==='object')?s.lessonsByGrade:{'دهم':0,'یازدهم':0,'دوازدهم':0};
    const currentFree = (s.freeLessons && typeof s.freeLessons==='object')?s.freeLessons:{'دهم':[],'یازدهم':[],'دوازدهم':[]};
    let totalLessons=0;
    GLOCAL.forEach(g=>{ totalLessons += (+currentByGrade[g]||0); });

    const rowsHtml = GLOCAL.map(g=>{
      const val = currentByGrade[g]||0;
      const freeVal = Array.isArray(currentFree[g]) ? currentFree[g].join(', ') : '';
      return `<div class="adv-grade-block">
        <div class="adv-grade-lesson-row" data-grade="${esc(g)}">
          <div class="aglr-label">${esc(g)}</div>
          <div class="aglr-input"><input dir="ltr" inputmode="numeric" class="input adv-lessons-input num-input" type="text" min="0" max="200" data-grade="${esc(g)}" value="${val}" placeholder="۰" ${isLocked?'disabled':''}></div>
          <div class="aglr-unit">درس</div>
          <div class="aglr-free-label" title="شماره درس‌های آزاد با کاما">آزاد:</div>
          <input class="input adv-free-input" type="text" data-grade="${esc(g)}" value="${esc(freeVal)}" placeholder="—" ${isLocked?'disabled':''}>
        </div>
      </div>`;
    }).join('');

    openModal(`
      <div class="modal-head">
        <div class="card-title">تنظیمات: ${esc(s.name)} <span class="text-muted fs-11">(عمومی)</span></div>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <label class="lbl mt-0">تعداد جلسات کلاس</label>
      <input dir="ltr" inputmode="numeric" class="input num-input" type="text" id="advSessions" min="0" max="200" value="${s.sessions||0}">
      <div class="muted fs-11 mt-6">در بخش «کلاس‌ها» استفاده می‌شود</div>
      ${!isLocked?`
        <div class="err-sep"></div>
        <div class="err-sec-title">📚 تعداد درس (پایه ۱۱ و ۱۲)</div>
        <div class="muted fs-10h mb-10 lh-18">برای درس‌های آزاد، شماره‌ها را با کاما وارد کن.</div>
        <div class="adv-grade-lessons-list">${rowsHtml}</div>
        <div class="adv-lessons-total"><span>مجموع:</span><b id="advTotalLessons">${fa(totalLessons)}</b><span>درس</span></div>
      `:''}
      ${!isLocked||name==='زبان'?`
      <div class="err-sep"></div>
      <div class="err-sec-title">✂️ زیرمبحث هر درس</div>
      <div class="muted fs-10h mb-10 lh-185">هر درس را می‌تونی به بخش‌های کوچکتر بشکنی.</div>
      <button class="btn cyan-soft" id="openLessonSectionsBtn">✂️ مدیریت زیرمبحث‌ها</button>
      `:''}
      <button class="btn primary mt-16" id="advSave">ذخیره</button>
    `);

    const recomputeTotal=()=>{
      let sum=0;
      document.querySelectorAll('.adv-lessons-input').forEach(inp=>{sum+=Math.max(0,Math.min(200,+inp.value||0));});
      const el=document.getElementById('advTotalLessons');if(el)el.textContent=fa(sum);
    };
    document.querySelectorAll('.adv-lessons-input').forEach(inp=>{inp.oninput=recomputeTotal;});

    document.getElementById('advSave').onclick=()=>{
      s.sessions=Math.max(0,Math.min(200,+document.getElementById('advSessions').value||0));
      if(!isLocked){
        const lbg={'دهم':0,'یازدهم':0,'دوازدهم':0};
        const fl={'دهم':[],'یازدهم':[],'دوازدهم':[]};
        document.querySelectorAll('.adv-lessons-input').forEach(inp=>{lbg[inp.dataset.grade]=Math.max(0,Math.min(200,+inp.value||0));});
        document.querySelectorAll('.adv-free-input').forEach(inp=>{
          const grade=inp.dataset.grade;const val=inp.value.trim();
          if(!val){fl[grade]=[];return;}
          fl[grade]=val.split(/[,،\s]+/).map(x=>parseInt(x.replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),10)).filter(n=>!isNaN(n)&&n>0&&n<=200);
        });
        s.lessonsByGrade=lbg;s.freeLessons=fl;
        s.lessons=GLOCAL.reduce((sum,g)=>sum+(lbg[g]||0),0);
      }
      if(state.classes[s.name])state.classes[s.name].total=s.sessions;
      save();closeModal();renderSubjectManager();try{refreshAll();}catch(_){}
      toast('ذخیره شد');
    };
    const lessonSectionsBtn=document.getElementById('openLessonSectionsBtn');
    if(lessonSectionsBtn)lessonSectionsBtn.onclick=()=>{closeModal();setTimeout(()=>openLessonSectionsManager(name),50);};
    return;
  }

  /* FEAT-6/7: question types live with the subject. Similarity suggestions
     are never applied automatically — the user must confirm every merge. */
  let draftTypes=(s.questionTypes||[]).map(t=>({
    id:String(t.id||uid()),
    label:String(t.label||''),
    topics:Array.isArray(t.topics)?t.topics.filter(x=>typeof x==='string'):[]
  })).filter(t=>t.label);
  let draftEmphasis=['note','question-type','both'].includes(s.emphasis)?s.emphasis:'note';
  let draftGroup=s.group||'';

  const typeUsage=(id)=>state.exams.reduce((sum,exam)=>
    sum+(exam.questions||[]).filter(q=>(q.questionTypes||[]).includes(id)).length,0);

  const suggestionsHTML=()=>{
    const groups=typeof suggestQuestionTypeGroups==='function'?suggestQuestionTypeGroups(draftTypes):[];
    if(!groups.length)return '<div class="qt-empty">پیشنهادی برای ادغام وجود ندارد.</div>';
    return groups.map((group,gi)=>`<div class="qt-suggest">
      <div class="qt-suggest-head"><b>پیشنهاد ادغام</b><span class="qt-score">${fa(Math.round(group.score*100))}٪</span></div>
      <div class="qt-suggest-labels">${group.members.map(m=>esc(m.label)).join(' + ')}</div>
      <div class="qt-suggest-meta">${fa(group.count)} تیپ • ${fa(Math.round(group.share*100))}٪ از تیپ\u200cهای درس</div>
      <button type="button" class="btn ghost qt-merge-btn" data-qt-merge="${gi}">ادغام</button>
    </div>`).join('');
  };

  const renderSpecModal=()=>{
    const typeRows=draftTypes.map((t,i)=>`<div class="qt-row">
      <input class="input qt-label" value="${esc(t.label)}" data-qt-input="${i}" placeholder="نام تیپ سوال" maxlength="60">
      <input class="input qt-topics" value="${esc(t.topics.join('، '))}" data-qt-topics="${i}" placeholder="مباحث (با کاما جدا کن)" title="زیرمجموعهٔ کدام مبحث؟ خالی = همهٔ مباحث">
      <span class="qt-usage" title="تعداد سوال\u200cهای استفاده\u200cکننده">${fa(typeUsage(t.id))}</span>
      <button type="button" class="qt-del" data-qt-del="${i}" aria-label="حذف تیپ">×</button>
    </div>`).join('');

    openModal(`
      <div class="modal-head">
        <div class="card-title">تنظیمات پیشرفته: ${esc(s.name)} ${isLocked?'<span class="text-amber fs-10">🔒</span>':''}</div>
        <button class=\"icon-btn\" data-close>✕</button>
      </div>
      <div class="grid2">
        <div><label class="lbl mt-0">تعداد جلسات کلاس</label>
          <input dir="ltr" inputmode="numeric" class="input num-input" type="text" id="advSessions" min="0" max="200" value="${s.sessions||0}"></div>
        <div><label class="lbl mt-0">تعداد سوال پیش\u200cفرض آزمون</label>
          <input dir="ltr" inputmode="numeric" class="input num-input" type="text" id="advDefaultQ" min="0" max="200" value="${s.defaultQ||0}"></div>
      </div>
      <div class="grid2">
        <div><label class="lbl">گروه درس</label>
          <input class="input" id="advGroup" value="${esc(draftGroup)}" placeholder="مثلاً: ریاضیات" maxlength="40"></div>
        <div><label class="lbl">تمرکز کارت تحلیل</label>
          <select class="input" id="advEmphasis">
            <option value="note" ${draftEmphasis==='note'?'selected':''}>نکته</option>
            <option value="question-type" ${draftEmphasis==='question-type'?'selected':''}>تیپ سوال</option>
            <option value="both" ${draftEmphasis==='both'?'selected':''}>هر دو</option>
          </select></div>
      </div>
      <div class="err-sep"></div>
      <div class="err-sec-title">🎯 تیپ\u200cهای سوال</div>
      <div class="muted fs-10h mb-10 lh-185">تیپ\u200cها مشابه هم که باشند پیشنهاد ادغام نشان داده می\u200cشود؛ ادغام فقط با تأیید تو انجام می\u200cشود.</div>
      <div class="qt-list">${typeRows||'<div class="qt-empty">هنوز تیپ سوالی تعریف نشده</div>'}</div>
      <div class="qt-add-row">
        <input class="input" id="newQuestionType" placeholder="تیپ سوال جدید..." maxlength="60">
        <button type="button" class="btn cyan-soft" id="addQuestionType">＋</button>
      </div>
      <div class="err-sep"></div>
      <div class="err-sec-title">🔗 پیشنهاد ادغام تیپ\u200cها</div>
      <div id="qtSuggestions">${suggestionsHTML()}</div>
      <button class="btn primary mt-16" id="advSave">ذخیره</button>
    `);

    document.querySelectorAll('#modalContent [data-close]').forEach(b=>b.onclick=closeModal);

    const syncDraftFromDOM=()=>{
      document.querySelectorAll('[data-qt-input]').forEach(inp=>{
        const idx=+inp.dataset.qtInput;
        if(draftTypes[idx])draftTypes[idx].label=inp.value.trim();
      });
      document.querySelectorAll('[data-qt-topics]').forEach(inp=>{
        const idx=+inp.dataset.qtTopics;
        if(draftTypes[idx])draftTypes[idx].topics=inp.value.split(/[،,]/).map(t=>t.trim()).filter(Boolean);
      });
      const groupEl=document.getElementById('advGroup');
      const emphasisEl=document.getElementById('advEmphasis');
      if(groupEl)draftGroup=groupEl.value.trim();
      if(emphasisEl)draftEmphasis=emphasisEl.value;
    };

    document.querySelectorAll('[data-qt-del]').forEach(btn=>btn.onclick=()=>{
      syncDraftFromDOM();
      const idx=+btn.dataset.qtDel;
      const type=draftTypes[idx];
      if(!type)return;
      if(!confirm(`تیپ «${type.label}» حذف شود؟`))return;
      draftTypes.splice(idx,1);
      renderSpecModal();
    });

    const addBtn=document.getElementById('addQuestionType');
    if(addBtn)addBtn.onclick=()=>{
      syncDraftFromDOM();
      const input=document.getElementById('newQuestionType');
      const label=(input&&input.value||'').trim();
      if(!label)return;
      if(draftTypes.some(t=>t.label===label)){toast('تکراری است');return;}
      draftTypes.push({id:'qt_'+uid(),label,topics:[]});
      renderSpecModal();
    };

    document.querySelectorAll('[data-qt-merge]').forEach(btn=>btn.onclick=()=>{
      syncDraftFromDOM();
      const groups=typeof suggestQuestionTypeGroups==='function'?suggestQuestionTypeGroups(draftTypes):[];
      const group=groups[+btn.dataset.qtMerge];
      if(!group)return;
      const target=group.members[0];
      const sourceIds=group.members.slice(1).map(m=>m.id);
      const labels=group.members.map(m=>m.label).join(' + ');
      if(!confirm(`تیپ\u200cهای «${labels}» در «${target.label}» ادغام شوند؟ سوال\u200cها به تیپ جدید منتقل می\u200cشوند.`))return;
      state.exams.forEach(exam=>{
        (exam.questions||[]).forEach(q=>{
          if(!Array.isArray(q.questionTypes)||!q.questionTypes.length)return;
          const replaced=q.questionTypes.map(id=>sourceIds.includes(id)?target.id:id);
          q.questionTypes=[...new Set(replaced)];
        });
      });
      draftTypes=draftTypes.filter(t=>!sourceIds.includes(t.id));
      renderSpecModal();
      toast('تیپ\u200cها ادغام شدند');
    });

    document.getElementById('advSave').onclick=()=>{
      syncDraftFromDOM();
      const sess=Math.max(0,Math.min(200,+document.getElementById('advSessions').value||0));
      const q=Math.max(0,Math.min(200,+document.getElementById('advDefaultQ').value||0));
      s.sessions=sess;s.defaultQ=q;
      s.questionTypes=draftTypes;s.emphasis=draftEmphasis;s.group=draftGroup;
      if(state.classes[s.name])state.classes[s.name].total=sess;
      save();closeModal();renderSubjectManager();try{refreshAll();}catch(_){}
      toast('ذخیره شد');
    };
  };
  renderSpecModal();
}

/* ============ LESSON SECTIONS MANAGER ============ */
function openLessonSectionsManager(subjectName){
  const s = state.subjects.find(x=>x.name===subjectName);
  if(!s) return;
  if(isDefaultSubject(subjectName)&&subjectName!=='زبان')return;
  let currentGrade = 'یازدهم';
  const render = () => {
    const totalLessons = getSubjectLessons(subjectName, currentGrade);
    const gradeBtns = ['یازدهم','دوازدهم'].map(g => {
      const cnt = getSubjectLessons(subjectName, g);
      if(cnt <= 0) return '';
      return `<button type="button" data-mg="${esc(g)}" class="${currentGrade===g?'active':''}">${esc(g)} (${fa(cnt)})</button>`;
    }).join('');
    let lessonsHtml = '';
    if(totalLessons > 0){
      for(let i = 0; i < totalLessons; i++){
        if(isFreeLesson(subjectName, currentGrade, i)) continue;
        const sections = getLessonSections(subjectName, currentGrade, i);
        const sectionsList = sections.map((sec, sIdx) => `<div class="subsec-row"><input class="input subsec-input" data-lesson-idx="${i}" data-sec-idx="${sIdx}" value="${esc(sec)}" placeholder="نام زیرمبحث"><button type="button" class="subsec-del" data-del-lesson="${i}" data-del-sec="${sIdx}">×</button></div>`).join('');
        lessonsHtml += `<div class="subsec-topic-block"><div class="subsec-topic-head"><span class="subsec-topic-name">درس ${fa(i+1)}</span><span class="subsec-count">${fa(sections.length)} زیرمبحث</span></div><div class="subsec-list">${sectionsList || '<div class="subsec-empty">هنوز زیرمبحثی تعریف نشده</div>'}</div><div class="subsec-add-row"><input class="input subsec-new-input" data-new-lesson="${i}" placeholder="نام زیرمبحث جدید..."><button type="button" class="subsec-add-btn" data-add-lesson="${i}">+</button></div></div>`;
      }
    } else {
      lessonsHtml = '<div class="empty-state lesson-empty">درسی برای این پایه ثبت نشده</div>';
    }
    openModal(`<div class="modal-head"><div class="card-title">✂️ زیرمبحث‌های ${esc(subjectName)}</div><button class="icon-btn" data-close>✕</button></div><div class="muted fs-11h mb-10 lh-185">هر درس را می‌تونی به بخش‌های کوچکتر بشکنی.</div><div class="grade-picker" id="lessonSecGradePicker">${gradeBtns}</div><div id="lessonSecList" class="lesson-sec-list">${lessonsHtml}</div><div class="row mt-14"><button class="btn ghost" data-close>بستن</button><button class="btn primary" id="saveLessonSecBtn">ذخیره</button></div>`);
    document.querySelectorAll('#lessonSecGradePicker button').forEach(b=>{b.onclick = () => { currentGrade = b.dataset.mg; render(); };});
    document.querySelectorAll('[data-add-lesson]').forEach(btn => {
      btn.onclick = () => {
        const lIdx = +btn.dataset.addLesson;
        const inp = document.querySelector(`[data-new-lesson="${lIdx}"]`);
        const val = inp.value.trim();
        if(!val) return;
        const current = getLessonSections(subjectName, currentGrade, lIdx);
        if(current.includes(val)){toast('تکراری');return;}
        setLessonSections(subjectName, currentGrade, lIdx, [...current, val]);
        render();
      };
    });
    document.querySelectorAll('[data-del-lesson]').forEach(btn => {
      btn.onclick = () => {
        const lIdx = +btn.dataset.delLesson;
        const sIdx = +btn.dataset.delSec;
        const current = getLessonSections(subjectName, currentGrade, lIdx);
        current.splice(sIdx, 1);
        setLessonSections(subjectName, currentGrade, lIdx, current);
        render();
      };
    });
    document.querySelectorAll('.subsec-input').forEach(inp => {
      inp.onchange = () => {
        const lIdx = +inp.dataset.lessonIdx;
        const sIdx = +inp.dataset.secIdx;
        const current = getLessonSections(subjectName, currentGrade, lIdx);
        const newVal = inp.value.trim();
        if(!newVal){ inp.value = current[sIdx]; return; }
        current[sIdx] = newVal;
        setLessonSections(subjectName, currentGrade, lIdx, current);
      };
    });
    const saveBtn = document.getElementById('saveLessonSecBtn');
    if(saveBtn) saveBtn.onclick = () => { closeModal(); try{refreshAll();}catch(_){} toast('ذخیره شد'); };
  };
  openModal('');
  render();
}

/* ============ refreshAll ============ */
function refreshAll(){
  try{renderActSubjects();}catch(e){console.warn('[settings] renderActSubjects failed:', e)}
  try{renderDashboard();}catch(e){console.warn('[settings] renderDashboard failed:', e)}
  try{renderPlanCalendar();}catch(e){console.warn('[settings] renderPlanCalendar failed:', e)}
  try{
    if(typeof planViewMode!=='undefined'&&planViewMode==='timeline'){
      const planView=document.getElementById('view-plan');
      if(planView)renderTimeblock();
      else renderPlanTable();
    }else{
      const planView=document.getElementById('view-plan');
      if(planView)renderPlanTable();
    }
  }catch(e){console.warn('[settings] timeline render failed:', e)}
  try{renderActivityList();}catch(e){console.warn('[settings] renderActivityList failed:', e)}
  try{renderClass();}catch(e){console.warn('[settings] renderClass failed:', e)}
  try{renderSubjectManager();}catch(e){console.warn('[settings] renderSubjectManager failed:', e)}
  try{renderExamSection();}catch(e){console.warn('[settings] renderExamSection failed:', e)}
  if(typeof renderOverview==='function'&&document.getElementById('view-overview')&&document.getElementById('view-overview').classList.contains('active')){
    try{renderOverview();}catch(e){console.warn('[settings] renderOverview failed:', e)}
  }
  const activityView = document.getElementById('view-activity');
  if(activityView && activityView.classList.contains('active')){
    try{ if(typeof renderTracker==='function') renderTracker(); }catch(e){console.warn('[settings] renderTracker failed:', e)}
    try{ if(typeof updateTimerDisplay==='function') updateTimerDisplay(); }catch(e){console.warn('[settings] updateTimerDisplay failed:', e)}
  }
}

/* ============ TAGS — GENERAL ============ */
let errSelectedSubject=null;

function renderCommonErrors(){
  const list=document.getElementById('commonErrorsList');if(!list)return;
  const errs=(state&&state.commonErrors)||[];
  if(!errs.length){list.innerHTML='<div class="muted text-center p-8 fs-11">تگ عمومی نداری</div>';return;}
  list.innerHTML=errs.map((e,i)=>{
    const subOpts = Array.isArray(e.subOptions) ? e.subOptions : [];
    const isSolvable = e.subType === 'solvable';
    const subsHtml = subOpts.map((opt, j)=>{
      return `<span class="sub-opt-chip"><span>${esc(opt.label)}</span><button class="sub-opt-del" data-ceidx="${i}" data-soidx="${j}">×</button></span>`;
    }).join('');
    const solvableBadge = isSolvable ? '<span class="tag-special-badge">قابل حل / غیرقابل حل</span>' : '';
    return `<div class="common-tag-block">
      <div class="err-tag-row">
        <span class="c-dot" style="background:${errColor(e.id)}"></span>
        <span class="c-label">${esc(e.label)}</span>
        ${solvableBadge}
        <button class="c-del" data-ceidx="${i}">×</button>
      </div>
      ${isSolvable ? '' : `
        <div class="sub-opts-row">
          ${subsHtml}
          <input class="sub-opt-input" data-add-sub-for="${i}" placeholder="+ زیرمجموعه جدید..." maxlength="40">
        </div>
      `}
    </div>`;
  }).join('');
  list.querySelectorAll('.c-del').forEach(b=>{
    b.onclick=()=>{
      if(!confirm('این تگ حذف شود؟')) return;
      state.commonErrors.splice(+b.dataset.ceidx,1);
      save();renderCommonErrors();
    };
  });
  list.querySelectorAll('.sub-opt-del').forEach(b=>{
    b.onclick=(e)=>{
      e.stopPropagation();
      const ei=+b.dataset.ceidx, si=+b.dataset.soidx;
      if(state.commonErrors[ei] && state.commonErrors[ei].subOptions){
        state.commonErrors[ei].subOptions.splice(si, 1);
        save();renderCommonErrors();
      }
    };
  });
  list.querySelectorAll('.sub-opt-input').forEach(inp=>{
    inp.onkeydown=(e)=>{
      if(e.key!=='Enter') return;
      e.preventDefault();
      const val=inp.value.trim();
      if(!val) return;
      const ei=+inp.dataset.addSubFor;
      const tag=state.commonErrors[ei];
      if(!tag) return;
      if(!tag.subOptions) tag.subOptions=[];
      tag.subOptions.push({id:'sub_'+uid(), label: val});
      save();renderCommonErrors();
      toast('زیرمجموعه اضافه شد ✓');
    };
  });
}

document.getElementById('addCommonErrBtn').onclick=()=>{
  const inp=document.getElementById('newCommonErr');
  const label=inp.value.trim();if(!label)return;
  state.commonErrors.push({id:'common_'+uid(),label,hasSub:false,subType:null,subOptions:[]});
  save();inp.value='';renderCommonErrors();toast('اضافه شد');
};

/* ============ TAGS — SPECIALIZED ============ */
function renderSubjectErrorsSection(){
  const chipsBox=document.getElementById('errSubjectChips');if(!chipsBox)return;
  const specSubs=state.subjects.filter(s=>s.type==='specialized');
  if(!specSubs.length){
    chipsBox.innerHTML='<div class="muted text-center p-8 fs-11">هیچ درس تخصصی وجود ندارد.</div>';
    const l=document.getElementById('subjectErrorsList');
    if(l)l.innerHTML='';
    return;
  }
  if(!errSelectedSubject||!specSubs.find(s=>s.name===errSelectedSubject))errSelectedSubject=specSubs[0].name;
  chipsBox.innerHTML=specSubs.map(s=>`<div class="chip chip-subj err-subj-chip ${errSelectedSubject===s.name?'active':''}" data-esubj="${esc(s.name)}" style="--c:${s.color};border-color:${s.color}55;background:${s.color}1a">${esc(s.name)}</div>`).join('');
  chipsBox.querySelectorAll('[data-esubj]').forEach(c=>c.onclick=()=>{errSelectedSubject=c.dataset.esubj;renderSubjectErrorsSection();});
  
  const list=document.getElementById('subjectErrorsList');
  const subj = state.subjects.find(s=>s.name===errSelectedSubject);
  if(!subj){list.innerHTML='';return;}
  const tags = Array.isArray(subj.specialTags) ? subj.specialTags : [];
  if(!tags.length){list.innerHTML='<div class="muted text-center p-8 fs-11">تگ تخصصی نداری</div>';return;}
  list.innerHTML=tags.map((e,i)=>`<div class="err-tag-row"><span class="c-dot" style="background:${errColor(e.id)}"></span><span class="c-label">${esc(e.label)}</span><button class="c-del" data-seidx="${i}">×</button></div>`).join('');
  list.querySelectorAll('[data-seidx]').forEach(b=>b.onclick=()=>{
    subj.specialTags.splice(+b.dataset.seidx,1);
    save();renderSubjectErrorsSection();
  });
}

document.getElementById('addSubjectErrBtn').onclick=()=>{
  const inp=document.getElementById('newSubjectErr');
  const label=inp.value.trim();if(!label)return;
  const subj=state.subjects.find(s=>s.name===errSelectedSubject);
  if(!subj)return;
  if(!subj.specialTags)subj.specialTags=[];
  subj.specialTags.push({id:'sub_'+uid(),label});
  save();inp.value='';renderSubjectErrorsSection();toast('اضافه شد');
};

/* ============ SETTINGS PANEL ============ */
function renderSettingsPanel(){
  const exToggle=document.getElementById('examEnabledToggle');
  const exCard=document.getElementById('examToggleCard');
  const exBody=document.getElementById('examSettingsBody');
  if(exToggle)exToggle.checked=!!state.settings.examsEnabled;
  if(exCard)exCard.classList.toggle('on',!!state.settings.examsEnabled);
  if(exBody)exBody.classList.toggle('hidden',!state.settings.examsEnabled);
  const durEl=document.getElementById('setExamDuration');if(durEl)durEl.value=state.settings.examDuration||3;
  const nameEl=document.getElementById('setExamName');if(nameEl)nameEl.value=state.settings.examName||'آزمایشی';
  const finalEleventhCard=document.getElementById('finalEleventhSetting');
  const finalEleventhToggle=document.getElementById('includeEleventhFinalToggle');
  const supportsFinalEleventh=['تجربی','ریاضی'].includes(state.profile.field)&&state.profile.grade==='دوازدهم';
  if(finalEleventhCard)finalEleventhCard.hidden=!supportsFinalEleventh;
  if(finalEleventhToggle)finalEleventhToggle.checked=!!state.settings.includeEleventhFinal;
}

const _includeEleventhFinalToggle=document.getElementById('includeEleventhFinalToggle');
if(_includeEleventhFinalToggle)_includeEleventhFinalToggle.onchange=event=>{
  const enable=!!event.target.checked;
  if(!enable&&state.settings.includeEleventhFinal&&
     !confirm('با خاموش‌کردن «نهایی یازدهم»، دروس یازدهم از نمای کلی پنهان می‌شوند؛ اطلاعات ثبت‌شده حذف نمی‌شوند. خاموش شود؟')){
    event.target.checked=true;
    return;
  }
  state.settings.includeEleventhFinal=enable;
  save();
  try{renderOverview();}catch(error){console.error('[settings] overview refresh failed:',error);}
  try{renderSubjectManager();}catch(error){console.error('[settings] subject list refresh failed:',error);}
};

const _examEnableToggle = document.getElementById('examEnabledToggle');
if(_examEnableToggle) _examEnableToggle.onchange=(ev)=>{
  state.settings.examsEnabled=ev.target.checked;save();
  const card = document.getElementById('examToggleCard');
  const body = document.getElementById('examSettingsBody');
  if(card) card.classList.toggle('on',ev.target.checked);
  if(body) body.classList.toggle('hidden',!ev.target.checked);
  try{renderDashboard();renderPlanCalendar();renderActivityHeader();renderExamSection();}catch(_){}
};

const _examDurationEl = document.getElementById('setExamDuration');
if(_examDurationEl) _examDurationEl.onchange=(ev)=>{state.settings.examDuration=Math.max(0.5,Math.min(6,+ev.target.value||3));save();};

const _examNameEl = document.getElementById('setExamName');
if(_examNameEl) _examNameEl.onchange=(ev)=>{state.settings.examName=ev.target.value.trim()||'آزمایشی';save();};

/* ============ OPEN OVERLAY ============ */
function setSettingsChrome(open){
  const app=document.querySelector('.app');
  const logo=document.getElementById('appLogo');
  const brandTitle=document.getElementById('brandTitle');
  const settingsTitle=document.getElementById('settingsTitle');
  const backBtn=document.getElementById('settingsBackBtn');
  if(app) app.classList.toggle('settings-open',open);
  if(logo) logo.classList.toggle('hidden',open);
  if(brandTitle) brandTitle.classList.toggle('hidden',open);
  if(settingsTitle) settingsTitle.classList.toggle('hidden',!open);
  if(backBtn) backBtn.classList.toggle('hidden',!open);
}
function openSettingsOverlay(){
  const overlay=document.getElementById('settingsOverlay');if(!overlay)return;
  if(typeof closeExamCompare==='function')closeExamCompare(true);
  setSettingsPage('home');
  overlay.classList.add('show');document.body.style.overflow='hidden';
  setSettingsChrome(true);
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  try{renderProfileSection();}catch(e){console.error(e);}
  try{renderInstallAppButton();}catch(e){console.error(e);}
  try{renderSubjectManager();}catch(e){console.error(e);}
  try{renderSettingsPanel();}catch(e){console.error(e);}
  try{renderCommonErrors();}catch(e){console.error(e);}
  try{renderSubjectErrorsSection();}catch(e){console.error(e);}
  // Sync UI is rendered by 12-sql-sync.js via onSettingsOpen
  try{ if(typeof onSettingsOpen === 'function') onSettingsOpen(); }catch(e){console.error(e);}
  const verEl = document.getElementById('appVersionDisplay');
  if(verEl) verEl.textContent = APP_VERSION;
}
function closeSettingsOverlay(force){
  const overlay=document.getElementById('settingsOverlay');
  if(!overlay)return;
  if(force!==true&&settingsPage!=='home'){
    setSettingsPage('home');
    return;
  }
  setSettingsPage('home');
  renderProfileSection();
  overlay.classList.remove('show');
  setSettingsChrome(false);
  const activeView=document.querySelector('.view.active');
  const viewName=activeView ? String(activeView.id||'').replace(/^view-/,'') : '';
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',!!viewName && b.dataset.view===viewName));
  document.body.style.overflow='';
}
document.getElementById('settingsBtn').onclick=openSettingsOverlay;
document.getElementById('settingsBackBtn').onclick=closeSettingsOverlay;
document.getElementById('settingsClose').onclick=closeSettingsOverlay;