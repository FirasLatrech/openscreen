import { useState, useRef, useEffect } from "react";
import styles from "./AreaSelector.module.css";

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function AreaSelector() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsSelecting(true);
    setStartPoint({ x: e.clientX, y: e.clientY });
    setSelection({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting) return;

    const width = e.clientX - startPoint.x;
    const height = e.clientY - startPoint.y;

    setSelection({
      x: width >= 0 ? startPoint.x : e.clientX,
      y: height >= 0 ? startPoint.y : e.clientY,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = async () => {
    setIsSelecting(false);
    if (selection && selection.width > 50 && selection.height > 50) {
      await window.electronAPI.selectAreaRegion(selection);
    }
    window.close();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className={styles.instructions}>
        <span>Drag to select the area you want to record</span>
        <span className={styles.hint}>Press ESC to cancel</span>
      </div>

      {selection && selection.width > 0 && selection.height > 0 && (
        <>
          <div
            className={styles.overlay}
            style={{
              clipPath: `polygon(
                0 0,
                100% 0,
                100% 100%,
                0 100%,
                0 0,
                ${selection.x}px ${selection.y}px,
                ${selection.x}px ${selection.y + selection.height}px,
                ${selection.x + selection.width}px ${selection.y + selection.height}px,
                ${selection.x + selection.width}px ${selection.y}px,
                ${selection.x}px ${selection.y}px
              )`,
            }}
          />
          <div
            className={styles.selection}
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.width,
              height: selection.height,
            }}
          >
            <div className={styles.dimensions}>
              {Math.round(selection.width)} × {Math.round(selection.height)}
            </div>
            <div className={`${styles.handle} ${styles.topLeft}`} />
            <div className={`${styles.handle} ${styles.topRight}`} />
            <div className={`${styles.handle} ${styles.bottomLeft}`} />
            <div className={`${styles.handle} ${styles.bottomRight}`} />
          </div>
        </>
      )}
    </div>
  );
}

