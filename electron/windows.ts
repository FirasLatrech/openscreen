import { BrowserWindow, screen } from 'electron'
import { ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST = path.join(APP_ROOT, 'dist')

let hudOverlayWindow: BrowserWindow | null = null;

ipcMain.on('hud-overlay-hide', () => {
  if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
    hudOverlayWindow.minimize();
  }
});

export function createHudOverlayWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  const windowWidth = 740;
  const windowHeight = 260;

  const x = Math.floor(workArea.x + (workArea.width - windowWidth) / 2);
  const y = Math.floor(workArea.y + workArea.height - windowHeight - 20);

  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 740,
    maxWidth: 740,
    minHeight: 200,
    maxHeight: 300,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  })


  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  hudOverlayWindow = win;

  win.on('closed', () => {
    if (hudOverlayWindow === win) {
      hudOverlayWindow = null;
    }
  });


  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '?windowType=hud-overlay')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), { 
      query: { windowType: 'hud-overlay' } 
    })
  }

  return win
}

export function createEditorWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin';

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...(isMac && {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
    }),
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: 'OpenScreen',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false,
    },
  })

  // Maximize the window by default
  win.maximize();

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '?windowType=editor')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), { 
      query: { windowType: 'editor' } 
    })
  }

  return win
}

export function createSourceSelectorWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  
  const win = new BrowserWindow({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((width - 620) / 2),
    y: Math.round((height - 420) / 2),
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '?windowType=source-selector')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), { 
      query: { windowType: 'source-selector' } 
    })
  }

  return win
}

export function createAreaSelectorWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;
  
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '?windowType=area-selector')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), { 
      query: { windowType: 'area-selector' } 
    })
  }

  return win
}

let cameraBubbleWindow: BrowserWindow | null = null;

export function createCameraBubbleWindow(deviceId: string, displayId?: string): BrowserWindow {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.close();
  }

  const displays = screen.getAllDisplays();
  let targetDisplay = displays[0];
  
  if (displayId) {
    const found = displays.find(d => String(d.id) === displayId);
    if (found) targetDisplay = found;
  }

  const size = 180;
  const padding = 30;
  const x = targetDisplay.bounds.x + padding;
  const y = targetDisplay.bounds.y + targetDisplay.bounds.height - size - padding;

  const win = new BrowserWindow({
    width: size,
    height: size,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(false);

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + `?windowType=camera-bubble&deviceId=${encodeURIComponent(deviceId)}&size=${size}`);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      query: { windowType: 'camera-bubble', deviceId, size: String(size) }
    });
  }

  cameraBubbleWindow = win;

  win.on('closed', () => {
    cameraBubbleWindow = null;
  });

  return win;
}

export function closeCameraBubbleWindow() {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.close();
    cameraBubbleWindow = null;
  }
}

export function moveCameraBubbleWindow(x: number, y: number) {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.setPosition(Math.round(x), Math.round(y));
  }
}

export function resizeCameraBubbleWindow(size: number) {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.setSize(size, size);
  }
}

export function getCameraBubbleWindow(): BrowserWindow | null {
  return cameraBubbleWindow;
}

