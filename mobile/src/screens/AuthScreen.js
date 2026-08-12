import React, { useState } from 'react';
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
  const { theme, setTheme, login, signup } = useApp();

  const c = COLORS[theme];

  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setErr('');
  };

  const submit = async () => {
    setBusy(true);
    setErr('');

    try {
      if (tab === 'login') {
        if (!email.trim() || !pass) {
          throw new Error('Email and password required');
        }

        await login(
          email.trim().toLowerCase(),
          pass
        );
      } else {
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

  /* ================= ERROR ================= */

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