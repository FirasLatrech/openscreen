import { useEffect, useRef, useState } from 'react';
import styles from './AudioLevelMeter.module.css';

interface AudioLevelMeterProps {
  deviceId: string | null;
  isActive: boolean;
}

export function AudioLevelMeter({ deviceId, isActive }: AudioLevelMeterProps) {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!deviceId || !isActive) {
      setAudioLevel(0);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let mounted = true;

    const startMonitoring = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } }
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        const audioContext = new AudioContext({ sampleRate: 44100 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          if (!mounted || !analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);

          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const normalizedLevel = Math.min(average / 128, 1);

          setAudioLevel(normalizedLevel);

          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (error) {
        console.error('[AudioLevelMeter] Failed to access microphone:', error);
        setAudioLevel(0);
      }
    };

    startMonitoring();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [deviceId, isActive]);

  const bars = 5;
  const barHeight = Math.max(2, audioLevel * 8);

  return (
    <div className={styles.meter}>
      {Array.from({ length: bars }).map((_, i) => {
        const barIndex = i + 1;
        const threshold = barIndex / bars;
        const isActive = audioLevel >= threshold;
        const height = isActive ? Math.max(2, (audioLevel - (barIndex - 1) / bars) * bars * 2) : 2;

        return (
          <div
            key={i}
            className={`${styles.bar} ${isActive ? styles.active : ''}`}
            style={{
              height: `${height}px`,
              opacity: isActive ? 0.8 + (audioLevel * 0.2) : 0.3,
            }}
          />
        );
      })}
    </div>
  );
}
