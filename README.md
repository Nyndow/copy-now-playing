# Copy Now Playing

A GNOME Shell extension that adds a **Copy** button to GNOME's built-in media
player notification, letting you copy the currently playing track's artist
and title to your clipboard in one click.

Works with any MPRIS-compatible player: Spotify (web or desktop), browsers, and more.

![Copy button next to Prev/Play/Next on the media notification](screenshot.webp)

## Installation

```sh
git clone https://github.com/Nyndow/copy-now-playing.git
ln -s "$(pwd)/copy-now-playing/copy-now-playing@nyndow.github.io" \
      ~/.local/share/gnome-shell/extensions/copy-now-playing@nyndow.github.io
gnome-extensions enable copy-now-playing@nyndow.github.io
```

Reload GNOME Shell first if it doesn't show up: `Alt+F2` → `r` → `Enter`
(X11), or log out/in (Wayland).

Tested on GNOME Shell 45, 46, 47.

## How it works

See [CONTRIBUTING.md](CONTRIBUTING.md) for the internals.

## License

[GPL-2.0-or-later](LICENSE)
