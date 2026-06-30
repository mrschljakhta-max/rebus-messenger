(() => {
  const STATE = {
    ready: false,
    factorId: null,
    challengeId: null,
    enrolling: false
  };

  function client() {
    return window.rebusSupabaseClient || window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function ensureContainer() {
    const page = qs('#mfaPage');
    const form = qs('#mfaForm');
    if (!page || !form) return null;
    let box = qs('#rebusMfaEnrollBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'rebusMfaEnrollBox';
      box.className = 'rebus-mfa-enroll';
      form.insertAdjacentElement('beforebegin', box);
    }
    return box;
  }

  function clearContainer() {
    qs('#rebusMfaEnrollBox')?.remove();
  }

  function setStatus(text) {
    const status = qs('#mfaStatus');
    if (status) status.textContent = text;
  }

  function setText(text) {
    const node = qs('#mfaText');
    if (node) node.textContent = text;
  }

  function renderQr(enrollData) {
    const box = ensureContainer();
    if (!box) return;
    const totp = enrollData?.totp || {};
    const qr = totp.qr_code || totp.qrCode || '';
    const secret = totp.secret || '';
    const qrHtml = String(qr).trim().startsWith('<svg')
      ? qr
      : `<img src="${String(qr).replaceAll('"', '&quot;')}" alt="QR-код 2FA" />`;

    box.innerHTML = `
      <h3>Перша реєстрація 2FA</h3>
      <p>Відскануй QR-код у Google Authenticator, Microsoft Authenticator або іншому TOTP-застосунку. Потім введи 6-значний код нижче.</p>
      <div class="rebus-mfa-qr">${qrHtml}</div>
      ${secret ? `<span class="rebus-mfa-secret">${secret}</span>` : ''}
    `;
  }

  async function createFreshEnrollment(supa) {
    const listed = await supa.auth.mfa.listFactors();
    const totp = listed?.data?.totp || [];
    for (const factor of totp) {
      if (factor.status === 'unverified') {
        try { await supa.auth.mfa.unenroll({ factorId: factor.id }); } catch {}
      }
    }

    const enrolled = await supa.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'REBUS Messenger'
    });
    if (enrolled.error) throw enrolled.error;

    const factorId = enrolled.data?.id;
    if (!factorId) throw new Error('Supabase не повернув factorId для TOTP.');

    const challenged = await supa.auth.mfa.challenge({ factorId });
    if (challenged.error) throw challenged.error;

    STATE.factorId = factorId;
    STATE.challengeId = challenged.data?.id;
    STATE.ready = Boolean(STATE.factorId && STATE.challengeId);
    renderQr(enrolled.data);
    setText('Зареєструй 2FA для REBUS Messenger.');
    setStatus('Відскануй QR-код і введи перший 6-значний код.');
  }

  async function ensureEnrollment() {
    if (STATE.enrolling || STATE.ready) return;
    const page = qs('#mfaPage');
    if (!page || page.hidden) return;
    const supa = client();
    if (!supa?.auth?.mfa?.enroll) return;

    STATE.enrolling = true;
    try {
      const user = await supa.auth.getUser();
      if (!user?.data?.user?.id) return;

      const listed = await supa.auth.mfa.listFactors();
      if (listed.error) throw listed.error;
      const verified = listed.data?.totp?.find(item => item.status === 'verified');
      if (verified) {
        clearContainer();
        return;
      }

      await createFreshEnrollment(supa);
    } catch (error) {
      console.error('[REBUS] MFA enrollment restore failed:', error);
      setStatus(`Не вдалося згенерувати QR-код: ${error.message || error}`);
    } finally {
      STATE.enrolling = false;
    }
  }

  async function verifyEnrollment(code) {
    const supa = client();
    if (!STATE.ready || !supa?.auth?.mfa?.verify) return false;
    if (!/^\d{6}$/.test(code)) {
      setStatus('Введіть рівно 6 цифр.');
      return true;
    }

    const button = qs('#mfaSubmitButton');
    if (button) button.disabled = true;
    setStatus('Підтвердження першої реєстрації 2FA…');

    try {
      const result = await supa.auth.mfa.verify({
        factorId: STATE.factorId,
        challengeId: STATE.challengeId,
        code
      });
      if (result.error) throw result.error;

      const user = await supa.auth.getUser();
      const userId = user?.data?.user?.id;
      if (userId) sessionStorage.setItem(`rebus:messenger:mfa:${userId}`, 'verified');
      setStatus('2FA зареєстровано. Доступ підтверджено.');
      clearContainer();
      STATE.ready = false;
      STATE.factorId = null;
      STATE.challengeId = null;

      if (typeof showApp === 'function') showApp();
      if (typeof loadDirectUsers === 'function') setTimeout(() => loadDirectUsers(), 120);
      window.RebusPresence?.start?.();
      return true;
    } catch (error) {
      console.error('[REBUS] MFA enrollment verify failed:', error);
      setStatus(`Код не підтверджено: ${error.message || error}`);
      return true;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindForm() {
    const form = qs('#mfaForm');
    if (!form || form.dataset.mfaEnrollmentFixReady === '1') return;
    form.dataset.mfaEnrollmentFixReady = '1';
    form.addEventListener('submit', async event => {
      if (!STATE.ready) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      await verifyEnrollment(qs('#mfaCode')?.value?.trim() || '');
    }, true);
  }

  function init() {
    bindForm();
    setTimeout(ensureEnrollment, 220);
    setTimeout(ensureEnrollment, 900);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(ensureEnrollment, 120);
  });

  new MutationObserver(() => {
    clearTimeout(window.__rebusMfaEnrollTimer);
    window.__rebusMfaEnrollTimer = setTimeout(ensureEnrollment, 120);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
