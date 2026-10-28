import type { NpmChannels, PublishedPackage } from './Types/registry.types.ts'
import type {
    ExpectedArtifact,
    RegistrySnapshot,
} from './Types/registry.types.ts'
import { isRecord } from '../lib/runtime.ts'
import { stableVersion } from './identity.ts'

async function registryResponse(url: string): Promise<Response> {
    return fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
    })
}

export function registryPackagePath(name: string): string {
    // Only public identities owned by this package suite can leave the runner.
    // File/event contents are never interpolated as an arbitrary registry path.
    switch (name) {
        case '@rentnerkev/calendar':
            return '@rentnerkev%2Fcalendar'
        case '@rentnerkev/inputs':
            return '@rentnerkev%2Finputs'
        case '@rentnerkev/menu':
            return '@rentnerkev%2Fmenu'
        case '@rentnerkev/picker':
            return '@rentnerkev%2Fpicker'
        case '@rentnerkev/select':
            return '@rentnerkev%2Fselect'
        case '@rentnerkev/toasts':
            return '@rentnerkev%2Ftoasts'
        case '@rentnerkev/tooltips':
            return '@rentnerkev%2Ftooltips'
        default:
            throw new Error('Unexpected public registry package identity')
    }
}

export function registryVersion(version: string): string {
    const parts = stableVersion(`v${version}`).split('.').map(Number)
    if (parts.some((part) => !Number.isSafeInteger(part)))
        throw new Error('Registry version exceeds SemVer numeric limits')
    return parts.join('.')
}

export async function lookupPackage(
    name: string,
    version: string,
): Promise<PublishedPackage | undefined> {
    const response = await registryResponse(
        `https://registry.npmjs.org/${registryPackagePath(name)}/${registryVersion(version)}`,
    )
    if (response.status === 404) return undefined
    if (!response.ok)
        throw new Error('Registry lookup failed; publication is not safe')
    const value: unknown = await response.json()
    if (
        !isRecord(value) ||
        typeof value.name !== 'string' ||
        typeof value.version !== 'string' ||
        !isRecord(value.dist) ||
        typeof value.dist.integrity !== 'string'
    )
        throw new Error('Invalid registry package response')
    return {
        name: value.name,
        version: value.version,
        dist: { integrity: value.dist.integrity },
    }
}

export function assertArtifactIdentity(
    published: PublishedPackage,
    expected: ExpectedArtifact,
): void {
    if (
        published.name !== expected.name ||
        published.version !== expected.version ||
        published.dist?.integrity !== expected.integrity
    ) {
        throw new Error(
            'Published version differs from this verified artifact; refusing collision',
        )
    }
}

export async function lookupChannels(name: string): Promise<NpmChannels> {
    const response = await registryResponse(
        `https://registry.npmjs.org/-/package/${registryPackagePath(name)}/dist-tags`,
    )
    if (response.status === 404) return {}
    if (!response.ok) throw new Error('Registry channel lookup failed')
    const value: unknown = await response.json()
    if (
        !isRecord(value) ||
        (value.latest !== undefined && typeof value.latest !== 'string')
    )
        throw new Error('Invalid registry channel response')
    return { latest: value.latest }
}

export function assertChannelProgression(
    latest: string | undefined,
    candidate: string,
): void {
    const target = stableVersion(`v${candidate}`).split('.').map(BigInt)
    if (latest === undefined) return
    const current = stableVersion(`v${latest}`).split('.').map(BigInt)
    for (let index = 0; index < 3; index++) {
        if (current[index] > target[index])
            throw new Error(
                'Refusing to move the latest channel to an older version',
            )
        if (current[index] < target[index]) return
    }
}

async function pauseRegistry(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

export async function waitForPublication(
    expected: ExpectedArtifact,
    read: () => Promise<RegistrySnapshot>,
    pause: (milliseconds: number) => Promise<void> = pauseRegistry,
): Promise<void> {
    /* eslint-disable no-await-in-loop -- Retry order and delay depend on the preceding registry response. */
    for (let attempt = 0; attempt < 61; attempt++) {
        const snapshot = await read()
        // Only missing visibility/channel propagation is retried. A conflicting
        // immutable artifact always fails immediately, including on a retry.
        if (snapshot.published)
            assertArtifactIdentity(snapshot.published, expected)
        assertChannelProgression(snapshot.latest, expected.version)
        if (snapshot.published && snapshot.latest === expected.version) return
        if (attempt < 60) await pause(5_000)
    }
    /* eslint-enable no-await-in-loop */
    throw new Error(
        'Published artifact/latest channel did not become visible in time',
    )
}

export async function verifyPublication(
    expected: ExpectedArtifact,
): Promise<void> {
    await waitForPublication(expected, async () => {
        const published = await lookupPackage(expected.name, expected.version)
        const { latest } = await lookupChannels(expected.name)
        return { published, latest }
    })
}
