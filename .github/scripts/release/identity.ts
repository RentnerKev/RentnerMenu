import type {
    ReleaseCheckoutOperations,
    SelectedRelease,
    VerifiedSourceRelease,
} from './Types/release.types.ts'
import { isDeepStrictEqual } from 'node:util'
import { repositoryPolicy } from '../lib/repository.ts'
import {
    isPackageIdentity,
    isReleaseEvent,
    isReleaseMetadata,
} from './releaseValidation.ts'
import { readFileSync } from 'node:fs'
import {
    containsControlCharacters,
    api,
    command,
    eventData,
    isMain,
    output,
    parseJson,
} from '../lib/runtime.ts'
import type { ReleaseMetadata } from './Types/release.types.ts'

export function stableVersion(tag: string): string {
    if (
        containsControlCharacters(tag) ||
        !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)
    )
        throw new Error('Expected a stable vMAJOR.MINOR.PATCH tag')
    return tag.slice(1)
}

export function validRelease(release: ReleaseMetadata, tag: string): boolean {
    return (
        Number.isSafeInteger(release.id) &&
        release.id > 0 &&
        release.tag_name === tag &&
        release.draft === false &&
        release.prerelease === false &&
        typeof release.published_at === 'string' &&
        Number.isFinite(Date.parse(release.published_at))
    )
}

export function selectedRelease(): SelectedRelease {
    const { repository } = repositoryPolicy()
    const event = eventData(isReleaseEvent)
    const tag = event.release?.tag_name ?? event.inputs?.tag
    if (typeof tag !== 'string') throw new Error('Missing release identity')
    const version = stableVersion(tag)
    const release = api(
        `repos/${repository}/releases/tags/${tag}`,
        isReleaseMetadata,
    )
    if (
        !validRelease(release, tag) ||
        (event.release && release.id !== event.release.id)
    )
        throw new Error('Release identity/channel mismatch')
    return { release, tag, version, repository }
}

export const checkoutOperations: ReleaseCheckoutOperations = {
    select: selectedRelease,
    packageName: () => repositoryPolicy().packageName,
    command,
    readManifest: () => readFileSync('package.json', 'utf8'),
}

export function verifySourceCheckout(
    operations: ReleaseCheckoutOperations = checkoutOperations,
): VerifiedSourceRelease {
    const selected = operations.select()
    if (
        stableVersion(selected.tag) !== selected.version ||
        !validRelease(selected.release, selected.tag)
    )
        throw new Error('Release identity/channel mismatch')
    const commit = operations.command('git', [
        'rev-parse',
        '--verify',
        `refs/tags/${selected.tag}^{commit}`,
    ])
    if (
        !/^[a-f0-9]{40}$/.test(commit) ||
        operations.command('git', ['rev-parse', 'HEAD']) !== commit
    )
        throw new Error('Tag checkout mismatch')
    const manifest = parseJson(
        operations.command('git', ['show', `${commit}:package.json`]),
        isPackageIdentity,
    )
    if (manifest.name !== operations.packageName())
        throw new Error('Committed package identity mismatch')
    operations.command('git', [
        'fetch',
        '--no-tags',
        'origin',
        'main:refs/remotes/origin/main',
    ])
    operations.command('git', [
        'merge-base',
        '--is-ancestor',
        commit,
        'refs/remotes/origin/main',
    ])
    const remote = operations
        .command('git', [
            'ls-remote',
            'origin',
            `refs/tags/${selected.tag}`,
            `refs/tags/${selected.tag}^{}`,
        ])
        .split('\n')
        .map((line) => line.split(/\s+/))
    const resolved =
        remote.find(([, ref]) => ref?.endsWith('^{}'))?.[0] ??
        remote.find(([, ref]) => ref === `refs/tags/${selected.tag}`)?.[0]
    if (resolved !== commit) throw new Error('Published tag moved')
    return { ...selected, commit, manifest: { ...manifest } }
}

export function preparedManifest(source: VerifiedSourceRelease) {
    return { ...source.manifest, version: source.version }
}

export function verifyPreparedCheckout(
    operations: ReleaseCheckoutOperations = checkoutOperations,
): VerifiedSourceRelease {
    const source = verifySourceCheckout(operations)
    const manifest = parseJson(operations.readManifest(), isPackageIdentity)
    if (!isDeepStrictEqual(manifest, preparedManifest(source)))
        throw new Error(
            'Prepared manifest must change only the release version',
        )
    return source
}

if (isMain(import.meta.url)) {
    // Older release workflows also load trusted automation from main.
    const sourceCheckout =
        process.argv.includes('--source-checkout') ||
        process.argv.includes('--checkout')
    const selected = sourceCheckout ? verifySourceCheckout() : selectedRelease()
    output('tag', selected.tag)
    output('version', selected.version)
}
