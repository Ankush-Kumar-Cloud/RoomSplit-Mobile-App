import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Switch, Alert, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../context/AppContext';
import { COLORS, PAL } from '../utils/theme';
import { Btn, Avatar, BottomSheet, GroupCardSkeleton } from '../components/index';

// ── Memoized Group Card ─────────────────────────────────────────────────────
// memo() ensures this component only re-renders if its OWN props change.
// Without memo, every time ANY group changes, ALL group cards re-render.
// This is the #1 FlatList optimization technique.
const GroupCard = memo(function GroupCard({ g, index, onPress, surfaceColor, borderColor }) {
  const col  = PAL[index % PAL.length];
  const mems = g.members || [];
  return (
    <TouchableOpacity
      onPress={() => onPress(g)}
      style={[s.groupCard, { backgroundColor: surfaceColor, borderColor }]}
      activeOpacity={0.8}
    >
      <View style={[s.groupIcon, { backgroundColor: col.bg, borderColor: col.border }]}>
        <Text style={{ fontSize: 20 }}>🏠</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181A' }}>{g.name}</Text>
        <Text style={{ fontSize: 12, color: '#65656A', marginTop: 3 }}>
          {mems.length} member{mems.length !== 1 ? 's' : ''}
          <Text style={{ color: '#9898A0' }}>  ·  </Text>
          Code: <Text style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1AAD7D' }}>{g.inviteCode}</Text>
        </Text>
      </View>
      {/* Avatar stack */}
      <View style={{ flexDirection: 'row' }}>
        {mems.slice(0, 3).map((m, j) => (
          <View key={m._id} style={[s.stackAv, { backgroundColor: PAL[j % PAL.length].av, marginLeft: j > 0 ? -8 : 0, borderColor: surfaceColor }]}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{m.name?.charAt(0).toUpperCase()}</Text>
          </View>
        ))}
        {mems.length > 3 && (
          <View style={[s.stackAv, { backgroundColor: '#E5E7EB', marginLeft: -8, borderColor: surfaceColor }]}>
            <Text style={{ fontSize: 9, color: '#65656A', fontWeight: '700' }}>+{mems.length - 3}</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 20, color: '#1AAD7D', marginLeft: 4 }}>›</Text>
    </TouchableOpacity>
  );
});

export default function HomeScreen({ navigation }) {
  const { theme, setTheme, user, groups, logout, loadGroups, createGroup, joinGroup, updateProfile } = useApp();
  const c = COLORS[theme];

  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);
  const [showJoin,    setShowJoin]    = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [gname,       setGname]       = useState('');
  const [code,        setCode]        = useState('');
  const [newName,     setNewName]     = useState('');
  const [err,         setErr]         = useState('');
  const [busy,        setBusy]        = useState(false);

  const load = useCallback(async () => {
    try { await loadGroups(); } catch (e) { Alert.alert('Error', e.message); } finally { setLoading(false); }
  }, [loadGroups]);

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleCreate = useCallback(async () => {
    if (!gname.trim()) return setErr('Enter a group name');
    setBusy(true); setErr('');
    try {
      const g = await createGroup(gname.trim());
      setGname(''); setShowCreate(false);
      navigation.navigate('Dashboard', { groupId: g._id, groupName: g.name });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }, [gname, createGroup, navigation]);

  const handleJoin = useCallback(async () => {
    if (code.trim().length !== 6) return setErr('Enter the 6-character invite code');
    setBusy(true); setErr('');
    try {
      const g = await joinGroup(code.trim().toUpperCase());
      setCode(''); setShowJoin(false);
      navigation.navigate('Dashboard', { groupId: g._id, groupName: g.name });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }, [code, joinGroup, navigation]);

  const handleUpdateProfile = useCallback(async () => {
    if (!newName.trim()) return setErr('Name cannot be empty');
    setBusy(true); setErr('');
    try { await updateProfile(newName.trim()); setShowProfile(false); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }, [newName, updateProfile]);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  }, [logout]);

  // Stable callback for FlatList — prevents all items from re-rendering when parent updates
  const handleGroupPress = useCallback((g) => {
    navigation.navigate('Dashboard', { groupId: g._id, groupName: g.name });
  }, [navigation]);

  // Stable keyExtractor — prevents recalculation on every render
  const keyExtractor = useCallback((g) => g._id, []);

  // Stable renderItem using the memoized GroupCard
  const renderItem = useCallback(({ item: g, index: i }) => (
    <GroupCard
      g={g}
      index={i}
      onPress={handleGroupPress}
      surfaceColor={c.surface}
      borderColor={c.border}
    />
  ), [handleGroupPress, c.surface, c.border]);

  const inputSt = { backgroundColor: c.surface2, borderColor: c.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: c.text };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* ── App Bar ── */}
      <View style={[s.appBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={s.barLeft}>
          <View style={[s.logoSm, { backgroundColor: c.accent }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>₹</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>RoomSplit</Text>
        </View>
        <View style={s.barRight}>
          <Text style={{ fontSize: 14, marginRight: 4 }}>{theme === 'dark' ? '🌙' : '☀️'}</Text>
          <Switch value={theme === 'dark'} onValueChange={v => setTheme(v ? 'dark' : 'light')}
            trackColor={{ false: c.border2, true: c.accent }} thumbColor="#fff"
            style={{ transform: [{ scaleX: .85 }, { scaleY: .85 }], marginRight: 6 }} />
          <TouchableOpacity onPress={() => { setNewName(user?.name || ''); setErr(''); setShowProfile(true); }}
            style={[s.profileBtn, { backgroundColor: c.surface2, borderColor: c.border }]}>
            <View style={[s.profileAv, { backgroundColor: c.accent }]}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{user?.name?.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>{user?.name?.split(' ')[0]}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={[s.outBtn, { borderColor: c.border2 }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.text2 }}>Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── List header ── */}
      <View style={s.listHead}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>Your Groups</Text>
          <Text style={{ fontSize: 13, color: c.text2, marginTop: 3 }}>{groups.length} group{groups.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn variant="secondary" size="sm" onPress={() => { setShowJoin(true); setErr(''); }}>Join</Btn>
          <Btn size="sm" onPress={() => { setShowCreate(true); setErr(''); }}>+ New</Btn>
        </View>
      </View>

      {/* ── Group list with skeleton loader ── */}
      {loading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map(i => <GroupCardSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
          // FlatList Performance Props
          initialNumToRender={10}        // Only render 10 items initially
          maxToRenderPerBatch={10}       // Render 10 items per batch during scroll
          windowSize={5}                 // Keep 5 screens of items in memory
          removeClippedSubviews={true}   // Unmount off-screen items (Android)
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 44, marginBottom: 14 }}>🏠</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 8 }}>No groups yet</Text>
              <Text style={{ fontSize: 14, color: c.text2, textAlign: 'center', marginBottom: 24 }}>Create a group and share the invite code with your roommates</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Btn onPress={() => setShowCreate(true)}>Create Group</Btn>
                <Btn variant="secondary" onPress={() => setShowJoin(true)}>Join Group</Btn>
              </View>
            </View>
          }
        />
      )}

      {/* ── Create Group Sheet ── */}
      <BottomSheet visible={showCreate} title="Create New Group" onClose={() => setShowCreate(false)} theme={theme}>
        <TextInput style={[inputSt, { marginBottom: 6 }]} placeholder="Group name *" placeholderTextColor={c.text3}
          value={gname} onChangeText={v => { setGname(v); setErr(''); }} returnKeyType="done" onSubmitEditing={handleCreate} />
        {err ? <Text style={{ color: c.danger, fontSize: 13, marginBottom: 10 }}>{err}</Text> : <View style={{ height: 10 }} />}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn variant="secondary" onPress={() => setShowCreate(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onPress={handleCreate} loading={busy} style={{ flex: 2 }}>Create Group</Btn>
        </View>
      </BottomSheet>

      {/* ── Join Group Sheet ── */}
      <BottomSheet visible={showJoin} title="Join a Group" onClose={() => setShowJoin(false)} theme={theme}>
        <Text style={{ fontSize: 13, color: c.text2, marginBottom: 14 }}>Ask your roommate for their 6-character invite code.</Text>
        <TextInput
          style={[inputSt, { textAlign: 'center', letterSpacing: 10, fontFamily: 'monospace', fontSize: 24, marginBottom: 6 }]}
          placeholder="AB12CD" placeholderTextColor={c.text3}
          value={code} onChangeText={v => { setCode(v.toUpperCase()); setErr(''); }}
          maxLength={6} autoCapitalize="characters" returnKeyType="done" onSubmitEditing={handleJoin}
        />
        {err ? <Text style={{ color: c.danger, fontSize: 13, marginBottom: 10 }}>{err}</Text> : <View style={{ height: 10 }} />}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn variant="secondary" onPress={() => setShowJoin(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onPress={handleJoin} loading={busy} style={{ flex: 2 }}>Join Group</Btn>
        </View>
      </BottomSheet>

      {/* ── Profile Sheet ── */}
      <BottomSheet visible={showProfile} title="My Profile" onClose={() => setShowProfile(false)} theme={theme}>
        <TextInput style={[inputSt, { marginBottom: 6 }]} placeholder="Display name" placeholderTextColor={c.text3}
          value={newName} onChangeText={v => { setNewName(v); setErr(''); }} autoCapitalize="words" />
        <Text style={{ fontSize: 12, color: c.text3, marginBottom: 14 }}>Email: {user?.email}</Text>
        {err ? <Text style={{ color: c.danger, fontSize: 13, marginBottom: 10 }}>{err}</Text> : null}
        <Btn onPress={handleUpdateProfile} loading={busy} full>Save Changes</Btn>
      </BottomSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  appBar:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1 },
  barLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoSm:    { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  barRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileBtn:{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1 },
  profileAv: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  outBtn:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  listHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  groupCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, gap: 12 },
  groupIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stackAv:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
