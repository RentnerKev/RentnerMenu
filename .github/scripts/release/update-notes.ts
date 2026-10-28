import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { api, command, isMain, requiredEnv } from '../lib/runtime.ts'
import { verifySourceCheckout, validRelease } from './identity.ts'
import { readNotes, releaseBody } from './notes.ts'
import { isReleaseMetadata } from './releaseValidation.ts'

if (isMain(import.meta.url)) {
    const selected = verifySourceCheckout()
    const notes = readNotes(requiredEnv('NOTES_PATH'))
    const banner = resolve(
        '.github/assets/release-banners/new-release-banner.png',
    )
    const bannerHash = `sha256:${createHash('sha256').update(readFileSync(banner)).digest('hex')}`
    const latest = api(
        `repos/${selected.repository}/releases/${selected.release.id}`,
        isReleaseMetadata,
    )
    if (!validRelease(latest, selected.tag))
        throw new Error('Release changed before asset upload')
    const assets = latest.assets.filter(
        (asset) => asset.name === 'release-banner.png',
    )
    if (
        assets.length > 1 ||
        (assets.length === 1 && assets[0].digest !== bannerHash)
    )
        throw new Error(
            'Existing banner has a different or unverifiable digest; refusing overwrite',
        )
    if (!assets.length) {
        const uploadPath = join(
            requiredEnv('RUNNER_TEMP'),
            'release-banner.png',
        )
        copyFileSync(banner, uploadPath)
        command('gh', [
            'release',
            'upload',
            selected.tag,
            uploadPath,
            '--repo',
            selected.repository,
        ])
    }
    const fresh = verifySourceCheckout()
    if (
        fresh.release.id !== selected.release.id ||
        fresh.commit !== selected.commit
    )
        throw new Error('Release identity changed before notes update')
    const server = requiredEnv('GITHUB_SERVER_URL').replace(/\/$/, '')
    if (server !== 'https://github.com')
        throw new Error('Unexpected release host')
    const body = releaseBody(
        fresh.release.body ?? '',
        notes,
        fresh.release,
        selected.repository,
        server,
    )
    const beforeWrite = api(
        `repos/${selected.repository}/releases/${selected.release.id}`,
        isReleaseMetadata,
    )
    if (
        !validRelease(beforeWrite, selected.tag) ||
        beforeWrite.body !== fresh.release.body
    )
        throw new Error(
            'Author notes changed concurrently; retry without overwrite',
        )
    if (body !== beforeWrite.body)
        api(
            `repos/${selected.repository}/releases/${selected.release.id}`,
            'PATCH',
            { body },
        )
    const published = api(
        `repos/${selected.repository}/releases/${selected.release.id}`,
        isReleaseMetadata,
    )
    if (!validRelease(published, selected.tag) || published.body !== body)
        throw new Error('Published release notes verification failed')
}
