'use strict';

// Segmented Tab Switching (for the combined MVP demo page)
document.querySelectorAll('.seg a[data-tab]').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelectorAll('.seg a[data-tab]').forEach(x => x.classList.remove('on'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    a.classList.add('on');
    const target = document.getElementById('pane-' + a.dataset.tab);
    if (target) target.classList.add('active');
  });
});

// 1. Auction Payment Simulation
window.submitAuction = function submitAuction() {
  const btn = document.getElementById('btn-pay');
  if (btn) btn.disabled = true;
  const form = document.getElementById('form-auction');
  const proc = document.getElementById('auc-processing');
  const rec = document.getElementById('auc-receipt');
  if (form) form.style.display = 'none';
  if (proc) proc.style.display = 'block';

  setTimeout(() => {
    if (proc) proc.style.display = 'none';
    if (rec) rec.style.display = 'block';
    if (btn) btn.disabled = false;
  }, 1000);
};

window.resetAuction = function resetAuction() {
  const rec = document.getElementById('auc-receipt');
  const form = document.getElementById('form-auction');
  if (rec) rec.style.display = 'none';
  if (form) form.style.display = 'block';
};

// 2. Repair Booking Simulation
window.submitRepair = function submitRepair() {
  const btn = document.getElementById('btn-repair');
  if (btn) btn.disabled = true;
  const res = document.getElementById('repair-result');
  if (res) res.style.display = 'block';

  const steps = [
    document.getElementById('rstep-1'),
    document.getElementById('rstep-2'),
    document.getElementById('rstep-3'),
    document.getElementById('rstep-4')
  ];
  steps.forEach((s, idx) => {
    if (!s) return;
    s.classList.remove('done', 'active');
    const badge = document.getElementById('sbadge-' + (idx + 1));
    if (badge) badge.textContent = idx + 1;
  });

  let current = 1;
  function nextStep() {
    if (current <= 4) {
      const s = document.getElementById('rstep-' + current);
      if (s) s.classList.add('active');
      setTimeout(() => {
        if (s) {
          s.classList.remove('active');
          s.classList.add('done');
        }
        const badge = document.getElementById('sbadge-' + current);
        if (badge) badge.innerHTML = '<i class="fa-solid fa-check"></i>';
        current++;
        if (current <= 4) nextStep();
        else if (btn) btn.disabled = false;
      }, 450);
    }
  }
  nextStep();
};

// 3. E-Waste Hand-in & Token Claim Simulation
let tokenTotal = 0;
window.submitRecycle = function submitRecycle() {
  const btn = document.getElementById('btn-recycle');
  if (btn) btn.disabled = true;
  const res = document.getElementById('recycle-result');
  if (res) res.style.display = 'block';
  const counter = document.getElementById('token-counter');
  const val = document.getElementById('token-val');
  const target = tokenTotal + 60;

  const interval = setInterval(() => {
    tokenTotal += 5;
    if (counter) counter.textContent = tokenTotal;
    if (val) val.textContent = 'ZMW ' + (tokenTotal * 0.5).toFixed(2);
    if (tokenTotal >= target) {
      clearInterval(interval);
      if (btn) btn.disabled = false;
    }
  }, 35);
};
