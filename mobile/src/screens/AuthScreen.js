import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../context/AppContext';
import { COLORS } from '../utils/theme';

export default function AuthScreen() {
  const { theme, setTheme, login, signup } = useApp();
  const c = COLORS[theme];

  const [tab,   setTab]   = useState('login');
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);

  const reset = () => { setErr(''); };

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      if (tab === 'login') {
        if (!email.trim() || !pass) throw new Error('Email and password required');
        await login(email.trim().toLowerCase(), pass);
      } else {
        if (!name.trim()) throw new Error('Name is required');
        if (!email.trim()) throw new Error('Email is required');
        if (pass.length < 6) throw new Error('Password must be at least 6 characters');
        await signup(name.trim(), email.trim().toLowerCase(), pass);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: c.surface2, borderColor: c.border,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: c.text, marginBottom: 12,
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: c.bg }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Theme toggle top-right */}
      <View style={s.themeRow}>
        <Text style={{ fontSize:14, marginRight:6 }}>{theme==='dark'?'🌙':'☀️'}</Text>
        <Switch
          value={theme === 'dark'}
          onValueChange={v => setTheme(v ? 'dark' : 'light')}
          trackColor={{ false: c.border2, true: c.accent }}
          thumbColor="#fff"
        />
      </View>

      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow:1, justifyContent:'center', padding:24 }} keyboardShouldPersistTaps="handled">

          {/* Brand */}
          <View style={{ alignItems:'center', marginBottom:32 }}>
            <View style={[s.logo, { backgroundColor: c.accent }]}>
              <Text style={s.logoText}>₹</Text>
            </View>
            <Text style={[s.appName, { color: c.text }]}>RoomSplit</Text>
            <Text style={[s.tagline, { color: c.text2 }]}>Smart expense sharing for roommates</Text>
          </View>

          {/* Card */}
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>

            {/* Tab toggle */}
            <View style={[s.tabRow, { backgroundColor: c.surface2 }]}>
              {[['login','Login'],['signup','Sign Up']].map(([t,l]) => (
                <TouchableOpacity key={t} onPress={() => { setTab(t); reset(); }}
                  style={[s.tabBtn, { backgroundColor: tab===t ? c.accent : 'transparent' }]}>
                  <Text style={{ fontSize:14, fontWeight:'600', color: tab===t ? '#fff' : c.text2 }}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'signup' && (
              <TextInput style={[inputStyle]} placeholder="Full name *" placeholderTextColor={c.text3}
                value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />
            )}

            <TextInput style={[inputStyle]} placeholder="Email *" placeholderTextColor={c.text3}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" />

            <TextInput style={[inputStyle, { marginBottom: 0 }]} placeholder="Password *" placeholderTextColor={c.text3}
              value={pass} onChangeText={setPass} secureTextEntry returnKeyType="done" onSubmitEditing={submit} />

            {err ? (
              <View style={[s.errBox, { backgroundColor: c.dangerBg, borderColor: c.dangerBd }]}>
                <Text style={{ fontSize:13, color: c.danger }}>{err}</Text>
              </View>
            ) : <View style={{ height:14 }} />}

            <TouchableOpacity onPress={submit} disabled={busy}
              style={[s.submitBtn, { backgroundColor: c.accent, opacity: busy ? 0.7 : 1 }]}>
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>{tab === 'login' ? 'Login →' : 'Create Account →'}</Text>
              }
            </TouchableOpacity>

            <Text style={{ textAlign:'center', fontSize:12, color:c.text3, marginTop:14 }}>
              Sign up · create group · share invite code
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  themeRow:   { position:'absolute', top:50, right:20, flexDirection:'row', alignItems:'center', zIndex:10 },
  logo:       { width:64, height:64, borderRadius:20, alignItems:'center', justifyContent:'center', marginBottom:14 },
  logoText:   { fontSize:30, color:'#fff', fontWeight:'700' },
  appName:    { fontSize:30, fontWeight:'700', marginBottom:6 },
  tagline:    { fontSize:14, textAlign:'center' },
  card:       { borderRadius:18, padding:22, borderWidth:1 },
  tabRow:     { flexDirection:'row', borderRadius:10, padding:4, marginBottom:20 },
  tabBtn:     { flex:1, paddingVertical:9, borderRadius:8, alignItems:'center' },
  errBox:     { borderRadius:8, padding:12, marginVertical:10, borderWidth:1 },
  submitBtn:  { paddingVertical:14, borderRadius:10, alignItems:'center', marginTop:2 },
  submitText: { color:'#fff', fontSize:15, fontWeight:'700' },
});
