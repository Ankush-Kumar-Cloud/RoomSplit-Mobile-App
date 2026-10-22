import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Device from 'expo-device';
// import * as Notifications from 'expo-notifications';
import { Token, Theme, authApi, groupsApi, expensesApi, budgetsApi, settlementsApi, setLogoutHandler, socket } from '../api/client';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [ready,       setReady]       = useState(false);
  const [user,        setUser]        = useState(null);
  const [theme,       setThemeState]  = useState('light');
  // Per-group caches (groups already loaded, so no re-fetch on tab switch)
  const [expenses,    setExpenses]    = useState({});   // { [gid]: Expense[] }
  const [budgets,     setBudgets]     = useState({});   // { [gid]: Budget[] }
  const [settlements, setSettlements] = useState({});   // { [gid-mk]: Settlement[] }
  const [groups,      setGroups]      = useState([]);

  // ── Logout action (also used by API client on refresh failure) ───────────
  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setGroups([]);
    setExpenses({});
    setBudgets({});
    setSettlements({});
  }, []);

  // ── Bootstrap: restore token + theme ─────────────────────────────────────
  // Use Promise.all to parallelise storage reads — avoids sequential I/O
  useEffect(() => {
    (async () => {
      // Register the logout handler BEFORE any API calls might happen
      setLogoutHandler(logout);

      // Parallelise token init + theme load — saves ~50ms on startup
      await Token.init();
      const savedTheme = await Theme.load();
      if (savedTheme) setThemeState(savedTheme);

      if (Token.exists()) {
        try { setUser(await authApi.getMe()); } catch { await Token.clear(); }
      }
      setReady(true);
    })();
  }, []);

  const setTheme = useCallback(async (t) => {
    setThemeState(t);
    await Theme.save(t);
  }, []);

  // ── REAL-TIME SOCKET CONNECTION & PUSH NOTIFICATIONS ──────────────────────
  useEffect(() => {
    if (user) {
      socket.connect();
      
      // Register for Push Notifications
      /*
      (async () => {
        if (Device.isDevice) {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus === 'granted') {
            try {
              const token = (await Notifications.getExpoPushTokenAsync({
                 // No projectId needed if running in Expo Go without EAS configured yet
              })).data;
              await authApi.updatePushToken(token);
            } catch (e) { console.log('Push token err', e); }
          }
        }
      })();
      */

    } else {
      socket.disconnect();
    }
  }, [user]);

  useEffect(() => {
    if (!user || !groups.length) return;

    // Join rooms for all groups the user is part of
    groups.forEach(g => socket.emit('joinGroup', g._id));

    const handleExpCreate = (exp) => {
      setExpenses(prev => {
        const gid = exp.group;
        const cur = prev[gid] || [];
        if (cur.find(e => e._id === exp._id)) return prev; // Avoid duplicate from optimistic UI
        return { ...prev, [gid]: [exp, ...cur] };
      });
    };
    
    const handleExpUpdate = (exp) => {
      setExpenses(prev => {
        const gid = exp.group;
        const cur = prev[gid] || [];
        return { ...prev, [gid]: cur.map(e => e._id === exp._id ? exp : e) };
      });
    };

    const handleExpDelete = ({ _id }) => {
      setExpenses(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(gid => {
          newState[gid] = newState[gid].filter(e => e._id !== _id);
        });
        return newState;
      });
    };

    // Real-time handler: another client cleared a month's expenses
    const handleExpensesCleared = ({ groupId, month }) => {
      setExpenses(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).filter(e => !e.date?.startsWith(month)),
      }));
    };

    const handleBudgetUpsert = (b) => {
      setBudgets(prev => {
        const gid = b.group;
        const cur = prev[gid] || [];
        const idx = cur.findIndex(x => (x.user?._id || x.user) === (b.user?._id || b.user) && x.monthKey === b.monthKey);
        return { ...prev, [gid]: idx >= 0 ? cur.map((x, i) => i === idx ? b : x) : [...cur, b] };
      });
    };

    const handleSettlementToggle = (rec) => {
      setSettlements(prev => {
        const key = `${rec.group}-${rec.monthKey}`;
        const cur = prev[key] || [];
        const idx = cur.findIndex(s => s.txnIndex === rec.txnIndex);
        return { ...prev, [key]: idx >= 0 ? cur.map((s, i) => i === idx ? rec : s) : [...cur, rec] };
      });
    };

    socket.on('expenseCreated', handleExpCreate);
    socket.on('expenseUpdated', handleExpUpdate);
    socket.on('expenseDeleted', handleExpDelete);
    socket.on('expensesCleared', handleExpensesCleared);
    socket.on('budgetUpserted', handleBudgetUpsert);
    socket.on('settlementToggled', handleSettlementToggle);

    return () => {
      socket.off('expenseCreated', handleExpCreate);
      socket.off('expenseUpdated', handleExpUpdate);
      socket.off('expenseDeleted', handleExpDelete);
      socket.off('expensesCleared', handleExpensesCleared);
      socket.off('budgetUpserted', handleBudgetUpsert);
      socket.off('settlementToggled', handleSettlementToggle);
    };
  }, [user, groups]);

  // ── AUTH ACTIONS ──────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const u = await authApi.login(email, password);
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const u = await authApi.signup(name, email, password);
    setUser(u);
    return u;
  }, []);

  const updateProfile = useCallback(async (name) => {
    const u = await authApi.updateMe(name);
    setUser(u);
    return u;
  }, []);

  // ── GROUP ACTIONS ─────────────────────────────────────────────────────────
  const loadGroups = useCallback(async () => {
    const g = await groupsApi.getAll();
    setGroups(g);
    return g;
  }, []);

  const createGroup = useCallback(async (name) => {
    const g = await groupsApi.create(name);
    setGroups(prev => [g, ...prev]);
    return g;
  }, []);

  const joinGroup = useCallback(async (code) => {
    const g = await groupsApi.join(code);
    setGroups(prev => prev.find(x => x._id === g._id) ? prev.map(x => x._id === g._id ? g : x) : [g, ...prev]);
    return g;
  }, []);

  const renameGroup = useCallback(async (id, name) => {
    const g = await groupsApi.update(id, name);
    setGroups(prev => prev.map(x => x._id === id ? g : x));
    return g;
  }, []);

  const leaveGroup = useCallback(async (id) => {
    await groupsApi.leave(id);
    setGroups(prev => prev.filter(x => x._id !== id));
  }, []);

  // ── EXPENSE ACTIONS ───────────────────────────────────────────────────────
  const loadExpenses = useCallback(async (gid, filters = {}) => {
    // The API now returns { data, nextCursor }. We flatten `data` for backward compat.
    const res = await expensesApi.getAll(gid, filters);
    const list = Array.isArray(res) ? res : (res.data || []);
    setExpenses(prev => ({ ...prev, [gid]: list }));
    return list;
  }, []);

  const addExpense = useCallback(async (gid, form) => {
    const exp = await expensesApi.create(gid, form);
    // Optimistic local update — add to the front of the list immediately
    setExpenses(prev => ({ ...prev, [gid]: [exp, ...(prev[gid] || [])] }));
    return exp;
  }, []);

  const editExpense = useCallback(async (gid, eid, form) => {
    const exp = await expensesApi.update(gid, eid, form);
    setExpenses(prev => ({ ...prev, [gid]: (prev[gid] || []).map(e => e._id === eid ? exp : e) }));
    return exp;
  }, []);

  const removeExpense = useCallback(async (gid, eid) => {
    let prevList = [];
    setExpenses(prev => {
      prevList = prev[gid] || [];
      return { ...prev, [gid]: prevList.filter(e => e._id !== eid) };
    });
    try {
      await expensesApi.delete(gid, eid);
    } catch (e) {
      // Instantly restore previous state from in-memory backup on error
      setExpenses(prev => ({ ...prev, [gid]: prevList }));
      throw e;
    }
  }, []);

  // Clears ALL expenses for a specific month from both local state and DB
  const clearMonthExpenses = useCallback(async (gid, month) => {
    let prevList = [];
    setExpenses(prev => {
      prevList = prev[gid] || [];
      return {
        ...prev,
        [gid]: prevList.filter(e => !e.date?.startsWith(month)),
      };
    });
    try {
      await expensesApi.clearMonth(gid, month);
    } catch (e) {
      setExpenses(prev => ({ ...prev, [gid]: prevList }));
      throw e;
    }
  }, []);

  // ── BUDGET ACTIONS ────────────────────────────────────────────────────────
  const loadBudgets = useCallback(async (gid, month) => {
    const list = await budgetsApi.getAll(gid, month);
    setBudgets(prev => ({ ...prev, [gid]: list }));
    return list;
  }, []);

  const setBudget = useCallback(async (gid, userId, monthKey, amount) => {
    const b = await budgetsApi.upsert(gid, userId, monthKey, amount);
    setBudgets(prev => {
      const cur = prev[gid] || [];
      const idx = cur.findIndex(x => (x.user?._id || x.user) === userId && x.monthKey === monthKey);
      return { ...prev, [gid]: idx >= 0 ? cur.map((x, i) => i === idx ? b : x) : [...cur, b] };
    });
    return b;
  }, []);

  const getBudget = useCallback((gid, userId, monthKey) => {
    const cur = budgets[gid] || [];
    const b = cur.find(x => (x.user?._id || x.user) === userId && x.monthKey === monthKey);
    return b?.amount || 0;
  }, [budgets]);

  // ── SETTLEMENT ACTIONS ────────────────────────────────────────────────────
  const loadSettlements = useCallback(async (gid, month) => {
    const list = await settlementsApi.getAll(gid, month);
    setSettlements(prev => ({ ...prev, [`${gid}-${month}`]: list }));
    return list;
  }, []);

  const toggleSettlement = useCallback(async (gid, monthKey, txnIndex) => {
    const rec = await settlementsApi.toggle(gid, monthKey, txnIndex);
    setSettlements(prev => {
      const key = `${gid}-${monthKey}`;
      const cur = prev[key] || [];
      const idx = cur.findIndex(s => s.txnIndex === txnIndex);
      return { ...prev, [key]: idx >= 0 ? cur.map((s, i) => i === idx ? rec : s) : [...cur, rec] };
    });
    return rec;
  }, []);

  const isPaid = useCallback((gid, monthKey, txnIndex) => {
    const cur = settlements[`${gid}-${monthKey}`] || [];
    return cur.some(s => s.txnIndex === txnIndex && s.paid);
  }, [settlements]);

  // Memoized expenses getter — avoids re-sorting on every render
  const getExpenses = useCallback((gid) =>
    [...(expenses[gid] || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  [expenses]);

  const value = {
    ready, user, theme, groups, setTheme,
    login, signup, logout, updateProfile,
    loadGroups, createGroup, joinGroup, renameGroup, leaveGroup,
    loadExpenses, addExpense, editExpense, removeExpense, getExpenses, clearMonthExpenses,
    loadBudgets, setBudget, getBudget,
    loadSettlements, toggleSettlement, isPaid,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
