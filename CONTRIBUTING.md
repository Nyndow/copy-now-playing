# Contributing

Open an issue before sending a non-trivial PR. To submit a change: fork the
repo, create a branch, and open a pull request against `main` — don't push
directly to `main`.

## Dev setup

```sh
git clone https://github.com/Nyndow/copy-now-playing.git
glib-compile-schemas copy-now-playing/copy-now-playing@nyndow.github.io/schemas
ln -s "$(pwd)/copy-now-playing/copy-now-playing@nyndow.github.io" \
      ~/.local/share/gnome-shell/extensions/copy-now-playing@nyndow.github.io
gnome-extensions enable copy-now-playing@nyndow.github.io
```

Re-run `glib-compile-schemas` whenever the `.gschema.xml` changes.
Edit `extension.js`, then reload: `Alt+F2` → `r` → `Enter` (X11) or
disable/re-enable the extension. Watch for errors with
`journalctl --user -f -o cat | grep -i copy-now-playing`.

## How it works

`extension.js` adds the Copy and optional Copy Link buttons to each media
message via the Shell's own `addMediaControl()` helper, and removes them in
`disable()`. How it gets hold of the messages depends on the Shell version:

- **GNOME 45–47**: `Mpris.MediaMessage` is exported, so its `_update()` is
  wrapped and existing messages are read from the date menu's `_mediaSection`.
- **GNOME 48+**: `MediaMessage` moved into `messageList.js` and is no longer
  exported, so `MessageList.MessageView.prototype._addPlayer()` is wrapped
  instead and existing messages come from the view's `_playerToMessage` map.

Each message's player `changed` signal keeps the greyed-out state in sync.
The OSD shown by the shortcut also switched signatures in GNOME 49, which is
handled by checking `Config.PACKAGE_VERSION`. All of this is internal Shell
API, not a stable public one — `enable()` feature-detects both shapes and
no-ops with a warning if neither matches.

The keyboard shortcut is registered with `Main.wm.addKeybinding()` and finds
the current player through the date menu's media section (with a fallback to
the messages already patched). `format.js` holds the `{artist} - {title}`
template renderer shared by `extension.js` and `prefs.js`; the preferences
window itself is a plain libadwaita page in `prefs.js`, backed by the schema
in `schemas/`.

## Issues

Include your GNOME Shell version, session type (`echo $XDG_SESSION_TYPE`),
and relevant `journalctl` output.

## License

Contributions are licensed under this project's [GPL-2.0-or-later](LICENSE).
