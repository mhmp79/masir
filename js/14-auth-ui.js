'use strict';

/* ============================================================
   MASIR AUTH UI — dedicated full-screen sign in, phone/password,
   OTP signup/reset, account tools and advisor pairing.
   Sync starts automatically only after a successful sign in.
   ============================================================ */

(function () {
  const AUTH_MODES = Object.freeze([
    'login', 'signup', 'reset', 'password', 'admin', 'advisor-code', 'pair-advisor'
  ]);
  const AUTH_REQUIRED_MODES = Object.freeze(['password', 'admin', 'advisor-code']);
  const AUTH_DEFER_KEY = 'konkur-auth-guest-deferred-v1';

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
  function deferLogin() {
    try { localStorage.setItem(AUTH_DEFER_KEY, String(Date.now())); } catch (e) {}
  }
  function clearDeferredLogin() {
    try { localStorage.removeItem(AUTH_DEFER_KEY); } catch (e) {}
  }
  function loginDeferred() {
    try { return !!localStorage.getItem(AUTH_DEFER_KEY); } catch (e) { return false; }
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
    /* A guest may postpone sign in; manual login buttons still open the overlay. */
    if (loginDeferred()) return;
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

    const mobileCopy = {
      login: { title: 'خوش آمدید', text: 'با شماره تلفن و رمز عبور خود وارد شوید.' },
      signup: { title: 'ثبت نام', text: 'حساب خود را بسازید و برنامهتان را شخصی کنید.' },
      reset: { title: 'بازیابی رمز', text: 'رمز عبور خود را دوباره تنظیم کنید.' },
      password: { title: 'تغییر رمز عبور', text: 'رمز حساب خود را بهروزرسانی کنید.' },
      admin: { title: 'مدیریت کاربران', text: 'ایجاد حساب و بازنشانی رمز توسط مدیر.' },
      'advisor-code': { title: 'دسترسی مشاور', text: 'کد دسترسی مخصوص خود را مدیریت کنید.' },
      'pair-advisor': { title: 'اتصال مشاور', text: 'کد مشاور را تأیید کنید.' }
    }[mode] || { title: 'مسیر', text: 'حساب شخصی تو' };

    box.innerHTML = `
      <div class="auth-shell">
        <aside class="auth-hero" aria-hidden="true">
          <div class="auth-hero-top">
            <div class="auth-logo" role="img" aria-label="مسیر"></div>
            <div class="auth-hero-kicker">مسیر</div>
          </div>
          <div class="auth-hero-copy">
            <h2>هر قدمی که برمیداری، حساب میشود</h2>
            <p>برنامه، فعالیتها و آزمونهایت را در یک فضای منظم و شخصی دنبال کن.</p>
          </div>
          <div class="auth-hero-features">
            <span>✓ برنامه ریزی هفتگی</span>
            <span>✓ ثبت فعالیت و شمارنده تست</span>
            <span>✓ تحلیل و مقایسه آزمونها</span>
          </div>
        </aside>
        <section class="auth-panel">
          <div class="auth-mobile-top">
            <div class="auth-mobile-brand">
              <div class="auth-logo" role="img" aria-label="مسیر"></div>
              <div>
                <div class="auth-hero-kicker">مسیر</div>
                <div class="auth-mobile-tagline">حساب شخصی تو</div>
              </div>
            </div>
            <div class="auth-mobile-welcome">
              <h1>${escapeHtml(mobileCopy.title)}</h1>
              <p>${escapeHtml(mobileCopy.text)}</p>
            </div>
          </div>
          <div class="auth-card">
            ${role ? '<button type="button" class="auth-tool-close" data-auth-action="close" aria-label="بازگشت به تنظیمات">‹ بازگشت به تنظیمات</button>' : ''}
            ${inner}
          </div>
        </section>
      </div>`;
  }

  function phoneField(value, readonly, id) {
    const inputId = id || 'authPhone';
    return `
      <div class="auth-field">
        <label class="auth-label" for="${inputId}">شماره تلفن</label>
        <input class="input auth-input" id="${inputId}" type="tel" dir="ltr" inputmode="numeric"
          autocomplete="tel-national" maxlength="15" placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          value="${escapeHtml(value || '')}" ${readonly ? 'readonly' : ''}>
      </div>`;
  }

  function passwordField(id, label, autocomplete) {
    return `
      <div class="auth-field">
        <label class="auth-label" for="${id}">${label}</label>
        <div class="auth-password">
          <input class="input auth-input" id="${id}" type="password" autocomplete="${autocomplete}" placeholder="••••••••">
          <button type="button" class="auth-eye" data-auth-toggle="${id}" aria-pressed="false" aria-label="نمایش رمز عبور">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
              <circle cx="12" cy="12" r="2.6" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>`;
  }

  function codeField(value) {
    return `
      <div class="auth-field">
        <label class="auth-label" for="authCode">کد پیامک</label>
        <input class="input auth-input auth-code" id="authCode" type="text" dir="ltr"
          inputmode="numeric" autocomplete="one-time-code" maxlength="6"
          placeholder="------" value="${escapeHtml(value || '')}">
      </div>`;
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
        <button type="button" class="auth-link auth-guest" data-auth-action="guest">ورود مهمان</button>
      </div>
      `;
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
        <div class="auth-field">
          <label class="auth-label" for="authDisplayName">نام نمایشی (اختیاری)</label>
          <input class="input auth-input" id="authDisplayName" type="text" maxlength="60" placeholder="مثلاً: متین">
        </div>
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
      `;
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
      `;
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
        <p class="auth-path-hint">مسیر دسترسی: تنظیمات ← حساب و پروفایل ← مدیریت کاربران ← ایجاد کاربر</p>
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
      <div class="auth-field">
        <label class="auth-label" for="authRole">نقش</label>
        <select class="input auth-input" id="authRole">
          <option value="student">دانشآموز</option>
          <option value="advisor">مشاور</option>
          <option value="admin">مدیر</option>
        </select>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="authDisplayName">نام نمایشی</label>
        <input class="input auth-input" id="authDisplayName" type="text" maxlength="60" placeholder="اختیاری">
      </div>
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
      <div class="auth-field">
        <label class="auth-label" for="authStudentPhone">شماره دانشآموز</label>
        <input class="input auth-input" id="authStudentPhone" type="tel" dir="ltr" inputmode="numeric"
          autocomplete="off" maxlength="15" placeholder="۰۹۱۲۳۴۵۶۷۸۹">
      </div>
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
      <div class="auth-field">
        <label class="auth-label" for="authAdvisorCode">کد مشاور</label>
        <input class="input auth-input auth-code" id="authAdvisorCode" type="text" dir="ltr"
          inputmode="text" autocomplete="off" maxlength="16" placeholder="XXXXXXXX">
      </div>
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
        button.classList.add('is-busy');
        button.textContent = '⏳…';
      }
    }
  }

  function setResult(message, error) {
    notice = String(message || '');
    errorText = String(error || '');
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
    const client = sync();
    clearDeferredLogin();
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
    const toggle = event.target && event.target.closest
      ? event.target.closest('[data-auth-toggle]') : null;
    if (toggle) {
      event.preventDefault();
      const field = document.getElementById(toggle.dataset.authToggle);
      if (field) {
        const revealed = field.type === 'password';
        field.type = revealed ? 'text' : 'password';
        toggle.setAttribute('aria-pressed', String(revealed));
        toggle.setAttribute('aria-label', revealed ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور');
      }
      return;
    }
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
    if (action === 'close') { hide(); return; }
    if (action === 'guest') {
      deferLogin();
      hide();
      notify('بهعنوان مهمان ادامه میدهید؛ هر وقت خواستید وارد شوید.');
      return;
    }
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
