// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Nyndow

import St from 'gi://St';
import GLib from 'gi://GLib';

import * as Mpris from 'resource:///org/gnome/shell/ui/mpris.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const COPY_ICON = 'edit-copy-symbolic';
const COPIED_ICON = 'object-select-symbolic';
const RESET_DELAY_MS = 1200;

export default class CopyNowPlayingExtension extends Extension {
    enable() {
        this._patchedMessages = new Set();
        this._originalUpdate = null;

        const targetProto = Mpris.MediaMessage?.prototype;
        const hasExpectedShape = typeof targetProto?._update === 'function' &&
            typeof targetProto?.addMediaControl === 'function';

        if (!hasExpectedShape) {
            console.warn(
                `[${this.metadata.name}] GNOME Shell's Mpris.MediaMessage API ` +
                'does not look like the shape this extension expects ' +
                '(tested against GNOME Shell 45-47). Skipping patch instead ' +
                'of risking a crash. The media notification will work as ' +
                'normal, just without the Copy button.');
            return;
        }

        this._originalUpdate = targetProto._update;

        const patchedMessages = this._patchedMessages;
        const originalUpdate = this._originalUpdate;

        Mpris.MediaMessage.prototype._update = function () {
            originalUpdate.call(this);

            if (!this._copyButton) {
                this._copyButton = this.addMediaControl(COPY_ICON, () => {
                    this._copyTrackToClipboard();
                });
                patchedMessages.add(this);
            }
        };

        Mpris.MediaMessage.prototype._cancelCopyReset = function () {
            if (this._copyResetId) {
                GLib.source_remove(this._copyResetId);
                this._copyResetId = 0;
            }
        };

        Mpris.MediaMessage.prototype._copyTrackToClipboard = function () {
            const artists = this._player.trackArtists?.join(', ') ?? '';
            const title = this._player.trackTitle ?? '';
            const text = artists ? `${artists} - ${title}` : title;

            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);

            const icon = this._copyButton.child;
            icon.icon_name = COPIED_ICON;

            this._cancelCopyReset();
            this._copyResetId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RESET_DELAY_MS, () => {
                icon.icon_name = COPY_ICON;
                this._copyResetId = 0;
                return GLib.SOURCE_REMOVE;
            });
        };
    }

    disable() {
        if (this._originalUpdate)
            Mpris.MediaMessage.prototype._update = this._originalUpdate;
        this._originalUpdate = null;

        delete Mpris.MediaMessage?.prototype?._copyTrackToClipboard;
        delete Mpris.MediaMessage?.prototype?._cancelCopyReset;

        for (const message of this._patchedMessages) {
            message._cancelCopyReset?.();
            message._copyButton?.destroy();
            delete message._copyButton;
        }
        this._patchedMessages.clear();
        this._patchedMessages = null;
    }
}
