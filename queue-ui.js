import { iconSvg } from "./icons.js";

export function collectTrackSignature(tracks, pinnedTrackUris, skipTrackUris) {
  return tracks.map((track) => {
    const key = track?.uri || track?.id || "";
    const pinned = track?.uri && pinnedTrackUris.has(track.uri) ? "p1" : "p0";
    const skip = track?.uri && skipTrackUris.has(track.uri) ? "s1" : "s0";
    return `${key}:${pinned}:${skip}`;
  }).join("|");
}

export function renderTrackCollection(queueList, tracks, mode, options, trackItemTemplate, pinnedTrackUris, skipTrackUris) {
  const { preserveScroll = true } = options || {};
  const signature = `${mode}:${collectTrackSignature(tracks, pinnedTrackUris, skipTrackUris)}`;
  if (queueList.dataset.signature === signature) return;
  const previousScrollTop = preserveScroll ? queueList.scrollTop : 0;
  queueList.innerHTML = tracks.length ? tracks.map((track, index) => trackItemTemplate(track, index, mode)).join("") : "";
  queueList.dataset.signature = signature;
  if (preserveScroll) queueList.scrollTop = previousScrollTop;
}

export function buildTrackItemTemplate(track, context, index = -1, mode = "") {
  const artistNames = (track.artists || []).map((a) => a.name).join(" • ");
  const artwork = track.album?.images?.[2]?.url || track.album?.images?.[1]?.url || "";
  const primaryArtistUrl = track.artists?.[0]?.external_urls?.spotify || "";
  const albumUrl = track.album?.external_urls?.spotify || "";
  const owner = context.getTrackOwner(track.uri);
  const ownerInitial = context.getOwnerInitial(owner);
  const skipMarked = context.skipTrackUris.has(track.uri);
  const nextUp = mode === "queue" && index === 0;
  return `
    <article class="queue-item ${skipMarked ? "skip-marked" : ""}" tabindex="0" data-track-id="${track.id}" data-track-uri="${track.uri}" data-track-url="${track.external_urls?.spotify || ""}" data-artist-url="${primaryArtistUrl}" data-album-url="${albumUrl}">
      ${artwork ? `<img class="artwork" src="${artwork}" alt="" />` : ""}
      <div class="queue-item-main">
        <p class="track-name">${track.name || "Unknown track"}</p>
        <p class="track-meta">${artistNames || "Unknown artist"}${nextUp ? '<span class="next-up-badge">Next up</span>' : ""}</p>
      </div>
      <div class="queue-item-footer">
        <div class="item-actions" aria-label="Track options">
          <button type="button" class="icon-action" data-action="hide-track" title="Skip when playing" aria-label="Skip when playing">${iconSvg("remove")}<span class="sr-only">Skip when playing</span></button>
          <button type="button" class="icon-action" data-action="play-next" title="Play next" aria-label="Play next">${iconSvg("next")}<span class="sr-only">Play next</span></button>
          <div class="track-menu-wrap">
            <button type="button" class="icon-action" data-action="track-menu" title="More options" aria-label="More options">•••</button>
            <div class="track-menu" hidden>
              <button type="button" class="track-menu-btn" data-action="like">Save To Liked Songs</button>
              <button type="button" class="track-menu-btn" data-action="go-artist">Go To Artist</button>
              <button type="button" class="track-menu-btn" data-action="go-album">Go To Album</button>
              <button type="button" class="track-menu-btn" data-action="share-track">Share</button>
            </div>
          </div>
        </div>
        <div class="item-owner" title="${owner}" aria-label="Selected by ${owner}">${ownerInitial}</div>
      </div>
    </article>
  `;
}

export function buildSearchItemTemplate(track) {
  const artistNames = (track.artists || []).map((a) => a.name).join(" • ");
  const artwork = track.album?.images?.[2]?.url || track.album?.images?.[1]?.url || "";
  return `
    <article class="search-item" data-track-uri="${track.uri}" data-track-url="${track.external_urls?.spotify || ""}">
      ${artwork ? `<img class="artwork" src="${artwork}" alt="" />` : ""}
      <div>
        <p class="track-name">${track.name || "Unknown track"}</p>
        <p class="track-meta">${artistNames || "Unknown artist"}</p>
      </div>
      <div class="search-actions">
        <button type="button" class="mini-btn" data-action="search-add">Add</button>
        <button type="button" class="mini-btn" data-action="search-open">Open</button>
      </div>
    </article>
  `;
}

export function renderNowPlayingFrame(state, els, formatMs, setPlaybackIcons) {
  if (!state.durationMs) return;
  if (state.isPlaying) {
    const now = Date.now();
    const elapsed = now - state.lastSyncAt;
    state.progressMs = Math.min(state.durationMs, state.progressMs + elapsed);
    state.lastSyncAt = now;
  }
  els.npProgressText.textContent = formatMs(state.progressMs);
  const seekPct = state.durationMs > 0
    ? Math.min(100, Math.round((state.progressMs / state.durationMs) * 100))
    : 0;
  els.npSeek.value = String(seekPct);
  els.npSeek.style.setProperty("--seek-fill", `${seekPct}%`);
  setPlaybackIcons();
}

export function createQueueController(deps) {
  const {
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
    getPinnedTrackUris,
    getSkipTrackUris,
    persistSkipTracks,
    getPrioritizedBypassUri,
    clearPrioritizedBypassUri,
    getTrackOwner,
    getOwnerInitial,
    getSelectedPlaybackSource,
    onNowPlayingItem,
    getListMode,
    setListMode
  } = deps;

  const api = {
    loadQueue: null,
    loadSkipList: null,
    loadNowPlaying: null,
    runSearch: null
  };
  let activeBypassUri = "";
  let hasSeenBypassInstance = false;
  let lastNowPlayingUri = "";
  let visibleQueueTracks = [];
  let visibleSkipTracks = [];

  function setSkipTabCount(count) {
    settingsTabBtn.textContent = `Skip/Remove (${Math.max(0, Number(count) || 0)})`;
  }

  async function fetchPaginated(path, itemSelector = (data) => data?.items || [], limit = 50, maxPages = 40) {
    const all = [];
    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * limit;
      const separator = path.includes("?") ? "&" : "?";
      const data = await spotifyFetch(`${path}${separator}limit=${limit}&offset=${offset}`);
      const items = itemSelector(data) || [];
      if (!items.length) break;
      all.push(...items);
      if (items.length < limit) break;
    }
    return all;
  }

  async function fetchSourceTracks() {
    const source = typeof getSelectedPlaybackSource === "function" ? String(getSelectedPlaybackSource() || "liked") : "liked";
    if (source === "liked") {
      const likedItems = await fetchPaginated("/me/tracks", (data) => data?.items || [], 50, 80);
      return likedItems.map((entry) => entry?.track).filter((t) => t?.uri);
    }
    if (source.startsWith("playlist:")) {
      const playlistUri = source.replace("playlist:", "");
      const playlistId = playlistUri.split(":").pop();
      if (!playlistId) return [];
      const playlistItems = await fetchPaginated(`/playlists/${encodeURIComponent(playlistId)}/tracks`, (data) => data?.items || [], 100, 100);
      return playlistItems.map((entry) => entry?.track).filter((t) => t?.uri);
    }
    return [];
  }

  function filterTracksByQuery(tracks, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter((track) => {
      const name = String(track?.name || "").toLowerCase();
      const artists = (track?.artists || []).map((a) => a?.name || "").join(" ").toLowerCase();
      const album = String(track?.album?.name || "").toLowerCase();
      return name.includes(q) || artists.includes(q) || album.includes(q);
    });
  }

  function renderEmpty(text) {
    queueList.innerHTML = `<div class="empty-state">${text}</div>`;
  }

  function renderSearchEmpty(text) {
    searchResults.hidden = false;
    searchResults.innerHTML = `<div class="empty-state">${text}</div>`;
  }

  function showSearchResults() {
    searchResults.hidden = false;
  }

  function hideSearchResults() {
    searchResults.hidden = true;
  }

  const trackItemTemplate = (track, index, mode) => buildTrackItemTemplate(track, {
    getTrackOwner,
    getOwnerInitial,
    skipTrackUris: getSkipTrackUris()
  }, index, mode);

  api.loadQueue = async (options = {}) => {
    const { silent = false, preserveScroll = true } = options;
    if (!(await ensureValidToken())) return;
    setListMode("queue");
    mainTabBtn.classList.add("active");
    settingsTabBtn.classList.remove("active");
    try {
      const data = await spotifyFetch("/me/player/queue");
      const skipTrackUris = getSkipTrackUris();
      const queue = (data?.queue || [])
        .filter((t) => t?.uri)
        .filter((t) => !skipTrackUris.has(t.uri))
        .slice()
        .sort((a, b) => (getPinnedTrackUris().has(b.uri) ? 1 : 0) - (getPinnedTrackUris().has(a.uri) ? 1 : 0));
      let tracksForView = queue;
      if (queue.length <= 20) {
        try {
          const sourceTracks = await fetchSourceTracks();
          if (sourceTracks.length > queue.length) {
            const queueUris = new Set(queue.map((t) => t.uri));
            const remainder = sourceTracks.filter((t) => t?.uri && !skipTrackUris.has(t.uri) && !queueUris.has(t.uri));
            tracksForView = [...queue, ...remainder];
          }
        } catch {
          // Keep queue fallback if source pagination fails.
        }
      }
      visibleQueueTracks = tracksForView;
      const filteredTracks = filterTracksByQuery(visibleQueueTracks, searchInput.value);
      if (!filteredTracks.length) {
        renderEmpty("Queue is empty right now. Skip-marked tracks are in Skip/Remove.");
        queueList.dataset.signature = "queue:empty";
        setSkipTabCount(getSkipTrackUris().size);
        if (!silent) setStatus("Queue loaded.");
        return;
      }
      renderTrackCollection(
        queueList,
        filteredTracks,
        "queue",
        { preserveScroll },
        trackItemTemplate,
        getPinnedTrackUris(),
        getSkipTrackUris()
      );
      setSkipTabCount(getSkipTrackUris().size);
      if (!silent) setStatus(`Queue loaded (${filteredTracks.length} tracks).`);
    } catch (error) {
      renderEmpty("Could not load queue. Check token scopes and active Spotify device.");
      if (!silent) setStatus(error.message || "Failed to load queue.", true);
      console.error(error);
    }
  };

  api.loadSkipList = async (options = {}) => {
    const { silent = false, preserveScroll = true } = options;
    if (!(await ensureValidToken())) return;
    setListMode("skip");
    mainTabBtn.classList.remove("active");
    settingsTabBtn.classList.add("active");
    try {
      const data = await spotifyFetch("/me/player/queue");
      const queue = data?.queue || [];
      const skipTrackUris = getSkipTrackUris();
      const tracks = queue
        .filter(Boolean)
        .filter((t) => t?.uri && skipTrackUris.has(t.uri))
        .slice()
        .sort((a, b) => (getPinnedTrackUris().has(b.uri) ? 1 : 0) - (getPinnedTrackUris().has(a.uri) ? 1 : 0));
      visibleSkipTracks = tracks;
      const filteredTracks = filterTracksByQuery(visibleSkipTracks, searchInput.value);
      setSkipTabCount(skipTrackUris.size);
      if (!filteredTracks.length) {
        renderEmpty("No tracks currently marked for skip/remove.");
        queueList.dataset.signature = "skip:empty";
        if (!silent) setStatus("Skip/Remove list is empty.");
        return;
      }
      renderTrackCollection(
        queueList,
        filteredTracks,
        "skip",
        { preserveScroll },
        trackItemTemplate,
        getPinnedTrackUris(),
        getSkipTrackUris()
      );
      if (!silent) setStatus(`Loaded skip/remove list (${filteredTracks.length} tracks).`);
    } catch (error) {
      renderEmpty("Could not load skip/remove list.");
      if (!silent) setStatus(error.message || "Failed to load skip/remove list.", true);
      console.error(error);
    }
  };

  api.loadNowPlaying = async (options = {}) => {
    const { silent = false, nowPlayingState } = options;
    if (!(await ensureValidToken())) return;
    try {
      const data = await spotifyFetch("/me/player/currently-playing");
      const item = data?.item;
      if (!item) {
        lastNowPlayingUri = "";
        npTitle.textContent = "Nothing playing";
        npArtist.textContent = "Start Spotify playback";
        npProgressText.textContent = "0:00";
        npDurationText.textContent = "0:00";
        npSeek.value = "0";
        npSeek.style.setProperty("--seek-fill", "0%");
        if (npVolume) {
          npVolume.value = "50";
          npVolume.style.setProperty("--vol-fill", "50%");
        }
        if (nowPlayingState) {
          nowPlayingState.isPlaying = false;
          nowPlayingState.durationMs = 0;
          nowPlayingState.progressMs = 0;
          nowPlayingState.lastSyncAt = Date.now();
        }
        setPlaybackIcons();
        if (onNowPlayingItem) onNowPlayingItem(null);
        return;
      }
      if (onNowPlayingItem) onNowPlayingItem(item);
      const currentUri = String(item?.uri || "");
      const trackChanged = currentUri && currentUri !== lastNowPlayingUri;
      lastNowPlayingUri = currentUri;
      const artists = (item.artists || []).map((a) => a.name).join(" • ");
      const progressMs = Number(data.progress_ms || 0);
      const durationMs = Number(item.duration_ms || 0);
      if (nowPlayingState) {
        nowPlayingState.isPlaying = Boolean(data.is_playing);
        nowPlayingState.durationMs = durationMs;
        nowPlayingState.progressMs = progressMs;
        nowPlayingState.lastSyncAt = Date.now();
      }
      npTitle.textContent = item.name || "Unknown track";
      npArtist.textContent = artists || "Unknown artist";
      npProgressText.textContent = formatMs(progressMs);
      npDurationText.textContent = formatMs(durationMs);
      const seekPct = durationMs > 0 ? Math.min(100, Math.round((progressMs / durationMs) * 100)) : 0;
      npSeek.value = String(seekPct);
      npSeek.style.setProperty("--seek-fill", `${seekPct}%`);
      const volumePct = Number(data?.device?.volume_percent);
      if (npVolume && Number.isFinite(volumePct)) {
        const clamped = Math.max(0, Math.min(100, Math.round(volumePct)));
        npVolume.value = String(clamped);
        npVolume.style.setProperty("--vol-fill", `${clamped}%`);
      }
      setPlaybackIcons();
      const bypassUri = typeof getPrioritizedBypassUri === "function" ? getPrioritizedBypassUri() : "";
      if (bypassUri !== activeBypassUri) {
        activeBypassUri = bypassUri;
        hasSeenBypassInstance = false;
      }
      if (item?.uri && bypassUri && item.uri === bypassUri) {
        hasSeenBypassInstance = true;
        return;
      }
      if (bypassUri && hasSeenBypassInstance && item?.uri && item.uri !== bypassUri) {
        if (typeof clearPrioritizedBypassUri === "function") clearPrioritizedBypassUri();
        activeBypassUri = "";
        hasSeenBypassInstance = false;
      }
      if (item?.uri && getSkipTrackUris().has(item.uri)) {
        await playbackCommand("/me/player/next");
        persistSkipTracks();
        setStatus("Skipped marked track.");
        setTimeout(() => api.loadQueue({ silent: true, preserveScroll: true }), 250);
        setTimeout(() => api.loadNowPlaying({ silent: true, nowPlayingState }), 250);
        return;
      }
      if (trackChanged) {
        if (getListMode() === "skip") {
          api.loadSkipList({ silent: true, preserveScroll: true });
        } else {
          api.loadQueue({ silent: true, preserveScroll: true });
        }
      }
    } catch (error) {
      if (!silent) setStatus(error.message || "Could not load now playing.", true);
    }
  };

  api.runSearch = async () => {
    if (getListMode() === "queue" || getListMode() === "skip") {
      const q = searchInput.value.trim();
      const sourceTracks = getListMode() === "skip" ? visibleSkipTracks : visibleQueueTracks;
      const filtered = filterTracksByQuery(sourceTracks, q);
      if (!filtered.length) {
        renderEmpty(q ? "No tracks match your filter." : "No tracks available.");
      } else {
        renderTrackCollection(
          queueList,
          filtered,
          getListMode(),
          { preserveScroll: true },
          trackItemTemplate,
          getPinnedTrackUris(),
          getSkipTrackUris()
        );
      }
      if (q) setStatus(`Filtered list (${filtered.length} match${filtered.length === 1 ? "" : "es"}).`);
      else setStatus("Filter cleared.");
      hideSearchResults();
      return;
    }
    if (!(await ensureValidToken())) return;
    const q = searchInput.value.trim();
    if (!q) {
      setStatus("Type a track name or artist to search.");
      hideSearchResults();
      return;
    }
    setStatus("Searching...");
    try {
      const data = await spotifyFetch(`/search?q=${encodeURIComponent(q)}&type=track&limit=8`);
      const items = data?.tracks?.items || [];
      if (!items.length) {
        renderSearchEmpty("No tracks found.");
        showSearchResults();
        setStatus("No search results.");
        return;
      }
      showSearchResults();
      searchResults.innerHTML = items.map(buildSearchItemTemplate).join("");
      setStatus(`Found ${items.length} tracks.`);
    } catch (error) {
      renderSearchEmpty("Search failed. Check token scope.");
      showSearchResults();
      setStatus(error.message || "Search failed.", true);
      console.error(error);
    }
  };

  api.applyListFilter = () => {
    if (getListMode() !== "queue" && getListMode() !== "skip") return;
    const sourceTracks = getListMode() === "skip" ? visibleSkipTracks : visibleQueueTracks;
    const filtered = filterTracksByQuery(sourceTracks, searchInput.value);
    if (!filtered.length) {
      renderEmpty(searchInput.value.trim() ? "No tracks match your filter." : "No tracks available.");
      return;
    }
    renderTrackCollection(
      queueList,
      filtered,
      getListMode(),
      { preserveScroll: true },
      trackItemTemplate,
      getPinnedTrackUris(),
      getSkipTrackUris()
    );
  };

  setSkipTabCount(getSkipTrackUris().size);

  return api;
}
