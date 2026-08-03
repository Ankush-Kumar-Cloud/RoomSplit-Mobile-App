import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  View, Text, TouchableOpacity, TextInput, Alert,
  StyleSheet, ScrollView, FlatList, RefreshControl,
} from "react-native";

import { useApp } from "../../context/AppContext";
import { COLORS, CATS, PAL } from "../../utils/theme";
import { today, monthKey, fmtDate, fmtTime, filterExpenses } from "../../utils/domain";
import { Avatar, CatChip, BottomSheet, ExpenseForm, ExpenseItemSkeleton } from "../../components/index";

// ── Memoized Expense Row ─────────────────────────────────────────────────────
// This is the most important optimization: with memo, only the expense that
// was edited will re-render, not the entire list of 200 items.
const ExpenseRow = memo(function ExpenseRow({ exp, isMe, col, c, onEdit, onDelete }) {
  return (
    <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: c.border }}>
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
          {exp.note ? (
            <Text style={{ marginTop: 6, fontSize: 12, color: c.text3, fontStyle: "italic" }}>
              {exp.note}
            </Text>
          ) : null}
        </View>
        <Text style={{ fontSize: 18, fontWeight: "700", color: col.mid }}>₹{exp.amount}</Text>
      </View>

      {isMe && (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <TouchableOpacity onPress={() => onEdit(exp)} style={[s.actBtn, { borderColor: c.border2, opacity: 0.75 }]}>
            <Text style={{ color: c.text2, fontWeight: "500" }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(exp)} style={[s.actBtn, { borderColor: c.dangerBd, opacity: 0.75 }]}>
            <Text style={{ color: c.danger, fontWeight: "500" }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}, (prev, next) =>
  prev.exp._id === next.exp._id &&
  prev.exp.amount === next.exp.amount &&
  prev.exp.item === next.exp.item &&
  prev.isMe === next.isMe
);

// ── Member Summary Card (horizontal scroll) ──────────────────────────────────
const MemberSummaryCard = memo(function MemberSummaryCard({ m, col, budget, spent, dayT, isActive, onPress }) {
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
      <Text style={{ fontSize: 24, fontWeight: "800", color: col.dark, marginTop: 4 }}>₹{dayT.toFixed(0)}</Text>
      <Text style={{ fontSize: 11, color: col.mid, opacity: 0.8, marginTop: 2 }}>Today</Text>
      {budget > 0 && (
        <View style={{ width: "100%", height: 5, backgroundColor: "rgba(255,255,255,.4)", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
          <View style={{ width: `${Math.min((spent / budget) * 100, 100)}%`, height: 5, backgroundColor: col.mid, borderRadius: 99 }} />
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function ExpensesTab({ group, members }) {
  const { theme, user, getExpenses, loadExpenses, addExpense, editExpense, removeExpense, getBudget } = useApp();
  const c = COLORS[theme];
  const gid = group._id;
  const mk = monthKey(0);

  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [srch,     setSrch]     = useState("");
  const [catF,     setCatF]     = useState("");
  const [showAdd,  setShowAdd]  = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [showCats, setShowCats] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  useEffect(() => {
    loadExpenses(gid).finally(() => setLoading(false));
  }, [gid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExpenses(gid);
    setRefreshing(false);
  }, [gid, loadExpenses]);

  const all = getExpenses(gid);
  const meId = user?._id;
  const todayStr = today();
  const activeMemberId = selectedMemberId || meId;

  const dayTotals = useMemo(() => {
    const t = {};
    members.forEach(m => {
      t[m._id] = all
        .filter(e => (e.user?._id || e.user) === m._id && e.date === todayStr)
        .reduce((s, e) => s + e.amount, 0);
    });
    return t;
  }, [all, members, todayStr]);

  const monTotals = useMemo(() => {
    const t = {};
    all.filter(e => e.date?.startsWith(mk)).forEach(e => {
      const uid = e.user?._id || e.user;
      t[uid] = (t[uid] || 0) + e.amount;
    });
    return t;
  }, [all, mk]);

  const orderedExpenseMembers = useMemo(() => {
    if (!members) return [];
    if (!activeMemberId) return members;
    const activeStr = String(activeMemberId);
    const activeUser = members.find(m => String(m._id) === activeStr);
    const others = members.filter(m => String(m._id) !== activeStr);
    return activeUser ? [activeUser, ...others] : members;
  }, [members, activeMemberId]);

  const filtered = useMemo(() => filterExpenses(all, { cat: catF, search: srch }), [all, catF, srch]);

  const handleDelete = useCallback((exp) => {
    Alert.alert("Delete Expense?", `"${exp.item}" will be permanently deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await removeExpense(gid, exp._id); }
        catch (e) { Alert.alert("Error", e.message); }
      }},
    ]);
  }, [gid, removeExpense]);

  const handleEdit = useCallback((exp) => setEditing(exp), []);

  const handleMemberPress = useCallback((uid) => setSelectedMemberId(uid), []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {/* Skeleton for member cards */}
        <View style={{ flexDirection: 'row', padding: 14, gap: 10 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ width: 105, height: 120, borderRadius: 16, backgroundColor: '#F3F4F6' }} />
          ))}
        </View>
        {/* Skeleton for expense rows */}
        <View style={{ borderRadius: 22, marginHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' }}>
          {[1, 2, 3, 4].map(i => <ExpenseItemSkeleton key={i} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* ───── MEMBER SUMMARY ───── */}
      <View style={{ backgroundColor: c.bg, paddingBottom: 6 }}>
        <ScrollView
          horizontal
          style={{ maxHeight: 150 }}
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
                dayT={dayTotals[m._id] || 0}
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
          <Text style={{ fontSize: 12, fontWeight: "600", color: catF ? c.accent : c.text2 }}>
            {catF ? CATS.find(x => x.id === catF)?.icon + " " + CATS.find(x => x.id === catF)?.label : "⚡ Filter"}
          </Text>
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
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1,
                  backgroundColor: isSel ? (cat.bg || c.accentBg) : "transparent",
                  borderColor: isSel ? (cat.color || c.accent) : c.border }}>
                <Text style={{ fontSize: 13, marginRight: 6, color: isSel ? (cat.color || c.accent) : c.text2 }}>{cat.icon}</Text>
                <Text style={{ fontSize: 13, fontWeight: isSel ? "700" : "500", color: isSel ? (cat.color || c.accent) : c.text2 }}>{cat.label}</Text>
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
        {orderedExpenseMembers.map((member, index) => {
          const uid = member._id;
          const col = PAL[index % PAL.length];
          const memberExpenses = filtered.filter(e => (e.user?._id || e.user) === uid);
          const todayTotal = dayTotals[uid] || 0;
          const monthTotal = monTotals[uid] || 0;

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
                <View style={{ marginTop: 14, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, color: c.text2 }}>Today</Text>
                  <Text style={{ fontSize: 28, fontWeight: "800", color: col.dark }}>₹{todayTotal}</Text>
                </View>
              </View>

              {/* EXPENSES — rendered individually with memoized rows */}
              {memberExpenses.length === 0 ? (
                <View style={{ padding: 18, alignItems: "center" }}>
                  <Text style={{ color: c.text3 }}>No expenses</Text>
                </View>
              ) : (
                memberExpenses.map(exp => (
                  <ExpenseRow
                    key={exp._id}
                    exp={exp}
                    col={col}
                    c={c}
                    isMe={(exp.user?._id || exp.user) === meId}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ───── FAB ───── */}
      <TouchableOpacity onPress={() => setShowAdd(true)} style={[s.fab, { backgroundColor: c.accent }]}>
        <Text style={{ color: "#fff", fontSize: 30, lineHeight: 34, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

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
            }}
            onSubmit={async (f) => {
              await editExpense(gid, editing._id, { ...f, amount: +f.amount });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  summCard: { width: 105, height: 120, borderRadius: 16, padding: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  filterBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1 },
  searchBox: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, height: 42 },
  filterBtn: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", height: 42 },
  actBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  fab: { position: "absolute", bottom: 24, right: 20, width: 58, height: 58, borderRadius: 30, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});