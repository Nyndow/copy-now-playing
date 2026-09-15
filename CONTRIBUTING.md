# Contributing

Open an issue before sending a non-trivial PR.

## Dev setup

```sh
git clone https://github.com/Nyndow/copy-now-playing.git
ln -s "$(pwd)/copy-now-playing/copy-now-playing@nyndow.github.io" \
      ~/.local/share/gnome-shell/extensions/copy-now-playing@nyndow.github.io
gnome-extensions enable copy-now-playing@nyndow.github.io
```

Edit `extension.js`, then reload: `Alt+F2` → `r` → `Enter` (X11) or
disable/re-enable the extension. Watch for errors with
`journalctl --user -f -o cat | grep -i copy-now-playing`.

## How it works

`extension.js` monkey-patches `Mpris.MediaMessage.prototype._update` (from
GNOME Shell's `js/ui/mpris.js`) to add a Copy button via the existing
`addMediaControl()` helper, and reverses it in `disable()`. This relies on
internal Shell API, not a stable public one — `enable()` feature-detects it
and no-ops with a warning if a GNOME Shell version changes its shape.

## Issues

Include your GNOME Shell version, session type (`echo $XDG_SESSION_TYPE`),
and relevant `journalctl` output.

## License

Contributions are licensed under this project's [GPL-2.0-or-later](LICENSE).
