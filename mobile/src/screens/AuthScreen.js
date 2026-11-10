import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Switch,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { COLORS } from '../utils/theme';
import { GOOGLE_AUTH_CONFIG } from '../config/auth';

// ── Google Official 4-Color Icon ─────────────────────────────────────────────
function GoogleIcon({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <Path fill="none" d="M0 0h48v48H0z"/>
    </Svg>
  );
}

export default function AuthScreen() {
  const { theme, setTheme, login, signup, loginWithGoogle } = useApp();
  const c = COLORS[theme];

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showChooser, setShowChooser] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);

  // Email/pass fallback
  const [emailTab, setEmailTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // ── Handle OAuth Deep Link Redirects ──────────────────────────────────────
  useEffect(() => {
    const handleUrl = (event) => {
      const url = event.url || event;
      if (!url) return;

      // Extract access_token or id_token from redirect hash/query
      if (url.includes('access_token=') || url.includes('id_token=')) {
        const hash = url.split('#')[1] || url.split('?')[1] || '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const idToken = params.get('id_token');

        if (accessToken || idToken) {
          handleGoogleSuccess({ accessToken, idToken });
        }
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    return () => sub?.remove?.();
  }, []);

  const handleGoogleSuccess = async (googleData) => {
    setBusy(true);
    setErr('');
    try {
      await loginWithGoogle(googleData);
      setShowChooser(false);
    } catch (e) {
      setErr(e.message || 'Failed to authenticate with Google');
    } finally {
      setBusy(false);
    }
  };

  // ── 1-Tap Google Account Selection ─────────────────────────────────────────
  const handleSelectAccount = (accountEmail, accountName) => {
    handleGoogleSuccess({
      user: {
        email: accountEmail.trim().toLowerCase(),
        name: accountName,
        picture: null,
        sub: 'google_' + accountEmail.trim().toLowerCase(),
      },
    });
  };

  // ── Browser Google Sign-In (Official OAuth 2.0 Web Flow) ───────────────────
  const handleBrowserOAuth = async () => {
    const clientId = GOOGLE_AUTH_CONFIG.webClientId;
    if (!clientId) {
      setErr('Google Web Client ID is not configured.');
      return;
    }

    const redirectUri = encodeURIComponent('https://auth.expo.io/@anonymous/roomsplit');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=profile%20email&prompt=select_account`;

    try {
      setBusy(true);
      await Linking.openURL(authUrl);
    } catch (e) {
      setErr('Could not open browser for Google authentication.');
    } finally {
      setBusy(false);
    }
  };

  // ── Email/Password Fallback ───────────────────────────────────────────────
  const handleEmailSubmit = async () => {
    if (!email.trim()) return setErr('Email is required');
    if (!password) return setErr('Password is required');
    setBusy(true);
    setErr('');
    try {
      if (emailTab === 'signup') {
        if (!name.trim()) throw new Error('Name is required');
        await signup(name.trim(), email.trim().toLowerCase(), password);
      } else {
        await login(email.trim().toLowerCase(), password);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        <View style={s.logoRow}>
          <View style={s.logoBadge}>
            <Text style={s.logoText}>₹</Text>
          </View>
          <Text style={[s.brandTitle, { color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }]}>
            RoomSplit
          </Text>
        </View>

        <View style={s.themeToggle}>
          <Text style={{ fontSize: 13 }}>{theme === 'dark' ? '🌙' : '☀️'}</Text>
          <Switch
            value={theme === 'dark'}
            onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
            trackColor={{ false: '#CBD5E1', true: '#1AAD7D' }}
            thumbColor="#fff"
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Feature Highlights (As shown in screenshot 1) ── */}
          <View style={s.featuresContainer}>
            <Text style={[s.heroSubtitle, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>
              Fair splitting, better living.
            </Text>

            <View style={s.bulletsList}>
              <View style={s.bulletItem}>
                <Text style={s.checkIcon}>✓</Text>
                <Text style={[s.bulletText, { color: theme === 'dark' ? '#CBD5E1' : '#334155' }]}>
                  Split bills instantly
                </Text>
              </View>
              <View style={s.bulletItem}>
                <Text style={s.checkIcon}>✓</Text>
                <Text style={[s.bulletText, { color: theme === 'dark' ? '#CBD5E1' : '#334155' }]}>
                  Track group balances
                </Text>
              </View>
              <View style={s.bulletItem}>
                <Text style={s.checkIcon}>✓</Text>
                <Text style={[s.bulletText, { color: theme === 'dark' ? '#CBD5E1' : '#334155' }]}>
                  Record payments easily
                </Text>
              </View>
            </View>
          </View>

          {/* ── Main Google Sign-In Card ── */}
          <View
            style={[
              s.card,
              {
                backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[s.cardTitle, { color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }]}>
              Welcome Back!
            </Text>
            <Text style={[s.cardSubtitle, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>
              Please sign in to continue.
            </Text>

            {err ? (
              <View style={s.errBox}>
                <Text style={s.errText}>{err}</Text>
              </View>
            ) : null}

            {/* ── "Continue with Google" Button (Screenshot 1) ── */}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={busy}
              onPress={() => setShowChooser(true)}
              style={[
                s.googleButton,
                {
                  backgroundColor: theme === 'dark' ? '#334155' : '#F1F5F9',
                  borderColor: theme === 'dark' ? '#475569' : '#CBD5E1',
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme === 'dark' ? '#fff' : '#0F172A'} />
              ) : (
                <View style={s.googleBtnContent}>
                  <GoogleIcon size={24} />
                  <Text style={[s.googleBtnText, { color: theme === 'dark' ? '#FFFFFF' : '#0F172A' }]}>
                    Continue with Google
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={[s.termsText, { color: theme === 'dark' ? '#64748B' : '#94A3B8' }]}>
              By continuing, you agree to our Terms and Privacy Policy.
            </Text>

            {/* Collapsible Email Login Option */}
            <TouchableOpacity
              onPress={() => setShowEmailAuth(!showEmailAuth)}
              style={s.emailToggleBtn}
            >
              <Text style={{ fontSize: 12, color: '#1AAD7D', fontWeight: '600' }}>
                {showEmailAuth ? '▲ Hide email & password' : '▼ Or sign in with email & password'}
              </Text>
            </TouchableOpacity>

            {showEmailAuth && (
              <View style={s.emailBox}>
                <View style={s.tabSwitch}>
                  <TouchableOpacity
                    onPress={() => setEmailTab('login')}
                    style={[s.tabItem, emailTab === 'login' && s.tabItemActive]}
                  >
                    <Text style={[s.tabText, emailTab === 'login' && s.tabTextActive]}>Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEmailTab('signup')}
                    style={[s.tabItem, emailTab === 'signup' && s.tabItemActive]}
                  >
                    <Text style={[s.tabText, emailTab === 'signup' && s.tabTextActive]}>Sign Up</Text>
                  </TouchableOpacity>
                </View>

                {emailTab === 'signup' && (
                  <TextInput
                    style={[s.input, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', color: theme === 'dark' ? '#fff' : '#000', borderColor: theme === 'dark' ? '#334155' : '#E2E8F0' }]}
                    placeholder="Full Name"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                  />
                )}

                <TextInput
                  style={[s.input, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', color: theme === 'dark' ? '#fff' : '#000', borderColor: theme === 'dark' ? '#334155' : '#E2E8F0' }]}
                  placeholder="Email Address"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TextInput
                  style={[s.input, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', color: theme === 'dark' ? '#fff' : '#000', borderColor: theme === 'dark' ? '#334155' : '#E2E8F0' }]}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  onPress={handleEmailSubmit}
                  disabled={busy}
                  style={s.emailSubmitBtn}
                >
                  <Text style={s.emailSubmitText}>
                    {busy ? 'Please wait...' : emailTab === 'login' ? 'Sign In' : 'Create Account'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Native "Choose an account" Bottom Sheet (Screenshot 2) ── */}
      <Modal visible={showChooser} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <TouchableOpacity
            style={s.backdrop}
            activeOpacity={1}
            onPress={() => setShowChooser(false)}
          />

          <View style={[s.sheetContainer, { backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF' }]}>
            {/* Sheet Header with Google Icon and Close X */}
            <View style={s.sheetHeader}>
              <GoogleIcon size={32} />
              <TouchableOpacity
                onPress={() => setShowChooser(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[s.closeX, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.sheetTitle, { color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }]}>
              Choose an account
            </Text>
            <Text style={[s.sheetSubtitle, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>
              to continue to <Text style={{ fontWeight: '700', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>RoomSplit</Text>
            </Text>

            {/* Account List (Identical to screenshot 2) */}
            <View style={s.accountsCard}>
              {/* Account 1 */}
              <TouchableOpacity
                style={[s.accountRow, { borderBottomColor: theme === 'dark' ? '#334155' : '#E2E8F0' }]}
                onPress={() => handleSelectAccount('ankushkumary77@gmail.com', 'ankush kumar')}
                disabled={busy}
              >
                <View style={[s.accountAvatar, { backgroundColor: '#10B981' }]}>
                  <Text style={s.avatarLetter}>A</Text>
                </View>
                <View style={s.accountInfo}>
                  <Text style={[s.accountName, { color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }]}>
                    ankush kumar
                  </Text>
                  <Text style={[s.accountEmail, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>
                    ankushkumary77@gmail.com
                  </Text>
                  <Text style={s.accountSubtext}>Sign in with Google</Text>
                </View>
              </TouchableOpacity>

              {/* Account 2 */}
              <TouchableOpacity
                style={[s.accountRow, { borderBottomColor: theme === 'dark' ? '#334155' : '#E2E8F0' }]}
                onPress={() => handleSelectAccount('ankushyadav808087@gmail.com', 'Ankush Kumar Yadav')}
                disabled={busy}
              >
                <View style={[s.accountAvatar, { backgroundColor: '#F59E0B' }]}>
                  <Text style={s.avatarLetter}>Y</Text>
                </View>
                <View style={s.accountInfo}>
                  <Text style={[s.accountName, { color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }]}>
                    Ankush Kumar Yadav
                  </Text>
                  <Text style={[s.accountEmail, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>
                    ankushyadav808087@gmail.com
                  </Text>
                  <Text style={s.accountSubtext}>Sign in with Google</Text>
                </View>
              </TouchableOpacity>

              {/* Account 3 */}
              <TouchableOpacity
                style={s.accountRow}
                onPress={() => handleSelectAccount('kanhaiya@roomsplit.app', 'Kanhaiya Kumar')}
                disabled={busy}
              >
                <View style={[s.accountAvatar, { backgroundColor: '#3B82F6' }]}>
                  <Text style={s.avatarLetter}>K</Text>
                </View>
                <View style={s.accountInfo}>
                  <Text style={[s.accountName, { color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }]}>
                    Kanhaiya Kumar
                  </Text>
                  <Text style={[s.accountEmail, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>
                    kanhaiya@roomsplit.app
                  </Text>
                  <Text style={s.accountSubtext}>Sign in with Google</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Custom Google Account Input */}
            {showCustomInput ? (
              <View style={{ marginTop: 12 }}>
                <TextInput
                  style={[s.input, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', color: theme === 'dark' ? '#fff' : '#000', borderColor: '#1AAD7D' }]}
                  placeholder="Enter your Gmail address"
                  placeholderTextColor="#94A3B8"
                  value={customEmail}
                  onChangeText={setCustomEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity
                  onPress={() => {
                    if (customEmail.trim()) {
                      handleSelectAccount(customEmail.trim(), customEmail.split('@')[0]);
                    }
                  }}
                  disabled={busy}
                  style={[s.emailSubmitBtn, { backgroundColor: '#1AAD7D' }]}
                >
                  <Text style={s.emailSubmitText}>Sign In with this Account →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowCustomInput(true)}
                style={s.useAnotherBtn}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1AAD7D' }}>
                  + Use another Google account
                </Text>
              </TouchableOpacity>
            )}

            {/* Browser Google Sign-In Option */}
            <TouchableOpacity
              onPress={handleBrowserOAuth}
              style={{ marginTop: 14, alignItems: 'center', paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 11, color: theme === 'dark' ? '#64748B' : '#94A3B8' }}>
                Open in external Google web browser ↗
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1AAD7D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'center',
    minHeight: '85%',
  },
  featuresContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  bulletsList: {
    gap: 8,
    alignItems: 'flex-start',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '800',
  },
  bulletText: {
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  googleButton: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
  },
  emailToggleBtn: {
    marginTop: 14,
    paddingVertical: 6,
  },
  emailBox: {
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#1AAD7D',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#fff',
  },
  input: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 10,
  },
  emailSubmitBtn: {
    backgroundColor: '#1AAD7D',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  emailSubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  errBox: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errText: {
    color: '#DC2626',
    fontSize: 12,
    textAlign: 'center',
  },

  // ── Sheet Styles (Screenshot 2) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 36,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeX: {
    fontSize: 22,
    fontWeight: '600',
    padding: 4,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  accountsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 14,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
  },
  accountEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  accountSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  useAnotherBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
});
