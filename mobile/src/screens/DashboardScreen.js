import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  Alert, ScrollView, StyleSheet, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../context/AppContext';
import { COLORS, PAL } from '../utils/theme';
import { Avatar, BottomSheet, Btn, LoadingView } from '../components/index';
import ExpensesTab            from './tabs/ExpensesTab';
import { ActivityTab, BudgetsTab, AnalyticsTab, MonthlyTab, SettlementTab } from './tabs/index';

const TABS = ['Expenses', 'Activity', 'Budgets', 'Analytics', 'Monthly', 'Settlement'];

export default function DashboardScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { theme, setTheme, user, groups, renameGroup, leaveGroup } = useApp();
  const c = COLORS[theme];

  const [activeTab,  setActiveTab]  = useState('Expenses');
  const [showSettings, setShowSettings] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [err,        setErr]        = useState('');
  const [busy,       setBusy]       = useState(false);

  const group   = groups.find(g => g._id === groupId);
  const members = group?.members || [];
  
  const orderedMembers = React.useMemo(() => {
    if (!members.length || !user?._id) return members;
    const meStr = String(user._id);
    const me = members.find(m => String(m._id) === meStr);
    const others = members.filter(m => String(m._id) !== meStr);
    return me ? [me, ...others] : members;
  }, [members, user]);

  useEffect(() => {
    if (group) { setNewName(group.name); navigation.setOptions({ title: group.name }); }
  }, [group]);

  if (!group) return <LoadingView theme={theme} />;

  const isOwner = (group.owner?._id || group.owner) === user?._id;

  const handleRename = async () => {
    if (!newName.trim()) return setErr('Name cannot be empty');
    setBusy(true); setErr('');
    try { await renameGroup(groupId, newName.trim()); setShowSettings(false); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const handleLeave = () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        try { await leaveGroup(groupId); navigation.goBack(); }
        catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const renderTab = () => {
    const props = { group, members: orderedMembers };
    switch (activeTab) {
      case 'Expenses':   return <ExpensesTab   {...props} />;
      case 'Activity':   return <ActivityTab   {...props} />;
      case 'Budgets':    return <BudgetsTab    {...props} />;
      case 'Analytics':  return <AnalyticsTab  {...props} />;
      case 'Monthly':    return <MonthlyTab    {...props} />;
      case 'Settlement': return <SettlementTab {...props} />;
      default:           return null;
    }
  };

  const inputSt = { backgroundColor:c.surface2, borderColor:c.border, borderWidth:1, borderRadius:10, paddingHorizontal:14, paddingVertical:12, fontSize:15, color:c.text };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:c.bg }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor:c.surface, borderBottomColor:c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Text style={{ fontSize:22, color:c.text2 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex:1 }}>
          <Text style={{ fontSize:17, fontWeight:'700', color:c.text }} numberOfLines={1}>{group.name}</Text>
          <Text style={{ fontSize:11, color:c.text2, marginTop:2 }}>{members.length} members</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <Text style={{ fontSize:13 }}>{theme==='dark'?'🌙':'☀️'}</Text>
          <Switch value={theme==='dark'} onValueChange={v=>setTheme(v?'dark':'light')}
            trackColor={{ false:c.border2, true:c.accent }} thumbColor="#fff"
            style={{ transform:[{scaleX:.8},{scaleY:.8}] }} />
          <TouchableOpacity onPress={()=>setShowSettings(true)} style={[s.settingsBtn, { borderColor:c.border }]}>
            <Text style={{ fontSize:16, color:c.text2 }}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tab bar ── */}
      <View style={[s.tabBarWrap, { backgroundColor:c.surface, borderBottomColor:c.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[s.tabBtn, activeTab===tab && { borderBottomColor:c.accent, borderBottomWidth:2 }]}
            >
              <Text style={[s.tabText, { color: activeTab===tab ? c.accent : c.text2, fontWeight: activeTab===tab ? '700' : '500' }]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Active tab content ── */}
      <View style={{ flex:1 }}>
        {renderTab()}
      </View>

      {/* ── Settings Sheet ── */}
      <BottomSheet visible={showSettings} title="Group Settings" onClose={()=>setShowSettings(false)} theme={theme} tall>
        {isOwner && (
          <>
            <Text style={{ fontSize:11, fontWeight:'700', color:c.text2, marginBottom:8, letterSpacing:0.5 }}>RENAME GROUP</Text>
            <TextInput style={[inputSt, { marginBottom:8 }]} value={newName} onChangeText={v=>{setNewName(v);setErr('');}} placeholder="Group name" placeholderTextColor={c.text3} />
            {err ? <Text style={{ color:c.danger, fontSize:13, marginBottom:8 }}>{err}</Text> : null}
            <Btn onPress={handleRename} loading={busy} style={{ marginBottom:20 }}>Save Name</Btn>
            <View style={{ height:1, backgroundColor:c.border, marginBottom:16 }} />
          </>
        )}

        {/* Members */}
        <Text style={{ fontSize:11, fontWeight:'700', color:c.text2, marginBottom:10, letterSpacing:0.5 }}>MEMBERS ({orderedMembers.length})</Text>
        {orderedMembers.map((m, i) => {
          const col = PAL[i % PAL.length];
          const ownerId = group.owner?._id || group.owner;
          return (
            <View key={m._id} style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:10, borderBottomWidth:1, borderColor:c.border }}>
              <Avatar name={m.name} col={col} size={34} />
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:13, fontWeight:'600', color:c.text }}>{m.name}</Text>
                <Text style={{ fontSize:11, color:c.text3 }}>{m.email}</Text>
              </View>
              {m._id === ownerId && (
                <View style={{ backgroundColor:c.accentBg, borderColor:c.accentBd, borderWidth:1, borderRadius:5, paddingHorizontal:8, paddingVertical:3 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:c.accent }}>Owner</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Invite code */}
        <View style={{ height:1, backgroundColor:c.border, marginVertical:16 }} />
        <Text style={{ fontSize:11, fontWeight:'700', color:c.text2, marginBottom:10, letterSpacing:0.5 }}>INVITE CODE</Text>
        <View style={{ backgroundColor:c.accentBg, borderColor:c.accentBd, borderWidth:1, borderRadius:14, padding:18, alignItems:'center', marginBottom:20 }}>
          <Text style={{ fontSize:11, color:c.accent, fontWeight:'700', marginBottom:6, letterSpacing:0.5 }}>Share with roommates</Text>
          <Text style={{ fontSize:32, fontWeight:'700', letterSpacing:10, fontFamily:'monospace', color:c.accent }}>{group.inviteCode}</Text>
        </View>

        <View style={{ height:1, backgroundColor:c.border, marginBottom:16 }} />
        <Btn variant="danger" onPress={handleLeave} full>Leave Group</Btn>
      </BottomSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:     { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:11, borderBottomWidth:1, gap:10 },
  backBtn:    { padding:4, marginRight:2 },
  settingsBtn:{ borderWidth:1, borderRadius:8, padding:7 },
  tabBarWrap: { borderBottomWidth:1 },
  tabBar:     { paddingHorizontal:8 },
  tabBtn:     { paddingHorizontal:14, paddingVertical:12, borderBottomWidth:2, borderBottomColor:'transparent' },
  tabText:    { fontSize:13 },
});
