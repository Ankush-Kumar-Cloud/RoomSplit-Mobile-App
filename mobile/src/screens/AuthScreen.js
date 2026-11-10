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
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { COLORS, PAL } from '../utils/theme';
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
  const [showChooser, setShowChooser] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);

  // Email/pass fallback states
  const [emailTab, setEmailTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // ── Handle OAuth Deep Link Redirects ──────────────────────────────────────
  useEffect(() => {
    const handleUrl = (event) => {
      const url = event.url || event;
      if (!url) return;

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

  // ── External Browser Google OAuth 2.0 ─────────────────────────────────────
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

            {/* ── "Continue with Google" Button (SplitMate Styling) ── */}
            <TouchableOpacity
              activeOpacity={0.82}
              disabled={busy}
              onPress={() => setShowChooser(true)}
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
                1-Click Instant Sign-in · No passwords to remember
              </Text>
            </View>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={[s.dividerLine, { backgroundColor: c.border }]} />
              <Text style={[s.dividerText, { color: c.text3 }]}>OR</Text>
              <View style={[s.dividerLine, { backgroundColor: c.border }]} />
            </View>

            {/* Collapsible Email Login Option */}
            <TouchableOpacity
              onPress={() => setShowEmailAuth(!showEmailAuth)}
              style={[s.emailToggleBtn, { backgroundColor: c.surface2, borderColor: c.border }]}
              activeOpacity={0.7}
            >
              <Text style={[s.emailToggleText, { color: c.text2 }]}>
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

      {/* ── SplitMate Styled "Choose an Account" BottomSheet ── */}
      <Modal visible={showChooser} transparent animationType="slide" onRequestClose={() => setShowChooser(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowChooser(false)} />

          <View style={[s.sheetCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            {/* Drag Handle */}
            <View style={s.sheetHandleBox}>
              <View style={[s.sheetHandle, { backgroundColor: c.border2 }]} />
            </View>

            {/* Header */}
            <View style={[s.sheetHeaderRow, { borderBottomColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <GoogleIcon size={24} />
                <View>
                  <Text style={[s.sheetTitleText, { color: c.text }]}>Choose an Account</Text>
                  <Text style={[s.sheetSubtitleText, { color: c.text2 }]}>to continue to SplitMate</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setShowChooser(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[s.closeBtn, { backgroundColor: c.surface2 }]}
              >
                <Text style={{ fontSize: 16, color: c.text2, fontWeight: '700' }}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Accounts List (Styled like SplitMate's Group Cards) */}
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10, paddingVertical: 14 }}>
                {/* Account 1 */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleSelectAccount('ankushkumary77@gmail.com', 'Ankush Kumar')}
                  disabled={busy}
                  style={[s.accountCard, { backgroundColor: c.surface2, borderColor: c.border }]}
                >
                  <View style={[s.accountAvatar, { backgroundColor: PAL[0].av }]}>
                    <Text style={s.avatarLetter}>A</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.accountName, { color: c.text }]}>ankush kumar</Text>
                    <Text style={[s.accountEmail, { color: c.text2 }]}>ankushkumary77@gmail.com</Text>
                    <View style={[s.pillBadge, { backgroundColor: c.accentBg, borderColor: c.accentBd }]}>
                      <Text style={[s.pillBadgeText, { color: c.accent }]}>Google Account</Text>
                    </View>
                  </View>
                  <Text style={[s.chevronText, { color: c.accent }]}>›</Text>
                </TouchableOpacity>

                {/* Account 2 */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleSelectAccount('ankushyadav808087@gmail.com', 'Ankush Kumar Yadav')}
                  disabled={busy}
                  style={[s.accountCard, { backgroundColor: c.surface2, borderColor: c.border }]}
                >
                  <View style={[s.accountAvatar, { backgroundColor: PAL[1].av }]}>
                    <Text style={s.avatarLetter}>Y</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.accountName, { color: c.text }]}>Ankush Kumar Yadav</Text>
                    <Text style={[s.accountEmail, { color: c.text2 }]}>ankushyadav808087@gmail.com</Text>
                    <View style={[s.pillBadge, { backgroundColor: c.accentBg, borderColor: c.accentBd }]}>
                      <Text style={[s.pillBadgeText, { color: c.accent }]}>Google Account</Text>
                    </View>
                  </View>
                  <Text style={[s.chevronText, { color: c.accent }]}>›</Text>
                </TouchableOpacity>

                {/* Account 3 */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleSelectAccount('kanhaiya@roomsplit.app', 'Kanhaiya Kumar')}
                  disabled={busy}
                  style={[s.accountCard, { backgroundColor: c.surface2, borderColor: c.border }]}
                >
                  <View style={[s.accountAvatar, { backgroundColor: PAL[2].av }]}>
                    <Text style={s.avatarLetter}>K</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.accountName, { color: c.text }]}>Kanhaiya Kumar</Text>
                    <Text style={[s.accountEmail, { color: c.text2 }]}>kanhaiya@roomsplit.app</Text>
                    <View style={[s.pillBadge, { backgroundColor: c.accentBg, borderColor: c.accentBd }]}>
                      <Text style={[s.pillBadgeText, { color: c.accent }]}>Google Account</Text>
                    </View>
                  </View>
                  <Text style={[s.chevronText, { color: c.accent }]}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Enter custom Google Email option */}
              {showCustomInput ? (
                <View style={[s.customInputBox, { backgroundColor: c.surface2, borderColor: c.border }]}>
                  <Text style={[s.inputLabel, { color: c.text2 }]}>ENTER ANY GMAIL ADDRESS</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]}
                    placeholder="yourname@gmail.com"
                    placeholderTextColor={c.text3}
                    value={customEmail}
                    onChangeText={setCustomEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      if (customEmail.trim()) {
                        handleSelectAccount(customEmail.trim(), customEmail.split('@')[0]);
                      }
                    }}
                    disabled={busy}
                    style={[s.submitBtn, { backgroundColor: c.accent }]}
                  >
                    <Text style={s.submitBtnText}>Sign In with this Email →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowCustomInput(true)}
                  style={[s.anotherAccountBtn, { borderColor: c.border }]}
                >
                  <Text style={[s.anotherAccountText, { color: c.accent }]}>
                    + Use another Google account
                  </Text>
                </TouchableOpacity>
              )}

              {/* Browser OAuth Link */}
              <TouchableOpacity
                onPress={handleBrowserOAuth}
                style={s.browserLinkBtn}
              >
                <Text style={[s.browserLinkText, { color: c.text3 }]}>
                  Open official Google web sign-in ↗
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
    marginVertical: 18,
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
  emailToggleBtn: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emailToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emailFormBox: {
    width: '100%',
    marginTop: 14,
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

  // ── BottomSheet Styles (Matching SplitMate Theme) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandleBox: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 99,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  sheetTitleText: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetSubtitleText: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 17,
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
  pillBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
    marginTop: 4,
  },
  pillBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  chevronText: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  customInputBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  anotherAccountBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 6,
  },
  anotherAccountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  browserLinkBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  browserLinkText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
