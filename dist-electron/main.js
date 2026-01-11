import { ipcMain, screen, BrowserWindow, desktopCapturer, shell, app, dialog, nativeImage, Tray, Menu } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL$1 = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST$1 = path.join(APP_ROOT, "dist");
let hudOverlayWindow = null;
ipcMain.on("hud-overlay-hide", () => {
  if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
    hudOverlayWindow.minimize();
  }
});
function createHudOverlayWindow() {
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
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  hudOverlayWindow = win;
  win.on("closed", () => {
    if (hudOverlayWindow === win) {
      hudOverlayWindow = null;
    }
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=hud-overlay");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "hud-overlay" }
    });
  }
  return win;
}
function createEditorWindow() {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...isMac && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 12, y: 12 }
    },
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: "OpenScreen",
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });
  win.maximize();
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=editor");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "editor" }
    });
  }
  return win;
}
function createSourceSelectorWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
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
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=source-selector");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "source-selector" }
    });
  }
  return win;
}
function createAreaSelectorWindow() {
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
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=area-selector");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "area-selector" }
    });
  }
  return win;
}
let cameraBubbleWindow = null;
function createCameraBubbleWindow(deviceId, displayId) {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.close();
  }
  const displays = screen.getAllDisplays();
  let targetDisplay = displays[0];
  if (displayId) {
    const found = displays.find((d) => String(d.id) === displayId);
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
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(false);
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + `?windowType=camera-bubble&deviceId=${encodeURIComponent(deviceId)}&size=${size}`);
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "camera-bubble", deviceId, size: String(size) }
    });
  }
  cameraBubbleWindow = win;
  win.on("closed", () => {
    cameraBubbleWindow = null;
  });
  return win;
}
function closeCameraBubbleWindow() {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.close();
    cameraBubbleWindow = null;
  }
}
function moveCameraBubbleWindow(x, y) {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.setPosition(Math.round(x), Math.round(y));
  }
}
function resizeCameraBubbleWindow(size) {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.setSize(size, size);
  }
}
let selectedSource = null;
let selectedAreaRegion = null;
function registerIpcHandlers(createEditorWindow2, createSourceSelectorWindow2, getMainWindow, getSourceSelectorWindow, onRecordingStateChange) {
  ipcMain.handle("get-sources", async (_, opts) => {
    const sources = await desktopCapturer.getSources(opts);
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  });
  ipcMain.handle("select-source", (_, source) => {
    selectedSource = source;
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.close();
    }
    return selectedSource;
  });
  ipcMain.handle("get-selected-source", () => {
    return selectedSource;
  });
  ipcMain.handle("open-source-selector", () => {
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.focus();
      return;
    }
    createSourceSelectorWindow2();
  });
  ipcMain.handle("switch-to-editor", () => {
    const mainWin = getMainWindow();
    if (mainWin) {
      mainWin.close();
    }
    createEditorWindow2();
  });
  ipcMain.handle("store-recorded-video", async (_, videoData, fileName) => {
    try {
      const videoPath = path.join(RECORDINGS_DIR, fileName);
      await fs.writeFile(videoPath, Buffer.from(videoData));
      currentVideoPath = videoPath;
      return {
        success: true,
        path: videoPath,
        message: "Video stored successfully"
      };
    } catch (error) {
      console.error("Failed to store video:", error);
      return {
        success: false,
        message: "Failed to store video",
        error: String(error)
      };
    }
  });
  ipcMain.handle("get-recorded-video-path", async () => {
    try {
      const files = await fs.readdir(RECORDINGS_DIR);
      const videoFiles = files.filter((file) => file.endsWith(".webm"));
      if (videoFiles.length === 0) {
        return { success: false, message: "No recorded video found" };
      }
      const latestVideo = videoFiles.sort().reverse()[0];
      const videoPath = path.join(RECORDINGS_DIR, latestVideo);
      return { success: true, path: videoPath };
    } catch (error) {
      console.error("Failed to get video path:", error);
      return { success: false, message: "Failed to get video path", error: String(error) };
    }
  });
  ipcMain.handle("set-recording-state", (_, recording) => {
    const source = selectedSource || { name: "Screen" };
    if (onRecordingStateChange) {
      onRecordingStateChange(recording, source.name);
    }
  });
  ipcMain.handle("open-external-url", async (_, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("Failed to open URL:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("get-asset-base-path", () => {
    try {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, "assets");
      }
      return path.join(app.getAppPath(), "public", "assets");
    } catch (err) {
      console.error("Failed to resolve asset base path:", err);
      return null;
    }
  });
  ipcMain.handle("save-exported-video", async (_, videoData, fileName) => {
    try {
      const mainWindow2 = getMainWindow();
      const isGif = fileName.toLowerCase().endsWith(".gif");
      const filters = isGif ? [{ name: "GIF Image", extensions: ["gif"] }] : [{ name: "MP4 Video", extensions: ["mp4"] }];
      const result = await dialog.showSaveDialog(mainWindow2 || void 0, {
        title: isGif ? "Save Exported GIF" : "Save Exported Video",
        defaultPath: path.join(app.getPath("downloads"), fileName),
        filters,
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      if (result.canceled || !result.filePath) {
        return {
          success: false,
          cancelled: true,
          message: "Export cancelled"
        };
      }
      await fs.writeFile(result.filePath, Buffer.from(videoData));
      return {
        success: true,
        path: result.filePath,
        message: "Video exported successfully"
      };
    } catch (error) {
      console.error("Failed to save exported video:", error);
      return {
        success: false,
        message: "Failed to save exported video",
        error: String(error)
      };
    }
  });
  ipcMain.handle("open-video-file-picker", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Select Video File",
        defaultPath: RECORDINGS_DIR,
        filters: [
          { name: "Video Files", extensions: ["webm", "mp4", "mov", "avi", "mkv"] },
          { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }
      return {
        success: true,
        path: result.filePaths[0]
      };
    } catch (error) {
      console.error("Failed to open file picker:", error);
      return {
        success: false,
        message: "Failed to open file picker",
        error: String(error)
      };
    }
  });
  let currentVideoPath = null;
  ipcMain.handle("set-current-video-path", (_, path2) => {
    currentVideoPath = path2;
    return { success: true };
  });
  ipcMain.handle("get-current-video-path", () => {
    return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
  });
  ipcMain.handle("clear-current-video-path", () => {
    currentVideoPath = null;
    return { success: true };
  });
  ipcMain.handle("get-platform", () => {
    return process.platform;
  });
  ipcMain.handle("select-area-region", (_, region) => {
    selectedAreaRegion = region;
    return { success: true };
  });
  ipcMain.handle("get-selected-area-region", () => {
    return selectedAreaRegion;
  });
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDINGS_DIR = path.join(app.getPath("userData"), "recordings");
async function ensureRecordingsDir() {
  try {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true });
    console.log(...oo_oo(`1286657019_17_4_17_50_4`, "RECORDINGS_DIR:", RECORDINGS_DIR));
    console.log(...oo_oo(`1286657019_18_4_18_59_4`, "User Data Path:", app.getPath("userData")));
  } catch (error) {
    console.error("Failed to create recordings directory:", error);
  }
}
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let mainWindow = null;
let sourceSelectorWindow = null;
let areaSelectorWindow = null;
let tray = null;
let selectedSourceName = "";
const defaultTrayIcon = getTrayIcon("openscreen.png");
const recordingTrayIcon = getTrayIcon("rec-button.png");
function createWindow() {
  mainWindow = createHudOverlayWindow();
}
function createTray() {
  tray = new Tray(defaultTrayIcon);
}
function getTrayIcon(filename) {
  return nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC || RENDERER_DIST, filename)).resize({
    width: 24,
    height: 24,
    quality: "best"
  });
}
function updateTrayMenu(recording = false) {
  if (!tray) return;
  const trayIcon = recording ? recordingTrayIcon : defaultTrayIcon;
  const trayToolTip = recording ? `Recording: ${selectedSourceName}` : "OpenScreen";
  const menuTemplate = recording ? [
    {
      label: "Stop Recording",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("stop-recording-from-tray");
        }
      }
    }
  ] : [
    {
      label: "Open",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.isMinimized() && mainWindow.restore();
        } else {
          createWindow();
        }
      }
    },
    {
      label: "Quit",
      click: () => {
        app.quit();
      }
    }
  ];
  tray.setImage(trayIcon);
  tray.setToolTip(trayToolTip);
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}
function createEditorWindowWrapper() {
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
  mainWindow = createEditorWindow();
}
function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow();
  sourceSelectorWindow.on("closed", () => {
    sourceSelectorWindow = null;
  });
  return sourceSelectorWindow;
}
app.on("window-all-closed", () => {
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(async () => {
  const { ipcMain: ipcMain2 } = await import("electron");
  ipcMain2.on("hud-overlay-close", () => {
    app.quit();
  });
  ipcMain2.handle("open-area-selector", () => {
    if (areaSelectorWindow && !areaSelectorWindow.isDestroyed()) {
      areaSelectorWindow.focus();
      return;
    }
    areaSelectorWindow = createAreaSelectorWindow();
    areaSelectorWindow.on("closed", () => {
      areaSelectorWindow = null;
    });
  });
  ipcMain2.handle("open-camera-bubble", (_, deviceId, displayId) => {
    createCameraBubbleWindow(deviceId, displayId);
  });
  ipcMain2.handle("close-camera-bubble", () => {
    closeCameraBubbleWindow();
  });
  ipcMain2.handle("move-camera-bubble", (_, x, y) => {
    moveCameraBubbleWindow(x, y);
  });
  ipcMain2.handle("resize-camera-bubble", (_, size) => {
    resizeCameraBubbleWindow(size);
  });
  ipcMain2.handle("open-recordings-folder", async () => {
    await shell.openPath(RECORDINGS_DIR);
  });
  createTray();
  updateTrayMenu();
  await ensureRecordingsDir();
  registerIpcHandlers(
    createEditorWindowWrapper,
    createSourceSelectorWindowWrapper,
    () => mainWindow,
    () => sourceSelectorWindow,
    (recording, sourceName) => {
      selectedSourceName = sourceName;
      if (!tray) createTray();
      updateTrayMenu(recording);
      if (!recording) {
        if (mainWindow) mainWindow.restore();
      }
    }
  );
  createWindow();
});
function oo_cm() {
  try {
    return (0, eval)("globalThis._console_ninja") || (0, eval)(`/* https://github.com/wallabyjs/console-ninja#how-does-it-work */'use strict';var _0x51ad09=_0x209a;(function(_0x97a950,_0x2420ac){var _0x360efc=_0x209a,_0x4854c6=_0x97a950();while(!![]){try{var _0x16c0fe=parseInt(_0x360efc(0x15a))/0x1*(parseInt(_0x360efc(0x116))/0x2)+-parseInt(_0x360efc(0x12e))/0x3*(parseInt(_0x360efc(0x10a))/0x4)+-parseInt(_0x360efc(0x1d3))/0x5*(-parseInt(_0x360efc(0x1bd))/0x6)+-parseInt(_0x360efc(0x1ef))/0x7*(-parseInt(_0x360efc(0x18a))/0x8)+-parseInt(_0x360efc(0x136))/0x9+parseInt(_0x360efc(0x183))/0xa*(-parseInt(_0x360efc(0x1eb))/0xb)+parseInt(_0x360efc(0x11c))/0xc;if(_0x16c0fe===_0x2420ac)break;else _0x4854c6['push'](_0x4854c6['shift']());}catch(_0x30b63c){_0x4854c6['push'](_0x4854c6['shift']());}}}(_0x1d0c,0x9e382));var K=Object[_0x51ad09(0x156)],Q=Object['defineProperty'],G=Object['getOwnPropertyDescriptor'],ee=Object[_0x51ad09(0x181)],te=Object['getPrototypeOf'],ne=Object['prototype'][_0x51ad09(0x115)],re=(_0x39728b,_0x410973,_0x57a74a,_0x23f8e8)=>{var _0x468abd=_0x51ad09;if(_0x410973&&typeof _0x410973==_0x468abd(0x1d8)||typeof _0x410973=='function'){for(let _0x2ddd9b of ee(_0x410973))!ne[_0x468abd(0x1e0)](_0x39728b,_0x2ddd9b)&&_0x2ddd9b!==_0x57a74a&&Q(_0x39728b,_0x2ddd9b,{'get':()=>_0x410973[_0x2ddd9b],'enumerable':!(_0x23f8e8=G(_0x410973,_0x2ddd9b))||_0x23f8e8[_0x468abd(0x167)]});}return _0x39728b;},V=(_0x5c2f35,_0x3d0db8,_0x115465)=>(_0x115465=_0x5c2f35!=null?K(te(_0x5c2f35)):{},re(_0x3d0db8||!_0x5c2f35||!_0x5c2f35[_0x51ad09(0x123)]?Q(_0x115465,_0x51ad09(0x153),{'value':_0x5c2f35,'enumerable':!0x0}):_0x115465,_0x5c2f35)),x=class{constructor(_0x18e1ca,_0x2422a2,_0x4a875c,_0xfb655,_0x470776,_0x16d592){var _0x40647d=_0x51ad09,_0x41cd6a,_0x4b73b5,_0xe5f0f2,_0x36a179;this[_0x40647d(0x143)]=_0x18e1ca,this[_0x40647d(0x152)]=_0x2422a2,this[_0x40647d(0x189)]=_0x4a875c,this['nodeModules']=_0xfb655,this['dockerizedApp']=_0x470776,this[_0x40647d(0x1da)]=_0x16d592,this['_allowedToSend']=!0x0,this[_0x40647d(0x150)]=!0x0,this[_0x40647d(0x138)]=!0x1,this['_connecting']=!0x1,this[_0x40647d(0x1f4)]=((_0x4b73b5=(_0x41cd6a=_0x18e1ca['process'])==null?void 0x0:_0x41cd6a[_0x40647d(0x163)])==null?void 0x0:_0x4b73b5[_0x40647d(0x1cd)])===_0x40647d(0x158),this['_inBrowser']=!((_0x36a179=(_0xe5f0f2=this[_0x40647d(0x143)][_0x40647d(0x13d)])==null?void 0x0:_0xe5f0f2[_0x40647d(0x1e5)])!=null&&_0x36a179[_0x40647d(0x133)])&&!this['_inNextEdge'],this[_0x40647d(0x16c)]=null,this[_0x40647d(0x1c4)]=0x0,this[_0x40647d(0x1dc)]=0x14,this[_0x40647d(0x1b4)]=_0x40647d(0x1b0),this[_0x40647d(0x1ec)]=(this[_0x40647d(0x19b)]?_0x40647d(0x19d):_0x40647d(0x107))+this['_webSocketErrorDocsLink'];}async[_0x51ad09(0x13c)](){var _0x1f8425=_0x51ad09,_0x24ff5f,_0x350406;if(this[_0x1f8425(0x16c)])return this['_WebSocketClass'];let _0x523180;if(this['_inBrowser']||this[_0x1f8425(0x1f4)])_0x523180=this[_0x1f8425(0x143)]['WebSocket'];else{if((_0x24ff5f=this[_0x1f8425(0x143)]['process'])!=null&&_0x24ff5f[_0x1f8425(0x14e)])_0x523180=(_0x350406=this['global']['process'])==null?void 0x0:_0x350406[_0x1f8425(0x14e)];else try{let _0x1080d8=await import('path');_0x523180=(await import((await import('url'))[_0x1f8425(0x105)](_0x1080d8['join'](this['nodeModules'],_0x1f8425(0x1cc)))[_0x1f8425(0x11d)]()))[_0x1f8425(0x153)];}catch{try{_0x523180=require(require(_0x1f8425(0x1f3))[_0x1f8425(0x17a)](this[_0x1f8425(0x19a)],'ws'));}catch{throw new Error(_0x1f8425(0x155));}}}return this[_0x1f8425(0x16c)]=_0x523180,_0x523180;}[_0x51ad09(0x1c7)](){var _0x17239a=_0x51ad09;this[_0x17239a(0x148)]||this[_0x17239a(0x138)]||this[_0x17239a(0x1c4)]>=this[_0x17239a(0x1dc)]||(this[_0x17239a(0x150)]=!0x1,this[_0x17239a(0x148)]=!0x0,this['_connectAttemptCount']++,this[_0x17239a(0x145)]=new Promise((_0x357831,_0x328c37)=>{var _0x28e58a=_0x17239a;this[_0x28e58a(0x13c)]()['then'](_0x4b6368=>{var _0x1a4bef=_0x28e58a;let _0xafbd77=new _0x4b6368(_0x1a4bef(0x15b)+(!this[_0x1a4bef(0x19b)]&&this[_0x1a4bef(0x1e7)]?_0x1a4bef(0x15c):this['host'])+':'+this[_0x1a4bef(0x189)]);_0xafbd77[_0x1a4bef(0x147)]=()=>{var _0x4564c0=_0x1a4bef;this['_allowedToSend']=!0x1,this['_disposeWebsocket'](_0xafbd77),this[_0x4564c0(0x120)](),_0x328c37(new Error(_0x4564c0(0x164)));},_0xafbd77[_0x1a4bef(0x160)]=()=>{var _0x452bb9=_0x1a4bef;this['_inBrowser']||_0xafbd77[_0x452bb9(0x1b9)]&&_0xafbd77[_0x452bb9(0x1b9)][_0x452bb9(0x1ad)]&&_0xafbd77[_0x452bb9(0x1b9)][_0x452bb9(0x1ad)](),_0x357831(_0xafbd77);},_0xafbd77[_0x1a4bef(0x1b7)]=()=>{var _0x28c4d1=_0x1a4bef;this['_allowedToConnectOnSend']=!0x0,this[_0x28c4d1(0x1a9)](_0xafbd77),this[_0x28c4d1(0x120)]();},_0xafbd77[_0x1a4bef(0x12c)]=_0x124bd0=>{var _0x16d652=_0x1a4bef;try{if(!(_0x124bd0!=null&&_0x124bd0['data'])||!this['eventReceivedCallback'])return;let _0x21563f=JSON['parse'](_0x124bd0['data']);this[_0x16d652(0x1da)](_0x21563f[_0x16d652(0x149)],_0x21563f['args'],this[_0x16d652(0x143)],this['_inBrowser']);}catch{}};})[_0x28e58a(0x17c)](_0x4bd6a6=>(this[_0x28e58a(0x138)]=!0x0,this['_connecting']=!0x1,this[_0x28e58a(0x150)]=!0x1,this['_allowedToSend']=!0x0,this[_0x28e58a(0x1c4)]=0x0,_0x4bd6a6))[_0x28e58a(0x195)](_0x295539=>(this[_0x28e58a(0x138)]=!0x1,this['_connecting']=!0x1,console[_0x28e58a(0x165)](_0x28e58a(0x174)+this['_webSocketErrorDocsLink']),_0x328c37(new Error(_0x28e58a(0x1f8)+(_0x295539&&_0x295539[_0x28e58a(0x10f)])))));}));}[_0x51ad09(0x1a9)](_0x108a23){var _0x34d1f4=_0x51ad09;this[_0x34d1f4(0x138)]=!0x1,this[_0x34d1f4(0x148)]=!0x1;try{_0x108a23[_0x34d1f4(0x1b7)]=null,_0x108a23[_0x34d1f4(0x147)]=null,_0x108a23[_0x34d1f4(0x160)]=null;}catch{}try{_0x108a23[_0x34d1f4(0x178)]<0x2&&_0x108a23[_0x34d1f4(0x18f)]();}catch{}}['_attemptToReconnectShortly'](){var _0x36acfa=_0x51ad09;clearTimeout(this[_0x36acfa(0x14d)]),!(this[_0x36acfa(0x1c4)]>=this[_0x36acfa(0x1dc)])&&(this[_0x36acfa(0x14d)]=setTimeout(()=>{var _0x26a474=_0x36acfa,_0x52720a;this['_connected']||this[_0x26a474(0x148)]||(this[_0x26a474(0x1c7)](),(_0x52720a=this[_0x26a474(0x145)])==null||_0x52720a[_0x26a474(0x195)](()=>this['_attemptToReconnectShortly']()));},0x1f4),this[_0x36acfa(0x14d)]['unref']&&this[_0x36acfa(0x14d)][_0x36acfa(0x1ad)]());}async['send'](_0x571391){var _0x16e9e2=_0x51ad09;try{if(!this[_0x16e9e2(0x1ae)])return;this[_0x16e9e2(0x150)]&&this[_0x16e9e2(0x1c7)](),(await this['_ws'])[_0x16e9e2(0x182)](JSON[_0x16e9e2(0x12b)](_0x571391));}catch(_0x3f8b6b){console[_0x16e9e2(0x165)](this[_0x16e9e2(0x1ec)]+':\\x20'+(_0x3f8b6b&&_0x3f8b6b['message'])),this['_allowedToSend']=!0x1,this[_0x16e9e2(0x120)]();}}};function q(_0x178541,_0x569b7c,_0x112293,_0x49486d,_0x53bed9,_0x6f8fba,_0x4a7046,_0x17a724=ie){var _0x5b613f=_0x51ad09;let _0x5c7e1b=_0x112293[_0x5b613f(0x196)](',')[_0x5b613f(0x127)](_0x4dc568=>{var _0x275c07=_0x5b613f,_0x129558,_0xcb1f9c,_0x517403,_0x2c307b;try{if(!_0x178541[_0x275c07(0x1b3)]){let _0x298b82=((_0xcb1f9c=(_0x129558=_0x178541[_0x275c07(0x13d)])==null?void 0x0:_0x129558[_0x275c07(0x1e5)])==null?void 0x0:_0xcb1f9c['node'])||((_0x2c307b=(_0x517403=_0x178541['process'])==null?void 0x0:_0x517403[_0x275c07(0x163)])==null?void 0x0:_0x2c307b[_0x275c07(0x1cd)])==='edge';(_0x53bed9===_0x275c07(0x1cf)||_0x53bed9==='remix'||_0x53bed9===_0x275c07(0x131)||_0x53bed9===_0x275c07(0x159))&&(_0x53bed9+=_0x298b82?_0x275c07(0x192):_0x275c07(0x19c)),_0x178541['_console_ninja_session']={'id':+new Date(),'tool':_0x53bed9},_0x4a7046&&_0x53bed9&&!_0x298b82&&console[_0x275c07(0x1d7)](_0x275c07(0x1ab)+(_0x53bed9[_0x275c07(0x1f1)](0x0)[_0x275c07(0x1ca)]()+_0x53bed9[_0x275c07(0x184)](0x1))+',',_0x275c07(0x1c3),'see\\x20https://tinyurl.com/2vt8jxzw\\x20for\\x20more\\x20info.');}let _0x12d971=new x(_0x178541,_0x569b7c,_0x4dc568,_0x49486d,_0x6f8fba,_0x17a724);return _0x12d971[_0x275c07(0x182)][_0x275c07(0x12f)](_0x12d971);}catch(_0x245cc6){return console[_0x275c07(0x165)](_0x275c07(0x11b),_0x245cc6&&_0x245cc6['message']),()=>{};}});return _0x4ec15a=>_0x5c7e1b['forEach'](_0x124d78=>_0x124d78(_0x4ec15a));}function _0x1d0c(){var _0x573442=['_sendErrorMessage','_property','replace','56385UziaUw','_propertyName','charAt','Set','path','_inNextEdge','NEGATIVE_INFINITY','indexOf','_keyStrRegExp','failed\\x20to\\x20connect\\x20to\\x20host:\\x20','forEach','expressionsToEvaluate','undefined','[object\\x20Map]','pathToFileURL','_objectToString','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20restarting\\x20the\\x20process\\x20may\\x20help;\\x20also\\x20see\\x20','_isPrimitiveWrapperType','autoExpandPreviousObjects','128QIXdqA','unknown','_p_','vite','_addProperty','message','_regExpToString','_setNodePermissions','funcName','[object\\x20BigInt]','value','hasOwnProperty','70726KbRPrH','root_exp','location','getOwnPropertySymbols','length','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host','16691388IzNlLy','toString','constructor','_addLoadNode','_attemptToReconnectShortly','stackTraceLimit','_getOwnPropertySymbols','__es'+'Module','now','_hasSetOnItsPath','number','map','','valueOf','_undefined','stringify','onmessage','127.0.0.1','85974lxUBti','bind','totalStrLength','astro','match','node','array','Symbol','820494BgMhZG','_treeNodePropertiesAfterFullValue','_connected','origin','depth','level','getWebSocketClass','process','index','current','autoExpandLimit','_isNegativeZero','prototype','global','performance','_ws','_processTreeNodeResult','onerror','_connecting','method','String','_setNodeQueryPath','_setNodeExpressionPath','_reconnectTimeout','_WebSocket','_console_ninja','_allowedToConnectOnSend','_hasMapOnItsPath','host','default','disabledLog','failed\\x20to\\x20find\\x20and\\x20load\\x20WebSocket','create','','edge','angular','5wQfEMY','ws://','gateway.docker.internal','root_exp_id','[object\\x20Set]','symbol','onopen','getter','55151','env','logger\\x20websocket\\x20error','warn','hrtime','enumerable','console','_type','_isUndefined','autoExpandPropertyCount','_WebSocketClass','trace','sortProps','rootExpression','_isPrimitiveType','_consoleNinjaAllowedToStart','slice','reduceLimits','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host,\\x20see\\x20','_getOwnPropertyDescriptor','props','count','readyState','_setNodeId','join','Map','then','[object\\x20Array]','POSITIVE_INFINITY','date','autoExpand','getOwnPropertyNames','send','4540hQTDoQ','substr','strLength','_capIfString',"/Users/firaslatrach/.cursor/extensions/wallabyjs.console-ninja-1.0.331/node_modules",'_additionalMetadata','port','80UZnaao','getOwnPropertyDescriptor','hostname','Buffer','stack','close','Boolean','elapsed','\\x20server','set','_Symbol','catch','split','_addObjectProperty','autoExpandMaxDepth','test','nodeModules','_inBrowser','\\x20browser','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20refreshing\\x20the\\x20page\\x20may\\x20help;\\x20also\\x20see\\x20','_addFunctionsNode','capped','timeStamp','bigint','function','string','positiveInfinity','...','noFunctions','_quotedRegExp','_p_name','_disposeWebsocket','perf_hooks','%c\\x20Console\\x20Ninja\\x20extension\\x20is\\x20connected\\x20to\\x20','_getOwnPropertyNames','unref','_allowedToSend','get','https://tinyurl.com/37x8b79t','_isMap','null','_console_ninja_session','_webSocketErrorDocsLink','_blacklistedProperty','HTMLAllCollection','onclose','isArray','_socket','isExpressionToEvaluate','elements','nuxt','6jsTAev','push','_HTMLAllCollection','serialize','error','toLowerCase','background:\\x20rgb(30,30,30);\\x20color:\\x20rgb(255,213,92)','_connectAttemptCount','_cleanNode','parent','_connectToHostNow','1','Number','toUpperCase','time','ws/index.js','NEXT_RUNTIME','[object\\x20Date]','next.js','_setNodeLabel','Error','allStrLength','4434590isJgvI','type','concat','args','log','object','reload','eventReceivedCallback','sort','_maxConnectAttemptCount','hits','negativeZero',["localhost","127.0.0.1","example.cypress.io","MacBook-Pro-10.local","172.20.10.2","169.254.57.208"],'call','_sortProps','name','pop','_dateToString','versions','unshift','dockerizedApp','_setNodeExpandableState','_treeNodePropertiesBeforeFullValue','coverage','21296EfuVdB'];_0x1d0c=function(){return _0x573442;};return _0x1d0c();}function ie(_0x29d783,_0x39bf70,_0x11bba2,_0x687c6f){var _0x4cda79=_0x51ad09;_0x687c6f&&_0x29d783===_0x4cda79(0x1d9)&&_0x11bba2['location'][_0x4cda79(0x1d9)]();}function b(_0x39362a){var _0x41d681=_0x51ad09,_0x54f945,_0x215762;let _0x493049=function(_0x4f6fb8,_0x5291d1){return _0x5291d1-_0x4f6fb8;},_0xda9fa4;if(_0x39362a[_0x41d681(0x144)])_0xda9fa4=function(){var _0x4ec525=_0x41d681;return _0x39362a[_0x4ec525(0x144)][_0x4ec525(0x124)]();};else{if(_0x39362a['process']&&_0x39362a[_0x41d681(0x13d)][_0x41d681(0x166)]&&((_0x215762=(_0x54f945=_0x39362a[_0x41d681(0x13d)])==null?void 0x0:_0x54f945['env'])==null?void 0x0:_0x215762[_0x41d681(0x1cd)])!=='edge')_0xda9fa4=function(){var _0x284500=_0x41d681;return _0x39362a[_0x284500(0x13d)]['hrtime']();},_0x493049=function(_0x1d3efa,_0x1e4f01){return 0x3e8*(_0x1e4f01[0x0]-_0x1d3efa[0x0])+(_0x1e4f01[0x1]-_0x1d3efa[0x1])/0xf4240;};else try{let {performance:_0x2eef10}=require(_0x41d681(0x1aa));_0xda9fa4=function(){return _0x2eef10['now']();};}catch{_0xda9fa4=function(){return+new Date();};}}return{'elapsed':_0x493049,'timeStamp':_0xda9fa4,'now':()=>Date[_0x41d681(0x124)]()};}function X(_0x29754e,_0x36dccb,_0x318c2d){var _0xd38205=_0x51ad09,_0x1e6ef1,_0xfc9248,_0x146a94,_0x480b01,_0xf049f6;if(_0x29754e[_0xd38205(0x171)]!==void 0x0)return _0x29754e[_0xd38205(0x171)];let _0x1a6b6a=((_0xfc9248=(_0x1e6ef1=_0x29754e['process'])==null?void 0x0:_0x1e6ef1[_0xd38205(0x1e5)])==null?void 0x0:_0xfc9248[_0xd38205(0x133)])||((_0x480b01=(_0x146a94=_0x29754e[_0xd38205(0x13d)])==null?void 0x0:_0x146a94[_0xd38205(0x163)])==null?void 0x0:_0x480b01['NEXT_RUNTIME'])===_0xd38205(0x158);return _0x1a6b6a&&_0x318c2d===_0xd38205(0x1bc)?_0x29754e[_0xd38205(0x171)]=!0x1:_0x29754e['_consoleNinjaAllowedToStart']=_0x1a6b6a||!_0x36dccb||((_0xf049f6=_0x29754e[_0xd38205(0x118)])==null?void 0x0:_0xf049f6['hostname'])&&_0x36dccb['includes'](_0x29754e['location'][_0xd38205(0x18c)]),_0x29754e['_consoleNinjaAllowedToStart'];}function H(_0x436f8b,_0x3b4919,_0x3af4cd,_0x2e3e7b){var _0x3d9a21=_0x51ad09;_0x436f8b=_0x436f8b,_0x3b4919=_0x3b4919,_0x3af4cd=_0x3af4cd,_0x2e3e7b=_0x2e3e7b;let _0x5605fd=b(_0x436f8b),_0x2e5831=_0x5605fd[_0x3d9a21(0x191)],_0xd88d98=_0x5605fd[_0x3d9a21(0x1a0)];class _0x23d17a{constructor(){var _0x4229a0=_0x3d9a21;this[_0x4229a0(0x1f7)]=/^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[_$a-zA-Z\\xA0-\\uFFFF][_$a-zA-Z0-9\\xA0-\\uFFFF]*$/,this['_numberRegExp']=/^(0|[1-9][0-9]*)$/,this[_0x4229a0(0x1a7)]=/'([^\\\\']|\\\\')*'/,this[_0x4229a0(0x12a)]=_0x436f8b['undefined'],this[_0x4229a0(0x1bf)]=_0x436f8b[_0x4229a0(0x1b6)],this[_0x4229a0(0x175)]=Object[_0x4229a0(0x18b)],this[_0x4229a0(0x1ac)]=Object['getOwnPropertyNames'],this[_0x4229a0(0x194)]=_0x436f8b[_0x4229a0(0x135)],this[_0x4229a0(0x110)]=RegExp[_0x4229a0(0x142)][_0x4229a0(0x11d)],this[_0x4229a0(0x1e4)]=Date[_0x4229a0(0x142)][_0x4229a0(0x11d)];}[_0x3d9a21(0x1c0)](_0x1a6604,_0x769c45,_0x584310,_0x4ac53d){var _0x495408=_0x3d9a21,_0x14deb6=this,_0x1cf202=_0x584310[_0x495408(0x180)];function _0x54750d(_0x36e4b1,_0x4ab83d,_0x9ec9de){var _0x244013=_0x495408;_0x4ab83d[_0x244013(0x1d4)]='unknown',_0x4ab83d['error']=_0x36e4b1[_0x244013(0x10f)],_0x19103e=_0x9ec9de['node'][_0x244013(0x13f)],_0x9ec9de[_0x244013(0x133)][_0x244013(0x13f)]=_0x4ab83d,_0x14deb6['_treeNodePropertiesBeforeFullValue'](_0x4ab83d,_0x9ec9de);}try{_0x584310[_0x495408(0x13b)]++,_0x584310[_0x495408(0x180)]&&_0x584310['autoExpandPreviousObjects'][_0x495408(0x1be)](_0x769c45);var _0x53fd2d,_0xd370a2,_0x1e3797,_0x5a93cf,_0xde5000=[],_0x373bda=[],_0x243337,_0x34866c=this[_0x495408(0x169)](_0x769c45),_0x5cbc6b=_0x34866c===_0x495408(0x134),_0x12267f=!0x1,_0x50d4db=_0x34866c===_0x495408(0x1a2),_0x3eb23d=this[_0x495408(0x170)](_0x34866c),_0x41d9e5=this[_0x495408(0x108)](_0x34866c),_0x3fbc81=_0x3eb23d||_0x41d9e5,_0x5deed0={},_0x36598e=0x0,_0x224887=!0x1,_0x19103e,_0x575976=/^(([1-9]{1}[0-9]*)|0)$/;if(_0x584310['depth']){if(_0x5cbc6b){if(_0xd370a2=_0x769c45['length'],_0xd370a2>_0x584310[_0x495408(0x1bb)]){for(_0x1e3797=0x0,_0x5a93cf=_0x584310[_0x495408(0x1bb)],_0x53fd2d=_0x1e3797;_0x53fd2d<_0x5a93cf;_0x53fd2d++)_0x373bda['push'](_0x14deb6[_0x495408(0x10e)](_0xde5000,_0x769c45,_0x34866c,_0x53fd2d,_0x584310));_0x1a6604['cappedElements']=!0x0;}else{for(_0x1e3797=0x0,_0x5a93cf=_0xd370a2,_0x53fd2d=_0x1e3797;_0x53fd2d<_0x5a93cf;_0x53fd2d++)_0x373bda[_0x495408(0x1be)](_0x14deb6['_addProperty'](_0xde5000,_0x769c45,_0x34866c,_0x53fd2d,_0x584310));}_0x584310[_0x495408(0x16b)]+=_0x373bda[_0x495408(0x11a)];}if(!(_0x34866c===_0x495408(0x1b2)||_0x34866c===_0x495408(0x1fb))&&!_0x3eb23d&&_0x34866c!==_0x495408(0x14a)&&_0x34866c!==_0x495408(0x18d)&&_0x34866c!==_0x495408(0x1a1)){var _0x4ae46e=_0x4ac53d[_0x495408(0x176)]||_0x584310[_0x495408(0x176)];if(this['_isSet'](_0x769c45)?(_0x53fd2d=0x0,_0x769c45[_0x495408(0x1f9)](function(_0x4621bd){var _0x541f87=_0x495408;if(_0x36598e++,_0x584310[_0x541f87(0x16b)]++,_0x36598e>_0x4ae46e){_0x224887=!0x0;return;}if(!_0x584310[_0x541f87(0x1ba)]&&_0x584310[_0x541f87(0x180)]&&_0x584310[_0x541f87(0x16b)]>_0x584310[_0x541f87(0x140)]){_0x224887=!0x0;return;}_0x373bda[_0x541f87(0x1be)](_0x14deb6[_0x541f87(0x10e)](_0xde5000,_0x769c45,_0x541f87(0x1f2),_0x53fd2d++,_0x584310,function(_0x2beba3){return function(){return _0x2beba3;};}(_0x4621bd)));})):this[_0x495408(0x1b1)](_0x769c45)&&_0x769c45[_0x495408(0x1f9)](function(_0x34aff3,_0x3fa468){var _0x611978=_0x495408;if(_0x36598e++,_0x584310[_0x611978(0x16b)]++,_0x36598e>_0x4ae46e){_0x224887=!0x0;return;}if(!_0x584310[_0x611978(0x1ba)]&&_0x584310[_0x611978(0x180)]&&_0x584310[_0x611978(0x16b)]>_0x584310[_0x611978(0x140)]){_0x224887=!0x0;return;}var _0x55147c=_0x3fa468[_0x611978(0x11d)]();_0x55147c[_0x611978(0x11a)]>0x64&&(_0x55147c=_0x55147c[_0x611978(0x172)](0x0,0x64)+_0x611978(0x1a5)),_0x373bda[_0x611978(0x1be)](_0x14deb6[_0x611978(0x10e)](_0xde5000,_0x769c45,_0x611978(0x17b),_0x55147c,_0x584310,function(_0x3b5ffa){return function(){return _0x3b5ffa;};}(_0x34aff3)));}),!_0x12267f){try{for(_0x243337 in _0x769c45)if(!(_0x5cbc6b&&_0x575976['test'](_0x243337))&&!this[_0x495408(0x1b5)](_0x769c45,_0x243337,_0x584310)){if(_0x36598e++,_0x584310['autoExpandPropertyCount']++,_0x36598e>_0x4ae46e){_0x224887=!0x0;break;}if(!_0x584310[_0x495408(0x1ba)]&&_0x584310[_0x495408(0x180)]&&_0x584310[_0x495408(0x16b)]>_0x584310['autoExpandLimit']){_0x224887=!0x0;break;}_0x373bda[_0x495408(0x1be)](_0x14deb6['_addObjectProperty'](_0xde5000,_0x5deed0,_0x769c45,_0x34866c,_0x243337,_0x584310));}}catch{}if(_0x5deed0['_p_length']=!0x0,_0x50d4db&&(_0x5deed0[_0x495408(0x1a8)]=!0x0),!_0x224887){var _0x519fea=[]['concat'](this['_getOwnPropertyNames'](_0x769c45))[_0x495408(0x1d5)](this[_0x495408(0x122)](_0x769c45));for(_0x53fd2d=0x0,_0xd370a2=_0x519fea[_0x495408(0x11a)];_0x53fd2d<_0xd370a2;_0x53fd2d++)if(_0x243337=_0x519fea[_0x53fd2d],!(_0x5cbc6b&&_0x575976[_0x495408(0x199)](_0x243337[_0x495408(0x11d)]()))&&!this[_0x495408(0x1b5)](_0x769c45,_0x243337,_0x584310)&&!_0x5deed0['_p_'+_0x243337[_0x495408(0x11d)]()]){if(_0x36598e++,_0x584310[_0x495408(0x16b)]++,_0x36598e>_0x4ae46e){_0x224887=!0x0;break;}if(!_0x584310[_0x495408(0x1ba)]&&_0x584310[_0x495408(0x180)]&&_0x584310['autoExpandPropertyCount']>_0x584310[_0x495408(0x140)]){_0x224887=!0x0;break;}_0x373bda['push'](_0x14deb6[_0x495408(0x197)](_0xde5000,_0x5deed0,_0x769c45,_0x34866c,_0x243337,_0x584310));}}}}}if(_0x1a6604[_0x495408(0x1d4)]=_0x34866c,_0x3fbc81?(_0x1a6604[_0x495408(0x114)]=_0x769c45['valueOf'](),this[_0x495408(0x186)](_0x34866c,_0x1a6604,_0x584310,_0x4ac53d)):_0x34866c===_0x495408(0x17f)?_0x1a6604[_0x495408(0x114)]=this['_dateToString'][_0x495408(0x1e0)](_0x769c45):_0x34866c===_0x495408(0x1a1)?_0x1a6604[_0x495408(0x114)]=_0x769c45['toString']():_0x34866c==='RegExp'?_0x1a6604[_0x495408(0x114)]=this[_0x495408(0x110)]['call'](_0x769c45):_0x34866c==='symbol'&&this[_0x495408(0x194)]?_0x1a6604[_0x495408(0x114)]=this[_0x495408(0x194)][_0x495408(0x142)][_0x495408(0x11d)][_0x495408(0x1e0)](_0x769c45):!_0x584310[_0x495408(0x13a)]&&!(_0x34866c===_0x495408(0x1b2)||_0x34866c===_0x495408(0x1fb))&&(delete _0x1a6604[_0x495408(0x114)],_0x1a6604[_0x495408(0x19f)]=!0x0),_0x224887&&(_0x1a6604['cappedProps']=!0x0),_0x19103e=_0x584310[_0x495408(0x133)]['current'],_0x584310[_0x495408(0x133)][_0x495408(0x13f)]=_0x1a6604,this['_treeNodePropertiesBeforeFullValue'](_0x1a6604,_0x584310),_0x373bda[_0x495408(0x11a)]){for(_0x53fd2d=0x0,_0xd370a2=_0x373bda['length'];_0x53fd2d<_0xd370a2;_0x53fd2d++)_0x373bda[_0x53fd2d](_0x53fd2d);}_0xde5000[_0x495408(0x11a)]&&(_0x1a6604[_0x495408(0x176)]=_0xde5000);}catch(_0x1f0818){_0x54750d(_0x1f0818,_0x1a6604,_0x584310);}return this[_0x495408(0x188)](_0x769c45,_0x1a6604),this[_0x495408(0x137)](_0x1a6604,_0x584310),_0x584310[_0x495408(0x133)][_0x495408(0x13f)]=_0x19103e,_0x584310[_0x495408(0x13b)]--,_0x584310[_0x495408(0x180)]=_0x1cf202,_0x584310[_0x495408(0x180)]&&_0x584310[_0x495408(0x109)][_0x495408(0x1e3)](),_0x1a6604;}[_0x3d9a21(0x122)](_0x206c62){var _0x29b1eb=_0x3d9a21;return Object[_0x29b1eb(0x119)]?Object['getOwnPropertySymbols'](_0x206c62):[];}['_isSet'](_0x3a08db){var _0x191be0=_0x3d9a21;return!!(_0x3a08db&&_0x436f8b['Set']&&this['_objectToString'](_0x3a08db)===_0x191be0(0x15e)&&_0x3a08db['forEach']);}[_0x3d9a21(0x1b5)](_0x4e0cb7,_0x383edb,_0x47a006){var _0x27eb16=_0x3d9a21;return _0x47a006[_0x27eb16(0x1a6)]?typeof _0x4e0cb7[_0x383edb]==_0x27eb16(0x1a2):!0x1;}[_0x3d9a21(0x169)](_0x118078){var _0x51fecc=_0x3d9a21,_0x482e80='';return _0x482e80=typeof _0x118078,_0x482e80===_0x51fecc(0x1d8)?this[_0x51fecc(0x106)](_0x118078)==='[object\\x20Array]'?_0x482e80='array':this[_0x51fecc(0x106)](_0x118078)===_0x51fecc(0x1ce)?_0x482e80='date':this[_0x51fecc(0x106)](_0x118078)===_0x51fecc(0x113)?_0x482e80='bigint':_0x118078===null?_0x482e80='null':_0x118078['constructor']&&(_0x482e80=_0x118078[_0x51fecc(0x11e)][_0x51fecc(0x1e2)]||_0x482e80):_0x482e80===_0x51fecc(0x1fb)&&this[_0x51fecc(0x1bf)]&&_0x118078 instanceof this[_0x51fecc(0x1bf)]&&(_0x482e80=_0x51fecc(0x1b6)),_0x482e80;}['_objectToString'](_0xe13b61){var _0x72df15=_0x3d9a21;return Object['prototype'][_0x72df15(0x11d)]['call'](_0xe13b61);}[_0x3d9a21(0x170)](_0x523ca1){var _0x5a60b0=_0x3d9a21;return _0x523ca1==='boolean'||_0x523ca1===_0x5a60b0(0x1a3)||_0x523ca1==='number';}[_0x3d9a21(0x108)](_0x1b1dcd){var _0x11c9cc=_0x3d9a21;return _0x1b1dcd===_0x11c9cc(0x190)||_0x1b1dcd===_0x11c9cc(0x14a)||_0x1b1dcd==='Number';}[_0x3d9a21(0x10e)](_0x544ebd,_0x522edb,_0x50872f,_0x2190bf,_0x33c12f,_0x48787e){var _0x5627bb=this;return function(_0x1ead52){var _0x412f81=_0x209a,_0x4fcc82=_0x33c12f['node'][_0x412f81(0x13f)],_0x290227=_0x33c12f['node'][_0x412f81(0x13e)],_0x1161c6=_0x33c12f['node'][_0x412f81(0x1c6)];_0x33c12f['node']['parent']=_0x4fcc82,_0x33c12f[_0x412f81(0x133)][_0x412f81(0x13e)]=typeof _0x2190bf==_0x412f81(0x126)?_0x2190bf:_0x1ead52,_0x544ebd[_0x412f81(0x1be)](_0x5627bb[_0x412f81(0x1ed)](_0x522edb,_0x50872f,_0x2190bf,_0x33c12f,_0x48787e)),_0x33c12f[_0x412f81(0x133)][_0x412f81(0x1c6)]=_0x1161c6,_0x33c12f['node'][_0x412f81(0x13e)]=_0x290227;};}[_0x3d9a21(0x197)](_0x22edcf,_0x400670,_0x4eec81,_0x444c50,_0xd1a08a,_0x102679,_0x1b5321){var _0x2e1280=_0x3d9a21,_0x51c419=this;return _0x400670[_0x2e1280(0x10c)+_0xd1a08a['toString']()]=!0x0,function(_0x53bb5f){var _0x1b6028=_0x2e1280,_0x33a1ca=_0x102679[_0x1b6028(0x133)][_0x1b6028(0x13f)],_0x3455d5=_0x102679[_0x1b6028(0x133)][_0x1b6028(0x13e)],_0x24add8=_0x102679[_0x1b6028(0x133)][_0x1b6028(0x1c6)];_0x102679[_0x1b6028(0x133)][_0x1b6028(0x1c6)]=_0x33a1ca,_0x102679['node'][_0x1b6028(0x13e)]=_0x53bb5f,_0x22edcf[_0x1b6028(0x1be)](_0x51c419[_0x1b6028(0x1ed)](_0x4eec81,_0x444c50,_0xd1a08a,_0x102679,_0x1b5321)),_0x102679[_0x1b6028(0x133)][_0x1b6028(0x1c6)]=_0x24add8,_0x102679[_0x1b6028(0x133)]['index']=_0x3455d5;};}[_0x3d9a21(0x1ed)](_0x452b20,_0x33495e,_0x45f0d7,_0x5b0458,_0x30b1d2){var _0xe85f5d=_0x3d9a21,_0x4c3d55=this;_0x30b1d2||(_0x30b1d2=function(_0x408c06,_0x12d371){return _0x408c06[_0x12d371];});var _0xfed1eb=_0x45f0d7[_0xe85f5d(0x11d)](),_0x309567=_0x5b0458['expressionsToEvaluate']||{},_0x11e018=_0x5b0458[_0xe85f5d(0x13a)],_0x193f8b=_0x5b0458[_0xe85f5d(0x1ba)];try{var _0x308a2f=this[_0xe85f5d(0x1b1)](_0x452b20),_0x1f58dc=_0xfed1eb;_0x308a2f&&_0x1f58dc[0x0]==='\\x27'&&(_0x1f58dc=_0x1f58dc[_0xe85f5d(0x184)](0x1,_0x1f58dc[_0xe85f5d(0x11a)]-0x2));var _0xba61ba=_0x5b0458[_0xe85f5d(0x1fa)]=_0x309567[_0xe85f5d(0x10c)+_0x1f58dc];_0xba61ba&&(_0x5b0458[_0xe85f5d(0x13a)]=_0x5b0458[_0xe85f5d(0x13a)]+0x1),_0x5b0458['isExpressionToEvaluate']=!!_0xba61ba;var _0x47966c=typeof _0x45f0d7==_0xe85f5d(0x15f),_0x408e0e={'name':_0x47966c||_0x308a2f?_0xfed1eb:this[_0xe85f5d(0x1f0)](_0xfed1eb)};if(_0x47966c&&(_0x408e0e[_0xe85f5d(0x15f)]=!0x0),!(_0x33495e===_0xe85f5d(0x134)||_0x33495e===_0xe85f5d(0x1d1))){var _0x2f26ef=this[_0xe85f5d(0x175)](_0x452b20,_0x45f0d7);if(_0x2f26ef&&(_0x2f26ef[_0xe85f5d(0x193)]&&(_0x408e0e['setter']=!0x0),_0x2f26ef[_0xe85f5d(0x1af)]&&!_0xba61ba&&!_0x5b0458['resolveGetters']))return _0x408e0e[_0xe85f5d(0x161)]=!0x0,this['_processTreeNodeResult'](_0x408e0e,_0x5b0458),_0x408e0e;}var _0x4c4b92;try{_0x4c4b92=_0x30b1d2(_0x452b20,_0x45f0d7);}catch(_0x22aef4){return _0x408e0e={'name':_0xfed1eb,'type':_0xe85f5d(0x10b),'error':_0x22aef4['message']},this[_0xe85f5d(0x146)](_0x408e0e,_0x5b0458),_0x408e0e;}var _0x50d546=this['_type'](_0x4c4b92),_0x1258b1=this[_0xe85f5d(0x170)](_0x50d546);if(_0x408e0e['type']=_0x50d546,_0x1258b1)this['_processTreeNodeResult'](_0x408e0e,_0x5b0458,_0x4c4b92,function(){var _0x5d234c=_0xe85f5d;_0x408e0e[_0x5d234c(0x114)]=_0x4c4b92[_0x5d234c(0x129)](),!_0xba61ba&&_0x4c3d55['_capIfString'](_0x50d546,_0x408e0e,_0x5b0458,{});});else{var _0x1bb22b=_0x5b0458[_0xe85f5d(0x180)]&&_0x5b0458['level']<_0x5b0458[_0xe85f5d(0x198)]&&_0x5b0458[_0xe85f5d(0x109)][_0xe85f5d(0x1f6)](_0x4c4b92)<0x0&&_0x50d546!==_0xe85f5d(0x1a2)&&_0x5b0458[_0xe85f5d(0x16b)]<_0x5b0458['autoExpandLimit'];_0x1bb22b||_0x5b0458[_0xe85f5d(0x13b)]<_0x11e018||_0xba61ba?(this[_0xe85f5d(0x1c0)](_0x408e0e,_0x4c4b92,_0x5b0458,_0xba61ba||{}),this['_additionalMetadata'](_0x4c4b92,_0x408e0e)):this[_0xe85f5d(0x146)](_0x408e0e,_0x5b0458,_0x4c4b92,function(){var _0x4f1251=_0xe85f5d;_0x50d546===_0x4f1251(0x1b2)||_0x50d546===_0x4f1251(0x1fb)||(delete _0x408e0e[_0x4f1251(0x114)],_0x408e0e[_0x4f1251(0x19f)]=!0x0);});}return _0x408e0e;}finally{_0x5b0458[_0xe85f5d(0x1fa)]=_0x309567,_0x5b0458[_0xe85f5d(0x13a)]=_0x11e018,_0x5b0458[_0xe85f5d(0x1ba)]=_0x193f8b;}}[_0x3d9a21(0x186)](_0x1da6f2,_0x15129f,_0x199d09,_0x3d0a5f){var _0x58c343=_0x3d9a21,_0x1e0850=_0x3d0a5f[_0x58c343(0x185)]||_0x199d09['strLength'];if((_0x1da6f2===_0x58c343(0x1a3)||_0x1da6f2===_0x58c343(0x14a))&&_0x15129f[_0x58c343(0x114)]){let _0xf000d2=_0x15129f[_0x58c343(0x114)]['length'];_0x199d09['allStrLength']+=_0xf000d2,_0x199d09[_0x58c343(0x1d2)]>_0x199d09[_0x58c343(0x130)]?(_0x15129f['capped']='',delete _0x15129f[_0x58c343(0x114)]):_0xf000d2>_0x1e0850&&(_0x15129f[_0x58c343(0x19f)]=_0x15129f[_0x58c343(0x114)]['substr'](0x0,_0x1e0850),delete _0x15129f['value']);}}['_isMap'](_0x31ac67){var _0x1d2477=_0x3d9a21;return!!(_0x31ac67&&_0x436f8b[_0x1d2477(0x17b)]&&this[_0x1d2477(0x106)](_0x31ac67)===_0x1d2477(0x1fc)&&_0x31ac67[_0x1d2477(0x1f9)]);}[_0x3d9a21(0x1f0)](_0x5c8351){var _0x2ae93e=_0x3d9a21;if(_0x5c8351[_0x2ae93e(0x132)](/^\\d+$/))return _0x5c8351;var _0x3dbfa0;try{_0x3dbfa0=JSON[_0x2ae93e(0x12b)](''+_0x5c8351);}catch{_0x3dbfa0='\\x22'+this['_objectToString'](_0x5c8351)+'\\x22';}return _0x3dbfa0[_0x2ae93e(0x132)](/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)?_0x3dbfa0=_0x3dbfa0[_0x2ae93e(0x184)](0x1,_0x3dbfa0[_0x2ae93e(0x11a)]-0x2):_0x3dbfa0=_0x3dbfa0[_0x2ae93e(0x1ee)](/'/g,'\\x5c\\x27')[_0x2ae93e(0x1ee)](/\\\\"/g,'\\x22')['replace'](/(^"|"$)/g,'\\x27'),_0x3dbfa0;}['_processTreeNodeResult'](_0x1a2671,_0x16945f,_0x444910,_0x48f4e3){var _0xe66569=_0x3d9a21;this[_0xe66569(0x1e9)](_0x1a2671,_0x16945f),_0x48f4e3&&_0x48f4e3(),this[_0xe66569(0x188)](_0x444910,_0x1a2671),this[_0xe66569(0x137)](_0x1a2671,_0x16945f);}[_0x3d9a21(0x1e9)](_0xf6869d,_0x1d654a){var _0x2c0c4f=_0x3d9a21;this[_0x2c0c4f(0x179)](_0xf6869d,_0x1d654a),this[_0x2c0c4f(0x14b)](_0xf6869d,_0x1d654a),this[_0x2c0c4f(0x14c)](_0xf6869d,_0x1d654a),this[_0x2c0c4f(0x111)](_0xf6869d,_0x1d654a);}[_0x3d9a21(0x179)](_0x3211e1,_0x977d1d){}[_0x3d9a21(0x14b)](_0x27e91a,_0x568335){}['_setNodeLabel'](_0x3fca3e,_0x59efbe){}[_0x3d9a21(0x16a)](_0x5f3189){var _0x1b153d=_0x3d9a21;return _0x5f3189===this[_0x1b153d(0x12a)];}[_0x3d9a21(0x137)](_0x510731,_0x4444be){var _0x5ab959=_0x3d9a21;this[_0x5ab959(0x1d0)](_0x510731,_0x4444be),this[_0x5ab959(0x1e8)](_0x510731),_0x4444be[_0x5ab959(0x16e)]&&this['_sortProps'](_0x510731),this[_0x5ab959(0x19e)](_0x510731,_0x4444be),this[_0x5ab959(0x11f)](_0x510731,_0x4444be),this['_cleanNode'](_0x510731);}[_0x3d9a21(0x188)](_0x27c62c,_0x3ab1b1){var _0x29b27c=_0x3d9a21;let _0x1070a4;try{_0x436f8b[_0x29b27c(0x168)]&&(_0x1070a4=_0x436f8b[_0x29b27c(0x168)][_0x29b27c(0x1c1)],_0x436f8b[_0x29b27c(0x168)][_0x29b27c(0x1c1)]=function(){}),_0x27c62c&&typeof _0x27c62c[_0x29b27c(0x11a)]=='number'&&(_0x3ab1b1[_0x29b27c(0x11a)]=_0x27c62c['length']);}catch{}finally{_0x1070a4&&(_0x436f8b['console'][_0x29b27c(0x1c1)]=_0x1070a4);}if(_0x3ab1b1[_0x29b27c(0x1d4)]==='number'||_0x3ab1b1[_0x29b27c(0x1d4)]===_0x29b27c(0x1c9)){if(isNaN(_0x3ab1b1[_0x29b27c(0x114)]))_0x3ab1b1['nan']=!0x0,delete _0x3ab1b1[_0x29b27c(0x114)];else switch(_0x3ab1b1[_0x29b27c(0x114)]){case Number[_0x29b27c(0x17e)]:_0x3ab1b1[_0x29b27c(0x1a4)]=!0x0,delete _0x3ab1b1[_0x29b27c(0x114)];break;case Number[_0x29b27c(0x1f5)]:_0x3ab1b1['negativeInfinity']=!0x0,delete _0x3ab1b1[_0x29b27c(0x114)];break;case 0x0:this['_isNegativeZero'](_0x3ab1b1['value'])&&(_0x3ab1b1[_0x29b27c(0x1de)]=!0x0);break;}}else _0x3ab1b1['type']===_0x29b27c(0x1a2)&&typeof _0x27c62c['name']==_0x29b27c(0x1a3)&&_0x27c62c[_0x29b27c(0x1e2)]&&_0x3ab1b1[_0x29b27c(0x1e2)]&&_0x27c62c[_0x29b27c(0x1e2)]!==_0x3ab1b1[_0x29b27c(0x1e2)]&&(_0x3ab1b1[_0x29b27c(0x112)]=_0x27c62c[_0x29b27c(0x1e2)]);}[_0x3d9a21(0x141)](_0x45525f){var _0x379dc3=_0x3d9a21;return 0x1/_0x45525f===Number[_0x379dc3(0x1f5)];}[_0x3d9a21(0x1e1)](_0xd179f8){var _0x4afa5e=_0x3d9a21;!_0xd179f8['props']||!_0xd179f8[_0x4afa5e(0x176)][_0x4afa5e(0x11a)]||_0xd179f8[_0x4afa5e(0x1d4)]===_0x4afa5e(0x134)||_0xd179f8[_0x4afa5e(0x1d4)]===_0x4afa5e(0x17b)||_0xd179f8[_0x4afa5e(0x1d4)]===_0x4afa5e(0x1f2)||_0xd179f8[_0x4afa5e(0x176)][_0x4afa5e(0x1db)](function(_0x33017e,_0x59dff9){var _0x2737bb=_0x4afa5e,_0x3fdd55=_0x33017e[_0x2737bb(0x1e2)]['toLowerCase'](),_0x1dee72=_0x59dff9[_0x2737bb(0x1e2)][_0x2737bb(0x1c2)]();return _0x3fdd55<_0x1dee72?-0x1:_0x3fdd55>_0x1dee72?0x1:0x0;});}[_0x3d9a21(0x19e)](_0x8f166c,_0x1e9e59){var _0x2a5376=_0x3d9a21;if(!(_0x1e9e59[_0x2a5376(0x1a6)]||!_0x8f166c[_0x2a5376(0x176)]||!_0x8f166c[_0x2a5376(0x176)][_0x2a5376(0x11a)])){for(var _0x393de0=[],_0x41e64e=[],_0x57c677=0x0,_0x3ed65a=_0x8f166c[_0x2a5376(0x176)][_0x2a5376(0x11a)];_0x57c677<_0x3ed65a;_0x57c677++){var _0x2b0b76=_0x8f166c[_0x2a5376(0x176)][_0x57c677];_0x2b0b76['type']==='function'?_0x393de0[_0x2a5376(0x1be)](_0x2b0b76):_0x41e64e[_0x2a5376(0x1be)](_0x2b0b76);}if(!(!_0x41e64e[_0x2a5376(0x11a)]||_0x393de0[_0x2a5376(0x11a)]<=0x1)){_0x8f166c[_0x2a5376(0x176)]=_0x41e64e;var _0x721e1={'functionsNode':!0x0,'props':_0x393de0};this[_0x2a5376(0x179)](_0x721e1,_0x1e9e59),this[_0x2a5376(0x1d0)](_0x721e1,_0x1e9e59),this['_setNodeExpandableState'](_0x721e1),this[_0x2a5376(0x111)](_0x721e1,_0x1e9e59),_0x721e1['id']+='\\x20f',_0x8f166c[_0x2a5376(0x176)][_0x2a5376(0x1e6)](_0x721e1);}}}[_0x3d9a21(0x11f)](_0x2c3194,_0xf9ea16){}[_0x3d9a21(0x1e8)](_0xfe8928){}['_isArray'](_0x380d77){var _0x1ea84a=_0x3d9a21;return Array[_0x1ea84a(0x1b8)](_0x380d77)||typeof _0x380d77=='object'&&this[_0x1ea84a(0x106)](_0x380d77)===_0x1ea84a(0x17d);}['_setNodePermissions'](_0x3bb4d6,_0x3a90af){}[_0x3d9a21(0x1c5)](_0xef1915){var _0xf3a814=_0x3d9a21;delete _0xef1915['_hasSymbolPropertyOnItsPath'],delete _0xef1915[_0xf3a814(0x125)],delete _0xef1915[_0xf3a814(0x151)];}[_0x3d9a21(0x14c)](_0x2bd6f5,_0x538bce){}}let _0x10812a=new _0x23d17a(),_0x4ff2a5={'props':0x64,'elements':0x64,'strLength':0x400*0x32,'totalStrLength':0x400*0x32,'autoExpandLimit':0x1388,'autoExpandMaxDepth':0xa},_0x5e4fcf={'props':0x5,'elements':0x5,'strLength':0x100,'totalStrLength':0x100*0x3,'autoExpandLimit':0x1e,'autoExpandMaxDepth':0x2};function _0x12d488(_0x508018,_0x1a8bad,_0x236532,_0x36a608,_0x4f111d,_0x57a428){var _0x774d31=_0x3d9a21;let _0xef26c3,_0xdbc491;try{_0xdbc491=_0xd88d98(),_0xef26c3=_0x3af4cd[_0x1a8bad],!_0xef26c3||_0xdbc491-_0xef26c3['ts']>0x1f4&&_0xef26c3[_0x774d31(0x177)]&&_0xef26c3['time']/_0xef26c3[_0x774d31(0x177)]<0x64?(_0x3af4cd[_0x1a8bad]=_0xef26c3={'count':0x0,'time':0x0,'ts':_0xdbc491},_0x3af4cd['hits']={}):_0xdbc491-_0x3af4cd[_0x774d31(0x1dd)]['ts']>0x32&&_0x3af4cd[_0x774d31(0x1dd)][_0x774d31(0x177)]&&_0x3af4cd['hits'][_0x774d31(0x1cb)]/_0x3af4cd[_0x774d31(0x1dd)][_0x774d31(0x177)]<0x64&&(_0x3af4cd[_0x774d31(0x1dd)]={});let _0x278610=[],_0xed2db8=_0xef26c3[_0x774d31(0x173)]||_0x3af4cd[_0x774d31(0x1dd)]['reduceLimits']?_0x5e4fcf:_0x4ff2a5,_0x33b5a6=_0x3536b1=>{var _0x1592b9=_0x774d31;let _0xa24a11={};return _0xa24a11[_0x1592b9(0x176)]=_0x3536b1[_0x1592b9(0x176)],_0xa24a11[_0x1592b9(0x1bb)]=_0x3536b1[_0x1592b9(0x1bb)],_0xa24a11[_0x1592b9(0x185)]=_0x3536b1[_0x1592b9(0x185)],_0xa24a11['totalStrLength']=_0x3536b1[_0x1592b9(0x130)],_0xa24a11['autoExpandLimit']=_0x3536b1['autoExpandLimit'],_0xa24a11[_0x1592b9(0x198)]=_0x3536b1[_0x1592b9(0x198)],_0xa24a11[_0x1592b9(0x16e)]=!0x1,_0xa24a11[_0x1592b9(0x1a6)]=!_0x3b4919,_0xa24a11['depth']=0x1,_0xa24a11[_0x1592b9(0x13b)]=0x0,_0xa24a11['expId']=_0x1592b9(0x15d),_0xa24a11[_0x1592b9(0x16f)]=_0x1592b9(0x117),_0xa24a11[_0x1592b9(0x180)]=!0x0,_0xa24a11[_0x1592b9(0x109)]=[],_0xa24a11[_0x1592b9(0x16b)]=0x0,_0xa24a11['resolveGetters']=!0x0,_0xa24a11[_0x1592b9(0x1d2)]=0x0,_0xa24a11[_0x1592b9(0x133)]={'current':void 0x0,'parent':void 0x0,'index':0x0},_0xa24a11;};for(var _0x146dc2=0x0;_0x146dc2<_0x4f111d['length'];_0x146dc2++)_0x278610[_0x774d31(0x1be)](_0x10812a[_0x774d31(0x1c0)]({'timeNode':_0x508018===_0x774d31(0x1cb)||void 0x0},_0x4f111d[_0x146dc2],_0x33b5a6(_0xed2db8),{}));if(_0x508018==='trace'){let _0x318f25=Error[_0x774d31(0x121)];try{Error[_0x774d31(0x121)]=0x1/0x0,_0x278610[_0x774d31(0x1be)](_0x10812a[_0x774d31(0x1c0)]({'stackNode':!0x0},new Error()[_0x774d31(0x18e)],_0x33b5a6(_0xed2db8),{'strLength':0x1/0x0}));}finally{Error['stackTraceLimit']=_0x318f25;}}return{'method':_0x774d31(0x1d7),'version':_0x2e3e7b,'args':[{'ts':_0x236532,'session':_0x36a608,'args':_0x278610,'id':_0x1a8bad,'context':_0x57a428}]};}catch(_0x503431){return{'method':'log','version':_0x2e3e7b,'args':[{'ts':_0x236532,'session':_0x36a608,'args':[{'type':_0x774d31(0x10b),'error':_0x503431&&_0x503431[_0x774d31(0x10f)]}],'id':_0x1a8bad,'context':_0x57a428}]};}finally{try{if(_0xef26c3&&_0xdbc491){let _0x339773=_0xd88d98();_0xef26c3[_0x774d31(0x177)]++,_0xef26c3[_0x774d31(0x1cb)]+=_0x2e5831(_0xdbc491,_0x339773),_0xef26c3['ts']=_0x339773,_0x3af4cd[_0x774d31(0x1dd)]['count']++,_0x3af4cd['hits'][_0x774d31(0x1cb)]+=_0x2e5831(_0xdbc491,_0x339773),_0x3af4cd[_0x774d31(0x1dd)]['ts']=_0x339773,(_0xef26c3[_0x774d31(0x177)]>0x32||_0xef26c3[_0x774d31(0x1cb)]>0x64)&&(_0xef26c3[_0x774d31(0x173)]=!0x0),(_0x3af4cd['hits']['count']>0x3e8||_0x3af4cd['hits']['time']>0x12c)&&(_0x3af4cd[_0x774d31(0x1dd)][_0x774d31(0x173)]=!0x0);}}catch{}}}return _0x12d488;}function _0x209a(_0x344320,_0x3b0a3c){var _0x1d0ca6=_0x1d0c();return _0x209a=function(_0x209a5e,_0x4b1995){_0x209a5e=_0x209a5e-0x105;var _0x260849=_0x1d0ca6[_0x209a5e];return _0x260849;},_0x209a(_0x344320,_0x3b0a3c);}((_0x4daf98,_0x3a907d,_0x5bbf8a,_0xa2ffe1,_0x4fd0df,_0x1020df,_0x84d360,_0x203a2f,_0x58aeac,_0x3e96eb,_0x2b8bdc)=>{var _0x1af7d2=_0x51ad09;if(_0x4daf98[_0x1af7d2(0x14f)])return _0x4daf98[_0x1af7d2(0x14f)];if(!X(_0x4daf98,_0x203a2f,_0x4fd0df))return _0x4daf98[_0x1af7d2(0x14f)]={'consoleLog':()=>{},'consoleTrace':()=>{},'consoleTime':()=>{},'consoleTimeEnd':()=>{},'autoLog':()=>{},'autoLogMany':()=>{},'autoTraceMany':()=>{},'coverage':()=>{},'autoTrace':()=>{},'autoTime':()=>{},'autoTimeEnd':()=>{}},_0x4daf98[_0x1af7d2(0x14f)];let _0x555827=b(_0x4daf98),_0x304520=_0x555827[_0x1af7d2(0x191)],_0xf8d5a0=_0x555827[_0x1af7d2(0x1a0)],_0x561150=_0x555827['now'],_0xb070b2={'hits':{},'ts':{}},_0xf1e479=H(_0x4daf98,_0x58aeac,_0xb070b2,_0x1020df),_0x5438b2=_0x48a0cb=>{_0xb070b2['ts'][_0x48a0cb]=_0xf8d5a0();},_0x5a8d78=(_0x2ec37a,_0x48ce83)=>{var _0xc2f401=_0x1af7d2;let _0x1fcb7f=_0xb070b2['ts'][_0x48ce83];if(delete _0xb070b2['ts'][_0x48ce83],_0x1fcb7f){let _0x2afda1=_0x304520(_0x1fcb7f,_0xf8d5a0());_0x527d6a(_0xf1e479(_0xc2f401(0x1cb),_0x2ec37a,_0x561150(),_0x77429f,[_0x2afda1],_0x48ce83));}},_0x36db45=_0x5af3a2=>{var _0x119a9e=_0x1af7d2,_0x42c59b;return _0x4fd0df===_0x119a9e(0x1cf)&&_0x4daf98['origin']&&((_0x42c59b=_0x5af3a2==null?void 0x0:_0x5af3a2[_0x119a9e(0x1d6)])==null?void 0x0:_0x42c59b[_0x119a9e(0x11a)])&&(_0x5af3a2['args'][0x0]['origin']=_0x4daf98[_0x119a9e(0x139)]),_0x5af3a2;};_0x4daf98[_0x1af7d2(0x14f)]={'consoleLog':(_0x513d1a,_0xe4699f)=>{var _0x2ceba0=_0x1af7d2;_0x4daf98['console']['log'][_0x2ceba0(0x1e2)]!==_0x2ceba0(0x154)&&_0x527d6a(_0xf1e479(_0x2ceba0(0x1d7),_0x513d1a,_0x561150(),_0x77429f,_0xe4699f));},'consoleTrace':(_0x43a306,_0x2bbad6)=>{var _0x1187b5=_0x1af7d2;_0x4daf98[_0x1187b5(0x168)][_0x1187b5(0x1d7)][_0x1187b5(0x1e2)]!=='disabledTrace'&&_0x527d6a(_0x36db45(_0xf1e479('trace',_0x43a306,_0x561150(),_0x77429f,_0x2bbad6)));},'consoleTime':_0x3182a1=>{_0x5438b2(_0x3182a1);},'consoleTimeEnd':(_0x1669d3,_0x303947)=>{_0x5a8d78(_0x303947,_0x1669d3);},'autoLog':(_0x4dcca5,_0x89fb2f)=>{_0x527d6a(_0xf1e479('log',_0x89fb2f,_0x561150(),_0x77429f,[_0x4dcca5]));},'autoLogMany':(_0x19200c,_0x57ab5b)=>{_0x527d6a(_0xf1e479('log',_0x19200c,_0x561150(),_0x77429f,_0x57ab5b));},'autoTrace':(_0x10b2b4,_0x2a2fc9)=>{_0x527d6a(_0x36db45(_0xf1e479('trace',_0x2a2fc9,_0x561150(),_0x77429f,[_0x10b2b4])));},'autoTraceMany':(_0x2774b5,_0x375c09)=>{var _0x3f94b2=_0x1af7d2;_0x527d6a(_0x36db45(_0xf1e479(_0x3f94b2(0x16d),_0x2774b5,_0x561150(),_0x77429f,_0x375c09)));},'autoTime':(_0x567bf7,_0xf5d4b6,_0x308119)=>{_0x5438b2(_0x308119);},'autoTimeEnd':(_0x528e38,_0x267d93,_0x24338d)=>{_0x5a8d78(_0x267d93,_0x24338d);},'coverage':_0x2158e8=>{var _0x32a734=_0x1af7d2;_0x527d6a({'method':_0x32a734(0x1ea),'version':_0x1020df,'args':[{'id':_0x2158e8}]});}};let _0x527d6a=q(_0x4daf98,_0x3a907d,_0x5bbf8a,_0xa2ffe1,_0x4fd0df,_0x3e96eb,_0x2b8bdc),_0x77429f=_0x4daf98[_0x1af7d2(0x1b3)];return _0x4daf98[_0x1af7d2(0x14f)];})(globalThis,_0x51ad09(0x12d),_0x51ad09(0x162),_0x51ad09(0x187),_0x51ad09(0x10d),'1.0.0','1768167738261',_0x51ad09(0x1df),_0x51ad09(0x157),_0x51ad09(0x128),_0x51ad09(0x1c8));`);
  } catch (e) {
  }
}
function oo_oo(i, ...v) {
  try {
    oo_cm().consoleLog(i, v);
  } catch (e) {
  }
  return v;
}
export {
  MAIN_DIST,
  RECORDINGS_DIR,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
