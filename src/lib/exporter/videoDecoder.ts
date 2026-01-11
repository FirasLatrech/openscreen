export interface DecodedVideoInfo {
  width: number;
  height: number;
  duration: number; // in seconds
  frameRate: number;
  codec: string;
  hasAudio: boolean;
}

export class VideoFileDecoder {
  private info: DecodedVideoInfo | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private audioStream: MediaStream | null = null;

  async loadVideo(videoUrl: string): Promise<DecodedVideoInfo> {
    this.videoElement = document.createElement('video');
    this.videoElement.src = videoUrl;
    this.videoElement.preload = 'metadata';
    this.videoElement.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      this.videoElement!.addEventListener('loadedmetadata', () => {
        const video = this.videoElement!;
        
        let hasAudio = false;
        try {
          const stream = (video as any).captureStream();
          hasAudio = stream.getAudioTracks().length > 0;
          if (hasAudio) {
            this.audioStream = stream;
          }
        } catch (e) {
          console.warn('[VideoFileDecoder] Could not check for audio:', e);
        }
        
        this.info = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          frameRate: 60,
          codec: 'avc1.640033',
          hasAudio,
        };

        resolve(this.info);
      });

      this.videoElement!.addEventListener('error', (e) => {
        reject(new Error(`Failed to load video: ${e}`));
      });
    });
  }

  getAudioStream(): MediaStream | null {
    if (!this.videoElement) {
      return null;
    }
    
    try {
      const stream = (this.videoElement as any).captureStream();
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioStream = new MediaStream();
        audioTracks.forEach((track: MediaStreamTrack) => audioStream.addTrack(track));
        return audioStream;
      }
    } catch (e) {
      console.warn('[VideoFileDecoder] Failed to get audio stream:', e);
    }
    
    return null;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  getInfo(): DecodedVideoInfo | null {
    return this.info;
  }

  destroy(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement = null;
    }
  }
}
