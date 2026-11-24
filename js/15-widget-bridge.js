'use strict';

/* ============================================================
   MASIR WIDGET BRIDGE — keeps a dashboard snapshot in the page
   and, on request from the Android TWA host, sends it to the
   native widgets with a standard Chrome intent URL.
   No external scripts, no network calls, no extra storage.
   ============================================================ */

(function () {
  const SCHEME = 'masirwidget://sync?d=';
  const INTENT_PREFIX = 'intent://sync#Intent;scheme=masirwidget;package=app.masirkonkur.twa;S.d=';
  const INTENT_SUFFIX = ';end';
  let lastSnapshot = null;

  function isTwa() {
    let android = false;
    let standalone = false;
    try {
      android = /android/i.test(String(navigator.userAgent || ''));
    } catch (e) {}
    if (!android) return false;
    try {
      standalone = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    } catch (e) {}
    return standalone || /masir/i.test(String(navigator.userAgent || ''));
  }

  function encode(value) {
    const json = JSON.stringify(value);
    let binary;
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(json);
      binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    } else {
      binary = unescape(encodeURIComponent(json));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function push(snapshot) {
    if (!snapshot) return false;
    lastSnapshot = snapshot;
    if (!isTwa()) return false;
    try {
      window.location.href = INTENT_PREFIX + encode(snapshot) + INTENT_SUFFIX;
      return true;
    } catch (e) {
      return false;
    }
  }

  function enable() {
    if (!isTwa()) return false;
    if (!lastSnapshot && typeof window.collectDashboardSnapshot === 'function') {
      lastSnapshot = window.collectDashboardSnapshot();
    }
    return push(lastSnapshot || { v: 1, app: 'مسیر' });
  }

  window.masirWidgets = {
    SCHEME,
    INTENT_PREFIX,
    INTENT_SUFFIX,
    isTwa,
    encode,
    update: (snapshot) => { if (snapshot) lastSnapshot = snapshot; return !!snapshot; },
    sync: push,
    enable,
    last: () => lastSnapshot
  };
})();
