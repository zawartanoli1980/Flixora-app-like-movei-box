import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../theme';

export function MediaBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'purple' | 'cyan' | 'gold' }) {
  return <View style={[styles.badge, styles[tone]]}><Text style={[styles.text, tone === 'gold' && styles.darkText]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  badge: { borderRadius: radii.sm, borderWidth: 1, borderColor: '#FFFFFF2B', backgroundColor: '#090909B8', paddingHorizontal: 7, paddingVertical: 4 },
  neutral: {},
  purple: { backgroundColor: '#8B5CF6CC', borderColor: colors.purple },
  cyan: { backgroundColor: '#06B6D4CC', borderColor: colors.cyan },
  gold: { backgroundColor: colors.gold, borderColor: colors.gold },
  text: { color: colors.text, fontSize: 10, lineHeight: 12, fontWeight: '900' },
  darkText: { color: colors.background },
});
