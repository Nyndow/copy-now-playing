// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Nyndow

/** Placeholders understood by formatTrack(). */
export const PLACEHOLDERS = ['artist', 'title', 'album'];

export const DEFAULT_FORMAT = '{artist} - {title}';

/** Presets offered in the preferences window, in display order. */
export const PRESETS = [
    {label: 'Artist - Title', format: '{artist} - {title}'},
    {label: 'Artist – Title (dash)', format: '{artist} – {title}'},
    {label: 'Title - Artist', format: '{title} - {artist}'},
    {label: 'Artist - Title (Album)', format: '{artist} - {title} ({album})'},
    {label: 'Title only', format: '{title}'},
];

const SEPARATOR = '[-–—|·:,/]';
const EMPTY = ''; // private-use marker for a placeholder with no value

/**
 * Render a template such as "{artist} - {title}" with the given fields.
 *
 * A placeholder whose value is empty disappears together with the separator
 * next to it, so "{artist} - {title}" with no artist yields just the title,
 * and "{artist} - {title} ({album})" with no album drops the parentheses.
 *
 * @param {string} template
 * @param {{artist?: string, title?: string, album?: string}} fields
 * @returns {string}
 */
export function formatTrack(template, fields) {
    let text = template.replace(/\{(\w+)\}/g, (match, key) =>
        PLACEHOLDERS.includes(key) ? (fields[key] || EMPTY) : match);

    // Drop the separator on one side of an empty field:
    // "Artist - <empty> - Title" -> "Artist - Title", "<empty> - Title" -> "Title"
    text = text.replace(
        new RegExp(`${EMPTY}\\s*${SEPARATOR}+\\s*|\\s*${SEPARATOR}+\\s*${EMPTY}`, 'g'),
        EMPTY);
    text = text.replaceAll(EMPTY, '');
    // Empty brackets left behind by a missing field: "Title ()"
    text = text.replace(/[([]\s*[)\]]/g, '');

    return text.replace(/\s+/g, ' ').trim();
}
