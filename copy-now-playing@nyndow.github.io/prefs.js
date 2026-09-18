// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Nyndow

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {DEFAULT_FORMAT, PRESETS, formatTrack} from './format.js';

const FORMAT_KEY = 'format';
const LINK_BUTTON_KEY = 'show-link-button';
const SHORTCUT_KEY = 'copy-shortcut';

const SAMPLE_TRACK = {
    artist: 'Daft Punk',
    title: 'Get Lucky',
    album: 'Random Access Memories',
};

const MODIFIER_KEYS = new Set([
    Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
    Gdk.KEY_Control_L, Gdk.KEY_Control_R,
    Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
    Gdk.KEY_Super_L, Gdk.KEY_Super_R,
    Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
    Gdk.KEY_Hyper_L, Gdk.KEY_Hyper_R,
    Gdk.KEY_ISO_Level3_Shift, Gdk.KEY_Caps_Lock,
]);

export default class CopyNowPlayingPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings; // keep alive for the window's lifetime

        const page = new Adw.PreferencesPage();
        page.add(this._buildFormatGroup(settings));
        page.add(this._buildButtonsGroup(settings));
        page.add(this._buildShortcutGroup(settings, window));
        window.add(page);
    }

    // --- Clipboard text ---------------------------------------------------

    _buildFormatGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Clipboard Text'),
            description: _('Placeholders: {artist}, {title}, {album}. ' +
                'An empty field is dropped together with its separator.'),
        });

        const labels = [...PRESETS.map(p => p.label), _('Custom…')];
        const presetRow = new Adw.ComboRow({
            title: _('Format'),
            model: Gtk.StringList.new(labels),
        });
        const customRow = new Adw.EntryRow({title: _('Custom format')});
        const previewRow = new Adw.ActionRow({
            title: _('Preview'),
            subtitle_selectable: true,
        });
        group.add(presetRow);
        group.add(customRow);
        group.add(previewRow);

        let customChosen = false;
        let syncing = false;

        const sync = () => {
            syncing = true;
            const raw = settings.get_string(FORMAT_KEY);
            const template = raw || DEFAULT_FORMAT;
            const presetIndex = PRESETS.findIndex(p => p.format === raw);
            const useCustom = customChosen || presetIndex < 0;

            presetRow.selected = useCustom ? PRESETS.length : presetIndex;
            customRow.visible = useCustom;
            if (customRow.text !== raw)
                customRow.text = raw;
            previewRow.subtitle = formatTrack(template, SAMPLE_TRACK) || _('(empty)');
            syncing = false;
        };

        presetRow.connect('notify::selected', () => {
            if (syncing)
                return;
            const preset = PRESETS[presetRow.selected];
            customChosen = !preset;
            if (preset)
                settings.set_string(FORMAT_KEY, preset.format);
            sync();
            if (!preset)
                customRow.grab_focus();
        });

        customRow.connect('changed', () => {
            if (syncing || !customRow.visible)
                return;
            settings.set_string(FORMAT_KEY, customRow.text);
        });

        settings.connect(`changed::${FORMAT_KEY}`, sync);
        sync();
        return group;
    }

    // --- Notification buttons --------------------------------------------

    _buildButtonsGroup(settings) {
        const group = new Adw.PreferencesGroup({title: _('Notification Buttons')});

        const linkRow = new Adw.SwitchRow({
            title: _('Copy Link button'),
            subtitle: _('Add a second button that copies the track’s URL, ' +
                'for example a Spotify or YouTube link'),
        });
        settings.bind(LINK_BUTTON_KEY, linkRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(linkRow);
        return group;
    }

    // --- Keyboard shortcut ---------------------------------------------

    _buildShortcutGroup(settings, window) {
        const group = new Adw.PreferencesGroup({
            title: _('Keyboard Shortcut'),
            description: _('Copies the playing track from anywhere and ' +
                'shows what was copied on screen.'),
        });

        const row = new Adw.ActionRow({
            title: _('Copy current track'),
            activatable: true,
        });
        const label = new Gtk.ShortcutLabel({
            disabled_text: _('Disabled'),
            valign: Gtk.Align.CENTER,
        });
        row.add_suffix(label);
        group.add(row);

        const sync = () => {
            label.accelerator = settings.get_strv(SHORTCUT_KEY)[0] ?? '';
        };
        settings.connect(`changed::${SHORTCUT_KEY}`, sync);
        sync();

        row.connect('activated', () => this._captureShortcut(settings, window));
        return group;
    }

    _captureShortcut(settings, parent) {
        const dialog = new Adw.Window({
            transient_for: parent,
            modal: true,
            title: _('Set Shortcut'),
            default_width: 420,
            default_height: 260,
            resizable: false,
        });

        const status = new Adw.StatusPage({
            icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
            title: _('Press a key combination'),
            description: _('Backspace removes the shortcut, Escape cancels'),
        });
        const view = new Adw.ToolbarView({content: status});
        view.add_top_bar(new Adw.HeaderBar());
        dialog.content = view;

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_ctrl, keyval, keycode, state) => {
            const mask = state & Gtk.accelerator_get_default_mod_mask();

            if (mask === 0 && keyval === Gdk.KEY_Escape) {
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (mask === 0 && keyval === Gdk.KEY_BackSpace) {
                settings.set_strv(SHORTCUT_KEY, []);
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (MODIFIER_KEYS.has(keyval))
                return Gdk.EVENT_STOP; // wait for the rest of the combination

            const lower = Gdk.keyval_to_lower(keyval);
            const isFunctionKey = lower >= Gdk.KEY_F1 && lower <= Gdk.KEY_F35;
            if ((mask === 0 && !isFunctionKey) || !Gtk.accelerator_valid(lower, mask))
                return Gdk.EVENT_STOP; // bare letters would swallow typing

            settings.set_strv(SHORTCUT_KEY,
                [Gtk.accelerator_name_with_keycode(null, lower, keycode, mask)]);
            dialog.close();
            return Gdk.EVENT_STOP;
        });
        dialog.add_controller(controller);
        dialog.present();
    }
}
