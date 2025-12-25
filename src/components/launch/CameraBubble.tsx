import { useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import styles from "./CameraBubble.module.css";

const DEFAULT_SIZE = 180;

export function CameraBubble() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const windowPos = useRef({ x: 0, y: 0 });

  const params = new URLSearchParams(window.location.search);
  const deviceId = params.get('deviceId') || '';

  const size = DEFAULT_SIZE;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      if (!deviceId) return;
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } }
        });
        currentStream = mediaStream;
        setStream(mediaStream);
      } catch (error) {
        console.error("Failed to start camera:", error);
      }
    }

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [deviceId]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.screenX, y: e.screenY };
    windowPos.current = { x: window.screenX, y: window.screenY };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.screenX - dragStart.current.x;
      const deltaY = e.screenY - dragStart.current.y;
      const newX = windowPos.current.x + deltaX;
      const newY = windowPos.current.y + deltaY;
      window.electronAPI?.moveCameraBubble(newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.electronAPI?.closeCameraBubble();
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isDragging ? styles.dragging : ''} ${isVisible ? styles.visible : ''}`}
      style={{ width: size, height: size }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={styles.video}
      />
      <div className={styles.border} />
      <button 
        className={`${styles.closeBtn} ${isHovered ? styles.visible : ''}`}
        onClick={handleClose}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <FiX size={10} />
      </button>
    </div>
  );
}

