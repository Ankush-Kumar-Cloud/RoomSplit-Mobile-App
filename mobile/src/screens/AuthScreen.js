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
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { COLORS } from '../utils/theme';
import { GOOGLE_AUTH_CONFIG } from '../config/auth';

// ── Google Official 4-Color SVG Icon ─────────────────────────────────────────
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
  const [lastAccount, setLastAccount] = useState(null);

  // Instant passwordless login inputs
  const [showInstantEmail, setShowInstantEmail] = useState(false);
  const [instantEmail, setInstantEmail] = useState('');
  const [instantName, setInstantName] = useState('');

  // Email/password tab states
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [emailTab, setEmailTab] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // ── Load Last Account Logged in on THIS Specific Phone ─────────────────────
  useEffect(() => {
    AsyncStorage.getItem('@splitmate_last_account').then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.email) {
            setLastAccount(parsed);
          }
        } catch (_) {}
      }
    });
  }, []);

  const saveLastAccount = async (userObj) => {
    try {
      if (userObj?.email) {
        const acc = {
          email: userObj.email,
          name: userObj.name || userObj.email.split('@')[0],
        };
        await AsyncStorage.setItem('@splitmate_last_account', JSON.stringify(acc));
        setLastAccount(acc);
      }
    } catch (_) {}
  };

  // ── Handle OAuth Deep Link Redirects (roomsplit://auth?access_token=...) ───
  useEffect(() => {
    const handleUrl = (event) => {
      const url = typeof event === 'string' ? event : event?.url;
      if (!url) return;

      if (url.includes('access_token=') || url.includes('id_token=')) {
        const raw = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || '';
        const params = new URLSearchParams(raw);
        const accessToken = params.get('access_token');
        const idToken = params.get('id_token');

        if (accessToken || idToken) {
          handleGoogleSuccess({ accessToken, idToken });
        }
      } else if (url.includes('error=')) {
        const raw = url.includes('?') ? url.split('?')[1] : url.split('#')[1] || '';
        const params = new URLSearchParams(raw);
        const error = params.get('error');
        if (error) {
          setErr('Google authentication was cancelled or returned an error.');
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
      const loggedUser = await loginWithGoogle(googleData);
      if (loggedUser) {
        saveLastAccount(loggedUser);
      }
    } catch (e) {
      setErr(e.message || 'Failed to authenticate with Google');
    } finally {
      setBusy(false);
    }
  };

  // ── Real Google OAuth: Opens Official Google Sign-In in Device Browser ─────
  const handleGoogleSignIn = async () => {
    setErr('');
    setBusy(true);

    const clientId = GOOGLE_AUTH_CONFIG.webClientId;
    if (!clientId) {
      setBusy(false);
      setErr('Google Web Client ID is not configured.');
      return;
    }

    // Google OAuth 2.0 Web Authorization URL
    // Opens in Chrome on Android: Google displays that user's actual phone accounts!
    const callbackUri = encodeURIComponent('https://roomsplit-mobile-app.onrender.com/api/auth/google/callback');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${callbackUri}&response_type=token&scope=profile%20email&prompt=select_account`;

    try {
      await Linking.openURL(authUrl);
    } catch (e) {
      setErr('Could not open browser for Google authentication.');
    } finally {
      setBusy(false);
    }
  };

  // ── 1-Tap Instant Sign-In with any Email (Passwordless) ────────────────────
  const handleInstantSignIn = async (userEmail, userName) => {
    const targetEmail = (userEmail || instantEmail).trim().toLowerCase();
    const targetName = (userName || instantName || targetEmail.split('@')[0]).trim();

    if (!targetEmail) {
      setErr('Please enter your email address');
      return;
    }

    if (!targetEmail.includes('@') || !targetEmail.includes('.')) {
      setErr('Please enter a valid email address');
      return;
    }

    setBusy(true);
    setErr('');
    try {
      const loggedUser = await loginWithGoogle({
        user: {
          email: targetEmail,
          name: targetName,
          picture: null,
          sub: 'google_instant_' + targetEmail,
        },
      });
      if (loggedUser) {
        saveLastAccount(loggedUser);
      }
    } catch (e) {
      setErr(e.message || 'Failed to sign in');
    } finally {
      setBusy(false);
    }
  };

  // ── Email/Password Authentication ──────────────────────────────────────────
  const handleEmailSubmit = async () => {
    if (!email.trim()) return setErr('Email is required');
    if (!password) return setErr('Password is required');
    setBusy(true);
    setErr('');
    try {
      let loggedUser;
      if (emailTab === 'signup') {
        if (!name.trim()) throw new Error('Name is required');
        loggedUser = await signup(name.trim(), email.trim().toLowerCase(), password);
      } else {
        loggedUser = await login(email.trim().toLowerCase(), password);
      }
      if (loggedUser) {
        saveLastAccount(loggedUser);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* ── Top Bar ── */}
      <View style={[s.topBar, { borderBottomColor: c.border }]}>
        <View style={s.brandRow}>
          <View style={[s.miniBadge, { backgroundColor: c.accent }]}>
            <Text style={s.miniBadgeText}>₹</Text>
          </View>
          <Text style={[s.brandTitle, { color: c.text }]}>SplitMate</Text>
        </View>

        <View style={s.themeRow}>
          <Text style={{ fontSize: 14 }}>{theme === 'dark' ? '🌙' : '☀️'}</Text>
          <Switch
            value={theme === 'dark'}
            onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
            trackColor={{ false: c.border2, true: c.accent }}
            thumbColor="#FFFFFF"
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
          {/* ── Hero Brand Header ── */}
          <View style={s.heroSection}>
            <View style={[s.heroIconBox, { backgroundColor: c.accentBg, borderColor: c.accentBd }]}>
              <View style={[s.heroIconInner, { backgroundColor: c.accent }]}>
                <Text style={s.heroCurrency}>₹</Text>
              </View>
            </View>

            <Text style={[s.heroTitle, { color: c.text }]}>SplitMate</Text>
            <Text style={[s.heroSubtitle, { color: c.text2 }]}>
              Smart Expense Sharing for Roommates
            </Text>

            {/* Feature Pills */}
            <View style={s.featuresPillRow}>
              <View style={[s.featurePill, { backgroundColor: c.surface2, borderColor: c.border }]}>
                <Text style={[s.featurePillText, { color: c.text2 }]}>⚡ Fair Splitting</Text>
              </View>
              <View style={[s.featurePill, { backgroundColor: c.surface2, borderColor: c.border }]}>
                <Text style={[s.featurePillText, { color: c.text2 }]}>🚫 Smart Exclusion</Text>
              </View>
              <View style={[s.featurePill, { backgroundColor: c.surface2, borderColor: c.border }]}>
                <Text style={[s.featurePillText, { color: c.text2 }]}>💳 Easy Settlements</Text>
              </View>
            </View>
          </View>

          {/* ── Main Authentication Card ── */}
          <View
            style={[
              s.card,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                shadowColor: c.shadow,
              },
            ]}
          >
            <Text style={[s.cardHeading, { color: c.text }]}>
              Welcome!
            </Text>
            <Text style={[s.cardSubheading, { color: c.text2 }]}>
              Sign in with your Google account to manage roommate bills and track balances seamlessly.
            </Text>

            {/* Error Message */}
            {err ? (
              <View style={[s.errBox, { backgroundColor: c.dangerBg, borderColor: c.dangerBd }]}>
                <Text style={[s.errText, { color: c.danger }]}>{err}</Text>
              </View>
            ) : null}

            {/* ── Recent Account on THIS Specific Device (Only shows if logged in here previously) ── */}
            {lastAccount && (
              <View style={[s.recentAccountCard, { backgroundColor: c.surface2, borderColor: c.border }]}>
                <Text style={[s.recentAccountHeader, { color: c.text3 }]}>RECENT ACCOUNT ON THIS PHONE</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={busy}
                  onPress={() => handleInstantSignIn(lastAccount.email, lastAccount.name)}
                  style={s.recentAccountRow}
                >
                  <View style={[s.accountAvatar, { backgroundColor: c.accent }]}>
                    <Text style={s.avatarLetter}>
                      {(lastAccount.name || lastAccount.email).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.accountName, { color: c.text }]}>{lastAccount.name}</Text>
                    <Text style={[s.accountEmail, { color: c.text2 }]}>{lastAccount.email}</Text>
                  </View>
                  <View style={[s.recentSignBtn, { backgroundColor: c.accentBg, borderColor: c.accentBd }]}>
                    <Text style={[s.recentSignText, { color: c.accent }]}>Sign In ›</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* ── "Continue with Google" Button (Primary) ── */}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={busy}
              onPress={handleGoogleSignIn}
              style={[
                s.googleButton,
                {
                  backgroundColor: theme === 'dark' ? c.surface2 : '#FFFFFF',
                  borderColor: c.border2,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={c.accent} size="small" />
              ) : (
                <View style={s.googleBtnContent}>
                  <GoogleIcon size={22} />
                  <Text style={[s.googleBtnText, { color: c.text }]}>
                    Continue with Google
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={s.badgeRow}>
              <View style={[s.securityDot, { backgroundColor: c.accent }]} />
              <Text style={[s.securityText, { color: c.text3 }]}>
                Opens Google's official account selector on your phone
              </Text>
            </View>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={[s.dividerLine, { backgroundColor: c.border }]} />
              <Text style={[s.dividerText, { color: c.text3 }]}>OR</Text>
              <View style={[s.dividerLine, { backgroundColor: c.border }]} />
            </View>

            {/* ── 1-Click Instant Sign-In with Any Email (Passwordless) ── */}
            <TouchableOpacity
              onPress={() => {
                setShowInstantEmail(!showInstantEmail);
                if (showEmailAuth) setShowEmailAuth(false);
              }}
              style={[s.optionToggleBtn, { backgroundColor: c.surface2, borderColor: c.border }]}
              activeOpacity={0.7}
            >
              <Text style={[s.optionToggleText, { color: c.text2 }]}>
                {showInstantEmail ? '▲ Hide Instant Sign-in' : '⚡ 1-Click Instant Sign-in (Enter your email)'}
              </Text>
            </TouchableOpacity>

            {showInstantEmail && (
              <View style={[s.instantFormBox, { backgroundColor: c.surface2, borderColor: c.border }]}>
                <Text style={[s.formHintText, { color: c.text2 }]}>
                  Type your Gmail or any email to sign in instantly without remembering a password:
                </Text>

                <View style={{ marginBottom: 10 }}>
                  <Text style={[s.inputLabel, { color: c.text2 }]}>YOUR FULL NAME (OPTIONAL)</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]}
                    placeholder="e.g. Rahul Kumar"
                    placeholderTextColor={c.text3}
                    value={instantName}
                    onChangeText={setInstantName}
                  />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={[s.inputLabel, { color: c.text2 }]}>YOUR GMAIL / EMAIL ADDRESS</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]}
                    placeholder="e.g. rahul@gmail.com"
                    placeholderTextColor={c.text3}
                    value={instantEmail}
                    onChangeText={setInstantEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  onPress={() => handleInstantSignIn(instantEmail, instantName)}
                  disabled={busy}
                  style={[s.submitBtn, { backgroundColor: c.accent }]}
                >
                  <Text style={s.submitBtnText}>
                    {busy ? 'Please wait...' : 'Sign In with This Email →'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Standard Email & Password Authentication ── */}
            <TouchableOpacity
              onPress={() => {
                setShowEmailAuth(!showEmailAuth);
                if (showInstantEmail) setShowInstantEmail(false);
              }}
              style={[s.optionToggleBtn, { backgroundColor: c.surface2, borderColor: c.border, marginTop: 10 }]}
              activeOpacity={0.7}
            >
              <Text style={[s.optionToggleText, { color: c.text2 }]}>
                {showEmailAuth ? '▲ Hide Email & Password' : '✉️ Sign in with Email & Password'}
              </Text>
            </TouchableOpacity>

            {showEmailAuth && (
              <View style={[s.emailFormBox, { backgroundColor: c.surface2, borderColor: c.border }]}>
                <View style={[s.tabSwitch, { backgroundColor: c.surface3 }]}>
                  <TouchableOpacity
                    onPress={() => setEmailTab('login')}
                    style={[s.tabItem, emailTab === 'login' && { backgroundColor: c.accent }]}
                  >
                    <Text style={[s.tabText, { color: emailTab === 'login' ? '#FFFFFF' : c.text2 }]}>
                      Login
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEmailTab('signup')}
                    style={[s.tabItem, emailTab === 'signup' && { backgroundColor: c.accent }]}
                  >
                    <Text style={[s.tabText, { color: emailTab === 'signup' ? '#FFFFFF' : c.text2 }]}>
                      Sign Up
                    </Text>
                  </TouchableOpacity>
                </View>

                {emailTab === 'signup' && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={[s.inputLabel, { color: c.text2 }]}>NAME</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]}
                      placeholder="Your full name"
                      placeholderTextColor={c.text3}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                )}

                <View style={{ marginBottom: 10 }}>
                  <Text style={[s.inputLabel, { color: c.text2 }]}>EMAIL</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]}
                    placeholder="name@gmail.com"
                    placeholderTextColor={c.text3}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={{ marginBottom: 14 }}>
                  <Text style={[s.inputLabel, { color: c.text2 }]}>PASSWORD</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]}
                    placeholder="••••••••"
                    placeholderTextColor={c.text3}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  onPress={handleEmailSubmit}
                  disabled={busy}
                  style={[s.submitBtn, { backgroundColor: c.accent }]}
                >
                  <Text style={s.submitBtnText}>
                    {busy ? 'Please wait...' : emailTab === 'login' ? 'Sign In' : 'Create Account'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Footer Note */}
          <Text style={[s.footerTerms, { color: c.text3 }]}>
            SplitMate automatically syncs roommate expenses in real time.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBadgeText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIconBox: {
    width: 80,
    height: 80,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroIconInner: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCurrency: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  featuresPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
  },
  featurePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
  },
  featurePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeading: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  cardSubheading: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  errBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  recentAccountCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  recentAccountHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  recentAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  accountName: {
    fontSize: 14,
    fontWeight: '700',
  },
  accountEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  recentSignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  recentSignText: {
    fontSize: 12,
    fontWeight: '700',
  },
  googleButton: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  securityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  optionToggleBtn: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  instantFormBox: {
    width: '100%',
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  formHintText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  emailFormBox: {
    width: '100%',
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabSwitch: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  submitBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footerTerms: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
  },
});
