// Contact form: Web3Forms over fetch, accessible validation, distinct idle/sending/success/error states.
// Without JS the form still posts to Web3Forms and comes back through the hidden redirect field.

const $ = (s, r = document) => r.querySelector(s);
export function initContact({ C, motion }) {
  const K = C.contact, F = K.form, FD = F.fields;
  const RULES = {
    name: { test: (v) => v.trim().length > 0, msg: FD.name.error },
    email: { test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), msg: FD.email.error },
    message: { test: (v) => v.trim().length >= (FD.message.min || 10), msg: FD.message.error },
  };
  const form = $('#form'), send = $('#send'), sendT = $('.send-t', send), formErr = $('#formErr');
  const sent = $('#sent'), sentMsg = $('#sentMsg'), again = $('#again'), pulse = $('#pulse'), state = $('#chState');
  const fields = ['name', 'email', 'message'].map((n) => {
    const el = form.elements[n], err = document.getElementById(el.getAttribute('aria-describedby').split(' ').pop());
    return { n, el, err, touched: false };
  });
  let busy = false;

  function check(f, show) {
    const ok = RULES[f.n].test(f.el.value);
    if (show) {
      f.el.setAttribute('aria-invalid', String(!ok));
      f.err.hidden = ok;
      $('span', f.err).textContent = ok ? '' : RULES[f.n].msg;
    }
    return ok;
  }
  fields.forEach((f) => {
    f.el.addEventListener('blur', () => { if (f.el.value || f.touched) { f.touched = true; check(f, true); } });
    f.el.addEventListener('input', () => { if (f.touched) check(f, true); });
  });

  function setBusy(b) {
    busy = b;
    form.setAttribute('aria-busy', String(b));
    send.setAttribute('aria-busy', String(b));
    send.setAttribute('aria-disabled', String(b));
    sendT.textContent = b ? F.sending : F.send;
    fields.forEach((f) => { f.el.readOnly = b; });
    state.textContent = b ? K.states.sending : K.states.open;
  }

  function once(key) { try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1'); } catch { /* no storage: play it */ } return true; }
  function playPulse() {
    return new Promise((res) => {
      if (motion.low || !once('gc-signal')) { res(); return; }
      const b = pulse.getBoundingClientRect(), w = b.width, h = b.height, P = 2 * (w + h);
      // the rect path runs clockwise from the top-left corner: start at the bottom-left, end at the top-right
      const from = ((2 * w + h) / P) * 100, to = 100 + (w / P) * 100 - 8;
      pulse.style.setProperty('--from', (-from).toFixed(2));
      pulse.style.setProperty('--to', (-to).toFixed(2));
      pulse.classList.remove('go'); void pulse.getBoundingClientRect(); pulse.classList.add('go');
      setTimeout(() => { pulse.classList.remove('go'); res(); }, 720);
    });
  }

  async function success() {
    await playPulse();
    form.hidden = true; sent.hidden = false; state.textContent = K.states.received;
    sentMsg.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    formErr.hidden = true;
    let first = null;
    fields.forEach((f) => { f.touched = true; if (!check(f, true) && !first) first = f.el; });
    if (first) { first.focus(); return; }
    if (form.elements.botcheck.checked) { success(); return; } // a bot ticked the honeypot: pretend, send nothing

    setBusy(true);
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), F.timeoutMs || 12000);
    const body = {
      access_key: form.elements.access_key.value,
      subject: form.elements.subject.value,
      from_name: form.elements.from_name.value,
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim(),
      botcheck: '',
    };
    let ok = false;
    try {
      const res = await fetch(F.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body), signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      ok = res.ok && data.success === true;
    } catch { ok = false; }
    clearTimeout(timer);
    setBusy(false);
    if (ok) { form.reset(); fields.forEach((f) => { f.touched = false; f.el.removeAttribute('aria-invalid'); f.err.hidden = true; }); success(); }
    else { formErr.hidden = false; send.focus(); }
  });

  again.addEventListener('click', () => {
    sent.hidden = true; form.hidden = false; state.textContent = K.states.open;
    fields[0].el.focus();
  });
}
