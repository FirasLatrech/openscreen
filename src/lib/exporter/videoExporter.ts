import type { ExportConfig, ExportProgress, ExportResult } from './types';
import { VideoFileDecoder } from './videoDecoder';
import { FrameRenderer } from './frameRenderer';
import { VideoMuxer } from './muxer';
import type { ZoomRegion, CropRegion, TrimRegion, AnnotationRegion } from '@/components/video-editor/types';

interface VideoExporterConfig extends ExportConfig {
  videoUrl: string;
  wallpaper: string;
  zoomRegions: ZoomRegion[];
  trimRegions?: TrimRegion[];
  showShadow: boolean;
  shadowIntensity: number;
  showBlur: boolean;
  motionBlurEnabled?: boolean;
  borderRadius?: number;
  padding?: number;
  videoPadding?: number;
  cropRegion: CropRegion;
  annotationRegions?: AnnotationRegion[];
  previewWidth?: number;
  previewHeight?: number;
  onProgress?: (progress: ExportProgress) => void;
}

export class VideoExporter {
  private config: VideoExporterConfig;
  private decoder: VideoFileDecoder | null = null;
  private renderer: FrameRenderer | null = null;
  private encoder: VideoEncoder | null = null;
  private audioEncoder: AudioEncoder | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private muxer: VideoMuxer | null = null;
  private cancelled = false;
  private encodeQueue = 0;
  // Increased queue size for better throughput with hardware encoding
  private readonly MAX_ENCODE_QUEUE = 120;
  private videoDescription: Uint8Array | undefined;
  private videoColorSpace: VideoColorSpaceInit | undefined;
  // Track muxing promises for parallel processing
  private muxingPromises: Promise<void>[] = [];
  private chunkCount = 0;
  private audioChunkCount = 0;

  constructor(config: VideoExporterConfig) {
    this.config = config;
  }

  // Calculate the total duration excluding trim regions (in seconds)
  private getEffectiveDuration(totalDuration: number): number {
    const trimRegions = this.config.trimRegions || [];
    const totalTrimDuration = trimRegions.reduce((sum, region) => {
      return sum + (region.endMs - region.startMs) / 1000;
    }, 0);
    return totalDuration - totalTrimDuration;
  }

  private mapEffectiveToSourceTime(effectiveTimeMs: number): number {
    const trimRegions = this.config.trimRegions || [];
    // Sort trim regions by start time
    const sortedTrims = [...trimRegions].sort((a, b) => a.startMs - b.startMs);

    let sourceTimeMs = effectiveTimeMs;

    for (const trim of sortedTrims) {
      // If the source time hasn't reached this trim region yet, we're done
      if (sourceTimeMs < trim.startMs) {
        break;
      }

      // Add the duration of this trim region to the source time
      const trimDuration = trim.endMs - trim.startMs;
      sourceTimeMs += trimDuration;
    }

    return sourceTimeMs;
  }

  async export(): Promise<ExportResult> {
    try {
      this.cleanup();
      this.cancelled = false;

      // Initialize decoder and load video
      this.decoder = new VideoFileDecoder();
      const videoInfo = await this.decoder.loadVideo(this.config.videoUrl);

      // Initialize frame renderer
      this.renderer = new FrameRenderer({
        width: this.config.width,
        height: this.config.height,
        wallpaper: this.config.wallpaper,
        zoomRegions: this.config.zoomRegions,
        showShadow: this.config.showShadow,
        shadowIntensity: this.config.shadowIntensity,
        showBlur: this.config.showBlur,
        motionBlurEnabled: this.config.motionBlurEnabled,
        borderRadius: this.config.borderRadius,
        padding: this.config.padding,
        cropRegion: this.config.cropRegion,
        videoWidth: videoInfo.width,
        videoHeight: videoInfo.height,
        annotationRegions: this.config.annotationRegions,
        previewWidth: this.config.previewWidth,
        previewHeight: this.config.previewHeight,
      });
      await this.renderer.initialize();

      // Initialize video encoder
      await this.initializeEncoder();

      // Initialize audio encoder if source has audio
      const hasAudio = videoInfo.hasAudio;
      if (hasAudio) {
        await this.initializeAudioEncoder();
      }

      // Initialize muxer
      this.muxer = new VideoMuxer(this.config, hasAudio);
      await this.muxer.initialize();

      // Get the video element for frame extraction
      const videoElement = this.decoder.getVideoElement();
      if (!videoElement) {
        throw new Error('Video element not available');
      }

      // Extract audio first if available (separate pass)
      if (hasAudio && this.audioEncoder && this.audioContext) {
        console.log('[VideoExporter] Extracting audio...');
        await this.extractAudio(videoElement, videoInfo.duration);
        console.log('[VideoExporter] Audio extraction complete');
      }

      // Calculate effective duration and frame count (excluding trim regions)
      const effectiveDuration = this.getEffectiveDuration(videoInfo.duration);
      const totalFrames = Math.ceil(effectiveDuration * this.config.frameRate);
      
      console.log('[VideoExporter] Original duration:', videoInfo.duration, 's');
      console.log('[VideoExporter] Effective duration:', effectiveDuration, 's');
      console.log('[VideoExporter] Total frames to export:', totalFrames);

      // Process frames continuously without batching delays
      const frameDuration = 1_000_000 / this.config.frameRate; // in microseconds
      let frameIndex = 0;
      const timeStep = 1 / this.config.frameRate;

      while (frameIndex < totalFrames && !this.cancelled) {
        const i = frameIndex;
        const timestamp = i * frameDuration;

        // Map effective time to source time (accounting for trim regions)
        const effectiveTimeMs = (i * timeStep) * 1000;
        const sourceTimeMs = this.mapEffectiveToSourceTime(effectiveTimeMs);
        const videoTime = sourceTimeMs / 1000;
          
        // Seek if needed or wait for first frame to be ready
        const needsSeek = Math.abs(videoElement.currentTime - videoTime) > 0.001;

        if (needsSeek) {
          // Attach listener BEFORE setting currentTime to avoid race condition
          const seekedPromise = new Promise<void>(resolve => {
            videoElement.addEventListener('seeked', () => resolve(), { once: true });
          });
          
          videoElement.currentTime = videoTime;
          await seekedPromise;
        } else if (i === 0) {
          // Only for the very first frame, wait for it to be ready
          await new Promise<void>(resolve => {
            videoElement.requestVideoFrameCallback(() => resolve());
          });
        }

        // Create a VideoFrame from the video element (on GPU!)
        const videoFrame = new VideoFrame(videoElement, {
          timestamp,
        });

        // Render the frame with all effects using source timestamp
        const sourceTimestamp = sourceTimeMs * 1000; // Convert to microseconds
        await this.renderer!.renderFrame(videoFrame, sourceTimestamp);
        
        videoFrame.close();

        const canvas = this.renderer!.getCanvas();

        // Create VideoFrame from canvas on GPU without reading pixels
        // @ts-ignore - colorSpace not in TypeScript definitions but works at runtime
        const exportFrame = new VideoFrame(canvas, {
          timestamp,
          duration: frameDuration,
          colorSpace: {
            primaries: 'bt709',
            transfer: 'iec61966-2-1',
            matrix: 'rgb',
            fullRange: true,
          },
        });

        // Check encoder queue before encoding to keep it full
        while (this.encodeQueue >= this.MAX_ENCODE_QUEUE && !this.cancelled) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (this.encoder && this.encoder.state === 'configured') {
          this.encodeQueue++;
          this.encoder.encode(exportFrame, { keyFrame: i % 150 === 0 });
        } else {
          console.warn(`[Frame ${i}] Encoder not ready! State: ${this.encoder?.state}`);
        }

        exportFrame.close();

        frameIndex++;

        // Update progress
        if (this.config.onProgress) {
          this.config.onProgress({
            currentFrame: frameIndex,
            totalFrames,
            percentage: (frameIndex / totalFrames) * 100,
            estimatedTimeRemaining: 0,
          });
        }
      }

      if (this.cancelled) {
        return { success: false, error: 'Export cancelled' };
      }

      // Finalize encoding
      if (this.encoder && this.encoder.state === 'configured') {
        await this.encoder.flush();
      }

      if (this.audioEncoder && this.audioEncoder.state === 'configured') {
        await this.audioEncoder.flush();
      }

      // Wait for all muxing operations to complete
      await Promise.all(this.muxingPromises);

      // Finalize muxer and get output blob
      const blob = await this.muxer!.finalize();

      return { success: true, blob };
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.cleanup();
    }
  }

  private async initializeEncoder(): Promise<void> {
    this.encodeQueue = 0;
    this.muxingPromises = [];
    this.chunkCount = 0;
    let videoDescription: Uint8Array | undefined;

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        // Capture decoder config metadata from encoder output
        if (meta?.decoderConfig?.description && !videoDescription) {
          const desc = meta.decoderConfig.description;
          videoDescription = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as any));
          this.videoDescription = videoDescription;
        }
        // Capture colorSpace from encoder metadata if provided
        if (meta?.decoderConfig?.colorSpace && !this.videoColorSpace) {
          this.videoColorSpace = meta.decoderConfig.colorSpace;
        }

        // Stream chunk to muxer immediately (parallel processing)
        const isFirstChunk = this.chunkCount === 0;
        this.chunkCount++;

        const muxingPromise = (async () => {
          try {
            if (isFirstChunk && this.videoDescription) {
              // Add decoder config for the first chunk
              const colorSpace = this.videoColorSpace || {
                primaries: 'bt709',
                transfer: 'iec61966-2-1',
                matrix: 'rgb',
                fullRange: true,
              };

              const metadata: EncodedVideoChunkMetadata = {
                decoderConfig: {
                  codec: this.config.codec || 'avc1.640033',
                  codedWidth: this.config.width,
                  codedHeight: this.config.height,
                  description: this.videoDescription,
                  colorSpace,
                },
              };

              await this.muxer!.addVideoChunk(chunk, metadata);
            } else {
              await this.muxer!.addVideoChunk(chunk, meta);
            }
          } catch (error) {
            console.error('Muxing error:', error);
          }
        })();

        this.muxingPromises.push(muxingPromise);
        this.encodeQueue--;
      },
      error: (error) => {
        console.error('[VideoExporter] Encoder error:', error);
        // Stop export encoding failed
        this.cancelled = true;
      },
    });

    const codec = this.config.codec || 'avc1.640033';
    
    const encoderConfig: VideoEncoderConfig = {
      codec,
      width: this.config.width,
      height: this.config.height,
      bitrate: this.config.bitrate,
      framerate: this.config.frameRate,
      latencyMode: 'realtime',
      bitrateMode: 'variable',
      hardwareAcceleration: 'prefer-hardware',
    };

    // Check hardware support first
    const hardwareSupport = await VideoEncoder.isConfigSupported(encoderConfig);

    if (hardwareSupport.supported) {
      // Use hardware encoding
      console.log('[VideoExporter] Using hardware acceleration');
      this.encoder.configure(encoderConfig);
    } else {
      // Fall back to software encoding
      console.log('[VideoExporter] Hardware not supported, using software encoding');
      encoderConfig.hardwareAcceleration = 'prefer-software';
      
      const softwareSupport = await VideoEncoder.isConfigSupported(encoderConfig);
      if (!softwareSupport.supported) {
        throw new Error('Video encoding not supported on this system');
      }
      
      this.encoder.configure(encoderConfig);
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.cleanup();
  }

  private async extractAudio(videoElement: HTMLVideoElement, duration: number): Promise<void> {
    if (!this.audioEncoder || !this.audioContext || !this.audioSource) {
      return;
    }

    const trimRegions = this.config.trimRegions || [];
    if (trimRegions.length === 0) {
      return new Promise((resolve, reject) => {
        const effectiveDuration = this.getEffectiveDuration(duration);
        videoElement.currentTime = 0;
        videoElement.play().catch(reject);

        const timeout = setTimeout(() => {
          videoElement.pause();
          resolve();
        }, effectiveDuration * 1000);

        videoElement.addEventListener('ended', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
    }

    const sortedTrims = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
    let currentPos = 0;
    const processSegment = async (segmentStart: number, segmentEnd: number): Promise<void> => {
      if (segmentStart >= segmentEnd || this.cancelled) return;
      
      videoElement.currentTime = segmentStart / 1000;
      await new Promise<void>(resolve => {
        videoElement.addEventListener('seeked', () => resolve(), { once: true });
      });
      
      const duration = (segmentEnd - segmentStart) / 1000;
      videoElement.play().catch(() => {});
      
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          videoElement.pause();
          resolve();
        }, duration * 1000);
        
        const checkTime = () => {
          if (videoElement.currentTime * 1000 >= segmentEnd || this.cancelled) {
            clearTimeout(timeout);
            videoElement.pause();
            resolve();
          } else {
            requestAnimationFrame(checkTime);
          }
        };
        checkTime();
      });
    };

    for (const trim of sortedTrims) {
      if (currentPos < trim.startMs) {
        await processSegment(currentPos, trim.startMs);
      }
      currentPos = Math.max(currentPos, trim.endMs);
    }

    if (currentPos < duration * 1000) {
      await processSegment(currentPos, duration * 1000);
    }
  }

  private async initializeAudioEncoder(): Promise<void> {
    const audioStream = this.decoder?.getAudioStream();
    if (!audioStream) {
      console.warn('[VideoExporter] No audio stream available');
      return;
    }

    try {
      const audioContext = new AudioContext({ sampleRate: 48000 });
      const source = audioContext.createMediaStreamSource(audioStream);
      
      this.audioContext = audioContext;
      this.audioSource = source;

      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          const isFirstChunk = this.audioChunkCount === 0;
          this.audioChunkCount++;

          const muxingPromise = (async () => {
            try {
              if (isFirstChunk && meta?.decoderConfig) {
                const metadata: EncodedAudioChunkMetadata = {
                  decoderConfig: meta.decoderConfig,
                };
                await this.muxer!.addAudioChunk(chunk, metadata);
              } else {
                await this.muxer!.addAudioChunk(chunk, meta);
              }
            } catch (error) {
              console.error('[VideoExporter] Audio muxing error:', error);
            }
          })();

          this.muxingPromises.push(muxingPromise);
        },
        error: (error) => {
          console.error('[VideoExporter] Audio encoder error:', error);
        },
      });

      const audioConfig: AudioEncoderConfig = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128_000,
      };

      const support = await AudioEncoder.isConfigSupported(audioConfig);
      if (!support.supported) {
        console.warn('[VideoExporter] Opus audio codec not supported');
        return;
      }

      audioEncoder.configure(audioConfig);
      this.audioEncoder = audioEncoder;

      const bufferSize = 4096;
      const numberOfChannels = 2;
      const processor = audioContext.createScriptProcessor(bufferSize, numberOfChannels, numberOfChannels);
      
      processor.onaudioprocess = (e) => {
        if (!this.audioEncoder || this.audioEncoder.state !== 'configured' || this.cancelled) {
          return;
        }

        const inputData = e.inputBuffer;
        const length = inputData.length;
        const sampleRate = inputData.sampleRate;
        const channels = inputData.numberOfChannels;

        const audioData = new Float32Array(length * channels);
        for (let channel = 0; channel < channels; channel++) {
          const channelData = inputData.getChannelData(channel);
          for (let i = 0; i < length; i++) {
            audioData[i * channels + channel] = channelData[i];
          }
        }

        const audioFrame = new AudioData({
          format: 'f32-planar',
          sampleRate,
          numberOfFrames: length,
          numberOfChannels: channels,
          timestamp: Math.round(audioContext.currentTime * 1_000_000),
          data: audioData,
        });

        try {
          this.audioEncoder.encode(audioFrame);
        } catch (err) {
          console.error('[VideoExporter] Error encoding audio frame:', err);
        }
        audioFrame.close();
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      this.audioProcessor = processor;

      const videoElement = this.decoder?.getVideoElement();
      if (videoElement) {
        videoElement.play().catch(e => {
          console.warn('[VideoExporter] Failed to play video for audio extraction:', e);
        });
      }
    } catch (error) {
      console.error('[VideoExporter] Failed to initialize audio encoder:', error);
    }
  }

  private cleanup(): void {
    if (this.audioProcessor) {
      try {
        this.audioProcessor.disconnect();
      } catch (e) {
        console.warn('[VideoExporter] Error disconnecting audio processor:', e);
      }
      this.audioProcessor = null;
    }

    if (this.audioSource) {
      try {
        this.audioSource.disconnect();
      } catch (e) {
        console.warn('[VideoExporter] Error disconnecting audio source:', e);
      }
      this.audioSource = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(e => {
        console.warn('[VideoExporter] Error closing audio context:', e);
      });
      this.audioContext = null;
    }

    if (this.audioEncoder) {
      try {
        if (this.audioEncoder.state === 'configured') {
          this.audioEncoder.close();
        }
      } catch (e) {
        console.warn('[VideoExporter] Error closing audio encoder:', e);
      }
      this.audioEncoder = null;
    }

    if (this.encoder) {
      try {
        if (this.encoder.state === 'configured') {
          this.encoder.close();
        }
      } catch (e) {
        console.warn('Error closing encoder:', e);
      }
      this.encoder = null;
    }

    if (this.decoder) {
      try {
        this.decoder.destroy();
      } catch (e) {
        console.warn('Error destroying decoder:', e);
      }
      this.decoder = null;
    }

    if (this.renderer) {
      try {
        this.renderer.destroy();
      } catch (e) {
        console.warn('Error destroying renderer:', e);
      }
      this.renderer = null;
    }

    this.muxer = null;
    this.encodeQueue = 0;
    this.muxingPromises = [];
    this.chunkCount = 0;
    this.audioChunkCount = 0;
    this.videoDescription = undefined;
    this.videoColorSpace = undefined;
  }
}
