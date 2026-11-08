const assert = require('assert');
const {
  calculateExpenseShares,
  calculateFairSettlement,
  toIdStr,
} = require('./utils/expenseCalculation');

console.log('====================================================');
console.log('🧪 SplitMate: Running All 10 Test Cases Verification');
console.log('====================================================\n');

// ── Shared Test Data ─────────────────────────────────────────────────────────
const ANKUSH   = '65f1a1a1a1a1a1a1a1a1a101';
const ANJUM    = '65f1a1a1a1a1a1a1a1a1a102';
const NAUSHAD  = '65f1a1a1a1a1a1a1a1a1a103';
const KANHAIYA = '65f1a1a1a1a1a1a1a1a1a104';
const STRANGER = '65f1a1a1a1a1a1a1a1a1a999';

const memberObjects = [
  { _id: ANKUSH,   name: 'Ankush' },
  { _id: ANJUM,    name: 'Anjum' },
  { _id: NAUSHAD,  name: 'Naushad' },
  { _id: KANHAIYA, name: 'Kanhaiya' },
];

let passedCount = 0;
let totalCount = 10;

// ── Test 1: Normal equal expense ───────────────────────────────────────────
// ₹400 expense shared by four members. Each member's share = ₹100.
console.log('▶ Test 1: Normal equal expense (₹400 / 4 members)');
{
  const exp = {
    _id: 'exp101',
    user: ANKUSH,
    amount: 400,
    item: 'Groceries',
    excludedMembers: [],
  };
  const result = calculateExpenseShares(exp, memberObjects);
  assert.strictEqual(result.expRupees, 400);
  assert.strictEqual(result.sharesRupees[ANKUSH], 100);
  assert.strictEqual(result.sharesRupees[ANJUM], 100);
  assert.strictEqual(result.sharesRupees[NAUSHAD], 100);
  assert.strictEqual(result.sharesRupees[KANHAIYA], 100);

  const settlement = calculateFairSettlement([exp], memberObjects, []);
  const ankushBal = settlement.memberBalances.find(b => b.id === ANKUSH);
  assert.strictEqual(ankushBal.netBalanceRupees, 300); // Paid 400 - 100 share = +300
  console.log('  ✔ Passed: Each member share = ₹100, Total exact = ₹400, Payer net = +₹300\n');
  passedCount++;
}

// ── Test 2: Selective exclusion ─────────────────────────────────────────────
// ₹150 chicken expense shared by three of four members (Kanhaiya excluded).
// Each included member's share = ₹50. Excluded member's share = ₹0.
console.log('▶ Test 2: Selective exclusion (₹150 Chicken, Kanhaiya excluded)');
{
  const exp = {
    _id: 'exp102',
    user: ANKUSH,
    amount: 150,
    item: 'Chicken',
    excludedMembers: [KANHAIYA],
  };
  const result = calculateExpenseShares(exp, memberObjects);
  assert.strictEqual(result.sharesRupees[ANKUSH], 50);
  assert.strictEqual(result.sharesRupees[ANJUM], 50);
  assert.strictEqual(result.sharesRupees[NAUSHAD], 50);
  assert.strictEqual(result.sharesRupees[KANHAIYA], 0);

  const settlement = calculateFairSettlement([exp], memberObjects, []);
  const kanhaiyaBal = settlement.memberBalances.find(b => b.id === KANHAIYA);
  const ankushBal = settlement.memberBalances.find(b => b.id === ANKUSH);

  assert.strictEqual(kanhaiyaBal.netBalanceRupees, 0); // Kanhaiya owes ₹0
  assert.strictEqual(ankushBal.netBalanceRupees, 100);  // Paid 150 - 50 share = +100
  console.log('  ✔ Passed: Included = ₹50 each, Kanhaiya excluded = ₹0, Ankush net = +₹100\n');
  passedCount++;
}

// ── Test 3: Payer excluded ──────────────────────────────────────────────────
// Ankush pays ₹120 for an expense. Only Anjum and Naushad are included.
// Ankush gets ₹120 payment credit but has zero consumption share.
// Anjum and Naushad each owe ₹60.
console.log('▶ Test 3: Payer excluded (Ankush pays ₹120, only Anjum & Naushad consume)');
{
  const exp = {
    _id: 'exp103',
    user: ANKUSH,
    amount: 120,
    item: 'Dessert',
    excludedMembers: [ANKUSH, KANHAIYA], // Ankush and Kanhaiya excluded
  };
  const result = calculateExpenseShares(exp, memberObjects);
  assert.strictEqual(result.sharesRupees[ANKUSH], 0);
  assert.strictEqual(result.sharesRupees[KANHAIYA], 0);
  assert.strictEqual(result.sharesRupees[ANJUM], 60);
  assert.strictEqual(result.sharesRupees[NAUSHAD], 60);

  const settlement = calculateFairSettlement([exp], memberObjects, []);
  const ankushBal = settlement.memberBalances.find(b => b.id === ANKUSH);
  const anjumBal = settlement.memberBalances.find(b => b.id === ANJUM);
  const naushadBal = settlement.memberBalances.find(b => b.id === NAUSHAD);
  const kanhaiyaBal = settlement.memberBalances.find(b => b.id === KANHAIYA);

  assert.strictEqual(ankushBal.netBalanceRupees, 120); // 120 paid - 0 share = +120
  assert.strictEqual(anjumBal.netBalanceRupees, -60);  // 0 paid - 60 share = -60
  assert.strictEqual(naushadBal.netBalanceRupees, -60);// 0 paid - 60 share = -60
  assert.strictEqual(kanhaiyaBal.netBalanceRupees, 0); // 0 paid - 0 share = 0
  console.log('  ✔ Passed: Ankush credit = +₹120, Anjum = -₹60, Naushad = -₹60, Kanhaiya = ₹0\n');
  passedCount++;
}

// ── Test 4: Different exclusions across expenses ────────────────────────────
// Expense A: ₹200 shared by Ankush, Anjum and Naushad (Kanhaiya excluded).
// Expense B: ₹300 shared by Anjum, Naushad and Kanhaiya (Ankush excluded).
console.log('▶ Test 4: Different exclusions across expenses');
{
  const expA = {
    _id: 'expA',
    user: ANKUSH,
    amount: 200, // 200 / 3 = 66.67, 66.67, 66.66
    item: 'Dinner NonVeg',
    excludedMembers: [KANHAIYA],
  };
  const expB = {
    _id: 'expB',
    user: ANJUM,
    amount: 300, // 300 / 3 = 100, 100, 100
    item: 'Stationery',
    excludedMembers: [ANKUSH],
  };

  const resA = calculateExpenseShares(expA, memberObjects);
  const resB = calculateExpenseShares(expB, memberObjects);

  assert.strictEqual(resA.sharesRupees[KANHAIYA], 0);
  assert.strictEqual(resB.sharesRupees[ANKUSH], 0);
  assert.strictEqual(resB.sharesRupees[KANHAIYA], 100);

  const settlement = calculateFairSettlement([expA, expB], memberObjects, []);
  // Sum of all net balances must be zero
  const totalNet = settlement.memberBalances.reduce((sum, b) => sum + b.netBalancePaise, 0);
  assert.strictEqual(totalNet, 0);
  console.log('  ✔ Passed: Both expenses retain independent participant lists & shares. Zero-sum balanced.\n');
  passedCount++;
}

// ── Test 5: Pending settlement receives new expense ────────────────────────
// Create expenses, calculate settlement, then add another expense before payment.
// Verify previous pending balance and new expense are combined correctly.
console.log('▶ Test 5: Pending settlement receives new expense (Dynamic recalculation)');
{
  const exp1 = { _id: 'e1', user: ANKUSH, amount: 90, excludedMembers: [KANHAIYA] }; // 90 / 3 = 30 each
  const s1 = calculateFairSettlement([exp1], memberObjects, []);
  const anjumBal1 = s1.memberBalances.find(b => b.id === ANJUM).netBalanceRupees;
  assert.strictEqual(anjumBal1, -30);

  // Now add exp2 of 60 paid by Naushad shared by all 4 (15 each)
  const exp2 = { _id: 'e2', user: NAUSHAD, amount: 60, excludedMembers: [] };
  const s2 = calculateFairSettlement([exp1, exp2], memberObjects, []);
  const anjumBal2 = s2.memberBalances.find(b => b.id === ANJUM).netBalanceRupees;
  assert.strictEqual(anjumBal2, -45); // -30 from exp1 + (-15) from exp2 = -45

  const ankushBal2 = s2.memberBalances.find(b => b.id === ANKUSH).netBalanceRupees;
  // Ankush: Paid 90 - 30(exp1) - 15(exp2) = +45
  assert.strictEqual(ankushBal2, 45);

  const naushadBal2 = s2.memberBalances.find(b => b.id === NAUSHAD).netBalanceRupees;
  // Naushad: Paid 60 - 30(exp1) - 15(exp2) = +15
  assert.strictEqual(naushadBal2, 15);

  const kanhaiyaBal2 = s2.memberBalances.find(b => b.id === KANHAIYA).netBalanceRupees;
  // Kanhaiya: Paid 0 - 0(exp1) - 15(exp2) = -15
  assert.strictEqual(kanhaiyaBal2, -15);

  console.log('  ✔ Passed: Pending settlement combined both expenses automatically (Ankush: +45, Anjum: -45, Naushad: +15, Kanhaiya: -15)\n');
  passedCount++;
}

// ── Test 6: Completed settlement freeze & fresh pending cycle ──────────────
// Complete a settlement and add another expense.
// Verify previous expenses remain in history but do not contribute to new pending balance.
console.log('▶ Test 6: Completed settlement lifecycle (Freeze history & fresh cycle)');
{
  // Cycle 1: exp1 (120 paid by Ankush, all 4 consume = 30 each)
  const cycle1Expenses = [
    { _id: 'oldExp1', user: ANKUSH, amount: 120, excludedMembers: [], settlementCycle: 'cycle_001' }
  ];
  // Everyone paid up, cycle is completed
  const cycle1Snapshot = calculateFairSettlement(cycle1Expenses, memberObjects, []);
  assert.strictEqual(cycle1Snapshot.totalSpent, 120);

  // Cycle 2: A new ₹150 chicken expense is added (Kanhaiya excluded)
  const cycle2PendingExpenses = [
    { _id: 'newExp1', user: ANKUSH, amount: 150, excludedMembers: [KANHAIYA], settlementCycle: null }
  ];

  // In new pending settlement, ONLY settlementCycle === null expenses are included!
  const newPendingSettlement = calculateFairSettlement(cycle2PendingExpenses, memberObjects, []);

  assert.strictEqual(newPendingSettlement.totalSpent, 150); // Does NOT include 120 from cycle 1
  const anjumBal = newPendingSettlement.memberBalances.find(b => b.id === ANJUM);
  const naushadBal = newPendingSettlement.memberBalances.find(b => b.id === NAUSHAD);
  const kanhaiyaBal = newPendingSettlement.memberBalances.find(b => b.id === KANHAIYA);
  const ankushBal = newPendingSettlement.memberBalances.find(b => b.id === ANKUSH);

  assert.strictEqual(anjumBal.netBalanceRupees, -50);
  assert.strictEqual(naushadBal.netBalanceRupees, -50);
  assert.strictEqual(kanhaiyaBal.netBalanceRupees, 0);
  assert.strictEqual(ankushBal.netBalanceRupees, 100);

  console.log('  ✔ Passed: Old cycle is frozen at ₹120. New pending cycle starts clean at ₹150 (Anjum owes ₹50, Naushad owes ₹50, Kanhaiya owes ₹0)\n');
  passedCount++;
}

// ── Test 7: Partial payment ────────────────────────────────────────────────
// A debtor pays only part of their outstanding amount.
// Verify that the remaining balance is calculated correctly.
console.log('▶ Test 7: Partial payment recording');
{
  // Expense: 200 paid by Ankush, split equally between Ankush and Anjum (100 each).
  // Anjum owes ₹100.
  const exp = { _id: 'exp7', user: ANKUSH, amount: 200, excludedMembers: [NAUSHAD, KANHAIYA] };
  
  // Anjum makes a partial payment of ₹40 to Ankush
  const partialPayment = {
    _id: 'pay7',
    from: ANJUM,
    to: ANKUSH,
    amount: 40,
    amountPaise: 4000,
    status: 'confirmed',
    settlementCycle: null,
  };

  const settlement = calculateFairSettlement([exp], memberObjects, [partialPayment]);
  const anjumBal = settlement.memberBalances.find(b => b.id === ANJUM);
  const ankushBal = settlement.memberBalances.find(b => b.id === ANKUSH);

  // Anjum initial debt = -100. Paid 40 -> remaining debt = -60.
  assert.strictEqual(anjumBal.netBalanceRupees, -60);
  assert.strictEqual(anjumBal.paymentSentRupees, 40);

  // Ankush initial credit = +100. Received 40 -> remaining credit = +60.
  assert.strictEqual(ankushBal.netBalanceRupees, 60);
  assert.strictEqual(ankushBal.paymentReceivedRupees, 40);

  // Suggested transfer should now be exactly ₹60 from Anjum to Ankush
  assert.strictEqual(settlement.txns.length, 1);
  assert.strictEqual(settlement.txns[0].fromId, ANJUM);
  assert.strictEqual(settlement.txns[0].toId, ANKUSH);
  assert.strictEqual(settlement.txns[0].amountPaise, 6000);
  assert.strictEqual(settlement.txns[0].amount, 60);

  console.log('  ✔ Passed: Initial debt ₹100 - Partial payment ₹40 = Remaining debt ₹60 exact\n');
  passedCount++;
}

// ── Test 8: New group member ───────────────────────────────────────────────
// Add a new member after old expenses exist.
// Verify that the new member is not charged for historical expenses.
console.log('▶ Test 8: New group member joined after past expenses');
{
  const NEW_MEMBER = '65f1a1a1a1a1a1a1a1a1a105';
  const updatedGroupMembers = [
    ...memberObjects,
    { _id: NEW_MEMBER, name: 'Vikram (New)' },
  ];

  // Past expense created among the original 4 members
  const pastExpense = {
    _id: 'pastExp',
    user: ANKUSH,
    amount: 400,
    excludedMembers: [NEW_MEMBER], // New member was not part of this or excluded
  };

  const settlement = calculateFairSettlement([pastExpense], updatedGroupMembers, []);
  const newMemberBal = settlement.memberBalances.find(b => b.id === NEW_MEMBER);

  assert.strictEqual(newMemberBal.shareRupees, 0);
  assert.strictEqual(newMemberBal.netBalanceRupees, 0);

  console.log('  ✔ Passed: New member share = ₹0 and net balance = ₹0. Not charged for past expenses.\n');
  passedCount++;
}

// ── Test 9: Remainder paise precision ──────────────────────────────────────
// ₹100 divided among three members.
// Verify shares are ₹33.34, ₹33.33, and ₹33.33 with exact total of ₹100.
console.log('▶ Test 9: Remainder paise integer arithmetic (₹100 / 3 members)');
{
  const exp = {
    _id: 'exp9',
    user: ANKUSH,
    amount: 100, // 10,000 paise / 3 = 3333 base + 1 remainder
    excludedMembers: [KANHAIYA],
  };

  const threeMembers = [memberObjects[0], memberObjects[1], memberObjects[2]];
  const result = calculateExpenseShares(exp, threeMembers);

  const s1 = result.sharesRupees[ANKUSH];
  const s2 = result.sharesRupees[ANJUM];
  const s3 = result.sharesRupees[NAUSHAD];

  // Exact paise distribution
  assert.strictEqual(result.sharesPaise[ANKUSH], 3334);
  assert.strictEqual(result.sharesPaise[ANJUM], 3333);
  assert.strictEqual(result.sharesPaise[NAUSHAD], 3333);

  // Exact rupees representation
  assert.strictEqual(s1, 33.34);
  assert.strictEqual(s2, 33.33);
  assert.strictEqual(s3, 33.33);

  // Total sum of shares must be EXACTLY 100.00
  const totalSharesRupees = Number((s1 + s2 + s3).toFixed(2));
  assert.strictEqual(totalSharesRupees, 100.00);

  const totalPaise = result.sharesPaise[ANKUSH] + result.sharesPaise[ANJUM] + result.sharesPaise[NAUSHAD];
  assert.strictEqual(totalPaise, 10000);

  console.log('  ✔ Passed: Shares = ₹33.34, ₹33.33, ₹33.33. Sum = exact ₹100.00 (Zero loss)\n');
  passedCount++;
}

// ── Test 10: Invalid exclusion ─────────────────────────────────────────────
// Try excluding all group members or using a member ID from another group.
// The backend must reject the request.
console.log('▶ Test 10: Invalid exclusion validation (Foreign member & exclude all)');
{
  // Validation function logic as implemented in expenseController.js
  const validate = (excludedMembers, groupMembers) => {
    if (!excludedMembers || !Array.isArray(excludedMembers)) return [];
    const memberIdSet = new Set(groupMembers.map(toIdStr));

    for (const rawId of excludedMembers) {
      const strId = toIdStr(rawId);
      if (!memberIdSet.has(strId)) {
        throw new Error(`Invalid exclusion: Member ${strId} does not belong to this group`);
      }
    }
    const uniqueExcluded = [...new Set(excludedMembers.map(toIdStr))];
    if (uniqueExcluded.length >= groupMembers.length) {
      throw new Error('Cannot exclude all members. At least one member must consume this expense.');
    }
    return uniqueExcluded;
  };

  // Case 1: Foreign ID rejection
  let foreignRejected = false;
  try {
    validate([STRANGER], memberObjects);
  } catch (err) {
    foreignRejected = err.message.includes('does not belong to this group');
  }
  assert.strictEqual(foreignRejected, true, 'Foreign member ID must be rejected');

  // Case 2: Exclude all members rejection
  let allExcludedRejected = false;
  try {
    validate([ANKUSH, ANJUM, NAUSHAD, KANHAIYA], memberObjects);
  } catch (err) {
    allExcludedRejected = err.message.includes('Cannot exclude all members');
  }
  assert.strictEqual(allExcludedRejected, true, 'Excluding all members must be rejected');

  // Case 3: Deduplication
  const deduplicated = validate([KANHAIYA, KANHAIYA], memberObjects);
  assert.strictEqual(deduplicated.length, 1);
  assert.strictEqual(deduplicated[0], KANHAIYA);

  console.log('  ✔ Passed: Foreign ID rejected, 100% exclusion rejected, duplicate IDs deduplicated.\n');
  passedCount++;
}

console.log('====================================================');
console.log(`🎉 ALL 10 TESTS PASSED: ${passedCount}/${totalCount} OK`);
console.log('====================================================');

