'use strict';

/* ============================================================
   MASIR AUTH UI — phone/password sign in, OTP signup/reset,
   account tools and advisor pairing, styled as part of the app.
   The overlay is dismissible for offline-first local use; sync
   starts automatically as soon as an account is available.
   ============================================================ */

(function () {
  const SESSION_DISMISSED_KEY = 'konkur-auth-offline-session-v1';
  const AUTH_MODES = Object.freeze([
    'login', 'signup', 'reset', 'password', 'admin', 'advisor-code', 'pair-advisor'
  ]);
  const AUTH_REQUIRED_MODES = Object.freeze(['password', 'admin', 'advisor-code']);

  let mode = 'login';
  let phase = 'form';
  let adminTab = 'create';
  let pendingPhone = '';
  let busy = false;
  let notice = '';
  let errorText = '';
  let advisorCode = '';
  let advisorLinks = [];

  function sync() {
    return window.sqlSync || window.masirSqlSync || null;
  }
  function overlay() {
    return document.getElementById('authOverlay');
  }
  function content() {
    return document.getElementById('authContent');
  }
  function escapeHtml(value) {
    if (typeof esc === 'function') return esc(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function valueOf(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }
  function notify(message) {
    try { if (typeof toast === 'function') toast(message); } catch (e) {}
  }
  function friendlyError(error) {
    const raw = String((error && error.message) || error || '').trim();
    if (!raw) return 'عملیات ناموفق بود. لطفاً دوباره تلاش کنید.';
    const map = [
      [/invalid credentials/i, 'شماره یا رمز عبور اشتباه است.'],
      [/current password is incorrect/i, 'رمز عبور فعلی اشتباه است.'],
      [/an account with this phone already exists/i, 'برای این شماره از قبل حساب وجود دارد؛ وارد شوید یا رمز را بازیابی کنید.'],
      [/a user with this phone already exists/i, 'کاربری با این شماره از قبل وجود دارد.'],
      [/user not found/i, 'کاربری با این شماره پیدا نشد.'],
      [/invalid or expired code/i, 'کد پیامک نامعتبر است یا منقضی شده است.'],
      [/invalid code/i, 'کد پیامک اشتباه است.'],
      [/invalid or expired (signup|reset) token/i, 'کد تأیید منقضی شده است؛ یک کد تازه بگیرید.'],
      [/too many requests/i, 'تعداد تلاشها زیاد شد؛ چند لحظه صبر کنید.'],
      [/invalid phone/i, 'شماره تلفن معتبر نیست.'],
      [/password must be/i, 'رمز عبور باید حداقل ۸ کاراکتر باشد.'],
      [/failed to fetch|networkerror|network request failed/i, 'اتصال به سرور برقرار نشد. اتصال اینترنت را بررسی کنید.']
    ];
    for (const [pattern, message] of map) {
      if (pattern.test(raw)) return message;
    }
    return raw;
  }
  function bodyIsLocked() {
    const settings = document.getElementById('settingsOverlay');
    const modal = document.getElementById('modalBackdrop');
    const compare = document.getElementById('examCompareOverlay');
    return !!(settings && settings.classList.contains('show')) ||
      !!(modal && modal.classList.contains('show')) ||
      !!(compare && compare.classList.contains('show'));
  }
  function unlockBody() {
    if (!bodyIsLocked()) document.body.style.overflow = '';
  }
  function dismissForOffline() {
    try { sessionStorage.setItem(SESSION_DISMISSED_KEY, '1'); } catch (e) {}
    hide();
    notify('ادامه آفلاین؛ دادهها روی این دستگاه ذخیره میشوند.');
  }
  function wasDismissed() {
    try { return sessionStorage.getItem(SESSION_DISMISSED_KEY) === '1'; } catch (e) { return false; }
  }
  function clearDismissed() {
    try { sessionStorage.removeItem(SESSION_DISMISSED_KEY); } catch (e) {}
  }

  function show(nextMode, options) {
    const opts = options || {};
    const client = sync();
    let requested = String(nextMode || 'login');
    if (!AUTH_MODES.includes(requested)) requested = 'login';
    if (AUTH_REQUIRED_MODES.includes(requested) && (!client || !client.isLoggedIn())) requested = 'login';
    mode = requested;
    phase = 'form';
    adminTab = opts.adminTab || adminTab || 'create';
    pendingPhone = String(opts.phone || '');
    errorText = '';
    notice = opts.notice || '';
    busy = false;
    if (!opts.keepAdvisorData) {
      advisorCode = '';
      advisorLinks = [];
    }
    clearDismissed();
    const box = overlay();
    if (!box) return;
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => box.classList.add('show'));
    render();
    if (mode === 'advisor-code') {
      refreshAdvisorData();
    }
  }

  function hide() {
    const box = overlay();
    if (!box) return;
    box.classList.remove('show');
    box.hidden = true;
    unlockBody();
  }

  function isOpen() {
    const box = overlay();
    return !!box && !box.hidden && box.classList.contains('show');
  }

  function startup() {
    const client = sync();
    if (!client || client.isLoggedIn()) return;
    if (wasDismissed()) return;
    show('login');
  }

  function render() {
    const box = content();
    if (!box) return;
    const role = (sync() && sync().isLoggedIn && sync().isLoggedIn())
      ? String((sync() && sync().getLoggedInRole && sync().getLoggedInRole()) || 'student')
      : '';
    let inner = '';
    if (mode === 'login') inner = renderLogin();
    else if (mode === 'signup') inner = renderSignup();
    else if (mode === 'reset') inner = renderReset();
    else if (mode === 'password') inner = renderPassword();
    else if (mode === 'admin' && role === 'admin') inner = renderAdmin();
    else if (mode === 'advisor-code') inner = renderAdvisorCode(role);
    else if (mode === 'pair-advisor') inner = renderPairAdvisor(role);
    else inner = renderLogin();

    const closeLabel = role ? 'بستن' : 'ادامه آفلاین';
    box.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <div class="auth-logo" aria-hidden="true">M</div>
          <div>
            <div class="auth-title">مسیر کنکور</div>
            <div class="auth-subtitle">حساب امن، پیشرفت همراهت</div>
          </div>
        </div>
        ${inner}
        <button type="button" class="auth-close-link" data-auth-action="dismiss">${closeLabel}</button>
        <div class="auth-footnote">دادههای مطالعاتی همیشه روی همین دستگاه ذخیره میشوند و فقط برای همگامسازی به سرور فرستاده میشوند.</div>
      </div>`;
  }

  function serverField() {
    const client = sync();
    const url = client && client.baseUrl ? client.baseUrl() : '';
    return `
      <details class="auth-advanced">
        <summary>آدرس سرور همگامسازی</summary>
        <input class="input auth-input" id="authServerUrl" type="url" dir="ltr"
          inputmode="url" autocomplete="off" spellcheck="false"
          value="${escapeHtml(url)}" placeholder="https://…">
        <div class="auth-hint">در نصب معمولی نیازی به تغییر نیست.</div>
      </details>`;
  }

  function phoneField(value, readonly, id) {
    const inputId = id || 'authPhone';
    return `
      <label class="auth-label" for="${inputId}">شماره تلفن</label>
      <input class="input auth-input" id="${inputId}" type="tel" dir="ltr" inputmode="numeric"
        autocomplete="tel-national" maxlength="15" placeholder="۰۹۱۲۳۴۵۶۷۸۹"
        value="${escapeHtml(value || '')}" ${readonly ? 'readonly' : ''}>`;
  }

  function passwordField(id, label, autocomplete) {
    return `
      <label class="auth-label" for="${id}">${label}</label>
      <input class="input auth-input" id="${id}" type="password" autocomplete="${autocomplete}" placeholder="••••••••">`;
  }

  function codeField(value) {
    return `
      <label class="auth-label" for="authCode">کد پیامک</label>
      <input class="input auth-input auth-code" id="authCode" type="text" dir="ltr"
        inputmode="numeric" autocomplete="one-time-code" maxlength="6"
        placeholder="------" value="${escapeHtml(value || '')}">`;
  }

  function feedback() {
    return `
      ${notice ? `<div class="auth-message show">${escapeHtml(notice)}</div>` : ''}
      ${errorText ? `<div class="auth-error show">${escapeHtml(errorText)}</div>` : ''}`;
  }

  function renderLogin() {
    return `
      <div class="auth-heading">
        <h1>خوش آمدید</h1>
        <p>با شماره تلفن و رمز عبور خود وارد شوید.</p>
      </div>
      ${phoneField('')}
      ${passwordField('authPassword', 'رمز عبور', 'current-password')}
      ${feedback()}
      <button type="button" class="btn primary auth-submit" data-auth-action="login" ${busy ? 'disabled' : ''}>
        ${busy ? 'در حال ورود…' : 'ورود'}
      </button>
      <div class="auth-actions">
        <button type="button" class="auth-link" data-auth-mode="signup">ثبت نام</button>
        <button type="button" class="auth-link" data-auth-mode="reset">فراموشی رمز عبور</button>
      </div>
      ${serverField()}`;
  }

  function renderSignup() {
    if (phase === 'code') {
      return `
        <div class="auth-heading">
          <h1>تنظیم رمز عبور</h1>
          <p>کد ارسالشده به <b dir="ltr">${escapeHtml(pendingPhone)}</b> را وارد کنید و رمز دلخواهتان را بسازید.</p>
        </div>
        ${codeField('')}
        ${passwordField('authNewPassword', 'رمز عبور جدید', 'new-password')}
        ${passwordField('authConfirmPassword', 'تکرار رمز عبور', 'new-password')}
        <label class="auth-label" for="authDisplayName">نام نمایشی (اختیاری)</label>
        <input class="input auth-input" id="authDisplayName" type="text" maxlength="60" placeholder="مثلاً: متین">
        ${feedback()}
        <button type="button" class="btn primary auth-submit" data-auth-action="complete-signup" ${busy ? 'disabled' : ''}>
          ${busy ? 'در حال ایجاد حساب…' : 'ایجاد حساب'}
        </button>
        <div class="auth-actions">
          <button type="button" class="auth-link" data-auth-action="resend-signup">ارسال دوباره کد</button>
          <button type="button" class="auth-link" data-auth-mode="login">بازگشت به ورود</button>
        </div>`;
    }
    return `
      <div class="auth-heading">
        <h1>ثبت نام</h1>
        <p>برای هر شماره یک حساب ساخته میشود. ابتدا کد پیامک را دریافت کنید، سپس رمز عبور خود را تعیین میکنید.</p>
      </div>
      ${phoneField('')}
      ${feedback()}
      <button type="button" class="btn primary auth-submit" data-auth-action="send-signup" ${busy ? 'disabled' : ''}>
        ${busy ? 'در حال ارسال کد…' : 'ارسال کد تأیید'}
      </button>
      <div class="auth-actions">
        <button type="button" class="auth-link" data-auth-mode="login">حساب دارم، وارد شوید</button>
      </div>
      ${serverField()}`;
  }

  function renderReset() {
    if (phase === 'code') {
      return `
        <div class="auth-heading">
          <h1>رمز عبور جدید</h1>
          <p>کد پیامک ارسالشده به <b dir="ltr">${escapeHtml(pendingPhone)}</b> را به همراه رمز جدید وارد کنید.</p>
        </div>
        ${codeField('')}
        ${passwordField('authNewPassword', 'رمز عبور جدید', 'new-password')}
        ${passwordField('authConfirmPassword', 'تکرار رمز عبور', 'new-password')}
        ${feedback()}
        <button type="button" class="btn primary auth-submit" data-auth-action="complete-reset" ${busy ? 'disabled' : ''}>
          ${busy ? 'در حال ذخیره رمز…' : 'ذخیره رمز جدید'}
        </button>
        <div class="auth-actions">
          <button type="button" class="auth-link" data-auth-action="resend-reset">ارسال دوباره کد</button>
          <button type="button" class="auth-link" data-auth-mode="login">بازگشت به ورود</button>
        </div>`;
    }
    return `
      <div class="auth-heading">
        <h1>بازیابی رمز</h1>
        <p>کد تأیید به شماره تلفنتان ارسال میشود؛ سپس رمز تازهای انتخاب میکنید.</p>
      </div>
      ${phoneField('')}
      ${feedback()}
      <button type="button" class="btn primary auth-submit" data-auth-action="send-reset" ${busy ? 'disabled' : ''}>
        ${busy ? 'در حال ارسال کد…' : 'ارسال کد بازیابی'}
      </button>
      <div class="auth-actions">
        <button type="button" class="auth-link" data-auth-mode="login">بازگشت به ورود</button>
      </div>
      ${serverField()}`;
  }

  function renderPassword() {
    return `
      <div class="auth-heading">
        <h1>تغییر رمز عبور</h1>
        <p>رمز فعلی و رمز جدید خود را وارد کنید. رمز جدید حداقل ۸ کاراکتر باشد.</p>
      </div>
      ${passwordField('authCurrentPassword', 'رمز عبور فعلی', 'current-password')}
      ${passwordField('authNewPassword', 'رمز عبور جدید', 'new-password')}
      ${passwordField('authConfirmPassword', 'تکرار رمز عبور', 'new-password')}
      ${feedback()}
      <button type="button" class="btn primary auth-submit" data-auth-action="change-password" ${busy ? 'disabled' : ''}>
        ${busy ? 'در حال ذخیره…' : 'ذخیره رمز جدید'}
      </button>
      <div class="auth-actions">
        <button type="button" class="auth-link" data-auth-action="close">بستن</button>
      </div>`;
  }

  function renderAdmin() {
    const createTab = adminTab === 'create';
    return `
      <div class="auth-heading">
        <h1>مدیریت کاربران</h1>
        <p>ایجاد حساب و بازنشانی رمز توسط مدیر انجام میشود؛ کد پیامک تنها برای ثبت نام و بازیابی است.</p>
      </div>
      <div class="auth-tabs" role="tablist">
        <button type="button" role="tab" class="auth-tab ${createTab ? 'active' : ''}" data-auth-admin-tab="create">ایجاد کاربر</button>
        <button type="button" role="tab" class="auth-tab ${adminTab === 'reset' ? 'active' : ''}" data-auth-admin-tab="reset">بازنشانی رمز</button>
        <button type="button" role="tab" class="auth-tab ${adminTab === 'link' ? 'active' : ''}" data-auth-admin-tab="link">اتصال مشاور</button>
      </div>
      ${createTab ? renderAdminCreate() : (adminTab === 'reset' ? renderAdminReset() : renderAdminLink())}
      ${feedback()}
      <div class="auth-actions">
        <button type="button" class="auth-link" data-auth-action="close">بستن</button>
      </div>`;
  }

  function renderAdminCreate() {
    return `
      ${phoneField('')}
      <label class="auth-label" for="authRole">نقش</label>
      <select class="input auth-input" id="authRole">
        <option value="student">دانشآموز</option>
        <option value="advisor">مشاور</option>
        <option value="admin">مدیر</option>
      </select>
      <label class="auth-label" for="authDisplayName">نام نمایشی</label>
      <input class="input auth-input" id="authDisplayName" type="text" maxlength="60" placeholder="اختیاری">
      ${passwordField('authPassword', 'رمز عبور', 'new-password')}
      <button type="button" class="btn primary auth-submit" data-auth-action="admin-create" ${busy ? 'disabled' : ''}>
        ${busy ? 'در حال ایجاد…' : 'ایجاد کاربر'}
      </button>`;
  }

  function renderAdminReset() {
    return `
      ${phoneField('')}
      ${passwordField('authPassword', 'رمز عبور جدید', 'new-password')}
      <button type="button" class="btn primary auth-submit" data-auth-action="admin-reset" ${busy ? 'disabled' : ''}>
        ${busy ? 'در حال ذخیره…' : 'بازنشانی رمز'}
      </button>`;
  }

  function renderAdminLink() {
    return `
      ${phoneField('', false, 'authAdvisorPhone')}
      <label class="auth-label" for="authStudentPhone">شماره دانشآموز</label>
      <input class="input auth-input" id="authStudentPhone" type="tel" dir="ltr" inputmode="numeric"
        autocomplete="off" maxlength="15" placeholder="۰۹۱۲۳۴۵۶۷۸۹">
      <button type="button" class="btn primary auth-submit" data-auth-action="admin-link" ${busy ? 'disabled' : ''}>
        ${busy ? 'در حال اتصال…' : 'اتصال مشاور به دانشآموز'}
      </button>`;
  }

  function renderAdvisorCode(role) {
    const canInvite = role === 'advisor' || role === 'admin';
    const links = advisorLinks.length
      ? advisorLinks.map((link) => {
          const advisor = (link && link.advisor) || {};
          const student = (link && link.student) || {};
          return `<div class="auth-link-row">
            <span>${escapeHtml(advisor.displayName || advisor.phone || 'مشاور')}</span>
            <b>${escapeHtml(student.displayName || student.phone || 'در انتظار دانشآموز')}</b>
            <small>${escapeHtml(link.status || '')}</small>
          </div>`;
        }).join('')
      : '<div class="auth-hint">اتصالی ثبت نشده است.</div>';
    return `
      <div class="auth-heading">
        <h1>دسترسی مشاور</h1>
        <p>دانشآموز با وارد کردن کد مشاور، دسترسی خواندن و نوشتن به دادههایش را تأیید میکند.</p>
      </div>
      ${canInvite ? `
        <button type="button" class="btn cyan auth-submit" data-auth-action="invite-advisor" ${busy ? 'disabled' : ''}>
          ${busy ? 'در حال ساخت کد…' : 'ساخت کد مشاور'}
        </button>
        ${advisorCode ? `<div class="auth-code-box"><span>کد مشاور</span><b dir="ltr">${escapeHtml(advisorCode)}</b></div>` : ''}
        <div class="auth-section-title">اتصالهای ثبتشده</div>
        ${links}` : `
        <div class="auth-hint">نقش شما مشاور یا مدیر نیست.</div>`}
      ${feedback()}
      <div class="auth-actions">
        <button type="button" class="auth-link" data-auth-action="close">بستن</button>
      </div>`;
  }

  function renderPairAdvisor(role) {
    if (role !== 'student') {
      return `
        <div class="auth-heading"><h1>اتصال مشاور</h1><p>این گزینه برای حساب دانشآموز است.</p></div>
        ${feedback()}
        <div class="auth-actions"><button type="button" class="auth-link" data-auth-action="close">بستن</button></div>`;
    }
    return `
      <div class="auth-heading">
        <h1>اتصال مشاور</h1>
        <p>کدی را که مشاور به شما داده وارد کنید تا دسترسی به دادههایتان تأیید شود.</p>
      </div>
      <label class="auth-label" for="authAdvisorCode">کد مشاور</label>
      <input class="input auth-input auth-code" id="authAdvisorCode" type="text" dir="ltr"
        inputmode="text" autocomplete="off" maxlength="16" placeholder="XXXXXXXX">
      ${feedback()}
      <button type="button" class="btn primary auth-submit" data-auth-action="accept-advisor" ${busy ? 'disabled' : ''}>
        ${busy ? 'در حال تأیید…' : 'تأیید اتصال'}
      </button>
      <div class="auth-actions"><button type="button" class="auth-link" data-auth-action="close">بستن</button></div>`;
  }

  function setBusy(state, action) {
    busy = !!state;
    render();
    if (busy) {
      const button = document.querySelector(`[data-auth-action="${action}"]`);
      if (button) {
        button.disabled = true;
        button.textContent = '⏳…';
      }
    }
  }

  function setResult(message, error) {
    notice = String(message || '');
    errorText = String(error || '');
  }

  function saveServerUrl() {
    const client = sync();
    const raw = valueOf('authServerUrl');
    if (!client || !raw || raw === client.baseUrl()) return;
    client.saveBaseUrl(raw);
  }

  function requirePasswordMatch() {
    const first = valueOf('authNewPassword');
    const second = valueOf('authConfirmPassword');
    if (first !== second) {
      setResult('', 'رمز عبور و تکرار آن یکسان نیستند.');
      render();
      return null;
    }
    return first;
  }

  async function finishLogin() {
    clearDismissed();
    const client = sync();
    try { if (client && client.startAutoSync) client.startAutoSync(); } catch (e) {}
    try { if (client && client.cycle) client.cycle({ reason: 'login' }); } catch (e) {}
    try { renderSyncUI(); } catch (e) {}
    try { updateHomeSyncState(); } catch (e) {}
    hide();
    notify('✓ وارد شدید؛ همگامسازی خودکار آغاز شد.');
  }

  async function sendOtp(purpose) {
    const client = sync();
    if (!client) { setResult('', 'ماژول ارتباط با سرور بارگذاری نشد.'); render(); return; }
    const phone = valueOf('authPhone');
    if (!phone) { setResult('', 'شماره تلفن را وارد کنید.'); render(); return; }
    saveServerUrl();
    setBusy(true, purpose === 'signup' ? 'send-signup' : 'send-reset');
    errorText = '';
    notice = '';
    try {
      await client.requestOtp(phone, purpose);
      pendingPhone = phone;
      phase = 'code';
      setResult(purpose === 'signup'
        ? 'کد تأیید ارسال شد. حالا رمز عبور خود را تنظیم کنید.'
        : 'کد بازیابی ارسال شد. رمز جدید را وارد کنید.');
      render();
    } catch (error) {
      setResult('', friendlyError(error));
      render();
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  async function completeOtp(kind) {
    const client = sync();
    if (!client) { setResult('', 'ماژول ارتباط با سرور بارگذاری نشد.'); render(); return; }
    const code = valueOf('authCode');
    const password = requirePasswordMatch();
    if (!password) return;
    if (!code) { setResult('', 'کد پیامک را وارد کنید.'); render(); return; }
    setBusy(true, kind === 'signup' ? 'complete-signup' : 'complete-reset');
    notice = '';
    errorText = '';
    try {
      if (kind === 'signup') {
        await client.completeSignup(pendingPhone, code, password, valueOf('authDisplayName'));
      } else {
        await client.resetPassword(pendingPhone, code, password);
      }
      await finishLogin();
    } catch (error) {
      setResult('', friendlyError(error));
      render();
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  async function doLogin() {
    const client = sync();
    if (!client) { setResult('', 'ماژول ارتباط با سرور بارگذاری نشد.'); render(); return; }
    const phone = valueOf('authPhone');
    const password = valueOf('authPassword');
    if (!phone || !password) { setResult('', 'شماره تلفن و رمز عبور را وارد کنید.'); render(); return; }
    saveServerUrl();
    setBusy(true, 'login');
    notice = '';
    errorText = '';
    try {
      await client.login(phone, password);
      await finishLogin();
    } catch (error) {
      setResult('', friendlyError(error));
      render();
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  async function doChangePassword() {
    const client = sync();
    if (!client) return;
    const current = valueOf('authCurrentPassword');
    const password = requirePasswordMatch();
    if (!password) return;
    if (!current) { setResult('', 'رمز عبور فعلی را وارد کنید.'); render(); return; }
    setBusy(true, 'change-password');
    notice = '';
    errorText = '';
    try {
      await client.changePassword(current, password);
      notify('✓ رمز عبور تغییر یافت.');
      hide();
    } catch (error) {
      setResult('', friendlyError(error));
      render();
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  async function doAdminCreate() {
    const client = sync();
    if (!client || !client.adminCreateUser) return;
    const phone = valueOf('authPhone');
    const password = valueOf('authPassword');
    const role = valueOf('authRole') || 'student';
    if (!phone || !password) { setResult('', 'شماره و رمز عبور را وارد کنید.'); render(); return; }
    setBusy(true, 'admin-create');
    notice = '';
    errorText = '';
    try {
      await client.adminCreateUser(phone, password, { role, displayName: valueOf('authDisplayName') });
      setResult(`✓ کاربر ${phone} ایجاد شد.`);
      phase = 'form';
      render();
    } catch (error) {
      setResult('', friendlyError(error));
      render();
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  async function doAdminReset() {
    const client = sync();
    if (!client || !client.adminResetPassword) return;
    const phone = valueOf('authPhone');
    const password = valueOf('authPassword');
    if (!phone || !password) { setResult('', 'شماره و رمز عبور جدید را وارد کنید.'); render(); return; }
    setBusy(true, 'admin-reset');
    notice = '';
    errorText = '';
    try {
      await client.adminResetPassword(phone, password);
      setResult(`✓ رمز عبور ${phone} بازنشانی شد.`);
      render();
    } catch (error) {
      setResult('', friendlyError(error));
      render();
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  async function doAdminLink() {
    const client = sync();
    if (!client || !client.assignStudent) return;
    const advisor = valueOf('authAdvisorPhone');
    const student = valueOf('authStudentPhone');
    if (!advisor || !student) { setResult('', 'شماره مشاور و دانشآموز را وارد کنید.'); render(); return; }
    setBusy(true, 'admin-link');
    notice = '';
    errorText = '';
    try {
      await client.assignStudent(advisor, student);
      setResult('✓ مشاور به دانشآموز متصل شد.');
      render();
    } catch (error) {
      setResult('', friendlyError(error));
      render();
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  async function refreshAdvisorData() {
    const client = sync();
    if (!client || !client.advisorLinks || !client.isLoggedIn()) return;
    try {
      const result = await client.advisorLinks();
      advisorLinks = Array.isArray(result && result.links) ? result.links : [];
      if (mode === 'advisor-code') render();
    } catch (error) {
      console.warn('[AUTH] advisor links failed:', error);
    }
  }

  async function inviteAdvisor() {
    const client = sync();
    if (!client || !client.inviteAdvisor) return;
    setBusy(true, 'invite-advisor');
    notice = '';
    errorText = '';
    try {
      const result = await client.inviteAdvisor();
      advisorCode = String((result && result.code) || '');
      await refreshAdvisorData();
      setResult('✓ کد مشاور ساخته شد؛ آن را در اختیار دانشآموز بگذارید.');
      render();
    } catch (error) {
      setResult('', friendlyError(error));
      render();
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  async function acceptAdvisor() {
    const client = sync();
    if (!client || !client.acceptAdvisor) return;
    const code = valueOf('authAdvisorCode');
    if (!code) { setResult('', 'کد مشاور را وارد کنید.'); render(); return; }
    setBusy(true, 'accept-advisor');
    notice = '';
    errorText = '';
    try {
      await client.acceptAdvisor(code);
      setResult('✓ اتصال مشاور تأیید شد.');
      render();
    } catch (error) {
      setResult('', friendlyError(error));
      render();
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  function handleClick(event) {
    const button = event.target.closest('[data-auth-mode],[data-auth-action],[data-auth-admin-tab]');
    if (!button) return;
    event.preventDefault();
    if (busy) return;
    const nextMode = button.dataset.authMode;
    if (nextMode) {
      show(nextMode, { notice: '' });
      return;
    }
    const adminTabValue = button.dataset.authAdminTab;
    if (adminTabValue) {
      adminTab = adminTabValue;
      setResult('');
      render();
      return;
    }
    const action = button.dataset.authAction;
    if (!action) return;
    if (action === 'dismiss') { dismissForOffline(); return; }
    if (action === 'close') { hide(); return; }
    if (action === 'login') return void doLogin();
    if (action === 'send-signup') return void sendOtp('signup');
    if (action === 'send-reset') return void sendOtp('reset');
    if (action === 'resend-signup') {
      pendingPhone = valueOf('authPhone') || pendingPhone;
      phase = 'form';
      return void sendOtp('signup');
    }
    if (action === 'resend-reset') {
      pendingPhone = valueOf('authPhone') || pendingPhone;
      phase = 'form';
      return void sendOtp('reset');
    }
    if (action === 'complete-signup') return void completeOtp('signup');
    if (action === 'complete-reset') return void completeOtp('reset');
    if (action === 'change-password') return void doChangePassword();
    if (action === 'admin-create') return void doAdminCreate();
    if (action === 'admin-reset') return void doAdminReset();
    if (action === 'admin-link') return void doAdminLink();
    if (action === 'invite-advisor') return void inviteAdvisor();
    if (action === 'accept-advisor') return void acceptAdvisor();
  }

  function handleKeydown(event) {
    if (event.key !== 'Enter') return;
    if (event.target && event.target.tagName === 'BUTTON') return;
    const submit = content() && content().querySelector('.auth-submit');
    if (submit) { event.preventDefault(); submit.click(); }
  }

  let listenersBound = false;
  function bindOverlay() {
    if (listenersBound) return;
    const box = overlay();
    if (!box) return;
    listenersBound = true;
    box.addEventListener('click', handleClick);
    box.addEventListener('keydown', handleKeydown);
  }
  document.addEventListener('DOMContentLoaded', bindOverlay);
  /* Scripts load at the end of <body>; DOMContentLoaded may already have fired. */
  bindOverlay();

  window.masirAuth = {
    show,
    hide,
    isOpen,
    startup,
    dismissForOffline,
    getMode: () => mode,
    showLogin: () => show('login'),
    showSignup: () => show('signup'),
    showReset: () => show('reset'),
    showPassword: () => show('password'),
    showAdmin: () => show('admin'),
    showAdvisorCode: () => show('advisor-code'),
    showPairAdvisor: () => show('pair-advisor')
  };
})();
