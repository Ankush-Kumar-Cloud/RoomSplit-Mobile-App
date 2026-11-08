/**
 * SplitMate - Smart Expense & Fair Settlement Calculation Engine
 * 
 * High-precision financial arithmetic using Integer Paise (1 Rupee = 100 Paise).
 * Eliminates IEEE 754 floating-point rounding drift.
 * Accurately calculates:
 * 1. Single expense shares with selective member exclusions.
 * 2. Aggregated fair consumption shares & total paid credits.
 * 3. Actual recorded peer-to-peer payments (full & partial payments).
 * 4. Net balances where Sum(Balances) === 0 paise strictly.
 * 5. Greedy peer-to-peer debt minimization transaction suggestions.
 */

/**
 * Universal ID Normalizer
 * Converts string, MongoDB ObjectId, or populated document { _id, name } to clean 24-character hex string.
 */
function toIdStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val.toHexString) return val.toHexString();
  if (val._id && val._id !== val) return toIdStr(val._id);
  if (val.id && val.id !== val) return toIdStr(val.id);
  return String(val);
}

/**
 * Calculates per-participant shares for a single expense in integer paise.
 * 
 * @param {Object} exp - Expense document/object
 * @param {Array} groupMembers - Group member objects or IDs
 * @returns {Object} { expPaise, expRupees, payerId, includedIds, excludedIds, sharesPaise, sharesRupees }
 */
function calculateExpenseShares(exp, groupMembers = []) {
  const amount = Number(exp.amount) || 0;
  const expPaise = Math.round(amount * 100);
  const payerId = toIdStr(exp.user);

  const allMemberIds = groupMembers.map(toIdStr).filter(Boolean);
  const excludedSet = new Set((exp.excludedMembers || []).map(toIdStr));

  // Included participants (all members minus excluded)
  const includedIds = allMemberIds.filter(id => !excludedSet.has(id));

  // Fallback: If no members included (invalid data), split among all members
  const participants = includedIds.length > 0 ? includedIds : allMemberIds;
  const count = Math.max(participants.length, 1);

  // Integer paise distribution: base share + remainder paise to first remainder members
  const baseShare = Math.floor(expPaise / count);
  const remainder = expPaise % count;

  const sharesPaise = {};
  const sharesRupees = {};

  // Initialize all group members with 0 share
  allMemberIds.forEach(id => {
    sharesPaise[id] = 0;
    sharesRupees[id] = 0;
  });

  participants.forEach((id, index) => {
    // Distribute 1 extra paisa to the first `remainder` members so sum === expPaise exactly
    const individualPaise = index < remainder ? baseShare + 1 : baseShare;
    sharesPaise[id] = individualPaise;
    sharesRupees[id] = Number((individualPaise / 100).toFixed(2));
  });

  return {
    expPaise,
    expRupees: expPaise / 100,
    payerId,
    includedIds: participants,
    excludedIds: allMemberIds.filter(id => excludedSet.has(id)),
    sharesPaise,
    sharesRupees,
  };
}

/**
 * Calculates fair pending or historical settlement balances across expenses and actual payments.
 * 
 * Formula:
 * Net Balance = (Total Paid For Expenses + Payments Sent) - (Total Consumption Share + Payments Received)
 * 
 * Positive Net Balance = Creditor (Group owes money to this member)
 * Negative Net Balance = Debtor (Member owes money to group)
 * Zero Net Balance = Settled up
 * 
 * @param {Array} expenses - Array of un-settled (pending) or historical Expense objects
 * @param {Array} members - Array of group member objects [{ _id, name }] or member IDs
 * @param {Array} payments - Array of recorded actual Payment objects
 * @returns {Object} { totalSpent, totalPayments, memberBalances, expenseShares, txns, isSettled }
 */
function calculateFairSettlement(expenses = [], members = [], payments = []) {
  if (!members || members.length === 0) {
    return {
      totalSpent: 0,
      totalPayments: 0,
      totalExpensesPaise: 0,
      totalPaymentsPaise: 0,
      balances: [],
      memberBalances: [],
      expenseShares: {},
      txns: [],
      isSettled: true,
    };
  }

  const memberIds = members.map(toIdStr);
  const memberNameMap = {};
  members.forEach(m => {
    const id = toIdStr(m);
    memberNameMap[id] = (m && typeof m === 'object' && m.name) ? m.name : 'Member';
  });

  // Track integer paise for all participants
  const paidPaise = {};             // Amount paid for group expenses
  const sharePaise = {};            // Consumption share of expenses
  const paymentSentPaise = {};      // Direct payments sent to roommates
  const paymentReceivedPaise = {};  // Direct payments received from roommates

  memberIds.forEach(id => {
    paidPaise[id] = 0;
    sharePaise[id] = 0;
    paymentSentPaise[id] = 0;
    paymentReceivedPaise[id] = 0;
  });

  let totalSpentPaise = 0;
  const expenseShares = {};

  // 1. Process Expenses
  for (const exp of expenses) {
    const amount = Number(exp.amount) || 0;
    if (amount <= 0) continue;

    const singleResult = calculateExpenseShares(exp, memberIds);
    totalSpentPaise += singleResult.expPaise;

    const expId = toIdStr(exp._id) || Math.random().toString(36).slice(2);
    expenseShares[expId] = singleResult.sharesRupees;

    // Credit payer with the full amount paid (even if payer was excluded from consuming)
    const payerId = singleResult.payerId;
    if (payerId) {
      paidPaise[payerId] = (paidPaise[payerId] || 0) + singleResult.expPaise;
      if (!memberNameMap[payerId]) {
        memberNameMap[payerId] = exp.user?.name || 'Previous Member';
      }
    }

    // Debit each member with their consumption share
    Object.entries(singleResult.sharesPaise).forEach(([mid, pShare]) => {
      sharePaise[mid] = (sharePaise[mid] || 0) + pShare;
    });
  }

  // 2. Process Actual Payments (Peer-to-Peer cash/UPI transfers)
  let totalPaymentsPaise = 0;
  for (const pay of payments) {
    // Only confirmed payments adjust live balances
    if (pay.status && pay.status !== 'confirmed') continue;

    const amtPaise = pay.amountPaise != null ? Math.round(Number(pay.amountPaise)) : Math.round((Number(pay.amount) || 0) * 100);
    if (amtPaise <= 0) continue;

    totalPaymentsPaise += amtPaise;

    const fromId = toIdStr(pay.from);
    const toId = toIdStr(pay.to);

    if (fromId) {
      paymentSentPaise[fromId] = (paymentSentPaise[fromId] || 0) + amtPaise;
      if (!memberNameMap[fromId]) memberNameMap[fromId] = pay.from?.name || 'Member';
    }

    if (toId) {
      paymentReceivedPaise[toId] = (paymentReceivedPaise[toId] || 0) + amtPaise;
      if (!memberNameMap[toId]) memberNameMap[toId] = pay.to?.name || 'Member';
    }
  }

  // All involved member IDs (current members + any previous payers/receivers)
  const allInvolvedIds = Array.from(new Set([
    ...memberIds,
    ...Object.keys(paidPaise),
    ...Object.keys(paymentSentPaise),
    ...Object.keys(paymentReceivedPaise),
  ]));

  // 3. Compute Net Balances in Paise & Rupees
  // Net Balance = (Total Paid + Payments Sent) - (Total Share + Payments Received)
  const memberBalances = allInvolvedIds.map(id => {
    const paidP = paidPaise[id] || 0;
    const shareP = sharePaise[id] || 0;
    const sentP = paymentSentPaise[id] || 0;
    const recvP = paymentReceivedPaise[id] || 0;

    const netP = (paidP + sentP) - (shareP + recvP);

    return {
      id,
      name: memberNameMap[id] || 'Member',
      paidPaise: paidP,
      paidRupees: Number((paidP / 100).toFixed(2)),
      sharePaise: shareP,
      shareRupees: Number((shareP / 100).toFixed(2)),
      paymentSentPaise: sentP,
      paymentSentRupees: Number((sentP / 100).toFixed(2)),
      paymentReceivedPaise: recvP,
      paymentReceivedRupees: Number((recvP / 100).toFixed(2)),
      netBalancePaise: netP,
      netBalanceRupees: Number((netP / 100).toFixed(2)),
      // UI convenience aliases
      paid: Number((paidP / 100).toFixed(2)),
      share: Number((shareP / 100).toFixed(2)),
      bal: Number((netP / 100).toFixed(2)),
    };
  });

  // 4. Greedy Debtor-Creditor Settlement Matching
  // Creditors: netBalancePaise > 0 (are owed money)
  // Debtors:   netBalancePaise < 0 (owe money)
  const creditors = memberBalances
    .filter(b => b.netBalancePaise > 0)
    .map(b => ({ ...b, remainingPaise: b.netBalancePaise }))
    .sort((a, b) => b.remainingPaise - a.remainingPaise);

  const debtors = memberBalances
    .filter(b => b.netBalancePaise < 0)
    .map(b => ({ ...b, remainingPaise: -b.netBalancePaise }))
    .sort((a, b) => b.remainingPaise - a.remainingPaise);

  const txns = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const settlePaise = Math.min(creditors[ci].remainingPaise, debtors[di].remainingPaise);
    if (settlePaise > 0) {
      txns.push({
        from: debtors[di].name,
        fromId: debtors[di].id,
        to: creditors[ci].name,
        toId: creditors[ci].id,
        amountPaise: settlePaise,
        amount: Math.round(settlePaise / 100), // Clean rounded rupees for cash/UPI handoff
        exactAmount: (settlePaise / 100).toFixed(2),
      });

      creditors[ci].remainingPaise -= settlePaise;
      debtors[di].remainingPaise -= settlePaise;
    }

    if (creditors[ci].remainingPaise === 0) ci++;
    if (debtors[di].remainingPaise === 0) di++;
  }

  // A settlement is settled if all member net balances are zero (or < 1 paisa)
  const isSettled = memberBalances.every(b => Math.abs(b.netBalancePaise) < 1);

  return {
    totalSpent: totalSpentPaise / 100,
    totalExpensesPaise: totalSpentPaise,
    totalPayments: totalPaymentsPaise / 100,
    totalPaymentsPaise,
    balances: memberBalances,
    memberBalances,
    expenseShares,
    txns,
    isSettled,
  };
}

module.exports = {
  toIdStr,
  calculateExpenseShares,
  calculateFairSettlement,
};
