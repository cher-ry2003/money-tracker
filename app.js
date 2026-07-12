/* ================================================================
   MoneyTrack — personal expense, investment & remittance tracker
   All data persists in localStorage under one key.
   ================================================================ */

const STORE_KEY = 'moneyTrackerData_v1';

const defaultData = {
  expenses: [],     // {id, date, category, description, amount}
  investments: [],  // {id, symbol, shares, buyPrice, currentPrice, dateBought}
  transfers: [],    // {id, date, amount, rate, recipient, service}
  settings: { monthlyBudget: 0 },
};

let data = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(defaultData);
    return { ...structuredClone(defaultData), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

/* ---------------- helpers ---------------- */

const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const fmtUSD = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmtINR = (n) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const monthKey = (iso) => iso.slice(0, 7); // "YYYY-MM"
const thisMonth = () => todayISO().slice(0, 7);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- navigation ---------------- */

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    $('view-' + btn.dataset.view).classList.add('active');
    renderAll();
  });
});

/* ================================================================
   EXPENSES
   ================================================================ */

$('expenseForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const entry = {
    id: $('expenseEditId').value || uid(),
    date: $('expenseDate').value,
    category: $('expenseCategory').value,
    description: $('expenseDesc').value.trim(),
    amount: parseFloat($('expenseAmount').value),
  };
  const editing = !!$('expenseEditId').value;
  if (editing) {
    const i = data.expenses.findIndex((x) => x.id === entry.id);
    data.expenses[i] = entry;
  } else {
    data.expenses.push(entry);
  }
  saveData();
  resetExpenseForm();
  renderAll();
  toast(editing ? 'Expense updated' : `Expense added — ${fmtUSD(entry.amount)}`);
});

function resetExpenseForm() {
  $('expenseForm').reset();
  $('expenseEditId').value = '';
  $('expenseDate').value = todayISO();
  $('expenseFormTitle').textContent = 'Add Expense';
  $('expenseSubmitBtn').textContent = 'Add Expense';
  $('expenseCancelBtn').classList.add('hidden');
}

$('expenseCancelBtn').addEventListener('click', resetExpenseForm);

function editExpense(id) {
  const e = data.expenses.find((x) => x.id === id);
  if (!e) return;
  $('expenseEditId').value = e.id;
  $('expenseDate').value = e.date;
  $('expenseCategory').value = e.category;
  $('expenseDesc').value = e.description;
  $('expenseAmount').value = e.amount;
  $('expenseFormTitle').textContent = 'Edit Expense';
  $('expenseSubmitBtn').textContent = 'Save Changes';
  $('expenseCancelBtn').classList.remove('hidden');
  $('expenseForm').scrollIntoView({ behavior: 'smooth' });
}

function deleteExpense(id) {
  data.expenses = data.expenses.filter((x) => x.id !== id);
  saveData();
  renderAll();
  toast('Expense deleted');
}

$('expenseMonthFilter').addEventListener('change', renderExpenses);
$('clearExpenseFilter').addEventListener('click', () => {
  $('expenseMonthFilter').value = '';
  renderExpenses();
});

function renderExpenses() {
  const filter = $('expenseMonthFilter').value;
  const rows = data.expenses
    .filter((e) => !filter || monthKey(e.date) === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const tbody = $('expenseTable');
  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No expenses yet — add your first one above 👆</td></tr>`;
  } else {
    tbody.innerHTML = rows.map((e) => `
      <tr>
        <td>${fmtDate(e.date)}</td>
        <td><span class="badge expense">${escapeHTML(e.category)}</span></td>
        <td>${escapeHTML(e.description)}</td>
        <td class="right">${fmtUSD(e.amount)}</td>
        <td class="row-actions">
          <button class="icon-btn" onclick="editExpense('${e.id}')" title="Edit">✏️</button>
          <button class="icon-btn" onclick="deleteExpense('${e.id}')" title="Delete">🗑️</button>
        </td>
      </tr>`).join('');
  }

  const label = filter || thisMonth();
  const total = data.expenses
    .filter((e) => monthKey(e.date) === label)
    .reduce((s, e) => s + e.amount, 0);
  $('expenseMonthTotal').textContent =
    `${fmtUSD(total)} spent in ${new Date(label + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
}

/* ================================================================
   INVESTMENTS
   ================================================================ */

$('investForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const entry = {
    id: $('investEditId').value || uid(),
    symbol: $('investSymbol').value.trim().toUpperCase(),
    shares: parseFloat($('investShares').value),
    buyPrice: parseFloat($('investBuyPrice').value),
    currentPrice: parseFloat($('investCurrentPrice').value),
    dateBought: $('investDate').value || '',
  };
  const editing = !!$('investEditId').value;
  if (editing) {
    const i = data.investments.findIndex((x) => x.id === entry.id);
    data.investments[i] = entry;
  } else {
    data.investments.push(entry);
  }
  saveData();
  resetInvestForm();
  renderAll();
  toast(editing ? `${entry.symbol} updated` : `${entry.symbol} added to portfolio`);
});

function resetInvestForm() {
  $('investForm').reset();
  $('investEditId').value = '';
  $('investFormTitle').textContent = 'Add Holding';
  $('investSubmitBtn').textContent = 'Add Holding';
  $('investCancelBtn').classList.add('hidden');
}

$('investCancelBtn').addEventListener('click', resetInvestForm);

function editInvest(id) {
  const h = data.investments.find((x) => x.id === id);
  if (!h) return;
  $('investEditId').value = h.id;
  $('investSymbol').value = h.symbol;
  $('investShares').value = h.shares;
  $('investBuyPrice').value = h.buyPrice;
  $('investCurrentPrice').value = h.currentPrice;
  $('investDate').value = h.dateBought;
  $('investFormTitle').textContent = `Edit ${h.symbol}`;
  $('investSubmitBtn').textContent = 'Save Changes';
  $('investCancelBtn').classList.remove('hidden');
  $('investForm').scrollIntoView({ behavior: 'smooth' });
}

function deleteInvest(id) {
  const h = data.investments.find((x) => x.id === id);
  data.investments = data.investments.filter((x) => x.id !== id);
  saveData();
  renderAll();
  toast(`${h ? h.symbol : 'Holding'} removed`);
}

function portfolioTotals() {
  let value = 0, cost = 0;
  for (const h of data.investments) {
    value += h.shares * h.currentPrice;
    cost += h.shares * h.buyPrice;
  }
  return { value, cost, pl: value - cost, plPct: cost ? ((value - cost) / cost) * 100 : 0 };
}

function renderInvestments() {
  const tbody = $('investTable');
  const holdings = [...data.investments]
    .sort((a, b) => b.shares * b.currentPrice - a.shares * a.currentPrice);

  if (!holdings.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No holdings yet — add your Robinhood positions above 📈</td></tr>`;
    $('investTotalsRow').innerHTML = '';
  } else {
    tbody.innerHTML = holdings.map((h) => {
      const value = h.shares * h.currentPrice;
      const pl = value - h.shares * h.buyPrice;
      const plPct = h.buyPrice ? (pl / (h.shares * h.buyPrice)) * 100 : 0;
      const cls = pl >= 0 ? 'gain' : 'loss';
      const sign = pl >= 0 ? '+' : '';
      return `
      <tr>
        <td class="symbol-cell">${escapeHTML(h.symbol)}</td>
        <td class="right">${h.shares}</td>
        <td class="right">${fmtUSD(h.buyPrice)}</td>
        <td class="right">${fmtUSD(h.currentPrice)}</td>
        <td class="right">${fmtUSD(value)}</td>
        <td class="right ${cls}">${sign}${fmtUSD(pl)} (${sign}${plPct.toFixed(1)}%)</td>
        <td class="row-actions">
          <button class="icon-btn" onclick="editInvest('${h.id}')" title="Edit / update price">✏️</button>
          <button class="icon-btn" onclick="deleteInvest('${h.id}')" title="Delete">🗑️</button>
        </td>
      </tr>`;
    }).join('');

    const t = portfolioTotals();
    const cls = t.pl >= 0 ? 'gain' : 'loss';
    const sign = t.pl >= 0 ? '+' : '';
    $('investTotalsRow').innerHTML = `
      <td>Total</td><td></td><td></td><td></td>
      <td class="right">${fmtUSD(t.value)}</td>
      <td class="right ${cls}">${sign}${fmtUSD(t.pl)} (${sign}${t.plPct.toFixed(1)}%)</td><td></td>`;
  }

  const t = portfolioTotals();
  $('portfolioSummary').textContent = holdings.length
    ? `${holdings.length} holding${holdings.length > 1 ? 's' : ''} · ${fmtUSD(t.value)} · ${t.pl >= 0 ? '+' : ''}${fmtUSD(t.pl)} all-time`
    : '';

  renderAllocationChart();
}

/* ================================================================
   TRANSFERS (money sent home)
   ================================================================ */

$('transferForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const entry = {
    id: $('transferEditId').value || uid(),
    date: $('transferDate').value,
    amount: parseFloat($('transferAmount').value),
    rate: parseFloat($('transferRate').value) || 0,
    recipient: $('transferRecipient').value.trim(),
    service: $('transferService').value.trim(),
  };
  const editing = !!$('transferEditId').value;
  if (editing) {
    const i = data.transfers.findIndex((x) => x.id === entry.id);
    data.transfers[i] = entry;
  } else {
    data.transfers.push(entry);
  }
  saveData();
  resetTransferForm();
  renderAll();
  toast(editing ? 'Transfer updated' : `Transfer added — ${fmtUSD(entry.amount)}`);
});

function resetTransferForm() {
  $('transferForm').reset();
  $('transferEditId').value = '';
  $('transferDate').value = todayISO();
  $('transferFormTitle').textContent = 'Add Transfer';
  $('transferSubmitBtn').textContent = 'Add Transfer';
  $('transferCancelBtn').classList.add('hidden');
}

$('transferCancelBtn').addEventListener('click', resetTransferForm);

function editTransfer(id) {
  const t = data.transfers.find((x) => x.id === id);
  if (!t) return;
  $('transferEditId').value = t.id;
  $('transferDate').value = t.date;
  $('transferAmount').value = t.amount;
  $('transferRate').value = t.rate || '';
  $('transferRecipient').value = t.recipient;
  $('transferService').value = t.service;
  $('transferFormTitle').textContent = 'Edit Transfer';
  $('transferSubmitBtn').textContent = 'Save Changes';
  $('transferCancelBtn').classList.remove('hidden');
  $('transferForm').scrollIntoView({ behavior: 'smooth' });
}

function deleteTransfer(id) {
  data.transfers = data.transfers.filter((x) => x.id !== id);
  saveData();
  renderAll();
  toast('Transfer deleted');
}

function renderTransfers() {
  const tbody = $('transferTable');
  const rows = [...data.transfers].sort((a, b) => b.date.localeCompare(a.date));

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No transfers yet — log the money you send home 🏠</td></tr>`;
  } else {
    tbody.innerHTML = rows.map((t) => `
      <tr>
        <td>${fmtDate(t.date)}</td>
        <td>${escapeHTML(t.recipient) || '—'}</td>
        <td>${t.service ? `<span class="badge transfer">${escapeHTML(t.service)}</span>` : '—'}</td>
        <td class="right">${fmtUSD(t.amount)}</td>
        <td class="right">${t.rate ? t.rate.toFixed(2) : '—'}</td>
        <td class="right">${t.rate ? fmtINR(t.amount * t.rate) : '—'}</td>
        <td class="row-actions">
          <button class="icon-btn" onclick="editTransfer('${t.id}')" title="Edit">✏️</button>
          <button class="icon-btn" onclick="deleteTransfer('${t.id}')" title="Delete">🗑️</button>
        </td>
      </tr>`).join('');
  }

  const totalUSD = data.transfers.reduce((s, t) => s + t.amount, 0);
  const totalINR = data.transfers.reduce((s, t) => s + (t.rate ? t.amount * t.rate : 0), 0);
  const ytd = data.transfers
    .filter((t) => t.date.startsWith(String(new Date().getFullYear())))
    .reduce((s, t) => s + t.amount, 0);
  $('transferSummary').textContent = rows.length
    ? `${fmtUSD(totalUSD)} sent all-time${totalINR ? ` (≈ ${fmtINR(totalINR)})` : ''} · ${fmtUSD(ytd)} this year`
    : '';
}

/* ================================================================
   DASHBOARD
   ================================================================ */

let categoryChart, trendChart, allocationChart;

Chart.defaults.color = '#8b94a8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.borderColor = 'rgba(35,43,61,.6)';

const PALETTE = ['#4f8cff', '#22c55e', '#f5b545', '#f45b69', '#a78bfa',
                 '#2dd4bf', '#fb923c', '#e879f9', '#94a3b8', '#facc15', '#38bdf8'];

function renderDashboard() {
  $('todayDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const mk = thisMonth();
  const monthExpenses = data.expenses.filter((e) => monthKey(e.date) === mk);
  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  $('dashMonthSpend').textContent = fmtUSD(monthTotal);

  // budget
  const budget = data.settings.monthlyBudget;
  const fill = $('budgetFill');
  if (budget > 0) {
    const pct = (monthTotal / budget) * 100;
    $('dashBudgetLine').textContent = pct <= 100
      ? `${fmtUSD(budget - monthTotal)} left of ${fmtUSD(budget)} budget`
      : `${fmtUSD(monthTotal - budget)} over your ${fmtUSD(budget)} budget`;
    fill.style.width = Math.min(pct, 100) + '%';
    fill.classList.toggle('over', pct > 100);
  } else {
    $('dashBudgetLine').textContent = 'Set a monthly budget below';
    fill.style.width = '0%';
  }
  $('budgetInput').value = budget || '';

  // portfolio
  const t = portfolioTotals();
  $('dashPortfolio').textContent = fmtUSD(t.value);
  const plEl = $('dashPortfolioPL');
  if (data.investments.length) {
    plEl.textContent = `${t.pl >= 0 ? '▲ +' : '▼ '}${fmtUSD(t.pl)} (${t.pl >= 0 ? '+' : ''}${t.plPct.toFixed(1)}%) all-time`;
    plEl.className = 'card-sub ' + (t.pl >= 0 ? 'gain' : 'loss');
  } else {
    plEl.textContent = 'No holdings yet';
    plEl.className = 'card-sub';
  }

  // sent home
  const totalSent = data.transfers.reduce((s, x) => s + x.amount, 0);
  const totalINR = data.transfers.reduce((s, x) => s + (x.rate ? x.amount * x.rate : 0), 0);
  $('dashSentHome').textContent = fmtUSD(totalSent);
  $('dashSentHomeINR').textContent = totalINR
    ? `≈ ${fmtINR(totalINR)} · ${data.transfers.length} transfer${data.transfers.length > 1 ? 's' : ''}`
    : data.transfers.length ? `${data.transfers.length} transfer(s)` : 'No transfers yet';

  // today
  const today = todayISO();
  const todayExp = data.expenses.filter((e) => e.date === today);
  $('dashTodaySpend').textContent = fmtUSD(todayExp.reduce((s, e) => s + e.amount, 0));
  $('dashTxCount').textContent = `${todayExp.length} transaction${todayExp.length === 1 ? '' : 's'} today`;

  renderCategoryChart(monthExpenses);
  renderTrendChart();
  renderRecentActivity();
}

function renderCategoryChart(monthExpenses) {
  const byCat = {};
  for (const e of monthExpenses) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  const labels = Object.keys(byCat);
  const values = Object.values(byCat);

  categoryChart?.destroy();
  categoryChart = new Chart($('categoryChart'), {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['No expenses yet'],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: labels.length ? PALETTE : ['#232b3d'],
        borderWidth: 2,
        borderColor: '#151a26',
      }],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, padding: 12 } },
        tooltip: { enabled: labels.length > 0 },
      },
    },
  });
}

function renderTrendChart() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const spendByMonth = months.map((m) =>
    data.expenses.filter((e) => monthKey(e.date) === m).reduce((s, e) => s + e.amount, 0));
  const sentByMonth = months.map((m) =>
    data.transfers.filter((t) => monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0));
  const labels = months.map((m) =>
    new Date(m + '-15').toLocaleDateString('en-US', { month: 'short' }));

  trendChart?.destroy();
  trendChart = new Chart($('trendChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Expenses', data: spendByMonth, backgroundColor: '#f45b69', borderRadius: 6, maxBarThickness: 34 },
        { label: 'Sent Home', data: sentByMonth, backgroundColor: '#4f8cff', borderRadius: 6, maxBarThickness: 34 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: (v) => '$' + v.toLocaleString() } },
      },
      plugins: { legend: { labels: { boxWidth: 12 } } },
    },
  });
}

function renderAllocationChart() {
  const holdings = data.investments;
  allocationChart?.destroy();
  allocationChart = new Chart($('allocationChart'), {
    type: 'doughnut',
    data: {
      labels: holdings.length ? holdings.map((h) => h.symbol) : ['No holdings yet'],
      datasets: [{
        data: holdings.length ? holdings.map((h) => h.shares * h.currentPrice) : [1],
        backgroundColor: holdings.length ? PALETTE : ['#232b3d'],
        borderWidth: 2,
        borderColor: '#151a26',
      }],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, padding: 12 } },
        tooltip: { enabled: holdings.length > 0 },
      },
    },
  });
}

function renderRecentActivity() {
  const items = [
    ...data.expenses.map((e) => ({
      date: e.date, type: 'expense', label: 'Expense',
      desc: `${e.category} — ${e.description}`, amount: -e.amount,
    })),
    ...data.transfers.map((t) => ({
      date: t.date, type: 'transfer', label: 'Sent Home',
      desc: t.recipient ? `To ${t.recipient}${t.service ? ' via ' + t.service : ''}` : (t.service || 'Transfer'),
      amount: -t.amount,
    })),
    ...data.investments.filter((h) => h.dateBought).map((h) => ({
      date: h.dateBought, type: 'invest', label: 'Investment',
      desc: `Bought ${h.shares} × ${h.symbol}`, amount: -(h.shares * h.buyPrice),
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const tbody = $('recentActivity');
  if (!items.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Nothing yet — start by adding an expense, holding, or transfer</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((i) => `
    <tr>
      <td>${fmtDate(i.date)}</td>
      <td><span class="badge ${i.type}">${i.label}</span></td>
      <td>${escapeHTML(i.desc)}</td>
      <td class="right">${fmtUSD(Math.abs(i.amount))}</td>
    </tr>`).join('');
}

/* ---------------- budget ---------------- */

$('saveBudgetBtn').addEventListener('click', () => {
  data.settings.monthlyBudget = parseFloat($('budgetInput').value) || 0;
  saveData();
  renderDashboard();
  toast(data.settings.monthlyBudget ? `Budget set to ${fmtUSD(data.settings.monthlyBudget)}/month` : 'Budget cleared');
});

/* ---------------- backup / restore ---------------- */

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `moneytrack-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup downloaded');
});

$('importBtn').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.expenses || !imported.investments || !imported.transfers) {
        throw new Error('bad format');
      }
      data = { ...structuredClone(defaultData), ...imported };
      saveData();
      renderAll();
      toast('Backup restored ✓');
    } catch {
      toast('⚠ Invalid backup file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ---------------- init ---------------- */

// expose row-action handlers used by inline onclick
Object.assign(window, {
  editExpense, deleteExpense,
  editInvest, deleteInvest,
  editTransfer, deleteTransfer,
});

function renderAll() {
  renderDashboard();
  renderExpenses();
  renderInvestments();
  renderTransfers();
}

$('expenseDate').value = todayISO();
$('transferDate').value = todayISO();
renderAll();
