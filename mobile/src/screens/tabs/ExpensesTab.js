import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  View, Text, TouchableOpacity, TextInput, Alert,
  StyleSheet, ScrollView, RefreshControl,
} from "react-native";

import { useApp } from "../../context/AppContext";
import { COLORS, CATS, PAL, palOf } from "../../utils/theme";
import { today, monthKey, fmtDate, fmtTime, fmtMonth, filterExpenses, toIdStr } from "../../utils/domain";
import { Avatar, CatChip, BottomSheet, ExpenseForm, ExpenseItemSkeleton, Btn } from "../../components/index";

// ── Memoized Expense Row ─────────────────────────────────────────────────────
const ExpenseRow = memo(function ExpenseRow({ exp, allMembers = [], canEdit, canDelete, col, c, theme, onEdit, onDelete, onDetail }) {
  const excluded = exp.excludedMembers || [];
  const excludedIds = excluded.map(toIdStr);
  const excludedCount = excludedIds.length;
  const includedCount = Math.max(allMembers.length - excludedCount, 1);
  const perPersonShare = (exp.amount / includedCount).toFixed(2);

  // Get excluded names
  const excludedNames = excluded.map(x => {
    if (x?.name) return x.name;
    const xId = toIdStr(x);
    const found = allMembers.find(m => toIdStr(m) === xId);
    return found?.name || 'Member';
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onDetail(exp)}
      style={{ padding: 16, borderTopWidth: 1, borderTopColor: c.border }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: c.text }}>
            {exp.item}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <CatChip cat={exp.category || "other"} />
            <Text style={{ fontSize: 12, color: c.text3 }}>
              {fmtDate(exp.date)} · {fmtTime(exp.createdAt)}
            </Text>
          </View>

          {/* Exclusion badge if any member was excluded */}
          {excludedCount > 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
              backgroundColor: theme === 'dark' ? '#2A1B1D' : '#FEF2F2',
              borderColor: c.dangerBd, borderWidth: 1, borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start'
            }}>
              <Text style={{ fontSize: 11, color: c.danger, fontWeight: '700' }}>
                🚫 Excluded: {excludedNames.join(', ')}
              </Text>
              <Text style={{ fontSize: 11, color: c.text3 }}>
                (₹{perPersonShare}/share)
              </Text>
            </View>
          )}

          {exp.note ? (
            <Text style={{ marginTop: 6, fontSize: 12, color: c.text3, fontStyle: "italic" }}>
              {exp.note}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: col.mid }}>₹{exp.amount}</Text>
          {excludedCount > 0 ? (
            <Text style={{ fontSize: 11, color: c.text3, marginTop: 2 }}>
              ₹{perPersonShare} × {includedCount}
            </Text>
          ) : (
            <Text style={{ fontSize: 11, color: c.text3, marginTop: 2 }}>
              ₹{(exp.amount / Math.max(allMembers.length, 1)).toFixed(1)}/ea
            </Text>
          )}
        </View>
      </View>

      {(canEdit || canDelete) && (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {canEdit && (
            <TouchableOpacity onPress={() => onEdit(exp)} style={[s.actBtn, { borderColor: c.border2, opacity: 0.75 }]}>
              <Text style={{ color: c.text2, fontWeight: "500" }}>Edit</Text>
            </TouchableOpacity>
          )}
          {canDelete && (
            <TouchableOpacity onPress={() => onDelete(exp)} style={[s.actBtn, { borderColor: c.dangerBd, opacity: 0.75 }]}>
              <Text style={{ color: c.danger, fontWeight: "500" }}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}, (prev, next) =>
  prev.exp._id === next.exp._id &&
  prev.exp.amount === next.exp.amount &&
  prev.exp.item === next.exp.item &&
  prev.exp.excludedMembers?.length === next.exp.excludedMembers?.length &&
  prev.allMembers?.length === next.allMembers?.length &&
  prev.canEdit === next.canEdit &&
  prev.canDelete === next.canDelete
);

// ── Member Summary Card ──────────────────────────────────────────────────────
const MemberSummaryCard = memo(function MemberSummaryCard({ m, col, budget, spent, isActive, onPress }) {
  return (
    <TouchableOpacity
      onPress={() => onPress(m._id)}
      activeOpacity={0.8}
      style={[s.summCard, { backgroundColor: col.bg, borderColor: isActive ? col.dark : col.border, borderWidth: isActive ? 2 : 1 }]}
    >
      <Avatar name={m.name} col={col} size={36} />
      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: col.dark, marginTop: 6, textAlign: "center" }}>
        {m.name}
      </Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color: col.dark, marginTop: 4 }}>₹{spent.toFixed(0)}</Text>
      <Text style={{ fontSize: 11, color: col.mid, opacity: 0.8, marginTop: 2 }}>This Month</Text>
      {budget > 0 && (
        <View style={{ width: "100%", height: 5, backgroundColor: "rgba(255,255,255,.4)", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
          <View style={{ width: `${Math.min((spent / budget) * 100, 100)}%`, height: 5, backgroundColor: col.mid, borderRadius: 99 }} />
        </View>
      )}
    </TouchableOpacity>
  );
});

// ── Main Tab ─────────────────────────────────────────────────────────────────
export default function ExpensesTab({ group, members, monthOff, setMonthOff }) {
  const { theme, user, getExpenses, loadExpenses, addExpense, editExpense, removeExpense, getBudget } = useApp();
  const c = COLORS[theme];
  const gid = group._id;

  const mk = monthKey(monthOff);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [srch,       setSrch]       = useState("");
  const [catF,       setCatF]       = useState("");
  const [showAdd,    setShowAdd]    = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [detailExp,  setDetailExp]  = useState(null);
  const [showCats,   setShowCats]   = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  useEffect(() => {
    let active = true;
    loadExpenses(gid)
      .catch((err) => {
        if (__DEV__) console.log("loadExpenses caught in ExpensesTab:", err?.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [gid, loadExpenses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadExpenses(gid);
    } catch (err) {
      if (__DEV__) console.log("onRefresh caught:", err?.message);
    } finally {
      setRefreshing(false);
    }
  }, [gid, loadExpenses]);

  const all = getExpenses(gid);
  const meId = user?._id;
  const isOwner = (group?.owner?._id || group?.owner)?.toString() === meId?.toString();
  const todayStr = today();
  const activeMemberId = selectedMemberId || meId;

  const monthExpenses = useMemo(() => all.filter(e => e.date?.startsWith(mk)), [all, mk]);

  const monTotals = useMemo(() => {
    const t = {};
    monthExpenses.forEach(e => {
      const uid = e.user?._id || e.user;
      t[uid] = (t[uid] || 0) + e.amount;
    });
    return t;
  }, [monthExpenses]);

  const todayTotals = useMemo(() => {
    if (monthOff !== 0) return {};
    const t = {};
    all.filter(e => e.date === todayStr).forEach(e => {
      const uid = e.user?._id || e.user;
      t[uid] = (t[uid] || 0) + e.amount;
    });
    return t;
  }, [all, todayStr, monthOff]);

  const orderedExpenseMembers = useMemo(() => {
    if (!members) return [];
    if (!activeMemberId) return members;
    const activeStr = String(activeMemberId);
    const activeUser = members.find(m => String(m._id) === activeStr);
    const others = members.filter(m => String(m._id) !== activeStr);
    return activeUser ? [activeUser, ...others] : members;
  }, [members, activeMemberId]);

  const filtered = useMemo(() => filterExpenses(monthExpenses, { cat: catF, search: srch }), [monthExpenses, catF, srch]);

  const handleDelete = useCallback((exp) => {
    Alert.alert("Delete Expense?", `"${exp.item}" will be permanently deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await removeExpense(gid, exp._id);
          if (detailExp?._id === exp._id) setDetailExp(null);
        } catch (e) {
          Alert.alert("Error", e.message);
        }
      }},
    ]);
  }, [gid, removeExpense, detailExp]);

  const handleEdit = useCallback((exp) => {
    setDetailExp(null);
    setEditing(exp);
  }, []);

  const handleMemberPress = useCallback((uid) => setSelectedMemberId(uid), []);
  const handleDetail = useCallback((exp) => setDetailExp(exp), []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', padding: 14, gap: 10 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ width: 105, height: 120, borderRadius: 16, backgroundColor: '#F3F4F6' }} />
          ))}
        </View>
        <View style={{ borderRadius: 22, marginHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' }}>
          {[1, 2, 3, 4].map(i => <ExpenseItemSkeleton key={i} />)}
        </View>
      </View>
    );
  }

  // Details sheet calculations
  const detailExcludedIds = (detailExp?.excludedMembers || []).map(toIdStr);
  const detailIncluded = members.filter(m => !detailExcludedIds.includes(toIdStr(m)));
  const detailExcluded = members.filter(m => detailExcludedIds.includes(toIdStr(m)));
  const detailSharePerPerson = detailExp && detailIncluded.length > 0 ? (detailExp.amount / detailIncluded.length).toFixed(2) : "0.00";
  const detailPayerName = detailExp ? (detailExp.user?.name || members.find(m => toIdStr(m) === toIdStr(detailExp.user))?.name || "Member") : "";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* ───── MEMBER SUMMARY ───── */}
      <View style={{ backgroundColor: c.bg, paddingBottom: 6 }}>
        <ScrollView
          horizontal
          style={{ maxHeight: 155 }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16, gap: 10 }}
        >
          {members.map((m, i) => {
            const col = PAL[i % PAL.length];
            return (
              <MemberSummaryCard
                key={m._id}
                m={m}
                col={col}
                budget={getBudget(gid, m._id, mk)}
                spent={monTotals[m._id] || 0}
                isActive={activeMemberId === m._id}
                onPress={handleMemberPress}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* ───── FILTER BAR ───── */}
      <View style={[s.filterBar, { backgroundColor: c.surface, borderBottomColor: c.border, borderTopColor: c.border }]}>
        <View style={[s.searchBox, { backgroundColor: c.surface2, borderColor: c.border }]}>
          <Text style={{ fontSize: 14, color: c.text3, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={{ flex: 1, fontSize: 13, color: c.text, height: 38 }}
            placeholder="Search expenses..."
            placeholderTextColor={c.text3}
            value={srch}
            onChangeText={setSrch}
          />
          {srch ? (
            <TouchableOpacity onPress={() => setSrch("")}>
              <Text style={{ fontSize: 18, color: c.text3 }}>×</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => setShowCats(!showCats)}
          style={[s.filterBtn, { backgroundColor: catF ? c.accentBg : c.surface2, borderColor: catF ? c.accentBd : c.border }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13 }}>{catF ? (CATS.find(x => x.id === catF)?.icon || "⚡") : "⚡"}</Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: catF ? c.accent : c.text2 }}>
              {catF ? (CATS.find(x => x.id === catF)?.label || "Filter") : "Filter"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ───── CATEGORY FILTER ───── */}
      {showCats && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: c.surface2 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
          {[{ id: "", label: "All", icon: "🗂" }].concat(CATS || []).map(cat => {
            const isSel = catF === cat.id;
            return (
              <TouchableOpacity key={cat.id}
                onPress={() => { setCatF(cat.id); setShowCats(false); }}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1,
                  backgroundColor: isSel
                    ? (theme === 'dark' ? c.accentBg : (cat.bg || c.accentBg))
                    : (theme === 'dark' ? c.surface : '#fff'),
                  borderColor: isSel
                    ? (theme === 'dark' ? c.accent : (cat.color || c.accent))
                    : c.border,
                }}>
                <Text style={{ fontSize: 15, marginRight: 6 }}>{cat.icon}</Text>
                <Text style={{
                  fontSize: 13,
                  fontWeight: isSel ? "700" : "500",
                  color: isSel
                    ? (theme === 'dark' ? c.accent : (cat.color || c.accent))
                    : c.text,
                }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ───── EXPENSE LIST ───── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
      >
        {monthExpenses.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 44, marginBottom: 14 }}>📭</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, textAlign: 'center' }}>
              No expenses in {fmtMonth(monthOff)}
            </Text>
            <Text style={{ fontSize: 13, color: c.text2, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
              {monthOff === 0 ? 'Tap + to add your first expense this month.' : 'Use the arrows to go to another month.'}
            </Text>
          </View>
        )}

        {orderedExpenseMembers.map((member, index) => {
          const uid = member._id;
          const col = PAL[index % PAL.length];
          const memberExpenses = filtered.filter(e => (e.user?._id || e.user) === uid);
          const monthTotal = monTotals[uid] || 0;
          const todayTotal = todayTotals[uid] || 0;

          if (memberExpenses.length === 0 && monthExpenses.length === 0) return null;

          return (
            <View key={uid} style={{ marginHorizontal: 12, marginBottom: 16, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: col.border, backgroundColor: c.surface }}>
              {/* HEADER */}
              <View style={{ backgroundColor: col.bg, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Avatar name={member.name} col={col} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: col.dark }}>{member.name}</Text>
                    <Text style={{ fontSize: 13, color: col.mid, marginTop: 2 }}>
                      {memberExpenses.length} expenses · Month ₹{monthTotal}
                    </Text>
                  </View>
                </View>

                {/* Stats row */}
                <View style={{ marginTop: 14, backgroundColor: c.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: c.text2, marginBottom: 2 }}>Month Total</Text>
                    <Text style={{ fontSize: 22, fontWeight: "800", color: c.text }}>₹{monthTotal}</Text>
                  </View>
                  {monthOff === 0 && (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: c.text2, marginBottom: 2 }}>Today</Text>
                      <Text style={{ fontSize: 22, fontWeight: "800", color: c.text }}>₹{todayTotal}</Text>
                    </View>
                  )}
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: c.text2, marginBottom: 2 }}>Entries</Text>
                    <Text style={{ fontSize: 22, fontWeight: "800", color: c.text }}>{memberExpenses.length}</Text>
                  </View>
                </View>
              </View>

              {/* EXPENSES */}
              {memberExpenses.length === 0 ? (
                <View style={{ padding: 18, alignItems: "center" }}>
                  <Text style={{ color: c.text3 }}>No expenses this month</Text>
                </View>
              ) : (
                memberExpenses.map(exp => {
                  const isExpMe = (exp.user?._id || exp.user) === meId;
                  return (
                    <ExpenseRow
                      key={exp._id}
                      exp={exp}
                      allMembers={members}
                      col={col}
                      c={c}
                      theme={theme}
                      canEdit={isExpMe}
                      canDelete={isExpMe || isOwner}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onDetail={handleDetail}
                    />
                  );
                })
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ───── FAB ───── */}
      {monthOff === 0 && (
        <TouchableOpacity onPress={() => setShowAdd(true)} style={[s.fab, { backgroundColor: c.accent }]}>
          <Text style={{ color: "#fff", fontSize: 30, lineHeight: 34, fontWeight: "300" }}>+</Text>
        </TouchableOpacity>
      )}

      {/* ───── ADD SHEET ───── */}
      <BottomSheet visible={showAdd} title="Add Expense" onClose={() => setShowAdd(false)} theme={theme} tall>
        <ExpenseForm
          members={members}
          theme={theme}
          onSubmit={async (f) => {
            await addExpense(gid, { ...f, amount: +f.amount });
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      </BottomSheet>

      {/* ───── EDIT SHEET ───── */}
      <BottomSheet visible={!!editing} title="Edit Expense" onClose={() => setEditing(null)} theme={theme} tall>
        {editing && (
          <ExpenseForm
            members={members}
            theme={theme}
            initial={{
              item: editing.item, amount: String(editing.amount), date: editing.date,
              note: editing.note || "", category: editing.category || "food",
              recurring: editing.recurring || false, splitType: editing.splitType || "equal",
              splitWeights: editing.splitWeights || {},
              excludedMembers: (editing.excludedMembers || []).map(toIdStr),
            }}
            onSubmit={async (f) => {
              await editExpense(gid, editing._id, { ...f, amount: +f.amount });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </BottomSheet>

      {/* ───── EXPENSE DETAILS MODAL ───── */}
      <BottomSheet visible={!!detailExp} title="Expense Details" onClose={() => setDetailExp(null)} theme={theme}>
        {detailExp && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, flex: 1, marginRight: 10 }}>
                {detailExp.item}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: c.accent }}>
                ₹{detailExp.amount}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CatChip cat={detailExp.category || 'other'} />
              <Text style={{ fontSize: 13, color: c.text2 }}>
                Paid by <Text style={{ fontWeight: '700', color: c.text }}>{detailPayerName}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: c.text3 }}>· {fmtDate(detailExp.date)}</Text>
            </View>

            {detailExp.note ? (
              <View style={{ backgroundColor: c.surface2, padding: 12, borderRadius: 10, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: c.text2, fontStyle: 'italic' }}>"{detailExp.note}"</Text>
              </View>
            ) : null}

            {/* Split Breakdown */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.text2, letterSpacing: 0.5, marginBottom: 10 }}>
              SPLIT BREAKDOWN ({detailIncluded.length} OF {members.length} MEMBERS)
            </Text>

            {/* Included Members List */}
            <View style={{ backgroundColor: c.surface2, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.border, marginBottom: 14 }}>
              {detailIncluded.map((m, idx) => (
                <View
                  key={m._id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 12, borderBottomWidth: idx < detailIncluded.length - 1 ? 1 : 0, borderColor: c.border
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Avatar name={m.name} col={palOf(members, m._id)} size={28} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{m.name}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.accent }}>
                    ₹{detailSharePerPerson}
                  </Text>
                </View>
              ))}
            </View>

            {/* Excluded Members List (if any) */}
            {detailExcluded.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.danger, letterSpacing: 0.5, marginBottom: 8 }}>
                  EXCLUDED FROM THIS EXPENSE ({detailExcluded.length})
                </Text>
                <View style={{ backgroundColor: theme === 'dark' ? '#2A1B1D' : '#FEF2F2', borderRadius: 14, borderWidth: 1, borderColor: c.dangerBd, overflow: 'hidden' }}>
                  {detailExcluded.map((m, idx) => (
                    <View
                      key={m._id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: 12, borderBottomWidth: idx < detailExcluded.length - 1 ? 1 : 0, borderColor: c.dangerBd
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Avatar name={m.name} col={palOf(members, m._id)} size={28} />
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: c.danger }}>{m.name}</Text>
                          <Text style={{ fontSize: 11, color: c.danger, opacity: 0.8 }}>Not included in this expense</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: c.text3 }}>₹0.00</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Actions */}
            {((detailExp.user?._id || detailExp.user) === meId || isOwner) && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Btn variant="secondary" onPress={() => handleEdit(detailExp)} style={{ flex: 1 }}>
                  Edit Expense
                </Btn>
                <Btn variant="danger" onPress={() => handleDelete(detailExp)} style={{ flex: 1 }}>
                  Delete
                </Btn>
              </View>
            )}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  summCard:   { width: 110, height: 130, borderRadius: 16, padding: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  filterBar:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1 },
  searchBox:  { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, height: 42 },
  filterBtn:  { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", height: 42 },
  actBtn:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  fab:        { position: "absolute", bottom: 24, right: 20, width: 58, height: 58, borderRadius: 30, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});
