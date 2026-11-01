import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';
import { MediaItem } from '../types';
import { MediaBadge } from './MediaBadge';

type Props = {
  item: MediaItem;
  onPress: () => void;
  width?: number;
  rank?: number;
  progress?: number;
};

export function MediaCard({ item, onPress, width = 156, rank, progress }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={onPress} style={({ pressed }) => [styles.card, { width, opacity: pressed ? 0.82 : 1 }]}>
      <ImageBackground source={{ uri: item.poster }} style={[styles.poster, { width, height: width * 1.43 }]} imageStyle={styles.posterImage}>
        <View style={styles.badges}><MediaBadge label={item.quality} tone="purple"/><MediaBadge label={`IMDb ${item.rating}`} tone="gold"/></View>
        {rank ? <Text style={styles.rank}>{rank}</Text> : null}
        {progress !== undefined ? <View style={styles.progressTrack}><View style={[styles.progress, { width: `${Math.max(2, Math.min(100, progress))}%` }]} /></View> : null}
      </ImageBackground>
      <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
      <View style={styles.meta}><Text style={styles.muted}>{item.year} · {item.kind}</Text><Text style={styles.rating}>★ {item.rating}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginRight: spacing.md },
  poster: { overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surfaceRaised, borderRadius: radii.md },
  posterImage: { borderRadius: radii.md },
  badges: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' },
  rank: { position: 'absolute', left: 8, bottom: 4, color: colors.text, fontSize: 58, lineHeight: 62, fontWeight: '900', textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 6 },
  progressTrack: { height: 4, backgroundColor: '#FFFFFF40' },
  progress: { height: 4, backgroundColor: colors.cyan },
  title: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: spacing.sm },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  muted: { color: colors.muted, fontSize: 11 },
  rating: { color: colors.gold, fontSize: 11 },
});
