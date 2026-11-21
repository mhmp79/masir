'use strict';

/* ============================================================
   INIT — bootstrap
   ⚠️ MUST be the LAST <script> in index.html
   ============================================================ */

/* ============================================================
   BACK / EXIT GUARD
   روی گوشی و صفحه‌های لمسی، دکمهٔ بازگشت اول لایه‌های باز
   (تنظیمات/مودال/آزمون) یا تب فعلی را می‌بندد و در «آخرین صفحه»
   قبل از خروج تأیید می‌گیرد. در دسکتاپ رفتار مرورگر دست‌نخورده
   می‌ماند.
   ============================================================ */
function setupBackExitGuard(){
  if(!window.history || typeof history.pushState!=='function') return;
  const touch=('ontouchstart' in window)||((navigator.maxTouchPoints||0)>0);
  if(!touch || window.__masirBackGuard) return;
  window.__masirBackGuard=true;

  let exitConfirmed=false;
  const rearm=()=>{ try{ history.pushState({masirGuard:true},''); }catch(_){} };
  rearm();

  window.addEventListener('popstate',()=>{
    if(exitConfirmed) return;

    /* ۱) لایه‌های باز */
    const settings=document.getElementById('settingsOverlay');
    if(settings && settings.classList.contains('show')){
      try{ closeSettingsOverlay(); }catch(_){}
      rearm(); return;
    }
    const compare=document.getElementById('examCompareOverlay');
    if(compare && compare.classList.contains('show')){
      compare.classList.remove('show');
      document.body.style.overflow='';
      rearm(); return;
    }
    const calendarDrawer=document.getElementById('examSidebarBackdrop');
    if(calendarDrawer && !calendarDrawer.hidden){
      try{ setExamSidebarOpen(false); }catch(_){}
      rearm(); return;
    }
    const tagDrawer=document.getElementById('noteTagBackdrop');
    if(tagDrawer && !tagDrawer.hidden){
      try{ setNoteTagSidebarOpen(false); }catch(_){}
      rearm(); return;
    }
    const exam=document.getElementById('examOverlay');
    if(exam && exam.style.display==='block'){
      try{ closeExamDetail(); }catch(_){}
      rearm(); return;
    }
    const backdrop=document.getElementById('modalBackdrop');
    if(backdrop && backdrop.classList.contains('show')){
      try{ closeModal(); }catch(_){}
      rearm(); return;
    }
    /* ۲) بازگشت از تب‌ها به داشبورد */
    const active=document.querySelector('.nav-btn.active');
    const viewName=active ? active.dataset.view : 'dashboard';
    if(viewName && viewName!=='dashboard'){
      try{ switchView('dashboard'); }catch(_){}
      rearm(); return;
    }

    /* ۳) آخرین صفحه → تأیید خروج */
    if(window.confirm('از Masir خارج می‌شوید؟')){
      exitConfirmed=true;
      try{ window.close(); }catch(_){}
      setTimeout(()=>{ try{ toast('برای خروج، دوباره بازگشت را بزنید'); }catch(_){} },80);
    }else{
      rearm();
    }
  });
}

function init(){
  loadTracker();
  renderActSubjects();
  renderActivityHeader();
  initActivityForm();
  renderDashboard();
  renderPlanCalendar();
  renderPlanTable();
  renderActivityList();
  renderClass();
  renderSubjectManager();
  renderTracker();
  renderSettingsPanel();
  renderCommonErrors();
  renderSubjectErrorsSection();
  renderExamSection();
  document.querySelectorAll('[data-acc-toggle]').forEach(btn=>{btn.addEventListener('click',(e)=>{e.preventDefault();btn.closest('.acc-card').classList.toggle('open');});});
  updateContextButton('dashboard');
  const verEl = document.getElementById('appVersionDisplay');
  if(verEl) verEl.textContent = APP_VERSION;
  // Sync UI initial render (only if logged in and on settings view)
  try {
    if (isLoggedIn() && typeof renderSyncUI === 'function') renderSyncUI();
  } catch(_) {}
  try{ setupBackExitGuard(); }catch(error){ console.warn('[back] guard setup failed:',error); }
}

(async()=>{
  try{
    await initializeStorage();
  }catch(error){
    console.error('[storage] application startup failed:',error);
    toast(error.message||'بارگذاری اطلاعات انجام نشد.');
  }finally{
    init();
    try{ if(typeof startAutoSync==='function') startAutoSync(); }
    catch(error){ console.error('[sync] auto sync start failed:',error); }
    const loading=document.getElementById('storageLoading');
    if(loading)loading.remove();
  }
})();