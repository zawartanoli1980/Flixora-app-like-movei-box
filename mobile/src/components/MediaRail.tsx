import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';
import type { MediaItem } from '../types';
import { MediaCard } from './MediaCard';

type Props = {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  navigation: NativeStackNavigationProp<RootStackParamList>;
  ranked?: boolean;
  progressById?: Record<string, number>;
};

export function MediaRail({ title, subtitle, items, navigation, ranked = false, progressById }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(132, Math.min(168, width * 0.39));
  if (!items.length) return null;

  return <View style={styles.section} accessibilityRole="summary">
    <View style={styles.headingRow}><View><Text style={styles.heading}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View><Text style={styles.arrow}>›</Text></View>
    <FlatList
      horizontal
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => <MediaCard item={item} width={cardWidth} rank={ranked ? index + 1 : undefined} progress={progressById?.[item.id]} onPress={() => navigation.navigate('MovieDetails', { mediaId: item.id })}/>} 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      initialNumToRender={5}
      windowSize={5}
    />
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  headingRow: { paddingHorizontal: spacing.md, marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heading: { color: colors.text, fontSize: 20, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  arrow: { color: colors.purple, fontSize: 28, lineHeight: 28 },
  list: { paddingLeft: spacing.md, paddingRight: spacing.xs },
});
