export function createActionDispatcher(deps) {
  const {
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
    getListMode,
    getCurrentUserName,
    getTrackOwners,
    getSkipTrackUris,
    setPrioritizedBypassUri
  } = deps;

  function closeTrackMenus(exceptWithin = null) {
    document.querySelectorAll(".track-menu").forEach((menuEl) => {
      if (!(exceptWithin instanceof Element) || !menuEl.contains(exceptWithin)) {
        menuEl.hidden = true;
      }
    });
  }

  async function handleSearchAction(action, actionButton) {
    const searchItem = actionButton.closest(".search-item");
    if (!searchItem) return;
    const trackUri = searchItem.dataset.trackUri;
    const trackUrl = searchItem.dataset.trackUrl;
    if (action === "search-add") {
      if (!(await ensureValidToken())) return;
      await addTrackToQueue(trackUri);
      const owners = getTrackOwners();
      owners[trackUri] = getCurrentUserName() || owners[trackUri] || "Jam";
      persistTrackOwners();
      setStatus("Added from search to queue.");
      return;
    }
    if (action === "search-open" && trackUrl) {
      window.open(trackUrl, "_blank", "noopener,noreferrer");
      setStatus("Opened search result in Spotify.");
    }
  }

  async function handleQueueAction(action, item) {
    const trackId = item.dataset.trackId;
    const trackUri = item.dataset.trackUri;
    const trackUrl = item.dataset.trackUrl;
    const artistUrl = item.dataset.artistUrl;
    const albumUrl = item.dataset.albumUrl;
    const skipTrackUris = getSkipTrackUris();

    const queueActionHandlers = {
      like: async () => {
        if (!(await ensureValidToken())) return;
        await likeTrack(trackId || trackUri);
        setStatus("Saved to Liked Songs.");
      },
      "play-next": async () => {
        if (!(await ensureValidToken())) return;
        await addTrackToQueue(trackUri);
        await pinTrackToTop(trackUri);
        setStatus("Track pinned next in queue.");
        if (getListMode() === "queue") await loadQueue({ silent: true });
      },
      open: async () => {
        if (!trackUrl) return;
        window.open(trackUrl, "_blank", "noopener,noreferrer");
        setStatus("Opened in Spotify.");
      },
      "go-artist": async () => {
        if (!artistUrl) return;
        window.open(artistUrl, "_blank", "noopener,noreferrer");
        setStatus("Opened artist in Spotify.");
      },
      "go-album": async () => {
        if (!albumUrl) return;
        window.open(albumUrl, "_blank", "noopener,noreferrer");
        setStatus("Opened album in Spotify.");
      },
      "share-track": async () => {
        if (!trackUrl) {
          setStatus("No share URL available for this track.", true);
          return;
        }
        await navigator.clipboard.writeText(trackUrl);
        setStatus("Track link copied.");
      },
      "hide-track": async () => {
        if (trackUri) {
          if (skipTrackUris.has(trackUri)) {
            skipTrackUris.delete(trackUri);
            setStatus("Track unmarked.");
          } else {
            skipTrackUris.add(trackUri);
            setStatus("Track marked to skip when it starts playing.");
          }
          persistSkipTracks();
        }
        if (getListMode() === "queue") await loadQueue({ silent: true, preserveScroll: true });
        if (getListMode() === "skip") await loadSkipList({ silent: true, preserveScroll: true });
      }
    };

    const handler = queueActionHandlers[action];
    if (handler) await handler();
  }

  async function dispatchActionButton(actionButton) {
    const action = actionButton.dataset.action;
    if (!action) return;
    if (action === "track-menu") {
      const menuWrap = actionButton.closest(".track-menu-wrap");
      const menu = menuWrap?.querySelector(".track-menu");
      if (menu) menu.hidden = !menu.hidden;
      return;
    }
    if (action === "search-add" || action === "search-open") {
      await handleSearchAction(action, actionButton);
      return;
    }
    const item = actionButton.closest(".queue-item");
    if (!item) return;
    await handleQueueAction(action, item);
  }

  async function handleDocumentClick(event) {
    const target = event.target;
    const clickedButton = target instanceof Element ? target.closest("button") : null;
    if (clickedButton) {
      const label = clickedButton.id || clickedButton.getAttribute("data-action") || clickedButton.textContent?.trim() || "button";
      logAction("click", label);
    }

    if (queuePopup.classList.contains("open")) {
      const isInsidePopup = queuePopup.contains(target);
      const isQueueButton = queueBtn.contains(target);
      if (!isInsidePopup && !isQueueButton) setPopupState(false);
    }

    const actionButton = target instanceof Element ? target.closest("button[data-action]") : null;
    if (actionButton?.dataset.action !== "track-menu") {
      closeTrackMenus(target instanceof Element ? target : null);
    }
    if (!actionButton) return;

    try {
      await dispatchActionButton(actionButton);
    } catch (error) {
      setStatus(error.message || "Action failed.", true);
      console.error(error);
    }
  }

  async function handleQueueDoubleClick(event) {
    const target = event.target;
    const item = target instanceof Element ? target.closest(".queue-item") : null;
    const button = target instanceof Element ? target.closest("button[data-action]") : null;
    if (!item || button) return;
    const trackUri = item.dataset.trackUri;
    try {
      if (!(await ensureValidToken())) return;
      await addTrackToQueue(trackUri);
      await pinTrackToTop(trackUri);
      if (trackUri) {
        const skipTrackUris = getSkipTrackUris();
        skipTrackUris.add(trackUri);
        persistSkipTracks();
        if (typeof setPrioritizedBypassUri === "function") {
          setPrioritizedBypassUri(trackUri);
        }
      }
      setStatus("Track prioritized. Other duplicates will auto-skip.");
      if (getListMode() === "queue") await loadQueue({ silent: true });
    } catch (error) {
      setStatus(error.message || "Queue pin failed.", true);
      console.error(error);
    }
  }

  return { handleDocumentClick, handleQueueDoubleClick };
}
