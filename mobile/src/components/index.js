import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Animated, FlatList,
} from 'react-native';
import { COLORS, catOf, PAL, palOf } from '../utils/theme';

/* ────────────────────────────────────────────────
   HOOK: get theme colors
──────────────────────────────────────────────── */
export const useTheme = (theme) => COLORS[theme] || COLORS.light;

/* ────────────────────────────────────────────────
   SKELETON LOADER — Shimmer effect for loading states
   Why: Users tolerate waiting much better when they see a
   recognisable layout vs a blank spinner. This mimics the
   shape of real content (premium feel like Splitwise / Zomato).
──────────────────────────────────────────────── */
export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#D1D5DB', opacity },
        style,
      ]}
    />
  );
}

export function GroupCardSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, gap: 12, borderColor: '#E5E7EB', backgroundColor: '#fff' }}>
      <SkeletonBox width={44} height={44} borderRadius={13} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox width="60%" height={14} />
        <SkeletonBox width="40%" height={11} />
      </View>
    </View>
  );
}

export function ExpenseItemSkeleton() {
  return (
    <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="70%" height={14} />
          <SkeletonBox width="40%" height={10} />
        </View>
        <SkeletonBox width={50} height={20} borderRadius={6} />
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────────
   BUTTON
──────────────────────────────────────────────── */
export function Btn({ children, onPress, variant = 'primary', size = 'md', full, disabled, loading, style }) {
  const variants = {
    primary:   { bg: '#1AAD7D',     text: '#fff',     border: '#1AAD7D' },
    secondary: { bg: 'transparent', text: '#18181A',  border: '#CACAC3' },
    danger:    { bg: 'transparent', text: '#C53030',  border: '#F9A8A8' },
    ghost:     { bg: 'transparent', text: '#65656A',  border: 'transparent' },
    accent:    { bg: '#E0F7EE',     text: '#1AAD7D',  border: '#9FE1C8' },
  };

  const sizes = {
    sm: { py: 6,  px: 12, fs: 12 },
    md: { py: 11, px: 18, fs: 14 },
    lg: { py: 14, px: 22, fs: 15 },
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          paddingVertical: s.py, paddingHorizontal: s.px,
          borderRadius: 10, borderWidth: 1,
          backgroundColor: v.bg, borderColor: v.border,
          opacity: disabled || loading ? 0.5 : 1,
          width: full ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color={v.text} />
        : <Text style={{ fontSize: s.fs, fontWeight: '600', color: v.text }}>{children}</Text>
      }
    </TouchableOpacity>
  );
}

/* ────────────────────────────────────────────────
   INPUT
──────────────────────────────────────────────── */
export function Input({ label, theme = 'light', error, style, inputStyle, ...props }) {
  const c = COLORS[theme] || COLORS.light;
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={{ fontSize: 11, fontWeight: '700', color: c.text2, marginBottom: 6, letterSpacing: 0.5 }}>{label.toUpperCase()}</Text> : null}
      <TextInput
        {...props}
        placeholderTextColor={c.text3}
        style={[{
          backgroundColor: c.surface2, borderColor: error ? c.danger : c.border,
          borderWidth: 1, borderRadius: 10,
          paddingHorizontal: 14, paddingVertical: 12,
          fontSize: 15, color: c.text,
        }, inputStyle]}
      />
      {error ? <Text style={{ fontSize: 12, color: c.danger, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

/* ────────────────────────────────────────────────
   CARD
──────────────────────────────────────────────── */
export function Card({ children, theme = 'light', style }) {
  const c = COLORS[theme] || COLORS.light;
  return (
    <View style={[{
      backgroundColor: c.surface, borderColor: c.border,
      borderWidth: 1, borderRadius: 14,
      shadowColor: c.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1, shadowRadius: 4, elevation: 3,
    }, style]}>
      {children}
    </View>
  );
}

/* ────────────────────────────────────────────────
   AVATAR — wrapped in memo so it never re-renders unless name/col changes
──────────────────────────────────────────────── */
export const Avatar = memo(function Avatar({ name = '?', col, size = 34 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: col.av, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
});

/* ────────────────────────────────────────────────
   CATEGORY CHIP
──────────────────────────────────────────────── */
export const CatChip = memo(function CatChip({ cat }) {
  const c = catOf(cat);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 10 }}>{c.icon}</Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: c.color }}>{c.label}</Text>
    </View>
  );
});

/* ────────────────────────────────────────────────
   PROGRESS BAR
──────────────────────────────────────────────── */
export function ProgressBar({ value, max = 100, color, label, showPct, theme = 'light' }) {
  const c = COLORS[theme] || COLORS.light;
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  const barColor = color || (pct > 90 ? c.danger : pct > 70 ? c.warn : c.accent);
  return (
    <View>
      {label ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
          <Text style={{ fontSize: 12, color: c.text2 }}>{label}</Text>
          {showPct ? <Text style={{ fontSize: 12, fontWeight: '600', color: barColor }}>{Math.round(pct)}%</Text> : null}
        </View>
      ) : null}
      <View style={{ height: 6, backgroundColor: c.surface3, borderRadius: 99, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${pct}%`, backgroundColor: barColor, borderRadius: 99 }} />
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────────
   EMPTY STATE
──────────────────────────────────────────────── */
export function EmptyState({ icon, title, body, action, theme = 'light' }) {
  const c = COLORS[theme] || COLORS.light;
  return (
    <View style={{ alignItems: 'center', padding: 40 }}>
      <Text style={{ fontSize: 44, marginBottom: 14 }}>{icon}</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 8, textAlign: 'center' }}>{title}</Text>
      {body   ? <Text style={{ fontSize: 14, color: c.text2, textAlign: 'center', marginBottom: 20 }}>{body}</Text> : null}
      {action || null}
    </View>
  );
}

/* ────────────────────────────────────────────────
   LOADING VIEW — Shimmer skeleton instead of spinner
──────────────────────────────────────────────── */
export function LoadingView({ theme = 'light' }) {
  const c = COLORS[theme] || COLORS.light;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 16, paddingTop: 24 }}>
      {[1, 2, 3].map(i => <GroupCardSkeleton key={i} />)}
    </View>
  );
}

/* ────────────────────────────────────────────────
   BOTTOM SHEET MODAL
──────────────────────────────────────────────── */
export function BottomSheet({ visible, onClose, title, children, theme = 'light', tall }) {
  const c = COLORS[theme] || COLORS.light;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{
            backgroundColor: c.surface, borderColor: c.border,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            borderWidth: 1, borderBottomWidth: 0,
            maxHeight: tall ? '92%' : '80%',
          }}>
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, backgroundColor: c.border2, borderRadius: 99 }} />
            </View>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: c.border }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 24, color: c.text2, lineHeight: 24 }}>×</Text>
              </TouchableOpacity>
            </View>
            {/* Body */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'android' ? 36 : 24 }}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ────────────────────────────────────────────────
   MONTH NAVIGATOR
──────────────────────────────────────────────── */
export function MonthNav({ label, onPrev, onNext, theme = 'light' }) {
  const c = COLORS[theme] || COLORS.light;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TouchableOpacity onPress={onPrev} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}>
        <Text style={{ fontSize: 16, color: c.text }}>‹</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 12, color: c.text2, minWidth: 86, textAlign: 'center' }}>{label}</Text>
      <TouchableOpacity onPress={onNext} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}>
        <Text style={{ fontSize: 16, color: c.text }}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ────────────────────────────────────────────────
   EXPENSE FORM  (self-contained, used in a BottomSheet)
──────────────────────────────────────────────── */
const SPLIT_OPTS = [
  { v: 'equal',  l: 'Equal split' },
  { v: 'custom', l: 'Custom weights' },
  { v: 'payer',  l: 'Payer only' },
];

export function ExpenseForm({ initial, members = [], onSubmit, onCancel, theme = 'light' }) {
  const c = COLORS[theme] || COLORS.light;
  const { CATS } = require('../utils/theme');

  const [form, setForm] = useState(initial || {
    item: '', amount: '', date: new Date().toISOString().split('T')[0],
    note: '', category: 'food', recurring: false, splitType: 'equal', splitWeights: {},
  });
  const [busy, setBusy] = useState(false);

  const set = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), []);
  const isValid = form.item.trim() && form.amount && +form.amount > 0 && form.date;

  const handleSubmit = async () => {
    if (!isValid || busy) return;
    setBusy(true);
    try { await onSubmit(form); } catch { /* parent handles errors */ } finally { setBusy(false); }
  };

  return (
    <View>
      {/* Item */}
      <Input label="Item Name *" theme={theme} placeholder="e.g. Aata, Milk, Gas bill"
        value={form.item} onChangeText={v => set('item', v)} returnKeyType="next" />

      {/* Amount */}
      <Input label="Amount (₹) *" theme={theme} placeholder="0.00"
        value={form.amount} onChangeText={v => set('amount', v)}
        keyboardType="decimal-pad" returnKeyType="done" />

      {/* Category */}
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5 }}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CATS.map(cat => (
              <TouchableOpacity key={cat.id} onPress={() => set('category', cat.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, borderWidth: 1,
                  backgroundColor: form.category === cat.id ? cat.bg : 'transparent',
                  borderColor: form.category === cat.id ? cat.color : cat.border }}>
                <Text style={{ fontSize: 12 }}>{cat.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: form.category === cat.id ? '700' : '400', color: form.category === cat.id ? cat.color : c.text2 }}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Date */}
      <Input label="Date * (YYYY-MM-DD)" theme={theme} placeholder="2025-08-01"
        value={form.date} onChangeText={v => set('date', v)} keyboardType="numbers-and-punctuation" maxLength={10} />

      {/* Split type */}
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5 }}>SPLIT TYPE</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SPLIT_OPTS.map(opt => (
            <TouchableOpacity key={opt.v} onPress={() => set('splitType', opt.v)} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1,
                backgroundColor: form.splitType === opt.v ? c.accent : 'transparent',
                borderColor: form.splitType === opt.v ? c.accent : c.border2 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: form.splitType === opt.v ? '#fff' : c.text2 }}>{opt.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Custom weights */}
      {form.splitType === 'custom' && members.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5 }}>CUSTOM WEIGHTS</Text>
          {members.map((m, i) => {
            const mid = m._id || m.id;
            const col = PAL[i % PAL.length];
            return (
              <View key={mid} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border }}>
                <Avatar name={m.name} col={col} size={28} />
                <Text style={{ flex: 1, fontSize: 13, color: c.text }}>{m.name}</Text>
                <TextInput
                  style={{ width: 60, textAlign: 'center', borderWidth: 1, borderRadius: 8, borderColor: c.border, backgroundColor: c.surface2, color: c.text, paddingVertical: 7, fontSize: 14 }}
                  placeholder="1" placeholderTextColor={c.text3}
                  keyboardType="number-pad" maxLength={3}
                  value={String(form.splitWeights[mid] || '')}
                  onChangeText={v => set('splitWeights', { ...form.splitWeights, [mid]: v })}
                />
              </View>
            );
          })}
        </View>
      )}

      {/* Note */}
      <Input label="Note (optional)" theme={theme} placeholder="Any details…"
        value={form.note} onChangeText={v => set('note', v)} multiline numberOfLines={2} />

      {/* Recurring */}
      <TouchableOpacity onPress={() => set('recurring', !form.recurring)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 22,
          backgroundColor: form.recurring ? c.accentBg : c.surface2, borderColor: form.recurring ? c.accentBd : c.border }}>
        <View style={{ width: 38, height: 22, borderRadius: 99, backgroundColor: form.recurring ? c.accent : c.border2, justifyContent: 'center', paddingHorizontal: 2 }}>
          <View style={{ width: 18, height: 18, borderRadius: 99, backgroundColor: '#fff', alignSelf: form.recurring ? 'flex-end' : 'flex-start' }} />
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Recurring monthly</Text>
          <Text style={{ fontSize: 11, color: c.text2, marginTop: 1 }}>Mark as a fixed monthly expense</Text>
        </View>
      </TouchableOpacity>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn variant="secondary" onPress={onCancel} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onPress={handleSubmit} loading={busy} disabled={!isValid} style={{ flex: 2 }}>
          {initial ? 'Update Expense' : 'Add Expense'}
        </Btn>
      </View>
    </View>
  );
}
