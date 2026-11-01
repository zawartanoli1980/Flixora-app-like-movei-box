import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSelection'>;

export function ProfilesScreen({ navigation }: Props) {
  const { activeProfile, profiles, switchProfile } = useAppState();
  const choose = (id: typeof activeProfile.id) => { switchProfile(id); navigation.goBack(); };
  return <SafeAreaView style={styles.screen}><View style={styles.header}><View><Text style={styles.eyebrow}>MULTI-PROFILE</Text><Text style={styles.title}>Who’s watching?</Text></View><Pressable accessibilityLabel="Close profile selection" onPress={() => navigation.goBack()} style={styles.close}><Ionicons name="close" size={24} color={colors.text}/></Pressable></View>{profiles.map((profile) => <Pressable accessibilityRole="button" key={profile.id} onPress={() => choose(profile.id)} style={[styles.profile, profile.id === activeProfile.id && styles.active]}><View style={styles.avatar}><Text style={styles.avatarText}>{profile.name[0]}</Text></View><View style={styles.copy}><Text style={styles.name}>{profile.name}</Text><Text style={styles.meta}>{profile.isKids ? 'Kids catalog · age 7 and under' : 'Adult profile · PIN-ready integration'}</Text></View><Text style={styles.check}>{profile.id === activeProfile.id ? '✓' : ''}</Text></Pressable>)}<Pressable style={styles.addProfile}><Ionicons name="add-circle-outline" size={22} color={colors.purple}/><Text style={styles.addText}>Add profile</Text></Pressable><Text style={styles.note}>Adult PIN verification must be performed by the authenticated backend. This UI never stores a PIN.</Text></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  eyebrow: { color: colors.cyan, fontSize: 10, letterSpacing: 1.8, fontWeight: '900' },
  title: { color: colors.text, fontSize: 34, fontWeight: '900', marginTop: spacing.xs },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  profile: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderColor: colors.border, borderWidth: 1, borderRadius: 14, marginBottom: spacing.md },
  active: { borderColor: colors.purple, backgroundColor: '#A487F511' },
  avatar: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purple },
  avatarText: { color: colors.background, fontSize: 22, fontWeight: '900' },
  copy: { flex: 1, marginLeft: spacing.md },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  check: { color: colors.cyan, fontSize: 20 },
  addProfile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 14, padding: spacing.md },
  addText: { color: colors.purple, fontWeight: '800' },
  note: { color: colors.muted, lineHeight: 19, marginTop: spacing.md },
});
