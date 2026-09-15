# Copy Now Playing

A GNOME Shell extension that adds a **Copy** button next to the Prev/Play/Next
controls on GNOME's built-in media player notification (the one you see when
you click the clock/date at the top of the screen while something is
playing).

Click it and the currently playing track's artist and title are copied to
your clipboard — no need to alt-tab into the player just to grab the song
name.

Works with **any MPRIS-compatible player**: Spotify (web player in a browser,
or the desktop app), Chrome/Firefox media playback in general, VLC, Rhythmbox,
mpv, and anything else that exposes `org.mpris.MediaPlayer2.*` over D-Bus.

## Compatibility

Tested against GNOME Shell 45, 46 and 47. The extension patches an internal
Shell API (`Mpris.MediaMessage`), so it includes a runtime check: on any
GNOME Shell version where that API has changed shape, it logs a clear warning
and does nothing rather than risk crashing your session — your normal
Prev/Play/Next controls are never affected either way.

## Installation

### From extensions.gnome.org

*(link goes here once published)*

### Manually

```sh
git clone https://github.com/Nyndow/copy-now-playing.git
ln -s "$(pwd)/copy-now-playing/copy-now-playing@nyndow.github.io" \
      ~/.local/share/gnome-shell/extensions/copy-now-playing@nyndow.github.io
```

Then reload GNOME Shell:
- **X11**: press `Alt+F2`, type `r`, press Enter.
- **Wayland**: log out and back in.

Finally, enable it:

```sh
gnome-extensions enable copy-now-playing@nyndow.github.io
```

## How it works

GNOME Shell's own `js/ui/mpris.js` builds the notification row via a
`MediaMessage` class, using a shared `addMediaControl(iconName, callback)`
helper to create the Prev/Play/Next buttons. This extension monkey-patches
`MediaMessage.prototype._update` to add one more button through that same
helper (so it looks and behaves identically to the native ones), and writes
`"Artist - Title"` to the clipboard via GNOME Shell's own `St.Clipboard` API
when clicked. Everything runs locally — no network requests are made.

See [CONTRIBUTING.md](CONTRIBUTING.md) for more detail on the internals if
you want to hack on it.

## License

[GPL-2.0-or-later](LICENSE)
