export type DownloadQuality = '480p' | '720p' | '1080p';
export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type ManagedDownload = {
  id: string;
  profileId: string;
  mediaId: string;
  episodeId?: string;
  sourceId: string;
  quality: DownloadQuality;
  remoteUri: string;
  localUri: string;
  status: DownloadStatus;
  progress: number;
  bytesWritten: number;
  totalBytes: number;
  resumeData?: string;
  checksum?: string;
  error?: string;
  updatedAt: number;
};

export type StartDownloadInput = {
  mediaId: string;
  episodeId?: string;
  sourceId: string;
  quality: DownloadQuality;
  remoteUri: string;
  protocol: 'HLS' | 'DASH' | 'MP4';
};
