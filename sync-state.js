export function createLocalSyncBridge(deps) {
  const {
    localSyncKey,
    localSyncChannelName,
    localSyncId,
    getPayloadState,
    applyIncomingState,
    isSuppressed,
    onChannelReadyState
  } = deps;

  let localSyncChannel = null;

  function broadcast(reason = "update") {
    if (isSuppressed()) return;
    const payload = {
      source: localSyncId,
      reason,
      state: getPayloadState(),
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem(localSyncKey, JSON.stringify(payload));
    } catch (error) {
      console.warn("[local-sync] storage broadcast failed", error);
    }
    if (localSyncChannel) {
      try {
        localSyncChannel.postMessage(payload);
      } catch (error) {
        console.warn("[local-sync] channel broadcast failed", error);
      }
    }
  }

  function init() {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        localSyncChannel = new BroadcastChannel(localSyncChannelName);
        localSyncChannel.onmessage = (event) => {
          const payload = event.data;
          if (!payload || payload.source === localSyncId) return;
          applyIncomingState(payload.state);
        };
      } catch (error) {
        console.warn("[local-sync] BroadcastChannel unavailable", error);
      }
    }
    if (onChannelReadyState) onChannelReadyState(Boolean(localSyncChannel));
    window.addEventListener("storage", (event) => {
      if (event.key !== localSyncKey || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        if (!payload || payload.source === localSyncId) return;
        applyIncomingState(payload.state);
      } catch {
        // Ignore malformed payloads.
      }
    });
  }

  return { init, broadcast, getChannel: () => localSyncChannel };
}
