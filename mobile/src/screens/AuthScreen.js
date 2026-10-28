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
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useApp } from '../context/AppContext';
import { COLORS } from '../utils/theme';

export default function AuthScreen() {
  const { theme, setTheme, login, signup, forgotPassword, loginWithOtp, resetPassword } = useApp();

  const c = COLORS[theme];

  const [tab, setTab] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // ── Forgot Password & OTP States ──────────────────────────────────────────
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = enter otp & action
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showResetPassForm, setShowResetPassForm] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const reset = () => {
    setErr('');
    setMsg('');
  };

  const submit = async () => {
    setBusy(true);
    setErr('');
    setMsg('');

    try {
      if (tab === 'login') {
        if (!email.trim() || !pass) {
          throw new Error('Email and password required');
        }

        await login(
          email.trim().toLowerCase(),
          pass
        );
      } else if (tab === 'signup') {
        if (!name.trim()) {
          throw new Error('Name is required');
        }

        if (!email.trim()) {
          throw new Error('Email is required');
        }

        if (pass.length < 6) {
          throw new Error(
            'Password must be at least 6 characters'
          );
        }

        await signup(
          name.trim(),
          email.trim().toLowerCase(),
          pass
        );
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ── Forgot Password: Send OTP to Email ────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim()) {
      setErr('Please enter your email address');
      return;
    }

    setBusy(true);
    setErr('');
    setMsg('');

    try {
      await forgotPassword(email.trim().toLowerCase());
      setForgotStep(2);
      setResendTimer(45);
      setMsg(`We sent a 6-digit OTP code to ${email.trim()}`);
    } catch (e) {
      setErr(e.message || 'Could not send verification code');
    } finally {
      setBusy(false);
    }
  };

  // ── Forgot Password: Login directly with OTP ─────────────────────────────
  const handleLoginWithOtp = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setErr('Please enter the 6-digit verification code');
      return;
    }

    setBusy(true);
    setErr('');

    try {
      await loginWithOtp(email.trim().toLowerCase(), otp.trim());
    } catch (e) {
      setErr(e.message || 'Invalid or expired verification code');
    } finally {
      setBusy(false);
    }
  };

  // ── Forgot Password: Update Password & Login ─────────────────────────────
  const handleResetPassword = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setErr('Please enter the 6-digit verification code');
      return;
    }
    if (!newPass || newPass.length < 6) {
      setErr('New password must be at least 6 characters');
      return;
    }
    if (newPass !== confirmPass) {
      setErr('Passwords do not match');
      return;
    }

    setBusy(true);
    setErr('');

    try {
      await resetPassword(email.trim().toLowerCase(), otp.trim(), newPass);
    } catch (e) {
      setErr(e.message || 'Failed to update password');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: c.surface2,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: c.text,
    marginBottom: 12,
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: c.bg,
        },
      ]}
    >
      {/* Status Bar */}
      <StatusBar
        style={theme === 'dark' ? 'light' : 'dark'}
      />

      {/* Theme Toggle */}
      <View style={styles.themeRow}>
        <Text
          style={[
            styles.themeIcon,
            {
              color: c.text,
            },
          ]}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </Text>

        <Switch
          value={theme === 'dark'}
          onValueChange={(value) =>
            setTheme(value ? 'dark' : 'light')
          }
          trackColor={{
            false: c.border2,
            true: c.accent,
          }}
          thumbColor="#fff"
        />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ================= BRAND SECTION ================= */}
          <View style={styles.brandSection}>

            {/* Logo */}
            <View
              style={[
                styles.logo,
                {
                  backgroundColor: c.accent,
                },
              ]}
            >
              <Text style={styles.logoText}>₹</Text>
            </View>

            {/* App Name */}
            <Text
              style={[
                styles.appName,
                {
                  color: c.text,
                },
              ]}
            >
              SplitMate
            </Text>

            {/* Tagline */}
            <Text
              style={[
                styles.tagline,
                {
                  color: c.text2,
                },
              ]}
            >
              Smart expense sharing for roommates
            </Text>

            {/* Developer Name */}
            <Text
              style={[
                styles.developerText,
                {
                  color: c.text3,
                },
              ]}
            >
              Developed by Mr. Ankush
            </Text>

            {/* Version */}
            <Text
              style={[
                styles.versionText,
                {
                  color: c.text3,
                },
              ]}
            >
              Version 1.0.0
            </Text>

            {/* Copyright */}
            <Text
              style={[
                styles.copyrightText,
                {
                  color: c.text3,
                },
              ]}
            >
              © 2026 Mr. Ankush. All Rights Reserved.
            </Text>
          </View>

          {/* ================= AUTH CARD ================= */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
              },
            ]}
          >

            {/* ── FORGOT PASSWORD / OTP VIEW ── */}
            {tab === 'forgot' ? (
              <View>
                {/* Header with Back button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setTab('login');
                      reset();
                    }}
                    style={{ paddingRight: 12, paddingVertical: 4 }}
                  >
                    <Text style={{ color: c.accent, fontSize: 16, fontWeight: '700' }}>← Back</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, flex: 1, textAlign: 'center', marginRight: 36 }}>
                    {forgotStep === 1 ? 'Forgot Password' : 'Email Verification'}
                  </Text>
                </View>

                {/* Info message */}
                {msg ? (
                  <View style={[styles.msgBox, { backgroundColor: c.accentBg || '#E8F5E9', borderColor: c.accentBd || '#81C784' }]}>
                    <Text style={{ color: c.accent, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{msg}</Text>
                  </View>
                ) : null}

                {/* Error message */}
                {err ? (
                  <View style={[styles.errBox, { backgroundColor: c.dangerBg, borderColor: c.dangerBd }]}>
                    <Text style={[styles.errorText, { color: c.danger }]}>{err}</Text>
                  </View>
                ) : null}

                {/* Step 1: Request OTP */}
                {forgotStep === 1 ? (
                  <>
                    <Text style={{ fontSize: 13, color: c.text2, marginBottom: 14, lineHeight: 18 }}>
                      Enter your account email. We will send a 6-digit OTP code to verify your identity and let you log in or reset your password.
                    </Text>

                    <TextInput
                      style={inputStyle}
                      placeholder="Your account email *"
                      placeholderTextColor={c.text3}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSendOtp}
                    />

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleSendOtp}
                      disabled={busy}
                      style={[
                        styles.submitBtn,
                        {
                          backgroundColor: c.accent,
                          opacity: busy ? 0.7 : 1,
                          marginTop: 6,
                        },
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitText}>Send OTP Code ✉️</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  /* Step 2: Verify OTP & Login or Reset */
                  <>
                    <Text style={{ fontSize: 13, color: c.text2, marginBottom: 12 }}>
                      Enter the 6-digit OTP sent to <Text style={{ fontWeight: '700', color: c.text }}>{email}</Text>:
                    </Text>

                    <TextInput
                      style={[
                        inputStyle,
                        {
                          textAlign: 'center',
                          letterSpacing: 8,
                          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                          fontSize: 24,
                          fontWeight: '700',
                          marginBottom: 14,
                        },
                      ]}
                      placeholder="------"
                      placeholderTextColor={c.text3}
                      value={otp}
                      onChangeText={(v) => {
                        setOtp(v.replace(/[^0-9]/g, '').slice(0, 6));
                        setErr('');
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      returnKeyType="done"
                    />

                    {/* Mode Selector: Quick OTP Login vs Set New Password */}
                    <View
                      style={[
                        styles.tabRow,
                        {
                          backgroundColor: c.surface2,
                          marginBottom: 14,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setShowResetPassForm(false);
                          setErr('');
                        }}
                        style={[
                          styles.tabBtn,
                          {
                            backgroundColor: !showResetPassForm ? c.accent : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            {
                              color: !showResetPassForm ? '#fff' : c.text2,
                              fontSize: 12,
                            },
                          ]}
                        >
                          ⚡ Login with OTP
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setShowResetPassForm(true);
                          setErr('');
                        }}
                        style={[
                          styles.tabBtn,
                          {
                            backgroundColor: showResetPassForm ? c.accent : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            {
                              color: showResetPassForm ? '#fff' : c.text2,
                              fontSize: 12,
                            },
                          ]}
                        >
                          🔑 Set New Password
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* If Set New Password is chosen */}
                    {showResetPassForm && (
                      <View style={{ marginBottom: 4 }}>
                        <TextInput
                          style={inputStyle}
                          placeholder="New password (min 6 chars) *"
                          placeholderTextColor={c.text3}
                          value={newPass}
                          onChangeText={setNewPass}
                          secureTextEntry
                          autoCapitalize="none"
                          returnKeyType="next"
                        />
                        <TextInput
                          style={inputStyle}
                          placeholder="Confirm new password *"
                          placeholderTextColor={c.text3}
                          value={confirmPass}
                          onChangeText={setConfirmPass}
                          secureTextEntry
                          autoCapitalize="none"
                          returnKeyType="done"
                          onSubmitEditing={handleResetPassword}
                        />
                      </View>
                    )}

                    {/* Submit Button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={showResetPassForm ? handleResetPassword : handleLoginWithOtp}
                      disabled={busy}
                      style={[
                        styles.submitBtn,
                        {
                          backgroundColor: c.accent,
                          opacity: busy ? 0.7 : 1,
                        },
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitText}>
                          {showResetPassForm
                            ? 'Update Password & Login →'
                            : 'Login with OTP →'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Footer Options: Resend OTP and Change Email */}
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 16,
                      }}
                    >
                      <TouchableOpacity
                        onPress={resendTimer === 0 ? handleSendOtp : undefined}
                        disabled={resendTimer > 0 || busy}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: resendTimer > 0 ? c.text3 : c.accent,
                            fontWeight: '600',
                          }}
                        >
                          {resendTimer > 0
                            ? `Resend OTP in ${resendTimer}s`
                            : 'Resend Code'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setForgotStep(1);
                          setErr('');
                          setMsg('');
                        }}
                      >
                        <Text style={{ fontSize: 13, color: c.text2 }}>
                          Change Email
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ) : (
              /* ── STANDARD LOGIN / SIGNUP VIEW ── */
              <View>
                {/* Login / Signup Tabs */}
                <View
                  style={[
                    styles.tabRow,
                    {
                      backgroundColor: c.surface2,
                    },
                  ]}
                >
                  {[
                    ['login', 'Login'],
                    ['signup', 'Sign Up'],
                  ].map(([t, label]) => (
                    <TouchableOpacity
                      key={t}
                      activeOpacity={0.8}
                      onPress={() => {
                        setTab(t);
                        reset();
                      }}
                      style={[
                        styles.tabBtn,
                        {
                          backgroundColor:
                            tab === t
                              ? c.accent
                              : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          {
                            color:
                              tab === t
                                ? '#fff'
                                : c.text2,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Full Name - Signup Only */}
                {tab === 'signup' && (
                  <TextInput
                    style={inputStyle}
                    placeholder="Full name *"
                    placeholderTextColor={c.text3}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                )}

                {/* Email */}
                <TextInput
                  style={inputStyle}
                  placeholder="Email *"
                  placeholderTextColor={c.text3}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />

                {/* Password */}
                <TextInput
                  style={[
                    inputStyle,
                    {
                      marginBottom: 0,
                    },
                  ]}
                  placeholder="Password *"
                  placeholderTextColor={c.text3}
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />

                {/* Forgot Password Link on Login tab */}
                {tab === 'login' && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      marginTop: 10,
                      marginBottom: 4,
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setTab('forgot');
                        setForgotStep(1);
                        setErr('');
                        setMsg('');
                      }}
                    >
                      <Text
                        style={{
                          color: c.accent,
                          fontSize: 13,
                          fontWeight: '600',
                        }}
                      >
                        Forgot password? / Login with OTP
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Error Message */}
                {err ? (
                  <View
                    style={[
                      styles.errBox,
                      {
                        backgroundColor: c.dangerBg,
                        borderColor: c.dangerBd,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.errorText,
                        {
                          color: c.danger,
                        },
                      ]}
                    >
                      {err}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.errorPlaceholder} />
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={submit}
                  disabled={busy}
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: c.accent,
                      opacity: busy ? 0.7 : 1,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>
                      {tab === 'login'
                        ? 'Login →'
                        : 'Create Account →'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Bottom Hint */}
                <Text
                  style={[
                    styles.bottomHint,
                    {
                      color: c.text3,
                    },
                  ]}
                >
                  Sign up · create group · share invite code
                </Text>
              </View>
            )}

          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text
              style={[
                styles.footerText,
                {
                  color: c.text3,
                },
              ]}
            >
              SplitMate • Version 1.0.0
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  /* ================= THEME ================= */

  themeRow: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },

  themeIcon: {
    fontSize: 14,
    marginRight: 6,
  },

  /* ================= BRAND ================= */

  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
  },

  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  logoText: {
    fontSize: 30,
    color: '#fff',
    fontWeight: '700',
  },

  appName: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 6,
  },

  tagline: {
    fontSize: 14,
    textAlign: 'center',
  },

  developerText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 9,
    textAlign: 'center',
  },

  versionText: {
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },

  copyrightText: {
    fontSize: 10,
    marginTop: 3,
    textAlign: 'center',
  },

  /* ================= CARD ================= */

  card: {
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
  },

  /* ================= TABS ================= */

  tabRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },

  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },

  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* ================= MESSAGES & ERROR ================= */

  msgBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },

  errBox: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
  },

  errorText: {
    fontSize: 13,
  },

  errorPlaceholder: {
    height: 14,
  },

  /* ================= BUTTON ================= */

  submitBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 2,
  },

  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ================= HINT ================= */

  bottomHint: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 14,
  },

  /* ================= FOOTER ================= */

  footer: {
    alignItems: 'center',
    marginTop: 20,
  },

  footerText: {
    fontSize: 10,
  },
});
