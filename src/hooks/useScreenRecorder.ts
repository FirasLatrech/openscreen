import { useState, useRef, useEffect } from "react";
import { fixWebmDuration } from "@fix-webm-duration/fix";

type UseScreenRecorderReturn = {
  recording: boolean;
  toggleRecording: () => void;
};

export function useScreenRecorder(): UseScreenRecorderReturn {
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef<number>(0);

  // Target visually lossless 4K @ 60fps; fall back gracefully when hardware cannot keep up
  const TARGET_FRAME_RATE = 60;
  const TARGET_WIDTH = 3840;
  const TARGET_HEIGHT = 2160;
  const FOUR_K_PIXELS = TARGET_WIDTH * TARGET_HEIGHT;
  const selectMimeType = () => {
    const preferred = [
      "video/webm;codecs=av1",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];

    return preferred.find(type => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
  };

  const computeBitrate = (width: number, height: number) => {
    const pixels = width * height;
    const highFrameRateBoost = TARGET_FRAME_RATE >= 60 ? 1.7 : 1;

    if (pixels >= FOUR_K_PIXELS) {
      return Math.round(45_000_000 * highFrameRateBoost);
    }

    if (pixels >= 2560 * 1440) {
      return Math.round(28_000_000 * highFrameRateBoost);
    }

    return Math.round(18_000_000 * highFrameRateBoost);
  };

  const stopRecording = useRef(() => {
    if (mediaRecorder.current?.state === "recording") {
      if (stream.current) {
        stream.current.getTracks().forEach(track => {
          track.stop();
          stream.current?.removeTrack(track);
        });
      }
      mediaRecorder.current.stop();
      setRecording(false);

      window.electronAPI?.setRecordingState(false);
    }
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    if (window.electronAPI?.onStopRecordingFromTray) {
      cleanup = window.electronAPI.onStopRecordingFromTray(() => {
        stopRecording.current();
      });
    }

    return () => {
      if (cleanup) cleanup();
      
      if (mediaRecorder.current?.state === "recording") {
        mediaRecorder.current.stop();
      }
      if (stream.current) {
        const tracks = stream.current.getTracks();
        tracks.forEach(track => {
          track.stop();
          stream.current?.removeTrack(track);
        });
        stream.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (stream.current) {
        console.warn('[useScreenRecorder] Cleaning up existing stream before starting new recording');
        const tracks = stream.current.getTracks();
        tracks.forEach(track => {
          track.stop();
          stream.current?.removeTrack(track);
        });
        stream.current = null;
      }
      
      if (mediaRecorder.current) {
        if (mediaRecorder.current.state !== 'inactive') {
          mediaRecorder.current.stop();
        }
        mediaRecorder.current = null;
      }
      
      const selectedSource = await window.electronAPI.getSelectedSource();
      if (!selectedSource) {
        alert("Please select a source to record");
        return;
      }

      console.log('[useScreenRecorder] Starting recording with source:', {
        id: selectedSource.id,
        name: selectedSource.name,
        microphoneId: selectedSource.microphoneId
      });

      const mediaStream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: selectedSource.id,
            maxWidth: TARGET_WIDTH,
            maxHeight: TARGET_HEIGHT,
            maxFrameRate: TARGET_FRAME_RATE,
            minFrameRate: 30,
          },
        },
      });

      let audioTracksAdded = 0;
      const addedAudioTracks: MediaStreamTrack[] = [];
      
      if (selectedSource.microphoneId) {
        try {
          const platform = await window.electronAPI?.getPlatform();
          
          if (platform === 'darwin') {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          const audioConstraints: MediaTrackConstraints = {
            deviceId: { exact: selectedSource.microphoneId },
          };
          
          if (platform === 'darwin' || platform === 'linux') {
            try {
              audioConstraints.echoCancellation = true;
              audioConstraints.noiseSuppression = true;
              audioConstraints.autoGainControl = true;
            } catch (e) {
              console.warn('[useScreenRecorder] Some audio constraints not supported, continuing without them');
            }
          }
          
          let audioStream: MediaStream | null = null;
          let retries = 0;
          const maxRetries = 3;
          
          while (retries < maxRetries && !audioStream) {
            try {
              audioStream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints
              });
              break;
            } catch (constraintError: any) {
              retries++;
              if (retries >= maxRetries) {
                console.warn('[useScreenRecorder] Failed with constraints, trying without advanced constraints:', constraintError);
                try {
                  audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { exact: selectedSource.microphoneId } }
                  });
                  break;
                } catch (fallbackError) {
                  console.error('[useScreenRecorder] Failed to get audio stream after retries:', fallbackError);
                  throw fallbackError;
                }
              } else {
                console.warn(`[useScreenRecorder] Audio access failed, retrying (${retries}/${maxRetries})...`, constraintError);
                await new Promise(resolve => setTimeout(resolve, 200 * retries));
              }
            }
          }
          
          if (!audioStream) {
            throw new Error('Failed to get audio stream after retries');
          }
          
          const audioTracks = audioStream.getAudioTracks();
          if (audioTracks.length > 0) {
            for (const track of audioTracks) {
              if (track.readyState === 'live') {
                if (!mediaStream.getAudioTracks().includes(track)) {
                  mediaStream.addTrack(track);
                  audioTracksAdded++;
                  addedAudioTracks.push(track);
                }
                
                track.onended = () => {
                  console.warn('[useScreenRecorder] Audio track ended unexpectedly');
                };
                
                track.onmute = () => {
                  console.warn('[useScreenRecorder] Audio track muted');
                };
              } else {
                console.warn('[useScreenRecorder] Audio track not ready, waiting...', track.readyState);
                
                await new Promise<void>((resolve) => {
                  let timeoutId: NodeJS.Timeout;
                  const checkReady = () => {
                    if (track.readyState === 'live') {
                      if (!mediaStream.getAudioTracks().includes(track)) {
                        mediaStream.addTrack(track);
                        audioTracksAdded++;
                        addedAudioTracks.push(track);
                      }
                      
                      track.onended = () => {
                        console.warn('[useScreenRecorder] Audio track ended unexpectedly');
                      };
                      
                      track.onmute = () => {
                        console.warn('[useScreenRecorder] Audio track muted');
                      };
                      if (timeoutId) clearTimeout(timeoutId);
                      resolve();
                    } else if (track.readyState === 'ended') {
                      console.error('[useScreenRecorder] Audio track ended before it could be added');
                      if (timeoutId) clearTimeout(timeoutId);
                      resolve();
                    } else {
                      setTimeout(checkReady, 50);
                    }
                  };
                  timeoutId = setTimeout(() => {
                    console.warn('[useScreenRecorder] Timeout waiting for audio track to become ready');
                    resolve();
                  }, 3000);
                  checkReady();
                });
              }
            }
            
            if (audioTracksAdded > 0) {
              console.log(`[useScreenRecorder] Added ${audioTracksAdded} audio track(s) to stream`);
              
              await new Promise(resolve => setTimeout(resolve, 200));
              
              const verifiedTracks = mediaStream.getAudioTracks().filter((t: MediaStreamTrack) => 
                t.readyState === 'live' && t.enabled && !t.muted
              );
              
              if (verifiedTracks.length !== audioTracksAdded) {
                console.warn(`[useScreenRecorder] Track count mismatch: added ${audioTracksAdded}, verified ${verifiedTracks.length}`);
              }
            } else {
              console.warn('[useScreenRecorder] No live audio tracks available');
            }
          } else {
            console.warn('[useScreenRecorder] No audio tracks found in audio stream');
          }
        } catch (audioError) {
          console.error('Failed to capture microphone audio:', audioError);
        }
      }

      stream.current = mediaStream;
      if (!stream.current) {
        throw new Error("Media stream is not available.");
      }
      
      const audioTracks = stream.current.getAudioTracks();
      const videoTracks = stream.current.getVideoTracks();
      
      if (audioTracks.length > 0) {
        console.log(`[useScreenRecorder] Stream has ${audioTracks.length} audio track(s) before validation`);
        
        for (const track of audioTracks) {
          if (!track.enabled) {
            console.warn('[useScreenRecorder] Audio track is disabled, enabling...');
            track.enabled = true;
          }
          
          if (track.muted) {
            console.warn('[useScreenRecorder] Audio track is muted - this may affect recording');
          }
        }
        
        const liveAudioTracks = audioTracks.filter(track => 
          track.readyState === 'live' && track.enabled && !track.muted
        );
        
        if (liveAudioTracks.length === 0) {
          console.warn('[useScreenRecorder] No live audio tracks - waiting for tracks to become ready...');
          
          await Promise.race([
            Promise.all(audioTracks.map(track => {
              return new Promise<void>((resolve) => {
                if (track.readyState === 'live' && track.enabled && !track.muted) {
                  resolve();
                  return;
                }
                
                const maxWait = 3000;
                const startTime = Date.now();
                
                const checkReady = () => {
                  if (track.readyState === 'live' && track.enabled && !track.muted) {
                    resolve();
                  } else if (Date.now() - startTime > maxWait) {
                    console.warn(`[useScreenRecorder] Timeout waiting for track ${track.label} to become ready`);
                    resolve();
                  } else {
                    if (!track.enabled) track.enabled = true;
                    setTimeout(checkReady, 50);
                  }
                };
                checkReady();
              });
            })),
            new Promise<void>((resolve) => setTimeout(() => resolve(), 3000))
          ]);
        }
        
        const finalLiveTracks = stream.current.getAudioTracks().filter(track => 
          track.readyState === 'live' && track.enabled && !track.muted
        );
        
        console.log(`[useScreenRecorder] Final audio track count: ${finalLiveTracks.length} live tracks`);
        finalLiveTracks.forEach(track => {
          console.log(`[useScreenRecorder] Final track state: ${track.label}, enabled: ${track.enabled}, readyState: ${track.readyState}, muted: ${track.muted}`);
        });
        
        if (finalLiveTracks.length === 0 && audioTracks.length > 0) {
          console.error('[useScreenRecorder] WARNING: Audio tracks exist but none are live/enabled/unmuted!');
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      if (videoTracks.length === 0) {
        throw new Error("No video tracks available in stream.");
      }
      
      const videoTrack = videoTracks[0];
      try {
        await videoTrack.applyConstraints({
          frameRate: { ideal: TARGET_FRAME_RATE, max: TARGET_FRAME_RATE },
          width: { ideal: TARGET_WIDTH, max: TARGET_WIDTH },
          height: { ideal: TARGET_HEIGHT, max: TARGET_HEIGHT },
        });
      } catch (error) {
        console.warn("Unable to lock 4K/60fps constraints, using best available track settings.", error);
      }

      let { width = 1920, height = 1080, frameRate = TARGET_FRAME_RATE } = videoTrack.getSettings();
      
      // Ensure dimensions are divisible by 2 for VP9/AV1 codec compatibility
      width = Math.floor(width / 2) * 2;
      height = Math.floor(height / 2) * 2;
      
      const videoBitsPerSecond = computeBitrate(width, height);
      const mimeType = selectMimeType();
      
      const finalAudioTracks = stream.current.getAudioTracks();
      const hasAudio = finalAudioTracks.length > 0 && finalAudioTracks.some(track => 
        track.readyState === 'live' && track.enabled && !track.muted
      );
      
      if (hasAudio) {
        const liveTracks = finalAudioTracks.filter(track => 
          track.readyState === 'live' && track.enabled && !track.muted
        );
        console.log(`[useScreenRecorder] Creating MediaRecorder with ${liveTracks.length} live audio track(s)`);
      }

      if (hasAudio) {
        const audioSupported = MediaRecorder.isTypeSupported(mimeType);
        if (!audioSupported) {
          console.warn(`[useScreenRecorder] MIME type ${mimeType} may not support audio`);
        }
      }

      console.log(
        `Recording at ${width}x${height} @ ${frameRate ?? TARGET_FRAME_RATE}fps using ${mimeType} / ${Math.round(
          videoBitsPerSecond / 1_000_000
        )} Mbps${hasAudio ? ' (with audio)' : ' (no audio)'}`
      );
      
      chunks.current = [];
      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond,
      };
      
      if (hasAudio) {
        recorderOptions.audioBitsPerSecond = 128_000;
        
        const audioTracksInfo = finalAudioTracks.map(t => ({
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        }));
        console.log('[useScreenRecorder] Audio tracks state before recording:', audioTracksInfo);
      }
      
      const streamForRecorder = stream.current;
      const audioTracksBeforeRecorder = streamForRecorder.getAudioTracks();
      const liveAudioBeforeRecorder = audioTracksBeforeRecorder.filter(track => 
        track.readyState === 'live' && track.enabled && !track.muted
      );
      
      if (hasAudio && liveAudioBeforeRecorder.length === 0) {
        console.error('[useScreenRecorder] ERROR: hasAudio is true but no live tracks found!');
        console.error('[useScreenRecorder] All audio tracks:', audioTracksBeforeRecorder.map(t => ({
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        })));
      }
      
      const recorder = new MediaRecorder(streamForRecorder, recorderOptions);
      
      if (hasAudio) {
        recorder.addEventListener('start', () => {
          const tracksAfterStart = streamForRecorder.getAudioTracks();
          const liveTracksAfterStart = tracksAfterStart.filter(track => 
            track.readyState === 'live' && track.enabled && !track.muted
          );
          
          console.log(`[useScreenRecorder] MediaRecorder started with ${tracksAfterStart.length} total audio track(s), ${liveTracksAfterStart.length} live`);
          tracksAfterStart.forEach(track => {
            console.log(`[useScreenRecorder] Track after start: ${track.label}, enabled: ${track.enabled}, readyState: ${track.readyState}, muted: ${track.muted}`);
          });
          
          const videoTracks = streamForRecorder.getVideoTracks();
          console.log(`[useScreenRecorder] MediaRecorder started with ${videoTracks.length} video track(s)`);
          
          if (liveTracksAfterStart.length === 0 && tracksAfterStart.length > 0) {
            console.error('[useScreenRecorder] WARNING: Audio tracks exist but none are live after MediaRecorder start!');
          }
        });
        
        recorder.addEventListener('error', (e) => {
          console.error('[useScreenRecorder] MediaRecorder error:', e);
        });
      }
      mediaRecorder.current = recorder;
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          chunks.current.push(e.data);
          if (hasAudio) {
            console.log(`[useScreenRecorder] Received data chunk: ${e.data.size} bytes, type: ${e.data.type}`);
          }
        }
      };
      recorder.onstop = async () => {
        const finalAudioTracks = stream.current?.getAudioTracks() || [];
        console.log(`[useScreenRecorder] Recording stopped. Final audio tracks: ${finalAudioTracks.length}`);
        console.log(`[useScreenRecorder] Total chunks: ${chunks.current.length}, total size: ${chunks.current.reduce((sum, chunk) => sum + chunk.size, 0)} bytes`);
        
        stream.current = null;
        if (chunks.current.length === 0) return;
        const duration = Date.now() - startTime.current;
        const recordedChunks = chunks.current;
        const buggyBlob = new Blob(recordedChunks, { type: mimeType });
        // Clear chunks early to free memory immediately after blob creation
        chunks.current = [];
        const timestamp = Date.now();
        const videoFileName = `recording-${timestamp}.webm`;

        try {
          const videoBlob = await fixWebmDuration(buggyBlob, duration);
          const arrayBuffer = await videoBlob.arrayBuffer();
          const videoResult = await window.electronAPI.storeRecordedVideo(arrayBuffer, videoFileName);
          if (!videoResult.success) {
            console.error('Failed to store video:', videoResult.message);
            return;
          }

          if (videoResult.path) {
            await window.electronAPI.setCurrentVideoPath(videoResult.path);
          }

          await window.electronAPI.switchToEditor();
        } catch (error) {
          console.error('Error saving recording:', error);
        }
      };
      recorder.onerror = () => setRecording(false);
      recorder.start(1000);
      startTime.current = Date.now();
      setRecording(true);
      window.electronAPI?.setRecordingState(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecording(false);
      if (stream.current) {
        const tracks = stream.current.getTracks();
        tracks.forEach(track => {
          track.stop();
          stream.current?.removeTrack(track);
        });
        stream.current = null;
      }
    }
  };

  const toggleRecording = () => {
    recording ? stopRecording.current() : startRecording();
  };

  return { recording, toggleRecording };
}
