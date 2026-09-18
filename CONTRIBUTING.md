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

`extension.js` monkey-patches `Mpris.MediaMessage.prototype._update` (from
GNOME Shell's `js/ui/mpris.js`) to add the Copy and optional Copy Link buttons
via the existing `addMediaControl()` helper, and reverses it in `disable()`.
This relies on internal Shell API, not a stable public one — `enable()`
feature-detects it and no-ops with a warning if a GNOME Shell version changes
its shape.

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
