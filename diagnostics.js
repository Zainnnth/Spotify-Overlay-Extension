export function createDiagnosticsController(deps) {
  const {
    actionLogKey,
    actionLogMax,
    actionLogText,
    diagnosticsText,
    statusText,
    getScope,
    getTokenExpiresAt,
    getSavedSide,
    getDisplayValue,
    getPeekMode,
    getSavedJamLink,
    getLocalSyncMode,
    getRefreshLevel,
    getLastApiError
  } = deps;

  function getActionLogs() {
    const parsed = JSON.parse(localStorage.getItem(actionLogKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  }

  function renderActionLogs() {
    if (!actionLogText) return;
    const logs = getActionLogs().slice(0, 15);
    if (!logs.length) {
      actionLogText.textContent = "No action logs yet.";
      return;
    }
    const lines = logs.map((entry) => {
      const when = new Date(entry.at).toLocaleTimeString();
      return `[${when}] ${entry.kind.toUpperCase()}: ${entry.message}`;
    });
    actionLogText.textContent = lines.join("\n");
  }

  function logAction(kind, message) {
    const msg = String(message || "").trim();
    if (!msg) return;
    const logs = getActionLogs();
    logs.unshift({ kind, message: msg, at: new Date().toISOString() });
    localStorage.setItem(actionLogKey, JSON.stringify(logs.slice(0, actionLogMax)));
    renderActionLogs();
  }

  function renderDiagnostics() {
    if (!diagnosticsText) return;
    const expiresRaw = getTokenExpiresAt();
    let expires = "Not set";
    if (expiresRaw && Number(expiresRaw) > 0) {
      try { expires = new Date(Number(expiresRaw)).toLocaleString(); } catch { expires = "Invalid"; }
    }
    const lines = [
      `Signed in: ${localStorage.getItem("spotify_access_token") ? "Yes" : "No"}`,
      `Token expires: ${expires}`,
      `Scopes: ${getScope() || "Unknown"}`,
      `Dock side: ${getSavedSide()}`,
      `Display: ${getDisplayValue()}`,
      `Peek mode: ${getPeekMode() ? "On" : "Off"}`,
      `Jam link saved: ${getSavedJamLink() ? "Yes" : "No"}`,
      `Local sync: ${getLocalSyncMode()}`,
      `Refresh level: ${getRefreshLevel()}`,
      `Action logs stored: ${getActionLogs().length}`,
      `Last API error: ${getLastApiError() || "None"}`
    ];
    diagnosticsText.textContent = lines.join("\n");
  }

  function setStatus(message, isError = false, onError = null) {
    if (!statusText) return;
    statusText.textContent = message;
    statusText.style.color = isError ? "#ff9c9c" : "#9aa89f";
    logAction(isError ? "error" : "result", message);
    if (isError && onError) onError(message);
  }

  return { getActionLogs, renderActionLogs, logAction, renderDiagnostics, setStatus };
}
