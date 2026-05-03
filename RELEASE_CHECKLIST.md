# Release Checklist (Spotify Jam Sticky Widget)

## Preflight
1. `npm start` launches without crash.
2. Settings shows app version.
3. No personal secrets are committed (tokens, local data files).
4. Monitor selector lists all connected displays.

## Auth + Session
1. Login flow succeeds with Spotify PKCE.
2. Token refresh works from Settings.
3. Logout clears auth state and returns to login view.
4. Permission banner behavior:
   - appears when scopes are stale / insufficient permission is detected
   - `Re-authorize` button starts PKCE login
   - banner hides after successful login

## Playback + Queue
1. Queue loads in main tab.
2. `Skip/Remove` tab loads skip-marked tracks in secondary tab.
3. Now playing card updates title/artist/progress.
4. Prev/Play/Pause/Next/Seek actions work on active device.
5. Play/Pause state-gating:
   - button is disabled when no playback device is selected
   - first press with selected device starts playback automatically
   - subsequent presses toggle play/pause
6. Skip-mark behavior:
   - mark from queue
   - highlight appears immediately
   - auto-skip when marked track starts
7. Double-click prioritize behavior:
   - selected track is queued next
   - selected instance is not skipped
   - other duplicate instances are skipped when they come up
8. `Next up` badge appears on first queue item.

## Search + Actions
1. Search returns results.
2. Search `Add` queues track.
3. Search/queue open actions launch Spotify links.
4. 3-dot menu actions work:
   - Save to liked songs
   - Go to artist
   - Go to album
   - Share (clipboard)
5. Now Playing 3-dot menu actions work.
6. Search input list-filter behavior:
   - filters queue/skip list by track/artist/album
   - clear button restores list
7. Source chooser in search bar:
   - opens in-app menu (not native Windows dropdown)
   - menu lists `Liked Songs` + playlists
   - changing source refreshes visible list and keeps popup open

## Device Control
1. Playback device list loads.
2. Device selection persists.
3. `Start Playback` transfers/starts playback on selected device.
4. Playback source list loads:
   - `Liked Songs`
   - user playlists
5. Source menu scrollbar uses app theme (not native Windows default look).

## UI/UX
1. Settings tab never opens empty.
2. Queue scroll reaches full end; no cut-off.
3. No overlap in long queue item names.
4. Custom scrollbar visible in Settings/Queue/Search.
5. Button hover/highlight style is consistent.
6. No divider line remains above the now-playing card.
7. No opacity control appears in Settings.
8. Top header controls are hidden until signed in.
9. Patch notes text appears on login screen only.

## Diagnostics
1. Action log records clicks/results/errors.
2. `Export Diagnostics` downloads JSON file.
3. `Clear Logs` clears action log.
4. `Reset UI Settings` resets side/peek/display-related UI state.
5. `Reset App Data` clears state and reloads.
6. Like/save failures produce actionable status text (auth/scope/device path).

## Packaging Readiness
1. `version` in `package.json` updated for release.
2. Shareable artifact produced (`dist/`), tested launch on target machine/profile.
3. Optional: code signing configured to reduce SmartScreen warnings.
