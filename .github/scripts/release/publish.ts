import { isPackedArtifacts } from './releaseValidation.ts'
import { repositoryPolicy } from '../lib/repository.ts'
import { createHash } from 'node:crypto'
import { readRegularFile } from '../lib/regularFile.ts'
import { resolve, basename } from 'node:path'
import { command, isMain, parseJson } from '../lib/runtime.ts'
import { verifyPreparedCheckout } from './identity.ts'
import type { PackageIdentity, PackedArtifact } from './Types/release.types.ts'
import {
    assertArtifactIdentity,
    assertChannelProgression,
    lookupPackage,
    lookupChannels,
    verifyPublication,
} from './registry.ts'

export function checkedPackedArtifact(
    packs: PackedArtifact[],
    expected: PackageIdentity,
): PackedArtifact {
    if (
        packs.length !== 1 ||
        packs[0].name !== expected.name ||
        packs[0].version !== expected.version ||
        basename(packs[0].filename) !== packs[0].filename ||
        !packs[0].filename.endsWith('.tgz')
    )
        throw new Error('Invalid packed artifact')
    if (
        packs[0].files.some((file) =>
            /^(src|test|tests|playground|\.github)\//.test(file.path),
        )
    )
        throw new Error('Package contains private source/test files')
    return packs[0]
}

if (isMain(import.meta.url)) {
    const identity = verifyPreparedCheckout()
    const { packageName } = repositoryPolicy()
    const pack = checkedPackedArtifact(
        parseJson(
            command('npm', ['pack', '--json', '--ignore-scripts']),
            isPackedArtifacts,
        ),
        { name: packageName, version: identity.version },
    )
    const tarball = resolve(pack.filename)
    const integrity = `sha512-${createHash('sha512').update(readRegularFile(tarball)).digest('base64')}`
    const expected = { name: packageName, version: identity.version, integrity }
    const existing = await lookupPackage(packageName, identity.version)
    if (existing) assertArtifactIdentity(existing, expected)
    const fresh = verifyPreparedCheckout()
    if (
        fresh.commit !== identity.commit ||
        fresh.release.id !== identity.release.id
    )
        throw new Error('Release changed before publication')
    assertChannelProgression(
        (await lookupChannels(packageName)).latest,
        identity.version,
    )
    if (!existing)
        command('npm', [
            'publish',
            tarball,
            '--access',
            'public',
            '--tag',
            'latest',
            '--provenance',
            '--ignore-scripts',
        ])
    await verifyPublication(expected)
}
