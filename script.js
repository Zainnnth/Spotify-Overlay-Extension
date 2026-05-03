import { safeParseJSON, getRefreshConfig, formatMs } from "./utils.js";
import { iconSvg } from "./icons.js";
import { createViewStateController } from "./view-state.js";
import { createActionDispatcher } from "./actions.js";
import { createSpotifyClient } from "./spotify-client.js";
import { createDiagnosticsController } from "./diagnostics.js";
import { createLocalSyncBridge } from "./sync-state.js";
import {
  renderNowPlayingFrame,
  createQueueController
} from "./queue-ui.js";

const SPOTIFY_API = "https://api.spotify.com/v1";

const jamWidget = document.getElementById("jamWidget");
const joinBtn = document.getElementById("joinBtn");
const queueBtn = document.getElementById("queueBtn");
const peekBtn = document.getElementById("peekBtn");
const hideBtn = document.getElementById("hideBtn");
const showBtn = document.getElementById("showBtn");
const edgeSensor = document.getElementById("edgeSensor");
const statusText = document.getElementById("statusText");
const loginPatchNotesText = document.getElementById("loginPatchNotesText");

const queuePopup = document.getElementById("queuePopup");
const popupHeader = document.getElementById("popupHeader");
const loginView = document.getElementById("loginView");
const permissionBanner = document.getElementById("permissionBanner");
const permissionBannerText = document.getElementById("permissionBannerText");
const permissionBannerBtn = document.getElementById("permissionBannerBtn");
const appView = document.getElementById("appView");
const jamSection = document.getElementById("jamSection");
const closePopupBtn = document.getElementById("closePopupBtn");
const refreshQueueBtn = document.getElementById("refreshQueueBtn");
const sourceSelect = document.getElementById("sourceSelect");
const sourceQuickBtn = document.getElementById("sourceQuickBtn");
const sourceQuickMenu = document.getElementById("sourceQuickMenu");
const refreshSourcesBtn = document.getElementById("refreshSourcesBtn");
const deviceSelect = document.getElementById("deviceSelect");
const refreshDevicesBtn = document.getElementById("refreshDevicesBtn");
const startPlaybackBtn = document.getElementById("startPlaybackBtn");
const refreshRateRange = document.getElementById("refreshRateRange");
const refreshRateLabel = document.getElementById("refreshRateLabel");
const jamLinkInput = document.getElementById("jamLinkInput");
const saveJamLinkBtn = document.getElementById("saveJamLinkBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsView = document.getElementById("settingsView");
const mainTabBtn = document.getElementById("mainTabBtn");
const settingsTabBtn = document.getElementById("settingsTabBtn");
const authRow = document.getElementById("authRow");
const logoutBtn = document.getElementById("logoutBtn");
const queueList = document.getElementById("queueList");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const searchBtn = document.getElementById("searchBtn");
const searchResults = document.getElementById("searchResults");
const npTitle = document.getElementById("npTitle");
const npArtist = document.getElementById("npArtist");
const npProgressText = document.getElementById("npProgressText");
const npDurationText = document.getElementById("npDurationText");
const npSeek = document.getElementById("npSeek");
const npVolume = document.getElementById("npVolume");
const npArtwork = document.getElementById("npArtwork");
const npMenuBtn = document.getElementById("npMenuBtn");
const npMenu = document.getElementById("npMenu");
const npPrevBtn = document.getElementById("npPrevBtn");
const npPlayPauseBtn = document.getElementById("npPlayPauseBtn");
const npNextBtn = document.getElementById("npNextBtn");
const collabToggle = document.getElementById("collabToggle");
const inviteBtn = document.getElementById("inviteBtn");
const endJamBtn = document.getElementById("endJamBtn");
const guestAvatars = document.getElementById("guestAvatars");
const memberLine = document.getElementById("memberLine");
const tokenInput = document.getElementById("tokenInput");
const connectBtn = document.getElementById("connectBtn");
const loginBtn = document.getElementById("loginBtn");
const refreshTokenBtn = document.getElementById("refreshTokenBtn");
const accountAttachState = document.getElementById("accountAttachState");
const dockLeftBtn = document.getElementById("dockLeftBtn");
const dockRightBtn = document.getElementById("dockRightBtn");
const displaySelect = document.getElementById("displaySelect");
const diagnosticsText = document.getElementById("diagnosticsText");
const actionLogText = document.getElementById("actionLogText");
const appVersionText = document.getElementById("appVersionText");
const exportDiagnosticsBtn = document.getElementById("exportDiagnosticsBtn");
const clearLogBtn = document.getElementById("clearLogBtn");
const resetSettingsBtn = document.getElementById("resetSettingsBtn");
const resetAppDataBtn = document.getElementById("resetAppDataBtn");
const isDesktopWidget = typeof window.widgetDesktop !== "undefined";

let accessToken = localStorage.getItem("spotify_access_token") || "";
const DEFAULT_SPOTIFY_CLIENT_ID = "4867b1731088414eb0dbe18180aea387";
let refreshToken = localStorage.getItem("spotify_refresh_token") || "";
let tokenExpiresAt = Number(localStorage.getItem("spotify_token_expires_at") || "0");
if (accessToken) tokenInput.value = accessToken;
let nowPlayingState = { isPlaying: false, durationMs: 0, progressMs: 0, lastSyncAt: 0 };
let nowPlayingItemMeta = null;

let side = "right";
let edgePeekMode = localStorage.getItem("jam_edge_peek_mode") === "1";
let peekHideTimer = null;
let isJoined = localStorage.getItem("jam_is_joined") === "1";
let collabEnabled = localStorage.getItem("jam_collab_enabled") !== "0";
let jamMembers = safeParseJSON("jam_members", []);
let listMode = "queue";
let lastApiError = "";
let savedJamLink = localStorage.getItem("jam_invite_link") || "";
let skipTrackUris = new Set(safeParseJSON("jam_skip_track_uris", safeParseJSON("jam_hidden_track_uris", [])));
let pinnedTrackUris = new Set(safeParseJSON("jam_pinned_track_uris", []));
let trackOwners = safeParseJSON("jam_track_owners", {});
let nowPlayingTimer = null;
let queueTimer = null;
let searchHideTimer = null;
let currentUserProfile = safeParseJSON("jam_current_user_profile", { name: "", imageUrl: "" });
let selectedDisplayId = localStorage.getItem("jam_widget_display_id") || "";
let selectedPlaybackDeviceId = localStorage.getItem("jam_playback_device_id") || "";
let selectedPlaybackSource = localStorage.getItem("jam_playback_source") || "liked";
let playbackInitialized = localStorage.getItem("jam_playback_initialized") === "1";
let currentMainView = "main";
let prioritizedBypassUri = localStorage.getItem("jam_prioritized_bypass_uri") || "";
let queueRefreshInFlight = false;
let nowPlayingRefreshInFlight = false;
let loadQueue = async () => {};
let loadSkipList = async () => {};
let loadNowPlaying = async () => {};
let runSearch = async () => {};
let applyListFilter = () => {};
let logAction = () => {};
let renderActionLogs = () => {};
let renderDiagnostics = () => {};
let setStatus = () => {};
let getActionLogs = () => [];
const TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;
const LOCAL_SYNC_KEY = "jam_local_sync_state";
const LOCAL_SYNC_CHANNEL = "spotify-jam-widget-local-sync-v1";
const ACTION_LOG_KEY = "jam_action_log";
const ACTION_LOG_MAX = 120;
const localSyncId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
let suppressLocalSync = false;
let localSyncChannel = null;

const sideClassNames = ["side-left", "side-right", "side-top"];
const allowedSides = ["right", "left"];
const REQUIRED_SCOPE_MARKER = "scope-v3-library-and-playlists";

function hasEl(el) {
  return el !== null && el !== undefined;
}

function guard(label, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`[widget-guard] ${label}`, error);
  }
}

const viewStateController = createViewStateController({
  loginView,
  appView,
  popupHeader,
  settingsView,
  mainTabBtn,
  settingsBtn,
  joinBtn,
  queueBtn,
  peekBtn,
  hideBtn,
  queuePopup,
  jamWidget,
  tokenInput,
  edgePeekModeRef: () => edgePeekMode,
  isDesktopWidget,
  widgetDesktop: window.widgetDesktop,
  getCurrentMainView: () => currentMainView,
  setCurrentMainView: (value) => { currentMainView = value; }
});
const { setAuthView, setTab, setPopupState } = viewStateController;
const diagnosticsController = createDiagnosticsController({
  actionLogKey: ACTION_LOG_KEY,
  actionLogMax: ACTION_LOG_MAX,
  actionLogText,
  diagnosticsText,
  statusText,
  getScope: () => localStorage.getItem("spotify_granted_scope") || "Unknown",
  getTokenExpiresAt: () => localStorage.getItem("spotify_token_expires_at"),
  getSavedSide: () => localStorage.getItem("jam_widget_side") || "right",
  getDisplayValue: () => localStorage.getItem("jam_widget_display_id") || "Primary",
  getPeekMode: () => edgePeekMode,
  getSavedJamLink: () => savedJamLink,
  getLocalSyncMode: () => (localSyncChannel ? "On" : "Fallback"),
  getRefreshLevel: () => localStorage.getItem("jam_refresh_level") || "5",
  getLastApiError: () => lastApiError
});
getActionLogs = diagnosticsController.getActionLogs;
renderActionLogs = diagnosticsController.renderActionLogs;
logAction = diagnosticsController.logAction;
renderDiagnostics = diagnosticsController.renderDiagnostics;
setStatus = (message, isError = false) => diagnosticsController.setStatus(message, isError, (err) => {
  lastApiError = err;
  syncPermissionBannerFromStatus(message || "", Boolean(isError));
  renderDiagnostics();
});

function showPermissionBanner(message) {
  if (!hasEl(permissionBanner)) return;
  permissionBanner.hidden = false;
  if (hasEl(permissionBannerText)) {
    permissionBannerText.textContent = message || "Spotify permissions need refresh.";
  }
}

function hidePermissionBanner() {
  if (!hasEl(permissionBanner)) return;
  permissionBanner.hidden = true;
}

function syncPermissionBannerFromStatus(message, isError) {
  const text = String(message || "");
  if (!isError) return;
  if (/missing spotify permission|permissions updated|re-authorize|insufficient|scope/i.test(text)) {
    showPermissionBanner("Spotify permissions are out of date. Click Re-authorize.");
  }
}

function getLocalSyncState() {
  return {
    isJoined,
    collabEnabled,
    jamMembers: Array.from(jamMembers),
    savedJamLink,
    skipTrackUris: Array.from(skipTrackUris),
    pinnedTrackUris: Array.from(pinnedTrackUris),
    trackOwners,
    side,
    edgePeekMode,
    currentUserProfile
  };
}

function applyLocalSyncState(state) {
  if (!state || typeof state !== "object") return;
  suppressLocalSync = true;
  try {
    if (Array.isArray(state.jamMembers)) {
      jamMembers = state.jamMembers.filter(Boolean);
      persistJamMembers();
    }
    if (typeof state.isJoined === "boolean") {
      isJoined = state.isJoined;
      localStorage.setItem("jam_is_joined", isJoined ? "1" : "0");
    }
    if (typeof state.collabEnabled === "boolean") {
      collabEnabled = state.collabEnabled;
      localStorage.setItem("jam_collab_enabled", collabEnabled ? "1" : "0");
    }
    if (typeof state.savedJamLink === "string") {
      savedJamLink = state.savedJamLink;
      localStorage.setItem("jam_invite_link", savedJamLink);
      syncJamLinkInput();
    }
    if (Array.isArray(state.skipTrackUris)) {
      skipTrackUris = new Set(state.skipTrackUris.filter(Boolean));
      persistSkipTracks();
    }
    if (Array.isArray(state.hiddenTrackUris)) {
      skipTrackUris = new Set(state.hiddenTrackUris.filter(Boolean));
      persistSkipTracks();
    }
    if (Array.isArray(state.pinnedTrackUris)) {
      pinnedTrackUris = new Set(state.pinnedTrackUris.filter(Boolean));
      persistPinnedTracks();
    }
    if (state.trackOwners && typeof state.trackOwners === "object") {
      trackOwners = { ...state.trackOwners };
      persistTrackOwners();
    }
    if (typeof state.edgePeekMode === "boolean") {
      edgePeekMode = state.edgePeekMode;
      localStorage.setItem("jam_edge_peek_mode", edgePeekMode ? "1" : "0");
      setEdgePeekMode(edgePeekMode);
    }
    if (typeof state.side === "string" && allowedSides.includes(state.side)) {
      applySide(state.side);
      localStorage.setItem("jam_widget_side", state.side);
      syncDockButtons();
      positionQueuePopup();
    }
    if (state.currentUserProfile && typeof state.currentUserProfile === "object") {
      const incomingName = state.currentUserProfile.name || "";
      const currentName = currentUserProfile?.name || "";
      if (!currentName || currentName === incomingName) {
        currentUserProfile = {
          name: incomingName,
          imageUrl: state.currentUserProfile.imageUrl || ""
        };
        persistCurrentUserProfile();
      }
    }
    syncJoinButton();
    syncCollabToggle();
    renderJamMembers();
    renderDiagnostics();
  } finally {
    suppressLocalSync = false;
  }

  if (queuePopup?.classList.contains("open")) {
    if (listMode === "skip") loadSkipList({ silent: true, preserveScroll: true });
    else loadQueue({ silent: true, preserveScroll: true });
  }
}

const localSyncBridge = createLocalSyncBridge({
  localSyncKey: LOCAL_SYNC_KEY,
  localSyncChannelName: LOCAL_SYNC_CHANNEL,
  localSyncId,
  getPayloadState: getLocalSyncState,
  applyIncomingState: applyLocalSyncState,
  isSuppressed: () => suppressLocalSync,
  onChannelReadyState: () => {
    localSyncChannel = localSyncBridge.getChannel();
  }
});

function broadcastLocalSync(reason = "update") {
  localSyncBridge.broadcast(reason);
}

function initLocalSync() {
  localSyncBridge.init();
  localSyncChannel = localSyncBridge.getChannel();
}

function clearAuthState(silent = false) {
  accessToken = "";
  refreshToken = "";
  tokenExpiresAt = 0;
  tokenInput.value = "";
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_token_expires_at");
  localStorage.removeItem("spotify_granted_scope");
  if (!silent) setStatus("Session expired. Please sign in again.", true);
  renderDiagnostics();
}

function buildDiagnosticsSnapshot() {
  return {
    capturedAt: new Date().toISOString(),
    appVersion: appVersionText?.textContent?.replace("Version: ", "") || "unknown",
    signedIn: Boolean(localStorage.getItem("spotify_access_token")),
    dockSide: localStorage.getItem("jam_widget_side") || "right",
    peekMode: edgePeekMode,
    refreshLevel: localStorage.getItem("jam_refresh_level") || "5",
    selectedDisplayId: localStorage.getItem("jam_widget_display_id") || "",
    selectedPlaybackDeviceId: localStorage.getItem("jam_playback_device_id") || "",
    lastApiError,
    actionLogs: getActionLogs()
  };
}

function syncCollabToggle() {
  if (!hasEl(collabToggle)) return;
  collabToggle.classList.toggle("on", collabEnabled);
  collabToggle.setAttribute("aria-pressed", String(collabEnabled));
}

function syncJamSectionVisibility() {
  if (!hasEl(jamSection)) return;
  jamSection.hidden = !isJoined;
}

function persistJamMembers() {
  localStorage.setItem("jam_members", JSON.stringify(jamMembers));
  broadcastLocalSync("jam_members");
}

function renderJamMembers() {
  if (!hasEl(guestAvatars) || !hasEl(memberLine)) return;
  guestAvatars.innerHTML = "";
  if (!jamMembers.length) {
    memberLine.textContent = "No one in the jam yet.";
    return;
  }
  memberLine.textContent = jamMembers.join(", ");
  jamMembers.slice(0, 6).forEach((name) => {
    const dot = document.createElement("span");
    dot.className = "avatar";
    dot.title = name;
    dot.setAttribute("aria-label", name);
    dot.textContent = getOwnerInitial(name);
    if (name === currentUserProfile?.name && currentUserProfile?.imageUrl) {
      dot.classList.add("avatar-image");
      dot.style.backgroundImage = `url("${currentUserProfile.imageUrl}")`;
      dot.textContent = "";
    }
    guestAvatars.appendChild(dot);
  });
}

function persistCurrentUserProfile() {
  localStorage.setItem("jam_current_user_profile", JSON.stringify(currentUserProfile));
  broadcastLocalSync("current_user_profile");
}

function syncCurrentUserIdentity() {
  const name = currentUserProfile?.name?.trim() || "";
  if (isJoined) {
    jamMembers = jamMembers.filter(Boolean).map((member) => member === "You" ? name || member : member);
    if (name && !jamMembers.includes(name)) jamMembers.unshift(name);
  } else {
    jamMembers = jamMembers.filter(Boolean).map((member) => member === "You" ? name || member : member);
  }
  if (name) {
    trackOwners = Object.fromEntries(Object.entries(trackOwners).map(([uri, owner]) => [uri, owner === "You" ? name : owner]));
  }
  persistJamMembers();
  persistTrackOwners();
  persistCurrentUserProfile();
  renderJamMembers();
}

function applySide(newSide, syncNative = true) {
  if (!hasEl(jamWidget) || !hasEl(edgeSensor) || !hasEl(queuePopup)) return;
  if (!allowedSides.includes(newSide)) newSide = "right";
  side = newSide;
  jamWidget.classList.remove(...sideClassNames);
  jamWidget.classList.add(`side-${newSide}`);
  edgeSensor.classList.remove(...sideClassNames);
  edgeSensor.classList.add(`side-${newSide}`);
  queuePopup.classList.remove("side-left");
  if (newSide === "left") {
    queuePopup.classList.add("side-left");
  }
  if (newSide === "left") {
    jamWidget.style.left = "0px";
    jamWidget.style.top = "0px";
  } else {
    jamWidget.style.left = `${window.innerWidth - jamWidget.offsetWidth}px`;
    jamWidget.style.top = "0px";
  }
  jamWidget.style.right = "auto";
  jamWidget.style.bottom = "auto";
  if (syncNative && isDesktopWidget && window.widgetDesktop?.setDock) {
    window.widgetDesktop.setDock(newSide);
    if (window.widgetDesktop?.setExpanded) {
      window.widgetDesktop.setExpanded(queuePopup.classList.contains("open"));
    }
  }
  broadcastLocalSync("dock");
}

function syncDockButtons() {
  if (hasEl(dockLeftBtn)) dockLeftBtn.classList.toggle("active", side === "left");
  if (hasEl(dockRightBtn)) dockRightBtn.classList.toggle("active", side === "right");
}

function positionQueuePopup() {
  if (!hasEl(queuePopup)) return;
  if (side === "top") {
    queuePopup.style.left = "auto";
    queuePopup.style.right = "16px";
    queuePopup.style.top = "14px";
    return;
  }
  queuePopup.style.top = "0px";
  if (side === "left") {
    queuePopup.style.left = "0px";
    queuePopup.style.right = "auto";
  } else {
    queuePopup.style.left = "auto";
    queuePopup.style.right = "0px";
  }
}

function requireToken() {
  accessToken = tokenInput.value.trim();
  if (!accessToken) {
    setStatus("No token yet. Add Client ID and click Login.", true);
    return false;
  }
  return true;
}

function requireClientId() {
  const clientId = getConfiguredClientId();
  if (!clientId) {
    setStatus("Account not attached. Add a Spotify Client ID in Settings.", true);
    return "";
  }
  return clientId;
}

function getConfiguredClientId() {
  const persisted = (localStorage.getItem("spotify_client_id") || "").trim();
  if (persisted) return persisted;
  return DEFAULT_SPOTIFY_CLIENT_ID;
}

function syncAccountAttachState() {
  if (!hasEl(accountAttachState)) return;
  const configured = getConfiguredClientId();
  if (configured) {
    accountAttachState.textContent = "Account attached. Click Get Token to continue.";
    accountAttachState.classList.remove("error");
    return;
  }
  accountAttachState.textContent = "Account not attached.";
  accountAttachState.classList.add("error");
}

async function loadDisplayOptions() {
  if (!isDesktopWidget || !hasEl(displaySelect) || !window.widgetDesktop?.getDisplays) {
    if (hasEl(displaySelect)) displaySelect.disabled = true;
    return;
  }
  try {
    const displays = await window.widgetDesktop.getDisplays();
    if (!Array.isArray(displays) || displays.length <= 1) {
      displaySelect.innerHTML = '<option value="">Primary display</option>';
      displaySelect.disabled = true;
      if (selectedDisplayId) {
        await window.widgetDesktop.setDisplay(selectedDisplayId);
      }
      return;
    }
    displaySelect.disabled = false;
    displaySelect.innerHTML = displays
      .map((display) => `<option value="${display.id}">${display.label}</option>`)
      .join("");
    const hasSaved = selectedDisplayId && displays.some((display) => String(display.id) === String(selectedDisplayId));
    if (!hasSaved) {
      selectedDisplayId = String(displays.find((display) => display.isPrimary)?.id || displays[0].id);
      localStorage.setItem("jam_widget_display_id", selectedDisplayId);
    }
    displaySelect.value = selectedDisplayId;
    await window.widgetDesktop.setDisplay(selectedDisplayId);
  } catch (error) {
    logAction("error", `Display list failed: ${error.message || "unknown error"}`);
    displaySelect.disabled = true;
  }
}

async function loadPlaybackDevices() {
  if (!deviceSelect) return;
  if (!(await ensureValidToken())) return;
  try {
    const data = await spotifyFetch("/me/player/devices");
    const devices = Array.isArray(data?.devices) ? data.devices : [];
    if (!devices.length) {
      deviceSelect.innerHTML = '<option value="">No devices available</option>';
      deviceSelect.disabled = true;
      selectedPlaybackDeviceId = "";
      localStorage.setItem("jam_playback_device_id", "");
      syncPlayPauseAvailability();
      setStatus("No Spotify devices available. Open Spotify on a device first.", true);
      return;
    }
    deviceSelect.disabled = false;
    deviceSelect.innerHTML = devices
      .map((d) => `<option value="${d.id}">${d.name} (${d.type})${d.is_active ? " - Active" : ""}</option>`)
      .join("");
    const preferred = selectedPlaybackDeviceId && devices.some((d) => d.id === selectedPlaybackDeviceId)
      ? selectedPlaybackDeviceId
      : (devices.find((d) => d.is_active)?.id || devices[0].id);
    selectedPlaybackDeviceId = preferred;
    localStorage.setItem("jam_playback_device_id", preferred);
    deviceSelect.value = preferred;
    syncPlayPauseAvailability();
    setStatus(`Loaded ${devices.length} device(s).`);
  } catch (error) {
    deviceSelect.disabled = true;
    deviceSelect.innerHTML = '<option value="">Device load failed</option>';
    selectedPlaybackDeviceId = "";
    localStorage.setItem("jam_playback_device_id", "");
    syncPlayPauseAvailability();
    setStatus(error.message || "Failed to load devices.", true);
  }
}

async function loadPlaybackSources() {
  if (!sourceSelect) return;
  if (!(await ensureValidToken())) return;
  try {
    const data = await spotifyFetch("/me/playlists?limit=50");
    const items = Array.isArray(data?.items) ? data.items : [];
    const options = [
      '<option value="liked">Liked Songs</option>',
      ...items
        .filter((pl) => pl?.uri && pl?.name)
        .map((pl) => `<option value="playlist:${pl.uri}">${pl.name}</option>`)
    ];
    sourceSelect.disabled = false;
    sourceSelect.innerHTML = options.join("");
    if (!selectedPlaybackSource || !options.join("").includes(`value="${selectedPlaybackSource}"`)) {
      selectedPlaybackSource = "liked";
    }
    sourceSelect.value = selectedPlaybackSource;
    localStorage.setItem("jam_playback_source", selectedPlaybackSource);
    syncSourceUI();
    setStatus(`Loaded ${items.length} playlist source(s).`);
  } catch (error) {
    sourceSelect.disabled = true;
    sourceSelect.innerHTML = '<option value="liked">Source load failed</option>';
    if (sourceQuickMenu) sourceQuickMenu.hidden = true;
    setStatus(error.message || "Failed to load playback sources.", true);
  }
}

async function startPlaybackOnSelectedDevice() {
  if (!(await ensureValidToken())) return;
  const deviceId = deviceSelect?.value || selectedPlaybackDeviceId || "";
  if (!deviceId) {
    setStatus("Select a Spotify device first.", true);
    return false;
  }
  try {
    const sourceValue = sourceSelect?.value || selectedPlaybackSource || "liked";
    await spotifyFetch("/me/player", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [deviceId], play: true })
    });

    if (sourceValue === "liked") {
      const likedData = await spotifyFetch("/me/tracks?limit=50");
      const uris = (likedData?.items || [])
        .map((entry) => entry?.track?.uri)
        .filter(Boolean)
        .slice(0, 50);
      if (!uris.length) {
        setStatus("No liked songs found to start playback.", true);
        return;
      }
      await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris, offset: { position: 0 } })
      });
    } else if (sourceValue.startsWith("playlist:")) {
      const contextUri = sourceValue.replace("playlist:", "");
      await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context_uri: contextUri, offset: { position: 0 } })
      });
    } else {
      await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT"
      });
    }

    selectedPlaybackDeviceId = deviceId;
    localStorage.setItem("jam_playback_device_id", deviceId);
    selectedPlaybackSource = sourceValue;
    localStorage.setItem("jam_playback_source", sourceValue);
    playbackInitialized = true;
    localStorage.setItem("jam_playback_initialized", "1");
    setStatus("Playback started on selected device.");
    setTimeout(() => loadNowPlaying({ silent: true }), 300);
    return true;
  } catch (error) {
    setStatus(error.message || "Could not start playback on selected device.", true);
    return false;
  }
}

function syncPlayPauseAvailability() {
  if (!hasEl(npPlayPauseBtn)) return;
  const hasDevice = Boolean((deviceSelect?.value || selectedPlaybackDeviceId || "").trim());
  npPlayPauseBtn.disabled = !hasDevice;
  npPlayPauseBtn.style.opacity = hasDevice ? "1" : "0.45";
  npPlayPauseBtn.style.cursor = hasDevice ? "pointer" : "not-allowed";
}

function persistTrackOwners() {
  localStorage.setItem("jam_track_owners", JSON.stringify(trackOwners));
  broadcastLocalSync("track_owners");
}

function persistSkipTracks() {
  localStorage.setItem("jam_skip_track_uris", JSON.stringify(Array.from(skipTrackUris)));
  broadcastLocalSync("skip_tracks");
}

function setPrioritizedBypassUri(uri) {
  prioritizedBypassUri = String(uri || "");
  if (prioritizedBypassUri) {
    localStorage.setItem("jam_prioritized_bypass_uri", prioritizedBypassUri);
  } else {
    localStorage.removeItem("jam_prioritized_bypass_uri");
  }
}

function persistPinnedTracks() {
  localStorage.setItem("jam_pinned_track_uris", JSON.stringify(Array.from(pinnedTrackUris)));
  broadcastLocalSync("pinned_tracks");
}

function getTrackOwner(trackUri) {
  return trackOwners[trackUri] || currentUserProfile?.name || "Jam";
}

function getOwnerInitial(name) {
  return (name || "J").trim().charAt(0).toUpperCase();
}

function setPlaybackIcons() {
  if (hasEl(npPrevBtn)) npPrevBtn.innerHTML = `${iconSvg("prev")}<span class="sr-only">Previous track</span>`;
  if (hasEl(npNextBtn)) npNextBtn.innerHTML = `${iconSvg("next")}<span class="sr-only">Next track</span>`;
  if (hasEl(npPlayPauseBtn)) {
    const kind = nowPlayingState.isPlaying ? "pause" : "play";
    npPlayPauseBtn.innerHTML = `${iconSvg(kind)}<span class="sr-only">${nowPlayingState.isPlaying ? "Pause" : "Play"}</span>`;
  }
}

async function loadCurrentUserProfile() {
  try {
    const profile = await spotifyFetch("/me");
    if (!profile) return;
    currentUserProfile = {
      name: profile.display_name || "",
      imageUrl: profile.images?.[0]?.url || ""
    };
    persistCurrentUserProfile();
    syncCurrentUserIdentity();
    renderJamMembers();
    syncPlayPauseAvailability();
  } catch (error) {
    console.warn("Could not load Spotify profile", error);
  }
}

function isValidJamLink(value) {
  if (!value) return false;
  const v = value.trim();
  return /^https:\/\/spotify\.link\/[A-Za-z0-9]+/i.test(v) || /^https:\/\/open\.spotify\.com\/socialsession\//i.test(v);
}

function syncJamLinkInput() {
  if (!hasEl(jamLinkInput)) return;
  jamLinkInput.value = savedJamLink;
}

function getSourceDisplayName(value) {
  if (!value || value === "liked") return "Liked Songs";
  const fromSettings = sourceSelect?.selectedOptions?.[0]?.textContent?.trim();
  if (fromSettings) return fromSettings;
  return "Playlist";
}

function syncSourceUI() {
  if (sourceSelect) sourceSelect.value = selectedPlaybackSource || "liked";
  if (sourceQuickBtn) {
    sourceQuickBtn.title = `Source: ${getSourceDisplayName(selectedPlaybackSource)}`;
    sourceQuickBtn.setAttribute("aria-label", `Source: ${getSourceDisplayName(selectedPlaybackSource)}`);
  }
  renderSourceQuickMenu();
}

function renderSourceQuickMenu() {
  if (!sourceQuickMenu || !sourceSelect) return;
  const opts = Array.from(sourceSelect.options || []);
  sourceQuickMenu.innerHTML = opts.map((opt) => {
    const active = opt.value === selectedPlaybackSource ? "active" : "";
    return `<button type="button" class="source-quick-item ${active}" data-source-value="${opt.value}">${opt.textContent || "Source"}</button>`;
  }).join("");
}

function updateRefreshLabel(level) {
  if (!hasEl(refreshRateLabel)) return;
  if (level <= 3) refreshRateLabel.textContent = "Battery Saver";
  else if (level <= 7) refreshRateLabel.textContent = "Normal";
  else refreshRateLabel.textContent = "Fast";
}

function startPolling() {
  if (nowPlayingTimer) clearTimeout(nowPlayingTimer);
  if (queueTimer) clearTimeout(queueTimer);
  const { nowPlayingMs, queueMs } = getRefreshConfig(localStorage.getItem("jam_refresh_level") || 5);

  const tickNowPlaying = async () => {
    if (queuePopup.classList.contains("open") && tokenInput.value.trim() && !nowPlayingRefreshInFlight) {
      nowPlayingRefreshInFlight = true;
      try {
        await loadNowPlaying({ silent: true });
      } finally {
        nowPlayingRefreshInFlight = false;
      }
    }
    nowPlayingTimer = setTimeout(tickNowPlaying, nowPlayingMs);
  };

  const tickQueue = async () => {
    if (queuePopup.classList.contains("open") && tokenInput.value.trim() && !queueRefreshInFlight) {
      queueRefreshInFlight = true;
      try {
        if (listMode === "skip") await loadSkipList({ silent: true });
        else await loadQueue({ silent: true });
      } finally {
        queueRefreshInFlight = false;
      }
    }
    queueTimer = setTimeout(tickQueue, queueMs);
  };

  nowPlayingTimer = setTimeout(tickNowPlaying, nowPlayingMs);
  queueTimer = setTimeout(tickQueue, queueMs);
}

function syncVisibleState() {
  if (!tokenInput.value.trim()) return;
  if (!queuePopup.classList.contains("open")) return;
  if (listMode === "skip") loadSkipList({ silent: true, preserveScroll: true });
  else loadQueue({ silent: true, preserveScroll: true });
  loadNowPlaying({ silent: true });
}

const spotifyClient = createSpotifyClient({
  apiBase: SPOTIFY_API,
  getAccessToken: () => accessToken,
  setAccessToken: (v) => { accessToken = v; tokenInput.value = v || ""; },
  getRefreshToken: () => refreshToken,
  setRefreshToken: (v) => { refreshToken = v || ""; },
  getTokenExpiresAt: () => tokenExpiresAt,
  setTokenExpiresAt: (v) => { tokenExpiresAt = Number(v) || 0; },
  tokenRefreshSkewMs: TOKEN_REFRESH_SKEW_MS,
  getConfiguredClientId,
  isDesktopWidget,
  widgetDesktop: window.widgetDesktop,
  requireToken,
  setAuthView,
  setStatus,
  clearAuthState,
  renderDiagnostics,
  onAuthUpdated: () => {
    loadCurrentUserProfile();
    loadPlaybackSources();
    loadPlaybackDevices();
  }
});

function setAuthFromTokenResult(tokenResult) { return spotifyClient.setAuthFromTokenResult(tokenResult); }
async function refreshAccessToken() { return await spotifyClient.refreshAccessToken(); }
async function ensureValidToken() { return await spotifyClient.ensureValidToken(); }
async function spotifyFetch(path, options = {}) { return await spotifyClient.spotifyFetch(path, options); }

function scheduleSearchHide() {
  if (searchHideTimer) clearTimeout(searchHideTimer);
  searchHideTimer = setTimeout(() => {
    const searchFocused = document.activeElement === searchInput;
    const searchHovered = searchInput.matches(":hover") || searchResults.matches(":hover");
    if (!searchFocused && !searchHovered) {
      hideSearchResults();
    }
  }, 180);
}

function hideSearchResults() {
  if (searchHideTimer) clearTimeout(searchHideTimer);
  searchResults.hidden = true;
}

function syncClearSearchButton() {
  if (!clearSearchBtn) return;
  clearSearchBtn.hidden = !searchInput.value.trim();
}

function resolveTrackId(trackIdOrUri) {
  const raw = String(trackIdOrUri || "").trim();
  if (!raw) return "";
  if (raw.startsWith("spotify:track:")) {
    return raw.split(":")[2] || "";
  }
  return raw;
}

async function likeTrack(trackIdOrUri) {
  const trackId = resolveTrackId(trackIdOrUri);
  if (!trackId) {
    throw new Error("Track ID unavailable for like action.");
  }
  await spotifyFetch(`/me/tracks?ids=${encodeURIComponent(trackId)}`, { method: "PUT" });
}

async function addTrackToQueue(trackUri) {
  if (!trackUri) return;
  await spotifyFetch(`/me/player/queue?uri=${encodeURIComponent(trackUri)}`, { method: "POST" });
}

async function pinTrackToTop(trackUri) {
  if (!trackUri) return;
  if (!pinnedTrackUris.has(trackUri)) {
    pinnedTrackUris.add(trackUri);
    persistPinnedTracks();
  }
}

async function playbackCommand(path, method = "POST") {
  await spotifyFetch(path, { method });
}

const queueController = createQueueController({
  queueList,
  searchResults,
  searchInput,
  mainTabBtn,
  settingsTabBtn,
  npTitle,
  npArtist,
  npProgressText,
  npDurationText,
  npSeek,
  npVolume,
  spotifyFetch,
  ensureValidToken,
  playbackCommand,
  setStatus,
  formatMs,
  setPlaybackIcons,
  getPinnedTrackUris: () => pinnedTrackUris,
  getSkipTrackUris: () => skipTrackUris,
  persistSkipTracks,
  getPrioritizedBypassUri: () => prioritizedBypassUri,
  clearPrioritizedBypassUri: () => setPrioritizedBypassUri(""),
  getTrackOwner,
  getOwnerInitial,
  getSelectedPlaybackSource: () => selectedPlaybackSource,
  onNowPlayingItem: (item) => {
    nowPlayingItemMeta = item || null;
    const artwork = item?.album?.images?.[1]?.url || item?.album?.images?.[2]?.url || "";
    if (npArtwork) {
      if (artwork) {
        npArtwork.src = artwork;
        npArtwork.hidden = false;
      } else {
        npArtwork.hidden = true;
        npArtwork.removeAttribute("src");
      }
    }
  },
  getListMode: () => listMode,
  setListMode: (value) => { listMode = value; }
});
loadQueue = queueController.loadQueue;
loadSkipList = queueController.loadSkipList;
loadNowPlaying = (options = {}) => queueController.loadNowPlaying({ ...options, nowPlayingState });
runSearch = queueController.runSearch;
applyListFilter = queueController.applyListFilter || (() => {});

function tickNowPlayingUI() {
  renderNowPlayingFrame(
    nowPlayingState,
    { npProgressText, npSeek },
    formatMs,
    setPlaybackIcons
  );
}


function restoreState() {
  if (!hasEl(jamWidget)) return;

  let savedSide = localStorage.getItem("jam_widget_side") || "right";
  if (!allowedSides.includes(savedSide)) {
    savedSide = "right";
    localStorage.setItem("jam_widget_side", "right");
  }
  applySide(savedSide);

  if (side === "left") {
    jamWidget.style.left = "0px";
    jamWidget.style.top = "0px";
  } else {
    jamWidget.style.left = `${window.innerWidth - jamWidget.offsetWidth}px`;
    jamWidget.style.top = "0px";
  }
  jamWidget.style.right = "auto";
  jamWidget.style.bottom = "auto";

  positionQueuePopup();
  setEdgePeekMode(edgePeekMode);
  syncDockButtons();
  renderDiagnostics();
}

function setEdgePeekMode(enabled) {
  if (!hasEl(edgeSensor) || !hasEl(peekBtn)) return;
  edgePeekMode = enabled;
  localStorage.setItem("jam_edge_peek_mode", enabled ? "1" : "0");
  edgeSensor.classList.toggle("active", enabled);
  peekBtn.style.background = enabled ? "#16b34f" : "#253128";
  peekBtn.textContent = enabled ? "On" : "Peek";
  peekBtn.title = enabled ? "Edge Peek On" : "Edge Peek Mode";
  if (!enabled) {
    jamWidget.classList.remove("peek-hidden");
    setPopupState(true);
  } else {
    jamWidget.classList.add("peek-hidden");
    setPopupState(false);
  }
  const signedIn = Boolean(localStorage.getItem("spotify_access_token") || tokenInput.value.trim());
  if (hasEl(hideBtn)) {
    hideBtn.hidden = enabled || !signedIn;
  }
  broadcastLocalSync("peek");
}

function schedulePeekHide() {
  if (!hasEl(queuePopup) || !hasEl(edgeSensor) || !hasEl(jamWidget)) return;
  if (!edgePeekMode) return;
  if (peekHideTimer) clearTimeout(peekHideTimer);
  peekHideTimer = setTimeout(() => {
    if (!queuePopup.matches(":hover") && !edgeSensor.matches(":hover")) {
      jamWidget.classList.add("peek-hidden");
      setPopupState(false);
    }
  }, 500);
}

edgeSensor.addEventListener("mouseenter", () => {
  if (peekHideTimer) clearTimeout(peekHideTimer);
  jamWidget.classList.remove("peek-hidden");
  setPopupState(true);
});

queuePopup.addEventListener("mouseleave", () => schedulePeekHide());
queuePopup.addEventListener("mouseenter", () => {
  if (peekHideTimer) clearTimeout(peekHideTimer);
});

if (hasEl(hideBtn)) {
  hideBtn.addEventListener("click", () => {
    setPopupState(false);
    if (isDesktopWidget) {
      window.widgetDesktop.minimize();
      return;
    }
    jamWidget.hidden = true;
    showBtn.hidden = false;
  });
}

peekBtn.addEventListener("click", () => {
  setEdgePeekMode(!edgePeekMode);
});

showBtn.addEventListener("click", () => {
  jamWidget.hidden = false;
  showBtn.hidden = true;
  positionQueuePopup();
});

queueBtn.addEventListener("click", async () => {
  setPopupState(!queuePopup.classList.contains("open"));
  positionQueuePopup();
  if (!queuePopup.classList.contains("open")) return;
  const queueLoad = listMode === "skip"
    ? loadSkipList({ silent: false })
    : loadQueue({ silent: false });
  await Promise.allSettled([queueLoad, loadNowPlaying({ silent: true })]);
});

searchBtn.addEventListener("click", runSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    runSearch();
  }
});
searchInput.addEventListener("focus", () => {
  if (searchResults.innerHTML.trim()) showSearchResults();
});
searchInput.addEventListener("blur", () => scheduleSearchHide());
searchInput.addEventListener("input", () => {
  applyListFilter();
  syncClearSearchButton();
  if (!searchInput.value.trim()) {
    hideSearchResults();
  }
});
if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    syncClearSearchButton();
    applyListFilter();
    hideSearchResults();
    searchInput.focus();
    setStatus("Filter cleared.");
  });
}
searchResults.addEventListener("mouseenter", () => {
  if (searchHideTimer) clearTimeout(searchHideTimer);
});
searchResults.addEventListener("mouseleave", () => scheduleSearchHide());
document.addEventListener("click", (event) => {
  const target = event.target;
  const insideSearch = searchInput.contains(target) || searchResults.contains(target) || searchBtn.contains(target);
  if (!insideSearch && !searchInput.value.trim()) {
    hideSearchResults();
  }
  if (sourceQuickMenu && sourceQuickBtn) {
    const clickNode = target instanceof Node ? target : null;
    if (clickNode && !sourceQuickMenu.contains(clickNode) && !sourceQuickBtn.contains(clickNode)) {
      sourceQuickMenu.hidden = true;
    }
  }
});

if (npMenuBtn && npMenu) {
  npMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    npMenu.hidden = !npMenu.hidden;
  });
  npMenu.addEventListener("click", async (event) => {
    event.stopPropagation();
    const target = event.target instanceof Element ? event.target.closest("button[data-action]") : null;
    if (!target) return;
    const action = target.dataset.action;
    const track = nowPlayingItemMeta;
    if (!track) {
      setStatus("Nothing playing right now.", true);
      return;
    }
    try {
      if (action === "np-like") {
        if (!(await ensureValidToken())) return;
        await likeTrack(track.id);
        setStatus("Saved to Liked Songs.");
      }
      if (action === "np-artist") {
        const url = track.artists?.[0]?.external_urls?.spotify;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }
      if (action === "np-album") {
        const url = track.album?.external_urls?.spotify;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }
      if (action === "np-share") {
        const url = track.external_urls?.spotify;
        if (url) {
          await navigator.clipboard.writeText(url);
          setStatus("Track link copied.");
        }
      }
    } catch (error) {
      setStatus(error.message || "Now playing action failed.", true);
    } finally {
      npMenu.hidden = true;
    }
  });
}
document.addEventListener("click", (event) => {
  if (!npMenu || !npMenuBtn) return;
  const target = event.target instanceof Node ? event.target : null;
  if (!target) return;
  if (npMenu.contains(target) || npMenuBtn.contains(target)) return;
  npMenu.hidden = true;
});

closePopupBtn.addEventListener("click", () => setPopupState(false));
refreshQueueBtn.addEventListener("click", async () => {
  const queueLoad = listMode === "skip"
    ? loadSkipList({ silent: false })
    : loadQueue({ silent: false });
  await Promise.allSettled([queueLoad, loadNowPlaying({ silent: true })]);
});
saveJamLinkBtn.addEventListener("click", () => {
  const candidate = jamLinkInput.value.trim();
  if (!isValidJamLink(candidate)) {
    setStatus("Paste a valid Spotify Jam link (spotify.link/...)", true);
    return;
  }
  savedJamLink = candidate;
  localStorage.setItem("jam_invite_link", savedJamLink);
  setStatus("Jam link saved.");
  renderDiagnostics();
  broadcastLocalSync("jam_link");
});
refreshRateRange.addEventListener("input", () => {
  const cfg = getRefreshConfig(refreshRateRange.value);
  localStorage.setItem("jam_refresh_level", String(cfg.level));
  updateRefreshLabel(cfg.level);
  startPolling();
  renderDiagnostics();
  broadcastLocalSync("refresh_rate");
});

if (deviceSelect) {
  deviceSelect.addEventListener("change", () => {
    selectedPlaybackDeviceId = deviceSelect.value || "";
    localStorage.setItem("jam_playback_device_id", selectedPlaybackDeviceId);
    syncPlayPauseAvailability();
  });
}
if (sourceSelect) {
  sourceSelect.addEventListener("change", () => {
    selectedPlaybackSource = sourceSelect.value || "liked";
    localStorage.setItem("jam_playback_source", selectedPlaybackSource);
    syncSourceUI();
    if (listMode === "skip") loadSkipList({ silent: true, preserveScroll: true });
    else loadQueue({ silent: true, preserveScroll: true });
  });
}
if (sourceQuickBtn && sourceQuickMenu) {
  sourceQuickBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    renderSourceQuickMenu();
    if (!sourceQuickMenu.innerHTML.trim()) {
      sourceQuickMenu.innerHTML = '<button type="button" class="source-quick-item active" data-source-value="liked">Liked Songs</button>';
    }
    sourceQuickMenu.hidden = !sourceQuickMenu.hidden;
  });
}
if (sourceQuickMenu) {
  sourceQuickMenu.addEventListener("click", (event) => {
    event.stopPropagation();
    const item = event.target instanceof Element ? event.target.closest("button[data-source-value]") : null;
    if (!item) return;
    selectedPlaybackSource = item.getAttribute("data-source-value") || "liked";
    localStorage.setItem("jam_playback_source", selectedPlaybackSource);
    syncSourceUI();
    if (listMode === "skip") loadSkipList({ silent: true, preserveScroll: true });
    else loadQueue({ silent: true, preserveScroll: true });
    setStatus(`Source set to ${getSourceDisplayName(selectedPlaybackSource)}.`);
    sourceQuickMenu.hidden = true;
  });
}
if (refreshDevicesBtn) {
  refreshDevicesBtn.addEventListener("click", () => loadPlaybackDevices());
}
if (refreshSourcesBtn) {
  refreshSourcesBtn.addEventListener("click", () => loadPlaybackSources());
}
if (startPlaybackBtn) {
  startPlaybackBtn.addEventListener("click", () => startPlaybackOnSelectedDevice());
}

connectBtn.addEventListener("click", () => {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus("Token cannot be empty.", true);
    return;
  }

  accessToken = token;
  tokenExpiresAt = Date.now() + 45 * 60 * 1000;
  localStorage.setItem("spotify_client_id", getConfiguredClientId());
  localStorage.setItem("spotify_access_token", token);
  localStorage.setItem("spotify_token_expires_at", String(tokenExpiresAt));
  setStatus("Token saved.");
  setAuthView();
  loadPlaybackSources();
  loadPlaybackDevices();
});

loginBtn.addEventListener("click", async () => {
  const clientId = requireClientId();
  if (!clientId) return;

  localStorage.setItem("spotify_client_id", clientId);
  syncAccountAttachState();

  if (!isDesktopWidget || !window.widgetDesktop.spotifyLogin) {
    setStatus("PKCE login is available in Electron desktop mode only.", true);
    return;
  }

  try {
    setStatus("Opening Spotify login...");
    const tokenResult = await window.widgetDesktop.spotifyLogin(clientId);
    setAuthFromTokenResult(tokenResult);
    hidePermissionBanner();
    setStatus("Spotify login complete.");
  } catch (error) {
    setStatus("Spotify login failed.", true);
    console.error(error);
  }
});

if (hasEl(permissionBannerBtn)) {
  permissionBannerBtn.addEventListener("click", () => {
    if (hasEl(loginBtn)) loginBtn.click();
  });
}

refreshTokenBtn.addEventListener("click", async () => {
  const clientId = requireClientId();
  if (!clientId) return;

  if (!refreshToken) {
    refreshToken = localStorage.getItem("spotify_refresh_token") || "";
  }
  if (!refreshToken) {
    setStatus("No refresh token found. Use Login first.", true);
    return;
  }

  if (!isDesktopWidget || !window.widgetDesktop.spotifyRefresh) {
    setStatus("Token refresh is available in Electron desktop mode only.", true);
    return;
  }

  try {
    setStatus("Refreshing token...");
    const tokenResult = await window.widgetDesktop.spotifyRefresh({ clientId, refreshToken });
    setAuthFromTokenResult(tokenResult);
    localStorage.setItem("spotify_client_id", clientId);
    setStatus("Token refreshed.");
  } catch (error) {
    setStatus("Token refresh failed.", true);
    console.error(error);
  }
});

npPrevBtn.addEventListener("click", async () => {
  try {
    if (!(await ensureValidToken())) return;
    await playbackCommand("/me/player/previous");
    setStatus("Previous track.");
    setTimeout(() => loadNowPlaying({ silent: true }), 300);
  } catch (error) {
    setStatus(error.message || "Previous failed.", true);
  }
});

npPlayPauseBtn.addEventListener("click", async () => {
  try {
    if (!(await ensureValidToken())) return;
    const hasDevice = Boolean((deviceSelect?.value || selectedPlaybackDeviceId || "").trim());
    if (!hasDevice) {
      setStatus("Select an active device first.", true);
      return;
    }
    if (!playbackInitialized && !nowPlayingState.durationMs) {
      const started = await startPlaybackOnSelectedDevice();
      if (!started) return;
      return;
    }
    await playbackCommand(nowPlayingState.isPlaying ? "/me/player/pause" : "/me/player/play", "PUT");
    nowPlayingState.isPlaying = !nowPlayingState.isPlaying;
    if (nowPlayingState.isPlaying) {
      playbackInitialized = true;
      localStorage.setItem("jam_playback_initialized", "1");
    }
    setPlaybackIcons();
    setStatus(nowPlayingState.isPlaying ? "Playing." : "Paused.");
    setTimeout(() => loadNowPlaying({ silent: true }), 300);
  } catch (error) {
    setStatus(error.message || "Play/Pause failed.", true);
  }
});

npNextBtn.addEventListener("click", async () => {
  try {
    if (!(await ensureValidToken())) return;
    await playbackCommand("/me/player/next");
    setStatus("Next track.");
    setTimeout(() => loadNowPlaying({ silent: true }), 300);
  } catch (error) {
    setStatus(error.message || "Next failed.", true);
  }
});

npSeek.addEventListener("change", async () => {
  try {
    if (!(await ensureValidToken())) return;
    const pct = Number(npSeek.value || 0) / 100;
    const targetMs = Math.max(0, Math.floor((nowPlayingState.durationMs || 0) * pct));
    await spotifyFetch(`/me/player/seek?position_ms=${targetMs}`, { method: "PUT" });
    setTimeout(() => loadNowPlaying({ silent: true }), 200);
  } catch (error) {
    setStatus(error.message || "Seek failed.", true);
  }
});

if (npVolume) {
  npVolume.addEventListener("input", () => {
    const pct = Math.max(0, Math.min(100, Number(npVolume.value || 0)));
    npVolume.style.setProperty("--vol-fill", `${pct}%`);
  });
  npVolume.addEventListener("change", async () => {
    try {
      if (!(await ensureValidToken())) return;
      const pct = Math.max(0, Math.min(100, Math.round(Number(npVolume.value || 0))));
      await spotifyFetch(`/me/player/volume?volume_percent=${pct}`, { method: "PUT" });
      setStatus(`Volume ${pct}%.`);
    } catch (error) {
      setStatus(error.message || "Volume change failed.", true);
    }
  });
}

settingsBtn.addEventListener("click", () => {
  setTab(currentMainView === "settings" ? "main" : "settings");
});
mainTabBtn.addEventListener("click", () => setTab("main"));
mainTabBtn.addEventListener("click", () => loadQueue({ silent: false }));
settingsTabBtn.addEventListener("click", () => loadSkipList({ silent: false }));
dockLeftBtn.addEventListener("click", () => {
  applySide("left");
  localStorage.setItem("jam_widget_side", "left");
  syncDockButtons();
  positionQueuePopup();
});
dockRightBtn.addEventListener("click", () => {
  applySide("right");
  localStorage.setItem("jam_widget_side", "right");
  syncDockButtons();
  positionQueuePopup();
});

logoutBtn.addEventListener("click", () => {
  clearAuthState(true);
  setAuthView();
  settingsView.hidden = true;
  setStatus("Logged out.");
});

resetSettingsBtn.addEventListener("click", () => {
  localStorage.setItem("jam_widget_side", "right");
  localStorage.setItem("jam_edge_peek_mode", "0");
  edgePeekMode = false;
  applySide("right");
  setEdgePeekMode(false);
  syncDockButtons();
  positionQueuePopup();
  setStatus("UI settings reset.");
  renderDiagnostics();
});

if (hasEl(displaySelect)) {
  displaySelect.addEventListener("change", async () => {
    const nextDisplayId = displaySelect.value || "";
    selectedDisplayId = nextDisplayId;
    localStorage.setItem("jam_widget_display_id", nextDisplayId);
    if (isDesktopWidget && window.widgetDesktop?.setDisplay) {
      try {
        await window.widgetDesktop.setDisplay(nextDisplayId);
        logAction("result", `Display changed to ${nextDisplayId}`);
      } catch (error) {
        logAction("error", `Display change failed: ${error.message || "unknown error"}`);
      }
    }
    renderDiagnostics();
  });
}

if (hasEl(clearLogBtn)) {
  clearLogBtn.addEventListener("click", () => {
    localStorage.removeItem(ACTION_LOG_KEY);
    renderActionLogs();
    renderDiagnostics();
    setStatus("Logs cleared.");
  });
}

if (hasEl(exportDiagnosticsBtn)) {
  exportDiagnosticsBtn.addEventListener("click", async () => {
    try {
      const payload = JSON.stringify(buildDiagnosticsSnapshot(), null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      anchor.href = url;
      anchor.download = `spotify-widget-diagnostics-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Diagnostics exported.");
    } catch (error) {
      setStatus(error.message || "Failed to export diagnostics.", true);
    }
  });
}

if (hasEl(resetAppDataBtn)) {
  resetAppDataBtn.addEventListener("click", () => {
    localStorage.clear();
    setStatus("App data reset. Reloading...");
    setTimeout(() => window.location.reload(), 200);
  });
}

function syncJoinButton() {
  if (isJoined) {
    joinBtn.textContent = "Leave";
    joinBtn.title = "Leave Jam";
    joinBtn.setAttribute("aria-label", "Leave Jam");
    joinBtn.style.background = "#2f3d32";
    joinBtn.style.color = "#ebf3ed";
  } else {
    joinBtn.textContent = "Join";
    joinBtn.title = "Join Jam";
    joinBtn.setAttribute("aria-label", "Join Jam");
    joinBtn.style.background = "#1ed760";
    joinBtn.style.color = "#06250f";
  }
}

joinBtn.addEventListener("click", () => {
  isJoined = !isJoined;
  localStorage.setItem("jam_is_joined", isJoined ? "1" : "0");
  if (isJoined) {
    const selfName = currentUserProfile?.name || "";
    if (selfName && !jamMembers.includes(selfName)) jamMembers.unshift(selfName);
  } else {
    const selfName = currentUserProfile?.name || "";
    if (selfName) jamMembers = jamMembers.filter((m) => m !== selfName);
  }
  persistJamMembers();
  renderJamMembers();
  syncJoinButton();
  syncJamSectionVisibility();
  setStatus(isJoined ? "Joined Jam." : "Left Jam.");
});

inviteBtn.addEventListener("click", async () => {
  try {
    if (!isValidJamLink(savedJamLink)) {
      setStatus("No Jam link saved. Paste one in Settings from Spotify app.", true);
      return;
    }

    await navigator.clipboard.writeText(savedJamLink.trim());
    setStatus("Copied Jam link to clipboard.");
  } catch (error) {
    setStatus(error?.message || "Invite copy failed.", true);
  }
});

endJamBtn.addEventListener("click", () => {
  isJoined = false;
  jamMembers = [];
  localStorage.setItem("jam_is_joined", "0");
  persistJamMembers();
  renderJamMembers();
  syncJoinButton();
  syncJamSectionVisibility();
  setStatus("Jam ended.");
});

const actionDispatcher = createActionDispatcher({
  queuePopup,
  queueBtn,
  logAction,
  ensureValidToken,
  addTrackToQueue,
  likeTrack,
  pinTrackToTop,
  persistTrackOwners,
  persistSkipTracks,
  loadQueue,
  loadSkipList,
  setStatus,
  setPopupState,
  getListMode: () => listMode,
  getCurrentUserName: () => currentUserProfile?.name || "",
  getTrackOwners: () => trackOwners,
  getSkipTrackUris: () => skipTrackUris,
  setPrioritizedBypassUri
});

document.addEventListener("click", actionDispatcher.handleDocumentClick);
queueList.addEventListener("dblclick", actionDispatcher.handleQueueDoubleClick);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setPopupState(false);
});

window.addEventListener("resize", () => {
  applySide(side, false);
  positionQueuePopup();
});

window.addEventListener("focus", () => {
  syncVisibleState();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    syncVisibleState();
  }
});

restoreState();
renderActionLogs();
setEdgePeekMode(edgePeekMode);
setPopupState(true);
setStatus("Ready");
syncJoinButton();
syncCollabToggle();
syncJamSectionVisibility();
renderJamMembers();
setAuthView();
syncAccountAttachState();
syncJamLinkInput();
syncClearSearchButton();
syncSourceUI();
if (loginPatchNotesText) {
  loginPatchNotesText.textContent = "Patch notes: Embedded source chooser in search • Spotify-style volume/controls polish • Live queue/skip refresh improvements.";
}
const refreshCfg = getRefreshConfig(localStorage.getItem("jam_refresh_level") || 5);
refreshRateRange.value = String(refreshCfg.level);
updateRefreshLabel(refreshCfg.level);
renderDiagnostics();
setPlaybackIcons();
syncPlayPauseAvailability();
setInterval(tickNowPlayingUI, 1000);
initLocalSync();
startPolling();
loadDisplayOptions();
loadPlaybackDevices();
loadPlaybackSources();
if (isDesktopWidget && window.widgetDesktop?.getVersion && hasEl(appVersionText)) {
  window.widgetDesktop.getVersion()
    .then((v) => { appVersionText.textContent = `Version: ${v || "unknown"}`; })
    .catch(() => { appVersionText.textContent = "Version: unknown"; });
}
window.addEventListener("error", (event) => {
  logAction("error", `Unhandled error: ${event.message || "unknown"}`);
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason?.message || String(event.reason || "unknown rejection");
  logAction("error", `Unhandled rejection: ${reason}`);
});
async function verifyPersistedAuthOnLaunch() {
  if (localStorage.getItem("spotify_scope_version") !== REQUIRED_SCOPE_MARKER) {
    clearAuthState(true);
    localStorage.setItem("spotify_scope_version", REQUIRED_SCOPE_MARKER);
    showPermissionBanner("Spotify permissions changed. Click Re-authorize once.");
    setStatus("Spotify permissions updated. Click Get Token once.", true);
    setAuthView();
    return;
  }
  if (!localStorage.getItem("spotify_access_token")) {
    setAuthView();
    return;
  }
  const ok = await ensureValidToken();
  if (!ok) {
    clearAuthState(true);
  }
  setAuthView();
  loadCurrentUserProfile();
  renderDiagnostics();
}
verifyPersistedAuthOnLaunch();

try {
  const initialLocalSync = safeParseJSON(LOCAL_SYNC_KEY, null);
  if (initialLocalSync?.state) {
    applyLocalSyncState(initialLocalSync.state);
  }
} catch {
  // Ignore startup sync parse issues.
}

function runStartupHealthCheck() {
  guard("required-dom", () => {
    const required = [
      jamWidget, queuePopup, loginView, appView, settingsView,
      mainTabBtn, settingsBtn, tokenInput
    ];
    if (required.some((el) => !hasEl(el))) {
      console.warn("[widget-health] one or more required elements missing");
    }
  });

  guard("state-coherence", () => {
    const signedIn = Boolean(localStorage.getItem("spotify_access_token") || tokenInput.value.trim());
    if (!signedIn && !loginView.hidden && appView.hidden) return;
    if (signedIn && loginView.hidden && !appView.hidden) return;
    setAuthView();
  });

  guard("tab-coherence", () => {
    const signedIn = Boolean(localStorage.getItem("spotify_access_token") || tokenInput.value.trim());
    if (!signedIn) {
      appView.hidden = true;
      settingsView.hidden = true;
      mainTabBtn.classList.add("active");
      settingsBtn.classList.remove("active");
      currentMainView = "main";
      return;
    }
    if (appView.hidden === settingsView.hidden) {
      setTab(currentMainView === "settings" ? "settings" : "main");
      return;
    }
    if (!settingsView.hidden && appView.hidden) {
      currentMainView = "settings";
      mainTabBtn.classList.remove("active");
      settingsBtn.classList.add("active");
    } else {
      currentMainView = "main";
      mainTabBtn.classList.add("active");
      settingsBtn.classList.remove("active");
    }
  });

  guard("dock-coherence", () => {
    if (!allowedSides.includes(side)) {
      side = "right";
      localStorage.setItem("jam_widget_side", "right");
    }
    applySide(side);
    positionQueuePopup();
  });
}

runStartupHealthCheck();

collabToggle.addEventListener("click", () => {
  collabEnabled = !collabEnabled;
  localStorage.setItem("jam_collab_enabled", collabEnabled ? "1" : "0");
  syncCollabToggle();
});

if (isDesktopWidget) {
  showBtn.hidden = true;
}
