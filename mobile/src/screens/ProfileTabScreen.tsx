import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { colors, radii, spacing } from '../theme';

export function ProfileTabScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeProfile, data } = useAppState();
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <Text style={styles.eyebrow}>YOUR FLIXORA</Text><Text style={styles.title}>Profile</Text>
    <View style={styles.card}><View style={styles.avatar}><Text style={styles.avatarText}>{activeProfile.name[0]}</Text></View><View style={styles.copy}><Text style={styles.name}>{activeProfile.name}</Text><Text style={styles.meta}>{activeProfile.isKids ? 'Kids profile' : 'Adult profile'} · {data.watchlist.length} in My List</Text></View></View>
    <Pressable onPress={() => navigation.navigate('ProfileSelection')} style={styles.row}><Ionicons name="people-outline" size={22} color={colors.cyan}/><View style={styles.rowCopy}><Text style={styles.rowTitle}>Switch profile</Text><Text style={styles.meta}>Choose who is watching</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>
    <View style={styles.row}><Ionicons name="settings-outline" size={22} color={colors.purple}/><View style={styles.rowCopy}><Text style={styles.rowTitle}>App settings</Text><Text style={styles.meta}>Playback, downloads and notifications</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></View>
    <View style={styles.row}><Ionicons name="shield-checkmark-outline" size={22} color={colors.gold}/><View style={styles.rowCopy}><Text style={styles.rowTitle}>Privacy & security</Text><Text style={styles.meta}>Devices, PIN and account controls</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></View>
    <Text style={styles.attribution}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  eyebrow: { color: colors.cyan, fontSize: 10, letterSpacing: 1.8, fontWeight: '900', marginTop: spacing.md },
  title: { color: colors.text, fontSize: 36, fontWeight: '900', marginTop: spacing.xs },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg, marginVertical: spacing.xl },
  avatar: { width: 68, height: 68, borderRadius: 20, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontSize: 28, fontWeight: '900' },
  copy: { marginLeft: spacing.md, flex: 1 },
  name: { color: colors.text, fontSize: 21, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  attribution: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: spacing.xl },
});
