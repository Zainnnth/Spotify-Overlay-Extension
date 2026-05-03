export function createSpotifyClient(deps) {
  const {
    apiBase,
    getAccessToken,
    setAccessToken,
    getRefreshToken,
    setRefreshToken,
    getTokenExpiresAt,
    setTokenExpiresAt,
    tokenRefreshSkewMs,
    getConfiguredClientId,
    isDesktopWidget,
    widgetDesktop,
    requireToken,
    setAuthView,
    setStatus,
    clearAuthState,
    renderDiagnostics,
    onAuthUpdated
  } = deps;

  function setAuthFromTokenResult(tokenResult) {
    const accessToken = tokenResult.accessToken || "";
    setAccessToken(accessToken);
    localStorage.setItem("spotify_access_token", accessToken);
    if (tokenResult.refreshToken) {
      setRefreshToken(tokenResult.refreshToken);
      localStorage.setItem("spotify_refresh_token", tokenResult.refreshToken);
    }
    const expiresIn = Number(tokenResult.expiresIn || 3600);
    const tokenExpiresAt = Date.now() + Math.max(300, expiresIn - 60) * 1000;
    setTokenExpiresAt(tokenExpiresAt);
    localStorage.setItem("spotify_token_expires_at", String(tokenExpiresAt));
    if (tokenResult.scope) {
      localStorage.setItem("spotify_granted_scope", tokenResult.scope);
    }
    setAuthView();
    renderDiagnostics();
    if (onAuthUpdated) onAuthUpdated();
  }

  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken || !isDesktopWidget || !widgetDesktop?.spotifyRefresh) {
      return false;
    }
    const clientId = getConfiguredClientId();
    if (!clientId) return false;
    try {
      const refreshed = await widgetDesktop.spotifyRefresh({ clientId, refreshToken });
      setAuthFromTokenResult(refreshed);
      setStatus("Session refreshed.");
      return true;
    } catch {
      clearAuthState(true);
      setStatus("Session refresh failed. Login again.", true);
      return false;
    }
  }

  async function ensureValidToken() {
    if (!requireToken()) return false;
    if (Date.now() < Math.max(0, getTokenExpiresAt() - tokenRefreshSkewMs)) return true;
    return await refreshAccessToken();
  }

  async function parseSpotifyErrorResponse(response) {
    const raw = await response.text();
    if (!raw) return { raw: "", message: "", reason: "" };
    try {
      const parsed = JSON.parse(raw);
      const errorBlock = parsed?.error || {};
      const message = errorBlock?.message || parsed?.message || "";
      const reason = errorBlock?.reason || "";
      return { raw, message, reason };
    } catch {
      return { raw, message: raw.trim(), reason: "" };
    }
  }

  async function spotifyFetch(path, options = {}) {
    if (!(await ensureValidToken())) {
      throw new Error("Spotify auth expired. Click Login/Refresh.");
    }

    const request = async () => fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        ...(options.headers || {})
      }
    });

    let response = await request();
    if (response.status === 401 && (await refreshAccessToken())) {
      response = await request();
    }

    if (!response.ok) {
      const errorInfo = await parseSpotifyErrorResponse(response);
      const message = errorInfo.message || errorInfo.raw;
      const reason = String(errorInfo.reason || "").toUpperCase();
      if (response.status === 401) throw new Error("Spotify auth expired. Click Login/Refresh.");
      if (response.status === 404 && (reason === "NO_ACTIVE_DEVICE" || /no active device/i.test(message))) {
        throw new Error("No active Spotify device found. Start playback on a device, then try again.");
      }
      if (response.status === 403) {
        if (/insufficient|scope/i.test(message)) {
          throw new Error("Missing Spotify permission. Click Get Token to re-authorize.");
        }
        if (path.startsWith("/me/player")) {
          throw new Error("Spotify Premium + active playback device required.");
        }
        throw new Error("Spotify denied this action. Re-login to refresh permissions.");
      }
      throw new Error(message || `Spotify API error (${response.status})`);
    }

    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) return null;
    try {
      return JSON.parse(text);
    } catch {
      console.warn("[spotify] non-parseable success payload", { path, status: response.status });
      return null;
    }
  }

  return {
    setAuthFromTokenResult,
    refreshAccessToken,
    ensureValidToken,
    spotifyFetch
  };
}
