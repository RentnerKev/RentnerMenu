import { expect, test } from 'bun:test'
import {
    assertChannelProgression,
    registryPackagePath,
    registryVersion,
    waitForPublication,
} from '../../../.github/scripts/release/registry.ts'
import type { RegistrySnapshot } from '../../../.github/scripts/release/Types/registry.types'

const expected = {
    name: '@rentnerkev/example',
    version: '1.2.3',
    integrity: 'sha512-verified',
}
const published = { ...expected, dist: { integrity: expected.integrity } }

test('limits registry requests to public suite identities and canonical stable versions', () => {
    for (const packageName of [
        'calendar',
        'inputs',
        'menu',
        'picker',
        'select',
        'toasts',
        'tooltips',
    ]) {
        expect(registryPackagePath(`@rentnerkev/${packageName}`)).toBe(
            `@rentnerkev%2F${packageName}`,
        )
    }
    for (const invalid of [
        'https://evil.invalid',
        '@rentnerkev/tooltips/secret',
        '@other/package',
    ]) {
        expect(() => registryPackagePath(invalid)).toThrow(
            'Unexpected public registry',
        )
    }
    expect(registryVersion('2.0.7')).toBe('2.0.7')
    for (const invalid of [
        '2.0.7?secret=token',
        '02.0.7',
        '2.0.7-beta',
        '9007199254740992.0.0',
    ]) {
        expect(() => registryVersion(invalid)).toThrow()
    }
})

test('allows stable forward/equal publication and refuses channel rollback', () => {
    for (const current of [undefined, '1.2.2', '1.2.3', '1.1.99', '0.99.99']) {
        expect(() =>
            assertChannelProgression(current, expected.version),
        ).not.toThrow()
    }
    for (const current of ['1.2.4', '1.3.0', '2.0.0']) {
        expect(() =>
            assertChannelProgression(current, expected.version),
        ).toThrow('older version')
    }
    expect(() =>
        assertChannelProgression('1.2.3-beta.1', expected.version),
    ).toThrow('stable')
})

test('accepts the exact visible artifact and channel without waiting', async () => {
    let pauses = 0
    await waitForPublication(
        expected,
        async () => ({ published, latest: expected.version }),
        async () => {
            pauses++
        },
    )
    expect(pauses).toBe(0)
})

test('waits for version visibility and then channel propagation', async () => {
    const snapshots: RegistrySnapshot[] = [
        { published: undefined, latest: '1.2.2' },
        { published, latest: '1.2.2' },
        { published, latest: expected.version },
    ]
    let reads = 0
    const pauses: number[] = []
    await waitForPublication(
        expected,
        async () => snapshots[reads++],
        async (milliseconds) => {
            pauses.push(milliseconds)
        },
    )
    expect(reads).toBe(3)
    expect(pauses).toEqual([5_000, 5_000])
})

test('rejects a conflicting immutable artifact immediately after an absent lookup', async () => {
    let reads = 0
    let pauses = 0
    await expect(
        waitForPublication(
            expected,
            async () => {
                reads++
                return {
                    published:
                        reads === 1
                            ? undefined
                            : {
                                  ...published,
                                  dist: { integrity: 'sha512-conflict' },
                              },
                    latest: expected.version,
                }
            },
            async () => {
                pauses++
            },
        ),
    ).rejects.toThrow('refusing collision')
    expect(reads).toBe(2)
    expect(pauses).toBe(1)
})

test('bounds absent registry visibility without accepting a false success', async () => {
    let reads = 0
    let pauses = 0
    await expect(
        waitForPublication(
            expected,
            async () => {
                reads++
                return { published: undefined, latest: undefined }
            },
            async () => {
                pauses++
            },
        ),
    ).rejects.toThrow('did not become visible')
    expect(reads).toBe(61)
    expect(pauses).toBe(60)
})

test('does not reinterpret registry errors as an absent version', async () => {
    let pauses = 0
    await expect(
        waitForPublication(
            expected,
            async () => {
                throw new Error('Registry unavailable')
            },
            async () => {
                pauses++
            },
        ),
    ).rejects.toThrow('Registry unavailable')
    expect(pauses).toBe(0)
})
