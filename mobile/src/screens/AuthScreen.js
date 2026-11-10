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
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';

import { useApp } from '../context/AppContext';
import { COLORS } from '../utils/theme';
import { GOOGLE_AUTH_CONFIG } from '../config/auth';

WebBrowser.maybeCompleteAuthSession();

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
  const { theme, setTheme, login, signup, loginWithGoogle, forgotPassword, loginWithOtp } = useApp();
  const c = COLORS[theme];

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);

  // Email fallback inputs
  const [emailTab, setEmailTab] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [oneTapEmail, setOneTapEmail] = useState('');

  // ── Expo Google OAuth Request ─────────────────────────────────────────────
  const hasClientId = Boolean(
    GOOGLE_AUTH_CONFIG.webClientId &&
    !GOOGLE_AUTH_CONFIG.webClientId.includes('YOUR_GOOGLE_WEB_CLIENT_ID')
  );

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: hasClientId ? GOOGLE_AUTH_CONFIG.webClientId : undefined,
    androidClientId: GOOGLE_AUTH_CONFIG.androidClientId || undefined,
    iosClientId: GOOGLE_AUTH_CONFIG.iosClientId || undefined,
    redirectUri: makeRedirectUri({ scheme: 'roomsplit' }),
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication, params } = response;
      handleGoogleAuthToken(authentication?.accessToken, params?.id_token);
    } else if (response?.type === 'error') {
      setErr(response.error?.message || 'Google authentication was cancelled or failed.');
    }
  }, [response]);

  const handleGoogleAuthToken = async (accessToken, idToken) => {
    setBusy(true);
    setErr('');
    try {
      await loginWithGoogle({ accessToken, idToken });
    } catch (e) {
      setErr(e.message || 'Failed to authenticate with Google');
    } finally {
      setBusy(false);
    }
  };

  const handleGooglePress = async () => {
    setErr('');
    if (!hasClientId) {
      // Guide user if client ID is not configured yet
      setShowConfigModal(true);
      return;
    }
    try {
      setBusy(true);
      await promptAsync();
    } catch (e) {
      setErr(e.message || 'Could not open Google sign in');
    } finally {
      setBusy(false);
    }
  };

  // ── Instant 1-Tap Passwordless Login (for immediate testing without client ID)
  const handleInstantOneTap = async (customEmail, customName) => {
    const targetEmail = (customEmail || oneTapEmail || 'ankushkumary77@gmail.com').trim().toLowerCase();
    const targetName = customName || (targetEmail.includes('ankush') ? 'Ankush Kumar' : targetEmail.split('@')[0]);

    if (!targetEmail) {
      setErr('Please enter an email address');
      return;
    }

    setBusy(true);
    setErr('');
    try {
      await loginWithGoogle({
        user: {
          email: targetEmail,
          name: targetName,
          picture: null,
          sub: 'google_instant_' + Date.now(),
        },
      });
      setShowConfigModal(false);
    } catch (e) {
      setErr(e.message || 'Failed to log in');
    } finally {
      setBusy(false);
    }
  };

  // ── Email/Password Submit Fallback ─────────────────────────────────────────
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

      {/* Top Bar with Brand & Theme Switch */}
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
          {/* ── Feature Highlights (As shown in screenshot) ── */}
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
                shadowColor: '#000',
              },
            ]}
          >
            <Text style={[s.cardTitle, { color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }]}>
              Welcome Back!
            </Text>
            <Text style={[s.cardSubtitle, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>
              Please sign in to continue.
            </Text>

            {/* Error Message */}
            {err ? (
              <View style={s.errBox}>
                <Text style={s.errText}>{err}</Text>
              </View>
            ) : null}

            {/* ── "Continue with Google" Button (Matching user screenshot) ── */}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={busy}
              onPress={handleGooglePress}
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

            {/* Quick 1-Tap Account Selector */}
            <View style={s.quickSection}>
              <View style={s.dividerRow}>
                <View style={[s.dividerLine, { backgroundColor: theme === 'dark' ? '#334155' : '#E2E8F0' }]} />
                <Text style={[s.dividerText, { color: theme === 'dark' ? '#64748B' : '#94A3B8' }]}>
                  FAST 1-TAP LOGIN
                </Text>
                <View style={[s.dividerLine, { backgroundColor: theme === 'dark' ? '#334155' : '#E2E8F0' }]} />
              </View>

              <View style={s.quickAccountsRow}>
                <TouchableOpacity
                  style={[s.quickPill, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', borderColor: '#1AAD7D' }]}
                  onPress={() => handleInstantOneTap('ankushkumary77@gmail.com', 'Ankush Kumar')}
                  disabled={busy}
                >
                  <Text style={s.quickPillIcon}>⚡</Text>
                  <Text style={[s.quickPillText, { color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }]}>
                    Ankush Kumar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.quickPill, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', borderColor: theme === 'dark' ? '#334155' : '#E2E8F0' }]}
                  onPress={() => handleInstantOneTap('kanhaiya@roomsplit.app', 'Kanhaiya Kumar')}
                  disabled={busy}
                >
                  <Text style={s.quickPillIcon}>👤</Text>
                  <Text style={[s.quickPillText, { color: theme === 'dark' ? '#CBD5E1' : '#475569' }]}>
                    Kanhaiya
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Collapsible Email Login Option */}
            <TouchableOpacity
              onPress={() => setShowEmailAuth(!showEmailAuth)}
              style={s.emailToggleBtn}
            >
              <Text style={{ fontSize: 12, color: '#1AAD7D', fontWeight: '600' }}>
                {showEmailAuth ? '▲ Hide email & password' : '▼ Or sign in with email / password'}
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

      {/* ── Modal for Google OAuth Setup & Instant Login ── */}
      <Modal visible={showConfigModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <GoogleIcon size={28} />
              <Text style={[s.modalTitle, { color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }]}>
                Google Sign-In Ready!
              </Text>
            </View>

            <Text style={[s.modalDesc, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>
              To enable the native Google Account Chooser popup, add your free Google Web Client ID in{' '}
              <Text style={{ fontWeight: '700', color: '#1AAD7D' }}>mobile/src/config/auth.js</Text>.
            </Text>

            <View style={[s.instantLoginCard, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F1F5F9' }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1AAD7D', marginBottom: 6 }}>
                ⚡ Test 1-Click Login Now (No Password):
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', color: theme === 'dark' ? '#fff' : '#000', borderColor: theme === 'dark' ? '#334155' : '#CBD5E1' }]}
                placeholder="Enter any Gmail address"
                placeholderTextColor="#94A3B8"
                value={oneTapEmail}
                onChangeText={setOneTapEmail}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => handleInstantOneTap(oneTapEmail)}
                style={s.instantBtn}
              >
                <Text style={s.instantBtnText}>Continue with this Email →</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowConfigModal(false)}
              style={s.closeModalBtn}
            >
              <Text style={s.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
  },
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
    marginBottom: 14,
  },
  quickSection: {
    width: '100%',
    marginTop: 6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  quickAccountsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
  },
  quickPillIcon: {
    fontSize: 13,
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emailToggleBtn: {
    marginTop: 18,
    paddingVertical: 6,
  },
  emailBox: {
    width: '100%',
    marginTop: 14,
    paddingTop: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  instantLoginCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  instantBtn: {
    backgroundColor: '#1AAD7D',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  instantBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  closeModalBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  closeModalText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
