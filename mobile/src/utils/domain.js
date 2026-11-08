export const today  = () => new Date().toISOString().split('T')[0];
export const nowISO = () => new Date().toISOString();

export const monthKey = (offset = 0) => {
  const d = new Date(); d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
};

export const fmtDate = d =>
  new Date(d+'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short' });

export const fmtDateFull = d =>
  new Date(d+'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });

export const fmtTime = iso =>
  new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

export const fmtMonth = (offset = 0) => {
  const d = new Date(); d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('en-IN', { month:'short', year:'2-digit' }).replace(' ', " '");
};

export const relTime = iso => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

/**
 * Universal ID Normalizer
 * Converts string, MongoDB ObjectId, or populated document { _id, name } to a clean 24-char hex string.
 */
export const toIdStr = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val.toHexString) return val.toHexString();
  if (val._id && val._id !== val) return toIdStr(val._id);
  if (val.id && val.id !== val) return toIdStr(val.id);
  return String(val);
};

/**
 * Fair Monthly Settlement Calculation with Smart Expense Exclusion
 * 
 * Aggregates per-expense consumption shares instead of a flat total/N division.
 * Net Balance = Total Paid - Total Consumption Share.
 * Positive balance = Should receive money (creditor).
 * Negative balance = Needs to pay money (debtor).
 */
export const calcSettlement = (memberIds, nameMap, totals, expenses = []) => {
  const normMemberIds = (memberIds || []).map(toIdStr);

  const normNameMap = {};
  Object.entries(nameMap || {}).forEach(([k, v]) => {
    normNameMap[toIdStr(k)] = v;
  });

  const normTotals = {};
  normMemberIds.forEach(id => { normTotals[id] = 0; });
  Object.entries(totals || {}).forEach(([k, v]) => {
    normTotals[toIdStr(k)] = (normTotals[toIdStr(k)] || 0) + Number(v || 0);
  });

  const total = normMemberIds.reduce((s, id) => s + (normTotals[id] || 0), 0);
  const avgShare = total / Math.max(normMemberIds.length, 1);

  // Compute individual consumption shares across all expenses
  const memberShares = {};
  normMemberIds.forEach(id => { memberShares[id] = 0; });

  if (expenses && expenses.length > 0) {
    expenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      if (amt <= 0) return;

      const rawExcluded = exp.excludedMembers || [];
      const excluded = rawExcluded.map(toIdStr);
      const included = normMemberIds.filter(id => !excluded.includes(id));
      const participants = included.length > 0 ? included : normMemberIds;
      const sharePerPerson = amt / participants.length;

      participants.forEach(id => {
        memberShares[id] = (memberShares[id] || 0) + sharePerPerson;
      });
    });
  } else {
    // Fallback if no expenses passed
    normMemberIds.forEach(id => { memberShares[id] = avgShare; });
  }

  // Net Balance = Total Paid - Total Consumption Share
  const balances = normMemberIds.map(id => ({
    id,
    name: normNameMap[id] || '?',
    bal: (normTotals[id] || 0) - (memberShares[id] || 0),
    spent: normTotals[id] || 0,
    share: memberShares[id] || 0,
  }));

  const pos = balances.filter(b => b.bal > 0.01).map(x => ({ ...x })).sort((a, b) => b.bal - a.bal);
  const neg = balances.filter(b => b.bal < -0.01).map(x => ({ ...x })).sort((a, b) => a.bal - b.bal);
  const txns = [];
  let pi = 0, ni = 0;

  while (pi < pos.length && ni < neg.length) {
    const amt = Math.min(pos[pi].bal, -neg[ni].bal);
    if (amt > 0.01) {
      txns.push({
        from: neg[ni].name,
        fromId: neg[ni].id,
        to: pos[pi].name,
        toId: pos[pi].id,
        amount: Math.round(amt),
        exactAmount: amt.toFixed(2),
      });
    }
    pos[pi].bal -= amt;
    neg[ni].bal += amt;
    if (pos[pi].bal < 0.01) pi++;
    if (neg[ni].bal > -0.01) ni++;
  }

  return { txns, share: Math.round(avgShare), total: Math.round(total), balances, memberShares };
};

export const filterExpenses = (expenses, { date='', cat='', search='' }={}) =>
  expenses.filter(e => {
    if (date && e.date !== date) return false;
    if (cat  && (e.category||'other') !== cat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.item?.toLowerCase().includes(q) && !(e.note||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });
