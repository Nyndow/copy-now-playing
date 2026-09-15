# Contributing

Thanks for considering a contribution. This is a small extension with a
narrow scope, so please open an issue to discuss any non-trivial change
before sending a PR — it saves everyone rework.

## Local development

1. Clone the repo and symlink it into GNOME's extensions directory:

   ```sh
   git clone https://github.com/Nyndow/copy-now-playing.git
   ln -s "$(pwd)/copy-now-playing/copy-now-playing@nyndow.github.io" \
         ~/.local/share/gnome-shell/extensions/copy-now-playing@nyndow.github.io
   gnome-extensions enable copy-now-playing@nyndow.github.io
   ```

2. Edit `copy-now-playing@nyndow.github.io/extension.js`.

3. Reload GNOME Shell to pick up changes:
   - **X11**: `Alt+F2` → `r` → `Enter`, or:
     ```sh
     gnome-extensions disable copy-now-playing@nyndow.github.io
     gnome-extensions enable copy-now-playing@nyndow.github.io
     ```
   - **Wayland**: log out and back in (there is no in-session reload).

4. Watch for errors:

   ```sh
   journalctl --user -f -o cat | grep -i copy-now-playing
   ```

## How the extension is structured

- `metadata.json` — standard GNOME Shell extension manifest (uuid, name,
  supported `shell-version`s).
- `extension.js` — the entire extension. It monkey-patches
  `Mpris.MediaMessage.prototype._update` (from GNOME Shell's own
  `js/ui/mpris.js`) to append a Copy button via the existing
  `addMediaControl()` helper, and reverses the patch cleanly in `disable()`.

There is intentionally no build step, bundler, or dependency — GNOME Shell
extensions run as plain ES modules loaded directly by the Shell.

## GNOME Shell version compatibility

This extension relies on the internal shape of GNOME Shell's
`js/ui/mpris.js` and `js/ui/messageList.js`, which are **not** a stable
public API and can change between GNOME Shell releases. `extension.js`
feature-detects this at `enable()` time and no-ops with a `console.warn` log
line if the expected methods aren't found, rather than crashing.

If you're adding support for a GNOME Shell version where this extension logs
that warning:

1. Diff the relevant GNOME Shell source for that version against the
   previous one, e.g.:
   ```sh
   curl -sL https://gitlab.gnome.org/GNOME/gnome-shell/-/raw/gnome-<N>/js/ui/mpris.js
   curl -sL https://gitlab.gnome.org/GNOME/gnome-shell/-/raw/gnome-<N>/js/ui/messageList.js
   ```
2. Find where the media notification row is now built (as of GNOME 48, it
   moved into `messageList.js` and `MediaMessage` is no longer exported —
   patching `MessageListSection.prototype.addMessage` and detecting media
   rows via a `_player` property is the likely path forward there).
3. Add a version-specific branch in `enable()`, and add the version to
   `shell-version` in `metadata.json` once verified on a real install.

## Reporting issues

Please include your GNOME Shell version (`gnome-shell --version`), session
type (`echo $XDG_SESSION_TYPE`), and any relevant lines from
`journalctl --user -b | grep -i copy-now-playing`.

## License

By contributing, you agree your contributions are licensed under this
project's [GPL-2.0-or-later license](LICENSE).
