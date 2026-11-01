import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Downloads: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  MovieDetails: { mediaId: string };
  VideoPlayer: { mediaId: string; sourceId?: string; episodeId?: string; offline?: boolean };
  ProfileSelection: undefined;
};
