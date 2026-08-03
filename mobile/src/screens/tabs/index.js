// ═══════════════════════════════════════════════════════
// ActivityTab.js
// ═══════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { COLORS, palOf } from '../../utils/theme';
import { fmtDateFull, fmtDate, relTime } from '../../utils/domain';
import { Avatar, CatChip } from '../../components/index';

export function ActivityTab({ group, members }) {
  const { theme, getExpenses } = useApp();
  const c = COLORS[theme];
  const all = getExpenses(group._id).slice(0, 60);

  const nameOf = u => (typeof u==='object'?u.name:members.find(m=>m._id===u)?.name)||'?';
  const uidOf  = u => typeof u==='object'?u._id:u;

  const byDate = useMemo(() => {
    const m={};
    all.forEach(e => { (m[e.date]=m[e.date]||[]).push(e); });
    return Object.entries(m).sort((a,b)=>b[0].localeCompare(a[0]));
  },[all]);

  if (!all.length) return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:c.bg }}>
      <Text style={{ fontSize:44, marginBottom:14 }}>📋</Text>
      <Text style={{ fontSize:16, fontWeight:'700', color:c.text }}>No activity yet</Text>
      <Text style={{ fontSize:13, color:c.text2, marginTop:8, textAlign:'center', paddingHorizontal:32 }}>Add expenses on the Expenses tab to see them here</Text>
    </View>
  );

  return (
    <FlatList
      data={byDate}
      keyExtractor={([d])=>d}
      contentContainerStyle={{ padding:14, paddingBottom:32, backgroundColor:c.bg }}
      style={{ backgroundColor:c.bg }}
      renderItem={({ item:[date,exps] }) => (
        <View style={{ marginBottom:18 }}>
          <Text style={{ fontSize:11, fontWeight:'700', color:c.text2, marginBottom:8, letterSpacing:0.6 }}>
            {fmtDateFull(date).toUpperCase()}
          </Text>
          <View style={{ backgroundColor:c.surface, borderColor:c.border, borderWidth:1, borderRadius:14, overflow:'hidden' }}>
            {exps.map((exp,i) => {
              const uid = uidOf(exp.user);
              const col = palOf(members, uid);
              return (
                <View key={exp._id} style={{ flexDirection:'row', alignItems:'flex-start', padding:13, borderBottomWidth: i<exps.length-1?1:0, borderColor:c.border, gap:12 }}>
                  <Avatar name={nameOf(exp.user)} col={col} size={36} />
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                      <Text style={{ fontSize:14, fontWeight:'600', color:c.text, flex:1 }} numberOfLines={1}>{exp.item}</Text>
                      <Text style={{ fontSize:15, fontWeight:'700', color:col.mid }}> ₹{exp.amount}</Text>
                    </View>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:5, flexWrap:'wrap' }}>
                      <Text style={{ fontSize:11, fontWeight:'500', color:c.text2 }}>{nameOf(exp.user)}</Text>
                      <CatChip cat={exp.category||'other'} />
                      {exp.recurring && <View style={{ backgroundColor:c.accentBg, paddingHorizontal:5, paddingVertical:2, borderRadius:4 }}><Text style={{ fontSize:10, color:c.accent, fontWeight:'700' }}>↻</Text></View>}
                      <Text style={{ fontSize:11, color:c.text3, marginLeft:'auto' }}>{relTime(exp.createdAt)}</Text>
                    </View>
                    {exp.note ? <Text style={{ fontSize:11, fontStyle:'italic', color:c.text3, marginTop:3 }} numberOfLines={1}>{exp.note}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    />
  );
}

// ═══════════════════════════════════════════════════════
// BudgetsTab.js
// ═══════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { monthKey, fmtMonth } from '../../utils/domain';
import { PAL } from '../../utils/theme';
import { ProgressBar, Btn } from '../../components/index';

export function BudgetsTab({ group, members }) {
  const { theme, getExpenses, loadBudgets, setBudget, getBudget } = useApp();
  const c = COLORS[theme];
  const mk  = monthKey(0);
  const gid = group._id;

  const [editId, setEditId] = useState(null);
  const [val,    setVal]    = useState('');
  const [busy,   setBusy]   = useState(false);

  useEffect(() => { loadBudgets(gid, mk); }, [gid, mk]);

  const all = getExpenses(gid);
  const monTotals = useMemo(() => {
    const t={};
    all.filter(e=>e.date?.startsWith(mk)).forEach(e=>{ const u=e.user?._id||e.user; t[u]=(t[u]||0)+e.amount; });
    return t;
  },[all, mk]);

  const save = async (uid) => {
    setBusy(true);
    try { await setBudget(gid, uid, mk, val||0); setEditId(null); setVal(''); }
    catch(e){ Alert.alert('Error', e.message); }
    setBusy(false);
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor:c.bg }} contentContainerStyle={{ padding:14, paddingBottom:32 }}>
      <Text style={{ fontSize:13, color:c.text2, marginBottom:16, lineHeight:20 }}>
        Set monthly budgets for <Text style={{ color:c.text, fontWeight:'700' }}>{fmtMonth(0)}</Text>. A progress bar appears on each member's card.
      </Text>
      {members.map((m, i) => {
        const col    = PAL[i % PAL.length];
        const uid    = m._id;
        const spent  = monTotals[uid] || 0;
        const budget = getBudget(gid, uid, mk);
        const pct    = budget>0 ? Math.round(spent/budget*100) : 0;
        const status = budget>0 ? (pct>100?'over':pct>80?'warn':'ok') : 'none';
        return (
          <View key={uid} style={{ backgroundColor:c.surface, borderColor:c.border, borderWidth:1, borderRadius:14, padding:16, marginBottom:12 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:12 }}>
              <Avatar name={m.name} col={col} size={38} />
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:15, fontWeight:'700', color:c.text }}>{m.name}</Text>
                <Text style={{ fontSize:12, color:c.text2, marginTop:3 }}>₹{spent} spent this month</Text>
              </View>
              {status==='over' && <View style={{ backgroundColor:c.dangerBg, borderColor:c.dangerBd, borderWidth:1, borderRadius:6, paddingHorizontal:8, paddingVertical:3 }}><Text style={{ fontSize:11, fontWeight:'700', color:c.danger }}>Over!</Text></View>}
              {status==='warn' && <View style={{ backgroundColor:c.warnBg, borderColor:c.warnBd, borderWidth:1, borderRadius:6, paddingHorizontal:8, paddingVertical:3 }}><Text style={{ fontSize:11, fontWeight:'700', color:c.warn }}>80%+</Text></View>}
            </View>
            {budget>0 && <View style={{ marginBottom:12 }}><ProgressBar value={spent} max={budget} label={`₹${spent} / ₹${budget}`} showPct theme={theme} /></View>}
            {editId===uid ? (
              <View style={{ flexDirection:'row', gap:8 }}>
                <TextInput style={{ flex:1, backgroundColor:c.surface2, borderColor:c.border, borderWidth:1, borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:c.text }}
                  placeholder="Monthly budget ₹" placeholderTextColor={c.text3} value={val} onChangeText={setVal} keyboardType="number-pad" autoFocus />
                <Btn onPress={()=>save(uid)} loading={busy} size="sm">Save</Btn>
                <Btn variant="ghost" size="sm" onPress={()=>{setEditId(null);setVal('');}}>✕</Btn>
              </View>
            ) : (
              <Btn variant="secondary" size="sm" onPress={()=>{setEditId(uid);setVal(budget>0?String(budget):'');}}>
                {budget>0?'Edit Budget':'Set Budget'}
              </Btn>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════
// AnalyticsTab.js
// ═══════════════════════════════════════════════════════
import { fmtMonth as fmtMon } from '../../utils/domain';
import { CATS as CATS2 } from '../../utils/theme';

export function AnalyticsTab({ group, members }) {
  const { theme, getExpenses } = useApp();
  const c = COLORS[theme];
  const [off, setOff] = useState(0);
  const mk  = monthKey(off);
  const all = getExpenses(group._id);
  const mEx = all.filter(e=>e.date?.startsWith(mk));

  const uidOf = e => e.user?._id||e.user;

  const monT = useMemo(()=>{ const t={}; mEx.forEach(e=>{const u=uidOf(e);t[u]=(t[u]||0)+e.amount;}); return t; },[mEx]);
  const maxM = Math.max(...members.map(m=>monT[m._id]||0),1);
  const catT = useMemo(()=>{ const t={}; mEx.forEach(e=>{t[e.category||'other']=(t[e.category||'other']||0)+e.amount;}); return t; },[mEx]);
  const catSum = Object.values(catT).reduce((s,v)=>s+v,0)||1;
  const sortedC = CATS2.map(ct=>({...ct,amount:catT[ct.id]||0})).filter(ct=>ct.amount>0).sort((a,b)=>b.amount-a.amount);

  const days = [...new Set(mEx.map(e=>e.date))].sort().slice(-10);
  const maxD = Math.max(...days.map(d=>mEx.filter(e=>e.date===d).reduce((s,e)=>s+e.amount,0)),1);

  return (
    <ScrollView style={{ flex:1, backgroundColor:c.bg }} contentContainerStyle={{ padding:14, paddingBottom:32 }}>
      {/* Daily chart */}
      <View style={{ backgroundColor:c.surface, borderColor:c.border, borderWidth:1, borderRadius:14, padding:16, marginBottom:14 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <Text style={{ fontSize:15, fontWeight:'700', color:c.text }}>Daily Spending</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <TouchableOpacity onPress={()=>setOff(o=>o-1)} style={{ borderWidth:1, borderColor:c.border, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}><Text style={{ color:c.text, fontSize:16 }}>‹</Text></TouchableOpacity>
            <Text style={{ fontSize:11, color:c.text2, minWidth:82, textAlign:'center' }}>{fmtMon(off)}</Text>
            <TouchableOpacity onPress={()=>setOff(o=>Math.min(o+1,0))} style={{ borderWidth:1, borderColor:c.border, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}><Text style={{ color:c.text, fontSize:16 }}>›</Text></TouchableOpacity>
          </View>
        </View>
        {days.length===0 ? <Text style={{ color:c.text3, textAlign:'center', paddingVertical:24 }}>No data yet</Text> : (
          <View>
            <View style={{ flexDirection:'row', alignItems:'flex-end', height:90, gap:4, marginBottom:6 }}>
              {days.map(d=>{
                const segs=members.map(m=>({ col:PAL[members.findIndex(x=>x._id===m._id)%PAL.length], amt:mEx.filter(e=>e.date===d&&uidOf(e)===m._id).reduce((s,e)=>s+e.amount,0) })).filter(x=>x.amt>0);
                const dt=segs.reduce((s,x)=>s+x.amt,0);
                const bH=Math.round((dt/maxD)*80);
                return (
                  <View key={d} style={{ flex:1, alignItems:'center', gap:2 }}>
                    <Text style={{ fontSize:8, color:c.text3 }}>{dt>=1000?`${Math.round(dt/100)/10}k`:Math.round(dt)}</Text>
                    <View style={{ width:'100%', height:bH, minHeight:2, borderRadius:3, overflow:'hidden', flexDirection:'column-reverse' }}>
                      {segs.map(({col,amt},i)=><View key={i} style={{ flex:amt/dt, backgroundColor:col.mid, minHeight:2 }} />)}
                    </View>
                    <Text style={{ fontSize:8, color:c.text3 }}>{fmtDate(d).split(' ')[0]}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:8 }}>
              {members.map((m,i)=>{ const col=PAL[i%PAL.length]; return <View key={m._id} style={{ flexDirection:'row', alignItems:'center', gap:5 }}><View style={{ width:8, height:8, borderRadius:3, backgroundColor:col.mid }} /><Text style={{ fontSize:11, color:c.text2 }}>{m.name}</Text></View>; })}
            </View>
          </View>
        )}
      </View>

      {/* Category */}
      <View style={{ backgroundColor:c.surface, borderColor:c.border, borderWidth:1, borderRadius:14, padding:16, marginBottom:14 }}>
        <Text style={{ fontSize:15, fontWeight:'700', color:c.text, marginBottom:14 }}>By Category</Text>
        {sortedC.length===0 ? <Text style={{ color:c.text3, textAlign:'center', paddingVertical:16 }}>No data yet</Text>
        : sortedC.map(ct=>(
          <View key={ct.id} style={{ marginBottom:12 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:5 }}>
              <Text style={{ fontSize:13, color:c.text }}>{ct.icon} {ct.label}</Text>
              <Text style={{ fontSize:13, fontWeight:'700', color:c.text }}>₹{ct.amount} <Text style={{ fontSize:11, fontWeight:'400', color:c.text3 }}>({Math.round(ct.amount/catSum*100)}%)</Text></Text>
            </View>
            <ProgressBar value={ct.amount} max={catSum} color={ct.color} theme={theme} />
          </View>
        ))}
      </View>

      {/* Member bars */}
      <View style={{ backgroundColor:c.surface, borderColor:c.border, borderWidth:1, borderRadius:14, padding:16 }}>
        <Text style={{ fontSize:15, fontWeight:'700', color:c.text, marginBottom:14 }}>Member Spending — {fmtMon(off)}</Text>
        {members.map((m,i)=>{
          const col=PAL[i%PAL.length]; const amt=monT[m._id]||0;
          return (
            <View key={m._id} style={{ marginBottom:14 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:9 }}><Avatar name={m.name} col={col} size={26} /><Text style={{ fontSize:13, color:c.text }}>{m.name}</Text></View>
                <Text style={{ fontSize:13, fontWeight:'700', color:c.text }}>₹{amt}</Text>
              </View>
              <ProgressBar value={amt} max={maxM} color={col.mid} theme={theme} />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════
// MonthlyTab.js
// ═══════════════════════════════════════════════════════
import { calcSettlement } from '../../utils/domain';

export function MonthlyTab({ group, members }) {
  const { theme, getExpenses } = useApp();
  const c = COLORS[theme];
  const [off, setOff] = useState(0);
  const mk  = monthKey(off);
  const all = getExpenses(group._id);
  const mEx = all.filter(e=>e.date?.startsWith(mk));
  const uidOf = e => e.user?._id||e.user;

  const monT = useMemo(()=>{ const t={}; mEx.forEach(e=>{const u=uidOf(e);t[u]=(t[u]||0)+e.amount;}); return t; },[mEx]);
  const settle = useMemo(()=>{
    if(!members.length) return null;
    const nm={}; members.forEach(m=>{nm[m._id]=m.name;});
    return calcSettlement(members.map(m=>m._id), nm, monT);
  },[members, monT]);

  return (
    <ScrollView style={{ flex:1, backgroundColor:c.bg }} contentContainerStyle={{ padding:14, paddingBottom:32 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <Text style={{ fontSize:20, fontWeight:'700', color:c.text }}>Monthly Summary</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <TouchableOpacity onPress={()=>setOff(o=>o-1)} style={{ borderWidth:1, borderColor:c.border, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}><Text style={{ color:c.text, fontSize:16 }}>‹</Text></TouchableOpacity>
          <Text style={{ fontSize:11, color:c.text2, minWidth:82, textAlign:'center' }}>{fmtMon(off)}</Text>
          <TouchableOpacity onPress={()=>setOff(o=>Math.min(o+1,0))} style={{ borderWidth:1, borderColor:c.border, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}><Text style={{ color:c.text, fontSize:16 }}>›</Text></TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:16 }}>
        {members.map((m,i)=>{ const col=PAL[i%PAL.length]; const tot=monT[m._id]||0; return (
          <View key={m._id} style={{ width:'47%', backgroundColor:col.bg, borderColor:col.border, borderWidth:1, borderRadius:14, padding:14, alignItems:'center', gap:5 }}>
            <Avatar name={m.name} col={col} size={30} />
            <Text style={{ fontSize:12, fontWeight:'700', color:col.dark, textAlign:'center' }} numberOfLines={1}>{m.name}</Text>
            <Text style={{ fontSize:24, fontWeight:'700', color:col.dark }}>₹{tot}</Text>
            <Text style={{ fontSize:10, color:col.mid, opacity:.75 }}>spent</Text>
          </View>
        );})}
      </View>

      {settle && (
        <View style={{ backgroundColor:c.surface, borderColor:c.border, borderWidth:1, borderRadius:14, padding:18 }}>
          <Text style={{ fontSize:15, fontWeight:'700', color:c.text, marginBottom:16 }}>Group Summary</Text>
          <View style={{ flexDirection:'row', justifyContent:'space-around', marginBottom:16 }}>
            {[['Total','₹'+settle.total,c.accent],['Per Person','₹'+settle.share,c.text],['Members',members.length,c.text]].map(([l,v,col])=>(
              <View key={l} style={{ alignItems:'center' }}>
                <Text style={{ fontSize:12, color:c.text2, marginBottom:4 }}>{l}</Text>
                <Text style={{ fontSize:22, fontWeight:'700', color:col }}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={{ height:1, backgroundColor:c.border, marginBottom:14 }} />
          <Text style={{ fontSize:13, fontWeight:'700', color:c.text2, marginBottom:10 }}>Balance vs equal share</Text>
          {settle.balances.map(b=>(
            <View key={b.id} style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:10, borderBottomWidth:1, borderColor:c.border }}>
              <Avatar name={b.name} col={palOf(members,b.id)} size={28} />
              <Text style={{ flex:1, fontSize:14, color:c.text }}>{b.name}</Text>
              <Text style={{ fontSize:13, color:c.text2, marginRight:6 }}>₹{monT[b.id]||0}</Text>
              <View style={{ backgroundColor:b.bal>=0?c.accentBg:c.dangerBg, borderColor:b.bal>=0?c.accentBd:c.dangerBd, borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:4 }}>
                <Text style={{ fontSize:13, fontWeight:'700', color:b.bal>=0?c.accent:c.danger }}>{b.bal>=0?'+':''}₹{Math.round(b.bal)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════
// SettlementTab.js
// ═══════════════════════════════════════════════════════
export function SettlementTab({ group, members }) {
  const { theme, getExpenses, loadSettlements, toggleSettlement, isPaid } = useApp();
  const c = COLORS[theme];
  const [off, setOff] = useState(0);
  const mk  = monthKey(off);
  const gid = group._id;
  const all = getExpenses(gid);
  const mEx = all.filter(e=>e.date?.startsWith(mk));
  const uidOf = e => e.user?._id||e.user;

  useEffect(()=>{ loadSettlements(gid, mk); },[mk, gid]);

  const monT = useMemo(()=>{ const t={}; mEx.forEach(e=>{const u=uidOf(e);t[u]=(t[u]||0)+e.amount;}); return t; },[mEx]);
  const settle = useMemo(()=>{
    if(!members.length) return null;
    const nm={}; members.forEach(m=>{nm[m._id]=m.name;});
    return calcSettlement(members.map(m=>m._id), nm, monT);
  },[members, monT]);

  const handleToggle = async (i) => {
    try { await toggleSettlement(gid, mk, i); }
    catch(e){ Alert.alert('Error', e.message); }
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor:c.bg }} contentContainerStyle={{ padding:14, paddingBottom:32 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <View>
          <Text style={{ fontSize:20, fontWeight:'700', color:c.text }}>Settlement</Text>
          <Text style={{ fontSize:12, color:c.text2, marginTop:3 }}>Minimum transactions · {fmtMon(off)}</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <TouchableOpacity onPress={()=>setOff(o=>o-1)} style={{ borderWidth:1, borderColor:c.border, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}><Text style={{ color:c.text, fontSize:16 }}>‹</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setOff(o=>Math.min(o+1,0))} style={{ borderWidth:1, borderColor:c.border, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}><Text style={{ color:c.text, fontSize:16 }}>›</Text></TouchableOpacity>
        </View>
      </View>

      <View style={{ backgroundColor:c.surface, borderColor:c.border, borderWidth:1, borderRadius:14, padding:16, marginBottom:14 }}>
        {!settle||settle.txns.length===0 ? (
          <View style={{ alignItems:'center', paddingVertical:32 }}>
            <Text style={{ fontSize:44, marginBottom:12 }}>🎉</Text>
            <Text style={{ fontSize:17, fontWeight:'700', color:c.text, marginBottom:6 }}>All settled up!</Text>
            <Text style={{ fontSize:13, color:c.text2, textAlign:'center' }}>Everyone spent equally this month.</Text>
          </View>
        ) : settle.txns.map((txn,i)=>{
          const paid  = isPaid(gid, mk, i);
          const fromI = members.findIndex(m=>m._id===txn.fromId);
          const toI   = members.findIndex(m=>m._id===txn.toId);
          const fc    = PAL[Math.max(fromI,0)%PAL.length];
          const tc    = PAL[Math.max(toI,0)%PAL.length];
          return (
            <View key={i} style={{ backgroundColor:c.surface2, borderRadius:12, padding:14, marginBottom:10, opacity:paid?.5:1 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
                <Avatar name={txn.from} col={fc} size={36} />
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:14, color:c.text, flexWrap:'wrap' }}>
                    <Text style={{ color:fc.dark, fontWeight:'700' }}>{txn.from}</Text>
                    <Text style={{ color:c.text3 }}> pays </Text>
                    <Text style={{ color:tc.dark, fontWeight:'700' }}>{txn.to}</Text>
                  </Text>
                  {paid && <Text style={{ fontSize:11, color:c.accent, fontWeight:'700', marginTop:3 }}>✓ Marked as paid</Text>}
                </View>
                <Avatar name={txn.to} col={tc} size={36} />
              </View>
              <View style={{ flexDirection:'row', gap:10 }}>
                <View style={{ flex:1, backgroundColor:c.accent, borderRadius:10, padding:10, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontSize:18, fontWeight:'700', textDecorationLine:paid?'line-through':'none' }}>₹{txn.amount}</Text>
                </View>
                <TouchableOpacity onPress={()=>handleToggle(i)}
                  style={{ flex:1, backgroundColor:paid?c.accentBg:c.surface, borderColor:paid?c.accentBd:c.border2, borderWidth:1, borderRadius:10, alignItems:'center', justifyContent:'center', padding:10 }}>
                  <Text style={{ fontSize:13, fontWeight:'600', color:paid?c.accent:c.text2 }}>{paid?'✓ Paid':'Mark Paid'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {settle && (
        <View style={{ backgroundColor:c.surface, borderColor:c.border, borderWidth:1, borderRadius:14, padding:16 }}>
          <Text style={{ fontSize:15, fontWeight:'700', color:c.text, marginBottom:14 }}>Breakdown</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:14 }}>
            {members.map((m,i)=>{ const col=PAL[i%PAL.length]; return (
              <View key={m._id} style={{ backgroundColor:col.bg, borderColor:col.border, borderWidth:1, borderRadius:10, padding:12, alignItems:'center', gap:4, minWidth:'30%', flex:1 }}>
                <Avatar name={m.name} col={col} size={26} />
                <Text style={{ fontSize:11, fontWeight:'700', color:col.dark, textAlign:'center' }} numberOfLines={1}>{m.name}</Text>
                <Text style={{ fontSize:18, fontWeight:'700', color:col.dark }}>₹{monT[m._id]||0}</Text>
              </View>
            );})}
          </View>
          <View style={{ borderTopWidth:1, borderColor:c.border, paddingTop:12, flexDirection:'row', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
            <Text style={{ fontSize:13, color:c.text2 }}>Total · Equal share</Text>
            <Text style={{ fontSize:13, fontWeight:'700', color:c.text }}>₹{settle.total} · ₹{settle.share}/person</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
