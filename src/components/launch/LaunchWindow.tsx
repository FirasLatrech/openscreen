import { useState, useEffect, useRef } from "react";
import styles from "./LaunchWindow.module.css";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { Button } from "../ui/button";
import { FiX, FiCheck, FiChevronDown } from "react-icons/fi";
import { 
  MdMonitor, 
  MdWindow, 
  MdMic,
  MdMicOff,
  MdVideocam,
  MdVideocamOff,
  MdVolumeOff,
  MdFolder
} from "react-icons/md";

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string | null;
  display_id: string;
  appIcon: string | null;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface VideoDevice {
  deviceId: string;
  label: string;
}

type SourceType = "display" | "window";

export function LaunchWindow() {
  const { recording, toggleRecording } = useScreenRecorder();
  const [recordingStart, setRecordingStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  
  const [sourceType, setSourceType] = useState<SourceType>("display");
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null);
  const [hoveredSource, setHoveredSource] = useState<DesktopSource | null>(null);
  
  const [microphones, setMicrophones] = useState<AudioDevice[]>([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("none");
  const [showMicDropdown, setShowMicDropdown] = useState(false);
  const [micDropdownStyle, setMicDropdownStyle] = useState<React.CSSProperties>({});
  
  const [cameras, setCameras] = useState<VideoDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("none");
  const [showCameraDropdown, setShowCameraDropdown] = useState(false);
  const [cameraDropdownStyle, setCameraDropdownStyle] = useState<React.CSSProperties>({});
  
  const micDropdownRef = useRef<HTMLDivElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const cameraDropdownRef = useRef<HTMLDivElement>(null);
  const cameraButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (recording) {
      if (!recordingStart) setRecordingStart(Date.now());
      timer = setInterval(() => {
        if (recordingStart) {
          setElapsed(Math.floor((Date.now() - recordingStart) / 1000));
        }
      }, 1000);
    } else {
      setRecordingStart(null);
      setElapsed(0);
      if (timer) clearInterval(timer);
      window.electronAPI?.closeCameraBubble();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recording, recordingStart]);

  useEffect(() => {
    async function fetchSources() {
      try {
        const rawSources = await window.electronAPI.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 320, height: 180 },
          fetchWindowIcons: true
        });
        const mappedSources = rawSources.map((source: any) => ({
          id: source.id,
          name: source.id.startsWith('window:') && source.name.includes(' — ')
            ? source.name.split(' — ')[1] || source.name
            : source.name,
          thumbnail: source.thumbnail,
          display_id: source.display_id,
          appIcon: source.appIcon
        }));
        setSources(mappedSources);
        
        const screens = mappedSources.filter((s: DesktopSource) => s.id.startsWith('screen:'));
        if (screens.length > 0 && !selectedSource) {
          setSelectedSource(screens[0]);
          await window.electronAPI.selectSource({
            ...screens[0],
            microphoneId: null,
            cameraId: null
          });
        }
      } catch (error) {
        console.error('Error loading sources:', error);
      }
    }
    fetchSources();
  }, []);

  useEffect(() => {
    async function fetchDevices() {
      try {
        const tempAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
        if (tempAudioStream) {
          tempAudioStream.getTracks().forEach(track => track.stop());
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`
          }));
        setMicrophones(audioInputs);

        const videoInputs = devices
          .filter(device => device.kind === 'videoinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId.slice(0, 5)}`
          }));
        setCameras(videoInputs);
      } catch (error) {
        console.error('Error loading devices:', error);
      }
    }
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedCamera !== "none" && selectedSource) {
      window.electronAPI?.closeCameraBubble();
      setTimeout(() => {
        window.electronAPI?.openCameraBubble(selectedCamera, selectedSource.display_id);
      }, 50);
    } else {
      window.electronAPI?.closeCameraBubble();
    }
  }, [selectedCamera, selectedSource]);

  useEffect(() => {
    return () => {
      window.electronAPI?.closeCameraBubble();
    };
  }, []);

  const calculateDropdownStyle = (buttonRef: React.RefObject<HTMLButtonElement | null>): React.CSSProperties => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 280;
    const left = rect.left + rect.width / 2 - dropdownWidth / 2;
    
    return {
      left: Math.max(8, left),
      top: rect.bottom + 8,
      width: dropdownWidth,
    };
  };

  const handleMicDropdownToggle = () => {
    if (!showMicDropdown) {
      setMicDropdownStyle(calculateDropdownStyle(micButtonRef));
    }
    setShowMicDropdown(!showMicDropdown);
    setShowCameraDropdown(false);
  };

  const handleCameraDropdownToggle = () => {
    if (!showCameraDropdown) {
      setCameraDropdownStyle(calculateDropdownStyle(cameraButtonRef));
    }
    setShowCameraDropdown(!showCameraDropdown);
    setShowMicDropdown(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (micDropdownRef.current && !micDropdownRef.current.contains(event.target as Node)) {
        setShowMicDropdown(false);
      }
      if (cameraDropdownRef.current && !cameraDropdownRef.current.contains(event.target as Node)) {
        setShowCameraDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const screenSources = sources.filter(s => s.id.startsWith('screen:'));
  const windowSources = sources.filter(s => s.id.startsWith('window:'));

  const currentSources = sourceType === "display" ? screenSources : windowSources;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSourceSelect = async (source: DesktopSource) => {
    setSelectedSource(source);
    await window.electronAPI.selectSource({
      ...source,
      microphoneId: selectedMicrophone === "none" ? null : selectedMicrophone,
      cameraId: selectedCamera === "none" ? null : selectedCamera
    });
  };

  const handleStartRecording = async () => {
    if (!selectedSource && currentSources.length > 0) {
      await handleSourceSelect(currentSources[0]);
    }
    toggleRecording();
  };

  const closeApp = () => {
    window.electronAPI?.closeCameraBubble();
    if (window.electronAPI?.hudOverlayClose) {
      window.electronAPI.hudOverlayClose();
    }
  };

  const truncateLabel = (label: string, maxLen: number) => {
    return label.length > maxLen ? label.slice(0, maxLen) + "…" : label;
  };

  const selectedMicLabel = microphones.find(m => m.deviceId === selectedMicrophone)?.label || "No mic";
  const selectedCameraLabel = cameras.find(c => c.deviceId === selectedCamera)?.label || "No camera";

  const sourceTypeButtons: { type: SourceType; icon: typeof MdMonitor; label: string }[] = [
    { type: "display", icon: MdMonitor, label: "Display" },
    { type: "window", icon: MdWindow, label: "Window" },
  ];

  const isSourceSelected = (sourceId: string) => selectedSource?.id === sourceId;

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <Button
          variant="ghost"
          size="icon"
          className={styles.closeButton}
          onClick={closeApp}
        >
          <FiX size={12} />
        </Button>

        <div className={styles.separator} />

        <div className={styles.sourceTypes}>
          {sourceTypeButtons.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              className={`${styles.sourceTypeBtn} ${sourceType === type ? styles.active : ''}`}
              onClick={() => setSourceType(type)}
              disabled={recording}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className={styles.separator} />

        <div className={styles.dropdownContainer} ref={cameraDropdownRef}>
          <button 
            ref={cameraButtonRef}
            className={`${styles.mediaBtn} ${selectedCamera !== "none" ? styles.active : ''}`}
            onClick={handleCameraDropdownToggle}
            disabled={recording}
          >
            {selectedCamera === "none" ? <MdVideocamOff size={14} /> : <MdVideocam size={14} />}
            <span className={styles.mediaLabel}>
              {selectedCamera === "none" ? "No camera" : truncateLabel(selectedCameraLabel, 10)}
            </span>
            <FiChevronDown size={10} />
          </button>
          
          {showCameraDropdown && (
            <div className={styles.dropdown} style={cameraDropdownStyle}>
              <button
                className={`${styles.dropdownItem} ${selectedCamera === "none" ? styles.selected : ''}`}
                onClick={() => {
                  setSelectedCamera("none");
                  setShowCameraDropdown(false);
                }}
              >
                <MdVideocamOff size={14} />
                <span>No camera</span>
                {selectedCamera === "none" && <FiCheck size={14} />}
              </button>
              {cameras.map(cam => (
                <button
                  key={cam.deviceId}
                  className={`${styles.dropdownItem} ${selectedCamera === cam.deviceId ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedCamera(cam.deviceId);
                    setShowCameraDropdown(false);
                  }}
                >
                  <MdVideocam size={14} />
                  <span>{cam.label}</span>
                  {selectedCamera === cam.deviceId && <FiCheck size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.separator} />

        <div className={styles.dropdownContainer} ref={micDropdownRef}>
          <button 
            ref={micButtonRef}
            className={`${styles.mediaBtn} ${selectedMicrophone !== "none" ? styles.active : ''}`}
            onClick={handleMicDropdownToggle}
            disabled={recording}
          >
            {selectedMicrophone === "none" ? <MdMicOff size={14} /> : <MdMic size={14} />}
            <span className={styles.mediaLabel}>
              {selectedMicrophone === "none" ? "No mic" : truncateLabel(selectedMicLabel, 10)}
            </span>
            <FiChevronDown size={10} />
          </button>
          
          {showMicDropdown && (
            <div className={styles.dropdown} style={micDropdownStyle}>
              <button
                className={`${styles.dropdownItem} ${selectedMicrophone === "none" ? styles.selected : ''}`}
                onClick={() => {
                  setSelectedMicrophone("none");
                  setShowMicDropdown(false);
                }}
              >
                <MdMicOff size={14} />
                <span>No microphone</span>
                {selectedMicrophone === "none" && <FiCheck size={14} />}
              </button>
              {microphones.map(mic => (
                <button
                  key={mic.deviceId}
                  className={`${styles.dropdownItem} ${selectedMicrophone === mic.deviceId ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedMicrophone(mic.deviceId);
                    setShowMicDropdown(false);
                  }}
                >
                  <MdMic size={14} />
                  <span>{mic.label}</span>
                  {selectedMicrophone === mic.deviceId && <FiCheck size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.separator} />

        <button className={styles.mediaBtn} disabled>
          <MdVolumeOff size={14} />
          <span className={styles.mediaLabel}>No system audio</span>
        </button>

        <div className={styles.separator} />

        <button className={styles.settingsBtn} onClick={() => window.electronAPI?.openRecordingsFolder()}>
          <MdFolder size={14} />
        </button>

        <button 
          className={`${styles.recordBtn} ${recording ? styles.recording : ''}`}
          onClick={handleStartRecording}
        >
          {recording ? (
            <>
              <div className={styles.recordingDot} />
              <span>{formatTime(elapsed)}</span>
            </>
          ) : (
            <>
              <span>Start recording</span>
              <FiCheck size={12} />
            </>
          )}
        </button>
      </div>

      {!recording && (
        <div className={styles.sourceGrid}>
          {currentSources.map(source => (
            <div
              key={source.id}
              className={`${styles.sourceCard} ${isSourceSelected(source.id) ? styles.selected : ''} ${hoveredSource?.id === source.id ? styles.hovered : ''}`}
              onClick={() => handleSourceSelect(source)}
              onMouseEnter={() => setHoveredSource(source)}
              onMouseLeave={() => setHoveredSource(null)}
            >
              <div className={styles.thumbnailContainer}>
                <img
                  src={source.thumbnail || ''}
                  alt={source.name}
                  className={styles.thumbnail}
                />
              </div>
              <div className={styles.sourceInfo}>
                {source.appIcon && sourceType === "window" && (
                  <img src={source.appIcon} alt="" className={styles.appIcon} />
                )}
                <span className={styles.sourceName}>{source.name}</span>
              </div>
              {isSourceSelected(source.id) && (
                <div className={styles.checkmark}>
                  <FiCheck size={10} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
