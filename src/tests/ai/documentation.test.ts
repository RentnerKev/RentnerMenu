import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
    getPackageDocumentation,
    getPackageExamples,
    getPackageInfo,
    searchPackageDocumentation,
} from '../../ai.ts'

const onlinePaths = [
    '/packages/menu',
    '/docs/menu',
    '/ai/menu',
    '/api/ai/packages/menu',
    '/mcp',
]

describe('packaged documentation', () => {
    test('both installed guides expose the canonical online documentation endpoints', () => {
        for (const name of ['readme', 'usage'] as const) {
            const document = getPackageDocumentation(name)
            const actual = readFileSync(
                new URL(`../../../${document.path}`, import.meta.url),
                'utf8',
            )
            expect(document.content).toBe(actual)
            const destinations = [
                ...document.content.matchAll(/\]\((https:\/\/[^)]+)\)/g),
            ]
                .map((match) => new URL(match[1]!))
                .filter((url) => url.hostname === 'packages.rentner.dev')
            expect(new Set(destinations.map((url) => url.pathname))).toEqual(
                new Set(onlinePaths),
            )
        }
    })

    test('local helpers return current package metadata, searchable locations and parseable examples', () => {
        const manifest = JSON.parse(
            readFileSync(
                new URL('../../../package.json', import.meta.url),
                'utf8',
            ),
        ) as { name: string; version: string }
        const info = getPackageInfo()
        expect(info.name).toBe(manifest.name)
        expect(info.version).toBe(manifest.version)
        const matches = searchPackageDocumentation('href')
        expect(matches.length).toBeGreaterThan(0)
        expect(searchPackageDocumentation('HREF')).toEqual(matches)
        for (const match of matches) {
            const document = getPackageDocumentation(
                match.path === 'README.md' ? 'readme' : 'usage',
            )
            expect(document.content.split('\n')[match.line - 1]).toBe(
                match.text,
            )
        }
        const examples = getPackageExamples().filter(
            (example) =>
                example.language === 'tsx' || example.language === 'ts',
        )
        expect(examples.length).toBeGreaterThan(0)
        const transpiler = new Bun.Transpiler({ loader: 'tsx' })
        for (const example of examples) {
            expect(() => transpiler.transformSync(example.code)).not.toThrow()
        }
    })
})
