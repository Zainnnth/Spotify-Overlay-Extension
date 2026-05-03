# Spotify Jam Sticky Widget Handoff

## Purpose
This project is an Electron-based Spotify Jam-style side widget. It behaves as:
- a docked left/right overlay
- a queue viewer and now-playing controller
- a Spotify OAuth client for playback/search/library actions
- a local-only jam presence demo for member display and queue metadata

## How To Run
- Install dependencies: already present in `node_modules`
- Start the app: `npm start`
- Main entry point: `main.js`
- Renderer UI: `index.html`, `script.js`, `styles.css`

## Current Behavior
### Window / layout
- Frameless always-on-top Electron window
- Docks to left or right from Settings
- Collapsed rail is narrow and should not block desktop interaction
- Peek mode can hide/reveal the widget from the edge sensor
- The widget is hidden from Alt+Tab when collapsed
- Display selector allows choosing which monitor the widget attaches to
- Top header controls are hidden until signed in

### Spotify auth
- Uses Spotify PKCE login in Electron
- OAuth redirect is `http://127.0.0.1:8888/callback`
- Client ID is stored locally once provided
- Access token and refresh token persist in `localStorage`
- Launch checks token validity and scope version
- Scope set now includes:
  - `user-read-playback-state`
  - `user-read-currently-playing`
  - `user-read-recently-played`
  - `user-modify-playback-state`
  - `user-library-modify`
  - `user-library-read`
  - `playlist-read-private`
  - `playlist-read-collaborative`
- Permission mismatch UX:
  - warning banner appears when scope is stale or permission errors are returned
  - banner button triggers the same re-auth flow as `Get Token`

### Queue and playback
- Queue view is skip-aware (skip-marked tracks are hidden from main queue)
- Secondary tab is `Skip/Remove` and shows skip-marked tracks
- Now playing is polled separately
- Music scrubber uses Spotify-like white played segment and grey remainder
- Playback controls use icon buttons
- Play/Pause button is device-aware:
  - disabled/greyed when no playback device is selected
  - first press auto-starts playback on selected device
  - then behaves as normal play/pause
- Search results auto-hide when focus leaves the search area
- Search input supports in-list filtering (name/artist/album) for queue/skip views
- Queue row menu supports:
  - Save to liked songs
  - Go to artist
  - Go to album
  - Share
- Now Playing card has cover art + matching 3-dot menu actions
- Double-click queue behavior:
  - prioritizes selected track (adds next)
  - marks same-song duplicates to skip
  - protects the prioritized instance from skip
  - skips later duplicates as they appear
- Main queue marks first item as `Next up`
- Volume control is Spotify-style and synced with current device volume
- Source chooser is embedded into search input and opens an in-app source menu (custom themed scrollbar)

### Local sync
- There is a local-only sync layer using `BroadcastChannel` plus `storage` fallback
- It shares state across widget instances on the same machine
- Shared items include:
  - jam members
  - join state
  - collab toggle
  - jam link
  - hidden/pinned track URIs
  - track owner labels
  - dock side, peek mode
- This is not a remote multiplayer backend

## Important Limitations
- Spotify Web API does not expose the real Jam member roster
- Spotify Web API does not expose Jam invite creation links
- Spotify Web API does not expose a queue item delete endpoint
- Other users on different machines will not sync with local-only sync
- `Hide`/skip in widget does not delete tracks from Spotify queue
- Duplicate-skip is app-side logic and depends on polling cadence (not true queue deletion)

## File Responsibilities
### `main.js`
- Electron window creation
- dock sizing and focusability
- tray menu
- Spotify PKCE login and refresh token exchange

### `preload.js`
- exposes Electron IPC bridge to the renderer

### `script.js`
- all renderer logic
- auth state
- queue loading
- now playing
- search
- settings
- source quick-menu + source sync
- local sync
- jam member rendering

### `styles.css`
- Spotify-like visual styling
- queue item layout
- custom scrollbar styling
- seek bar styling

### `index.html`
- all UI structure
- queue panel
- settings panel
- login panel

## Recent Fixes Already In Place
- silent background queue refresh
- queue refresh jitter reduced
- playback button click routing now handles icon clicks
- guarded JSON parsing for persisted storage
- guarded JSON parsing for Spotify auth responses
- local-only sync broadcast and storage fallback
- faster queue/now-playing polling
- Spotify-like seek bar colors
- Spotify-like volume slider + hover thumb
- Settings no longer intermittently opens empty
- Permission warning banner + re-authorize shortcut
- Source chooser integrated into search bar
- Custom source dropdown/menu rendering
- Queue updates immediately on now-playing track change
- Skip/Remove tab with live count
- Queue/menu interaction and hover/active visual consistency
- Prioritized duplicate-skip flow for double-click

## Where To Continue
If you continue work later, start here:
1. Open `script.js`
2. Inspect these sections in order:
   - auth helpers near the top
   - `spotifyFetch()`
   - `loadQueue()` / `loadRecentlyPlayed()`
   - `loadNowPlaying()`
   - action router near the bottom
   - local sync helpers near the top-middle
3. Then check `main.js` if window behavior or auth refresh needs changes

## Best Next Improvements
1. Add explicit inline status for active playback device mismatch (device name and id)
2. Add a small queue policy explainer tooltip for duplicate-skip behavior
3. If true multi-device jam presence is needed, add a remote backend later
4. Add optional debounce/throttle tuning in Settings for low-refresh systems

## Notes For Future Debugging
- If you see a JSON error again, check whether it comes from:
  - localStorage parse
  - Spotify API response parsing
  - OAuth login/refresh response parsing
- If queue items are missing, check:
  - active playback device
  - token scopes
  - whether the item is hidden locally
  - whether the widget is reading the same playback device you are using in Spotify
- If like/save fails:
  - verify user re-authorized after scope updates
  - verify permission banner is cleared after successful login
  - inspect action log for 401/403 endpoint errors
