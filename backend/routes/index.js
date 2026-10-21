// auth.js
const express = require('express');
const {
  signup, login, getMe, updateMe, refreshToken, logoutUser, registerPushToken
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const r = express.Router();

r.post('/signup',  signup);
r.post('/login',   login);
r.post('/refresh', refreshToken);           // New: silent token refresh
r.post('/logout',  protect, logoutUser);    // New: invalidates refresh token in DB
r.get('/me',       protect, getMe);
r.put('/me',       protect, updateMe);
r.post('/push-token', protect, registerPushToken);

module.exports.authRouter = r;

// groups.js
const { createGroup, getMyGroups, getGroup, joinGroup, updateGroup, leaveGroup } = require('../controllers/groupController');
const gr = express.Router();
gr.use(protect);
gr.get('/',             getMyGroups);
gr.post('/',            createGroup);
gr.post('/join',        joinGroup);
gr.get('/:id',          getGroup);
gr.put('/:id',          updateGroup);
gr.delete('/:id/leave', leaveGroup);
module.exports.groupRouter = gr;

// expenses.js (nested under /api/groups/:groupId)
const { getExpenses, createExpense, updateExpense, deleteExpense, clearMonthExpenses } = require('../controllers/expenseController');
const { getBudgets, upsertBudget, getSettlements, toggleSettlement } = require('../controllers/budgetSettlementController');
const er = express.Router({ mergeParams: true });
er.use(protect);
er.get('/expenses',                getExpenses);
er.post('/expenses',               createExpense);
er.put('/expenses/:expenseId',     updateExpense);
er.delete('/expenses/:expenseId',  deleteExpense);
er.delete('/expenses',             clearMonthExpenses); // DELETE /expenses?month=YYYY-MM
er.get('/budgets',                 getBudgets);
er.put('/budgets',                 upsertBudget);
er.get('/settlements',             getSettlements);
er.post('/settlements/toggle',     toggleSettlement);
module.exports.expenseRouter = er;
