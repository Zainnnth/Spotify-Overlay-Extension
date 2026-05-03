const { app, BrowserWindow, ipcMain, screen, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const crypto = require("crypto");
const http = require("http");

let mainWindow;
let tray;
let currentDockSide = "right";
let dockExpanded = true;
let currentDisplayId = null;
const SPOTIFY_ACCOUNTS = "https://accounts.spotify.com";
const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-modify-playback-state",
  "user-library-modify",
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative"
].join(" ");

function createWindow() {
  const primary = resolveTargetDisplay();
  const width = 500;
  const height = primary.workArea.height;
  const x = Math.max(0, primary.workArea.x + primary.workArea.width - width);
  const y = primary.workArea.y;

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setMinimumSize(width, height);
  mainWindow.setMaximumSize(width, height);
  mainWindow.loadFile("index.html");
}

function resolveTargetDisplay() {
  const displays = screen.getAllDisplays();
  if (currentDisplayId !== null) {
    const selected = displays.find((display) => display.id === currentDisplayId);
    if (selected) return selected;
  }
  return screen.getPrimaryDisplay();
}

function setWindowFocusable(expanded) {
  if (!mainWindow) return;
  mainWindow.setFocusable(Boolean(expanded));
}

function applyDockBounds(side, expanded) {
  if (!mainWindow) return;
  const targetDisplay = resolveTargetDisplay();
  const work = targetDisplay.workArea;
  const railWidth = 12;
  const panelWidth = 500;
  const width = expanded ? panelWidth : railWidth;
  const x = side === "left" ? work.x : work.x + work.width - width;

  currentDockSide = side === "left" ? "left" : "right";
  dockExpanded = Boolean(expanded);
  setWindowFocusable(dockExpanded);
  mainWindow.setMinimumSize(width, work.height);
  mainWindow.setMaximumSize(width, work.height);
  mainWindow.setBounds({ x, y: work.y, width, height: work.height });
}

function createTray() {
  // Tiny neutral icon for Windows tray.
  const trayIcon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAKElEQVR42mNgGAWjYBSMglEwCkbBKBhFQxj+T4YGBgaG/2M0jIJRMApGAQAT5QfA6E4z3QAAAABJRU5ErkJggg=="
  );
  tray = new Tray(trayIcon);
  tray.setToolTip("Spotify Jam Widget");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show", click: () => mainWindow?.show() },
      { label: "Hide", click: () => mainWindow?.hide() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() }
    ])
  );
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("widget:hide", () => {
  if (!mainWindow) return;
  mainWindow.hide();
});

ipcMain.handle("widget:show", () => {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  setWindowFocusable(true);
});

ipcMain.handle("widget:minimize", () => {
  if (!mainWindow) return;
  mainWindow.minimize();
});

ipcMain.handle("widget:setDock", (_event, side) => {
  const resolved = side === "left" ? "left" : "right";
  applyDockBounds(resolved, dockExpanded);
});

ipcMain.handle("widget:setExpanded", (_event, expanded) => {
  applyDockBounds(currentDockSide, Boolean(expanded));
});

ipcMain.handle("widget:getDisplays", () => {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((display, index) => ({
    id: display.id,
    label: `Display ${index + 1}${display.id === primaryId ? " (Primary)" : ""}`,
    isPrimary: display.id === primaryId
  }));
});

ipcMain.handle("widget:setDisplay", (_event, displayId) => {
  const numericDisplayId = Number(displayId);
  if (!Number.isNaN(numericDisplayId)) {
    currentDisplayId = numericDisplayId;
  } else {
    currentDisplayId = null;
  }
  applyDockBounds(currentDockSide, dockExpanded);
  return currentDisplayId;
});

ipcMain.handle("widget:getVersion", () => app.getVersion());

function toBase64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sha256Base64Url(value) {
  return toBase64Url(crypto.createHash("sha256").update(value).digest());
}

function exchangeToken(bodyParams) {
  return fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(bodyParams)
  });
}

ipcMain.handle("spotify:login", async (_event, clientId) => {
  if (!clientId || typeof clientId !== "string") {
    throw new Error("Missing Spotify Client ID.");
  }

  const codeVerifier = toBase64Url(crypto.randomBytes(64));
  const codeChallenge = sha256Base64Url(codeVerifier);
  const state = toBase64Url(crypto.randomBytes(24));

  const authUrl = new URL(`${SPOTIFY_ACCOUNTS}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", SPOTIFY_SCOPES);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", codeChallenge);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || "/", REDIRECT_URI);
        if (reqUrl.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const returnedState = reqUrl.searchParams.get("state");
        const returnedCode = reqUrl.searchParams.get("code");
        const error = reqUrl.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h3>Spotify login failed. You can close this tab.</h3>");
          reject(new Error(`Spotify authorization error: ${error}`));
          return;
        }

        if (!returnedCode || returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h3>Invalid OAuth callback. You can close this tab.</h3>");
          reject(new Error("Invalid OAuth callback state/code."));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h3>Spotify login complete. You can close this tab.</h3>");
        resolve(returnedCode);
      } finally {
        setTimeout(() => server.close(), 50);
      }
    });

    server.on("error", (err) => reject(err));
    server.listen(8888, "127.0.0.1", () => {
      shell.openExternal(authUrl.toString());
    });

    setTimeout(() => {
      try {
        server.close();
      } catch {}
      reject(new Error("Spotify login timed out."));
    }, 180000);
  });

  const tokenResponse = await exchangeToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: codeVerifier
  });

  const tokenText = await tokenResponse.text();
  let tokenJson = {};
  try {
    tokenJson = tokenText ? JSON.parse(tokenText) : {};
  } catch {
    throw new Error("Spotify returned an invalid login response.");
  }
  if (!tokenResponse.ok) {
    throw new Error(tokenJson.error_description || tokenJson.error || "Token exchange failed.");
  }

  return {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || "",
    expiresIn: tokenJson.expires_in || 3600,
    scope: tokenJson.scope || "",
    tokenType: tokenJson.token_type || "Bearer"
  };
});

ipcMain.handle("spotify:refresh", async (_event, { clientId, refreshToken }) => {
  if (!clientId || !refreshToken) {
    throw new Error("Missing Client ID or refresh token.");
  }

  const tokenResponse = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId
  });

  const tokenText = await tokenResponse.text();
  let tokenJson = {};
  try {
    tokenJson = tokenText ? JSON.parse(tokenText) : {};
  } catch {
    throw new Error("Spotify returned an invalid refresh response.");
  }
  if (!tokenResponse.ok) {
    throw new Error(tokenJson.error_description || tokenJson.error || "Refresh failed.");
  }

  return {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || refreshToken,
    expiresIn: tokenJson.expires_in || 3600,
    scope: tokenJson.scope || "",
    tokenType: tokenJson.token_type || "Bearer"
  };
});
