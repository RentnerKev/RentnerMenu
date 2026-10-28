import { readRegularFile } from '../lib/regularFile.ts'
import type { ReleaseMetadata } from './Types/release.types.ts'

export const startMarker = '<!-- rentner-release-notes:start -->'
export const endMarker = '<!-- rentner-release-notes:end -->'

export function readNotes(path: string): string {
    const notes = readRegularFile(path, {
        minBytes: 1,
        maxBytes: 1_000_000,
    }).toString('utf8')
    if (
        notes.includes('\0') ||
        notes.includes(startMarker) ||
        notes.includes(endMarker)
    )
        throw new Error('Invalid release notes contents')
    return notes
}

export function releaseBody(
    existing: string,
    notes: string,
    release: ReleaseMetadata,
    repository: string,
    server: string,
): string {
    const banner = `![RentnerMenu release banner](${server}/${repository}/releases/download/${release.tag_name}/release-banner.svg)`
    const start = existing.indexOf(startMarker)
    const end = existing.indexOf(endMarker)
    if (
        (start === -1) !== (end === -1) ||
        (start !== -1 &&
            (end < start ||
                existing.indexOf(startMarker, start + 1) !== -1 ||
                existing.indexOf(endMarker, end + 1) !== -1))
    )
        throw new Error(
            'Ambiguous managed notes markers; refusing to overwrite author notes',
        )
    const authorNotes = (
        start === -1
            ? existing
            : existing.slice(0, start) + existing.slice(end + endMarker.length)
    )
        .replace(banner, '')
        .trim()
    const date = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(release.published_at))
    const body = `${banner}\n\n${authorNotes ? `${authorNotes}\n\n` : ''}${startMarker}\n# Release · \`${release.tag_name}\`\n\n> **Stable Release** · Published on **${date}**\n\n${notes.trim()}\n${endMarker}\n`
    if (Buffer.byteLength(body) > 1_000_000 || body.includes('\0'))
        throw new Error('Release body exceeds its safe size')
    return body
}
