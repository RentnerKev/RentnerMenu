import { describe, expect, test } from 'bun:test'
import { YAML } from 'bun'
import { readFileSync } from 'node:fs'
import {
    verifyPreparedCheckout,
    verifySourceCheckout,
} from '../../../.github/scripts/release/identity.ts'
import { prepareRelease } from '../../../.github/scripts/release/prepare.ts'
import { checkedPackedArtifact } from '../../../.github/scripts/release/publish.ts'
import type {
    ReleasePreparationOperations,
    SelectedRelease,
} from '../../../.github/scripts/release/Types/release.types.ts'

const commit = 'a'.repeat(40)
const otherCommit = 'b'.repeat(40)

function fixture() {
    const manifest = {
        name: '@rentnerkev/menu',
        version: '1.0.0',
        scripts: { build: 'compile', prepare: 'compile' },
        dependencies: { example: '^1.2.3' },
        exports: { '.': './dist/index.js' },
        custom: { version: 'retain nested version' },
    }
    const selected: SelectedRelease = {
        repository: 'RentnerKev/RentnerMenu',
        tag: 'v2.0.7',
        version: '2.0.7',
        release: {
            id: 12,
            tag_name: 'v2.0.7',
            draft: false,
            prerelease: false,
            published_at: '2026-10-07T10:00:00Z',
            body: null,
            assets: [],
        },
    }
    const files = new Map([
        ['package.json', JSON.stringify(manifest, null, 4) + '\n'],
        ['bun.lock', '{"workspaces":{"":{"name":"@rentnerkev/menu"}}}'],
        ['playground/package.json', '{"version":"0.0.0","private":true}'],
        ['playground/bun.lock', 'unchanged playground lock'],
    ])
    const state = {
        head: commit,
        tagCommit: commit,
        remote: `${commit}\trefs/tags/v2.0.7`,
        ancestor: true,
    }
    const commands: string[][] = []
    const writes: string[] = []
    const operations: ReleasePreparationOperations = {
        select: () => selected,
        packageName: () => '@rentnerkev/menu',
        command: (program, args) => {
            expect(program).toBe('git')
            commands.push([...args])
            if (args[0] === 'rev-parse')
                return args[1] === 'HEAD' ? state.head : state.tagCommit
            if (args[0] === 'show') {
                expect(args[1]).toBe(`${commit}:package.json`)
                return JSON.stringify(manifest)
            }
            if (args[0] === 'fetch') return ''
            if (args[0] === 'merge-base') {
                if (!state.ancestor) throw new Error('not a main ancestor')
                return ''
            }
            if (args[0] === 'ls-remote') return state.remote
            throw new Error('Unexpected fixture command')
        },
        readManifest: () => files.get('package.json')!,
        writeManifest: (text) => {
            writes.push(text)
            files.set('package.json', text)
        },
    }
    return { manifest, selected, files, state, commands, writes, operations }
}

describe('tag-derived release preparation', () => {
    test('validates the tagged source while allowing a stale committed version', () => {
        const input = fixture()
        input.operations.readManifest = () => {
            throw new Error('source validation must use the committed manifest')
        }
        const verified = verifySourceCheckout(input.operations)
        expect(verified.commit).toBe(commit)
        expect(verified.version).toBe('2.0.7')
        expect(verified.manifest.version).toBe('1.0.0')
        expect(input.commands).toContainEqual([
            'merge-base',
            '--is-ancestor',
            commit,
            'refs/remotes/origin/main',
        ])
        expect(input.writes).toEqual([])
    })

    test('stamps only the root version before install/build and reruns idempotently', () => {
        const input = fixture()
        const before = new Map(input.files)
        prepareRelease(input.operations)
        const prepared = input.files.get('package.json')!
        expect(prepared).toBe(
            JSON.stringify({ ...input.manifest, version: '2.0.7' }, null, 4) +
                '\n',
        )
        for (const [path, contents] of before)
            if (path !== 'package.json')
                expect(input.files.get(path)).toBe(contents)
        const observedVersions: string[] = []
        function fakeInstall() {
            observedVersions.push(
                JSON.parse(input.operations.readManifest()).version,
            )
        }
        function fakeBuild() {
            observedVersions.push(
                JSON.parse(input.operations.readManifest()).version,
            )
        }
        fakeInstall()
        fakeBuild()
        expect(observedVersions).toEqual(['2.0.7', '2.0.7'])
        prepareRelease(input.operations)
        expect(input.files.get('package.json')).toBe(prepared)
        expect(verifyPreparedCheckout(input.operations).version).toBe('2.0.7')
        expect(
            input.commands.every(([operation]) =>
                [
                    'rev-parse',
                    'show',
                    'fetch',
                    'merge-base',
                    'ls-remote',
                ].includes(operation!),
            ),
        ).toBe(true)
    })

    test('refuses unstamped manifests before packing or publishing', () => {
        const input = fixture()
        expect(() => verifyPreparedCheckout(input.operations)).toThrow(
            'only the release version',
        )
        prepareRelease(input.operations)
        expect(() => verifyPreparedCheckout(input.operations)).not.toThrow()
        input.files.set('package.json', JSON.stringify(input.manifest))
        expect(() => verifyPreparedCheckout(input.operations)).toThrow(
            'only the release version',
        )
    })

    test.each([
        'name',
        'dependencies',
        'scripts',
        'exports',
        'extra',
        'custom',
    ])('rejects unrelated working manifest changes: %s', (key) => {
        const input = fixture()
        prepareRelease(input.operations)
        const changed = JSON.parse(input.operations.readManifest())
        changed[key] = 'tampered'
        input.files.set('package.json', JSON.stringify(changed))
        expect(() => verifyPreparedCheckout(input.operations)).toThrow(
            'only the release version',
        )
        expect(() => prepareRelease(input.operations)).toThrow(
            'unrelated manifest changes',
        )
        expect(input.writes).toHaveLength(1)
    })

    test('rejects a committed package with another identity', () => {
        const input = fixture()
        input.manifest.name = '@rentnerkev/inputs'
        expect(() => prepareRelease(input.operations)).toThrow(
            'identity mismatch',
        )
        expect(input.writes).toEqual([])
    })

    test.each([
        'draft',
        'prerelease',
        'malformed tag',
        'wrong version',
        'changed release tag',
    ])('retains stable release guards: %s', (reason) => {
        const input = fixture()
        if (reason === 'draft') input.selected.release.draft = true
        if (reason === 'prerelease') input.selected.release.prerelease = true
        if (reason === 'malformed tag') input.selected.tag = 'v02.0.7'
        if (reason === 'wrong version') input.selected.version = '2.0.8'
        if (reason === 'changed release tag')
            input.selected.release.tag_name = 'v2.0.8'
        expect(() => prepareRelease(input.operations)).toThrow()
        expect(input.writes).toEqual([])
    })

    test.each([
        'HEAD',
        'invalid commit',
        'ancestry',
        'moved tag',
        'missing tag',
    ])('retains exact-source guards: %s', (reason) => {
        const input = fixture()
        if (reason === 'HEAD') input.state.head = otherCommit
        if (reason === 'invalid commit') input.state.tagCommit = 'invalid'
        if (reason === 'ancestry') input.state.ancestor = false
        if (reason === 'moved tag')
            input.state.remote = `${otherCommit}\trefs/tags/v2.0.7`
        if (reason === 'missing tag') input.state.remote = ''
        expect(() => prepareRelease(input.operations)).toThrow()
        expect(input.writes).toEqual([])
    })

    test('checks an annotated tag against its peeled commit', () => {
        const input = fixture()
        input.state.remote = `${otherCommit}\trefs/tags/v2.0.7\n${commit}\trefs/tags/v2.0.7^{}`
        expect(() => prepareRelease(input.operations)).not.toThrow()
        input.state.remote = `${commit}\trefs/tags/v2.0.7\n${otherCommit}\trefs/tags/v2.0.7^{}`
        expect(() => verifyPreparedCheckout(input.operations)).toThrow(
            'tag moved',
        )
    })
})

test('checks packed name/version as well as archive inventory before publication', () => {
    const expected = { name: '@rentnerkev/menu', version: '2.0.7' }
    const pack = {
        ...expected,
        filename: 'calendar-2.0.7.tgz',
        files: [{ path: 'dist/index.js' }],
    }
    expect(checkedPackedArtifact([pack], expected)).toEqual(pack)
    for (const changed of [
        { ...pack, name: '@rentnerkev/inputs' },
        { ...pack, version: '1.0.0' },
        { ...pack, filename: '../calendar.tgz' },
        { ...pack, filename: 'calendar.json' },
        { ...pack, files: [{ path: 'src/private.ts' }] },
    ])
        expect(() => checkedPackedArtifact([changed], expected)).toThrow()
    expect(() => checkedPackedArtifact([], expected)).toThrow()
    expect(() => checkedPackedArtifact([pack, pack], expected)).toThrow()
})

test('workflow prepares the source before its first install or build', () => {
    const workflow = YAML.parse(
        readFileSync('.github/workflows/npm-publish.yml', 'utf8'),
    ) as {
        jobs: {
            publish: {
                steps: {
                    name: string
                    run?: string
                    'working-directory'?: string
                }[]
            }
        }
    }
    const steps = workflow.jobs.publish.steps
    const prepare = steps.findIndex((step) =>
        step.run?.includes('/release/prepare.ts'),
    )
    const sourceValidation = steps.findIndex((step) =>
        step.run?.includes('--source-checkout'),
    )
    const install = steps.findIndex((step) =>
        /\b(?:bun|npm) install\b/.test(step.run ?? ''),
    )
    const build = steps.findIndex((step) => step.run === 'bun run verify')
    expect(sourceValidation).toBeGreaterThan(-1)
    expect(prepare).toBeGreaterThan(sourceValidation)
    expect(install).toBeGreaterThan(prepare)
    expect(build).toBeGreaterThan(install)
    expect(steps[prepare]?.['working-directory']).toBe('source')
    expect(
        steps.some((step) =>
            /npm version|git commit|git push/.test(step.run ?? ''),
        ),
    ).toBe(false)
})
