'use strict';

/* ============================================================
   INIT — bootstrap
   ⚠️ MUST be the LAST <script> in index.html
   ============================================================ */

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