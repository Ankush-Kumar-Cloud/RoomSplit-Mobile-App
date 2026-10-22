import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as Updates from 'expo-updates';

export default function UpdatePrompt({ theme = 'light' }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [visible, setVisible] = useState(false);

  const isDark = theme === 'dark';

  const checkUpdates = useCallback(async () => {
    // In local dev / Expo Go, checkForUpdateAsync will throw or is unsupported
    if (__DEV__) return;

    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        setUpdateAvailable(true);
        setVisible(true);
      }
    } catch (e) {
      // Gracefully ignore network timeout / offline errors
      console.log('Update check error (ignored):', e?.message || e);
    }
  }, []);

  useEffect(() => {
    // Check shortly after app starts
    const timer = setTimeout(() => {
      checkUpdates();
    }, 1500);

    return () => clearTimeout(timer);
  }, [checkUpdates]);

  const handleUpdate = async () => {
    try {
      setDownloading(true);
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      alert('Failed to download update. Please check your internet connection.');
      setDownloading(false);
      setVisible(false);
    }
  };

  if (!visible || !updateAvailable) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {
        if (!downloading) setVisible(false);
      }}
    >
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? '#2C2C2E' : '#E5E7EB' }]}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 28 }}>🚀</Text>
          </View>

          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            New Update Available!
          </Text>

          <Text style={[styles.message, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
            A fresh update for SplitMate is ready with improvements and bug fixes. Update now for the best experience.
          </Text>

          {downloading ? (
            <View style={styles.downloadingContainer}>
              <ActivityIndicator size="small" color="#1AAD7D" />
              <Text style={[styles.downloadingText, { color: isDark ? '#1FD396' : '#1AAD7D' }]}>
                Downloading & restarting app…
              </Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={[styles.btnSecondary, { borderColor: isDark ? '#3A3A3C' : '#D1D5DB' }]}
              >
                <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: '600', fontSize: 14 }}>
                  Later
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleUpdate}
                style={styles.btnPrimary}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                  Update Now
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(26, 173, 125, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
  },
  downloadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  downloadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    flex: 1.5,
    backgroundColor: '#1AAD7D',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
