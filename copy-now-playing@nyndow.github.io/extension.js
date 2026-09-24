// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Nyndow

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageList from 'resource:///org/gnome/shell/ui/messageList.js';
import * as Mpris from 'resource:///org/gnome/shell/ui/mpris.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {DEFAULT_FORMAT, formatTrack} from './format.js';

const COPY_ICON = 'edit-copy-symbolic';
const LINK_ICON = 'insert-link-symbolic';
const COPIED_ICON = 'object-select-symbolic';
const NOTHING_PLAYING_ICON = 'media-playback-stop-symbolic';

const RESET_DELAY_MS = 2000;
const FADE_MS = 120;

const FORMAT_KEY = 'format';
const LINK_BUTTON_KEY = 'show-link-button';
const SHORTCUT_KEY = 'copy-shortcut';

const SHELL_MAJOR = parseInt(Config.PACKAGE_VERSION.split('.')[0], 10);

export default class CopyNowPlayingExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._patchedMessages = new Set();
        this._originalUpdate = null;
        this._originalAddPlayer = null;

        this._installMessageHooks();

        this._settingsChangedId = this._settings.connect('changed', () => {
            for (const message of this._patchedMessages)
                this._syncMessage(message);
        });

        Main.wm.addKeybinding(SHORTCUT_KEY, this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            () => this._copyCurrentTrack());
    }

    disable() {
        Main.wm.removeKeybinding(SHORTCUT_KEY);

        if (this._originalUpdate)
            Mpris.MediaMessage.prototype._update = this._originalUpdate;
        this._originalUpdate = null;

        if (this._originalAddPlayer)
            MessageList.MessageView.prototype._addPlayer = this._originalAddPlayer;
        this._originalAddPlayer = null;

        for (const message of this._patchedMessages)
            this._releaseMessage(message);
        this._patchedMessages = null;

        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = 0;
        this._settings = null;
    }

    // --- Finding media messages ------------------------------------------
    //
    // GNOME 45-47 export Mpris.MediaMessage, so its _update() can be wrapped.
    // GNOME 48+ moved MediaMessage into messageList.js; there MessageView
    // builds one per player in _addPlayer(), so that is wrapped instead.
    // Both paths feed _syncMessage().

    _installMessageHooks() {
        const extension = this;

        if (SHELL_MAJOR >= 48) {
            const viewProto = MessageList.MessageView.prototype;
            this._originalAddPlayer = viewProto._addPlayer;
            const originalAddPlayer = this._originalAddPlayer;
            viewProto._addPlayer = function (player) {
                originalAddPlayer.call(this, player);
                extension._syncMessage(this._playerToMessage.get(player));
            };
        } else {
            const messageProto = Mpris.MediaMessage.prototype;
            this._originalUpdate = messageProto._update;
            const originalUpdate = this._originalUpdate;
            messageProto._update = function () {
                originalUpdate.call(this);
                extension._syncMessage(this);
            };
        }

        for (const message of this._existingMessages())
            this._syncMessage(message);
    }

    /** Messages already on screen when the extension gets enabled. */
    _existingMessages() {
        const messageList = Main.panel.statusArea.dateMenu._messageList;
        if (SHELL_MAJOR >= 48)
            return [...messageList._messageView._playerToMessage.values()];
        return messageList._mediaSection._messages;
    }

    // --- Media notification buttons -------------------------------------

    /**
     * Make a media message's buttons match the current settings and track:
     * create them on first sight, add or drop the link button when the
     * setting flips, and grey them out when there is nothing to copy.
     */
    _syncMessage(message) {
        if (!this._patchedMessages.has(message)) {
            this._patchedMessages.add(message);
            message._copyDestroyId = message.connect('destroy',
                () => this._forgetMessage(message));
            // Track changes (metadata, play state) so the buttons stay in sync
            message._player.connectObject('changed',
                () => this._syncMessage(message), this);
        }

        const fields = this._trackFields(message._player);

        if (!message._copyButton) {
            message._copyButton = message.addMediaControl(COPY_ICON,
                () => this._copyFromMessage(message));
            message._copyButton.accessible_name = _('Copy track');
        }
        message._copyButton.reactive = this._formatFields(fields) !== '';

        const wantLink = this._settings.get_boolean(LINK_BUTTON_KEY);
        if (wantLink && !message._linkButton) {
            message._linkButton = message.addMediaControl(LINK_ICON,
                () => this._copyLinkFromMessage(message));
            message._linkButton.accessible_name = _('Copy track link');
        } else if (!wantLink && message._linkButton) {
            this._destroyButton(message, '_linkButton');
        }
        if (message._linkButton)
            message._linkButton.reactive = fields.url !== '';
    }

    /** The message is going away on its own: stop touching it. */
    _forgetMessage(message) {
        for (const button of [message._copyButton, message._linkButton]) {
            if (button)
                this._cancelCopyReset(button);
        }
        message._player.disconnectObject(this);
        this._patchedMessages.delete(message);
    }

    /** The extension is being disabled: put the message back as it was. */
    _releaseMessage(message) {
        message.disconnect(message._copyDestroyId);
        delete message._copyDestroyId;
        message._player.disconnectObject(this);
        this._destroyButton(message, '_copyButton');
        this._destroyButton(message, '_linkButton');
    }

    _destroyButton(message, prop) {
        const button = message[prop];
        if (!button)
            return;
        this._cancelCopyReset(button);
        button.child.remove_all_transitions();
        button.destroy();
        delete message[prop];
    }

    _copyFromMessage(message) {
        const text = this._formatFields(this._trackFields(message._player));
        if (!text)
            return;
        this._copyText(text);
        this._showCopiedFeedback(message._copyButton, COPY_ICON);
    }

    _copyLinkFromMessage(message) {
        const {url} = this._trackFields(message._player);
        if (!url)
            return;
        this._copyText(url);
        this._showCopiedFeedback(message._linkButton, LINK_ICON);
    }

    // --- Copied feedback --------------------------------------------------

    _showCopiedFeedback(button, restoreIcon) {
        const icon = button.child;
        this._cancelCopyReset(button);
        icon.remove_all_transitions();
        this._swapIcon(icon, COPIED_ICON);

        button._copyResetId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RESET_DELAY_MS, () => {
            button._copyResetId = 0;
            this._swapIcon(icon, restoreIcon);
            return GLib.SOURCE_REMOVE;
        });
    }

    _swapIcon(icon, iconName) {
        icon.ease({
            opacity: 0,
            duration: FADE_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: finished => {
                // Interrupted (e.g. the message was destroyed mid-fade)
                if (finished === false)
                    return;
                icon.icon_name = iconName;
                icon.ease({
                    opacity: 255,
                    duration: FADE_MS,
                    mode: Clutter.AnimationMode.EASE_IN_QUAD,
                });
            },
        });
    }

    _cancelCopyReset(button) {
        if (button._copyResetId) {
            GLib.source_remove(button._copyResetId);
            button._copyResetId = 0;
        }
    }

    // --- Keyboard shortcut ---------------------------------------------

    _copyCurrentTrack() {
        const player = this._currentPlayer();
        const text = player ? this._formatFields(this._trackFields(player)) : '';

        if (!text) {
            this._showOsd(NOTHING_PLAYING_ICON, _('Nothing is playing'));
            return;
        }

        this._copyText(text);
        this._showOsd(COPY_ICON, text);
    }

    /** The playing MPRIS player with a track, else any player with a track. */
    _currentPlayer() {
        const players = this._players().filter(
            p => this._formatFields(this._trackFields(p)) !== '');
        return players.find(p => p.status === 'Playing') ?? players[0] ?? null;
    }

    _players() {
        const messageList = Main.panel.statusArea.dateMenu._messageList;
        if (SHELL_MAJOR >= 48)
            return messageList._messageView._mediaSource.players;
        return [...messageList._mediaSection._players.values()];
    }

    _showOsd(iconName, label) {
        const icon = Gio.ThemedIcon.new(iconName);
        if (SHELL_MAJOR >= 49)
            Main.osdWindowManager.show(icon, label, []); // no level bar
        else
            Main.osdWindowManager.show(-1, icon, label); // -1: all monitors
    }

    // --- Track data --------------------------------------------------------

    _trackFields(player) {
        const metadata = player._playerProxy.Metadata ?? {};

        const str = key => {
            const value = metadata[key]?.deepUnpack();
            return typeof value === 'string' ? value.trim() : '';
        };

        const artists = player.trackArtists.filter(a => a.trim() !== '');

        return {
            artist: artists.join(', ').trim(),
            title: player.trackTitle.trim(),
            album: str('xesam:album'),
            url: str('xesam:url'),
        };
    }

    _formatFields(fields) {
        const template = this._settings.get_string(FORMAT_KEY) || DEFAULT_FORMAT;
        return formatTrack(template, fields);
    }

    _copyText(text) {
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
        clipboard.set_text(St.ClipboardType.PRIMARY, text);
    }
}
