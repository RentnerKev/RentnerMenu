import { readFileSync } from 'node:fs'

export interface PackageInfo {
    name: string
    version: string
    description: string
    license: string
    homepage: string
    repository: { type: string; url: string }
    exports: Record<
        string,
        string | { types?: string; import?: string; default?: string }
    >
    peerDependencies: Record<string, string>
}

export interface PackageDocument {
    path: string
    content: string
}

export interface PackageApi {
    package: string
    version: string
    subpaths: Record<string, string>
    declarations: PackageDocument[]
}

export interface PackageSearchMatch {
    path: string
    line: number
    text: string
}

export interface PackageExample {
    language: string
    code: string
}

const packageRoot = new URL('../', import.meta.url)

/** Read installed-package metadata without importing its UI entry point. */
export function getPackageInfo(): PackageInfo {
    const manifest = JSON.parse(
        readFileSync(new URL('package.json', packageRoot), 'utf8'),
    ) as PackageInfo
    return {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        license: manifest.license,
        homepage: manifest.homepage,
        repository: manifest.repository,
        exports: manifest.exports,
        peerDependencies: manifest.peerDependencies,
    }
}

/** Only these two explicitly packaged documents can be read. */
export function getPackageDocumentation(
    document: 'readme' | 'usage' = 'usage',
): PackageDocument {
    if (document !== 'readme' && document !== 'usage') {
        throw new Error('Unknown package document')
    }
    const path = document === 'readme' ? 'README.md' : 'docs/usage.md'
    return { path, content: readFileSync(new URL(path, packageRoot), 'utf8') }
}

/** Return export entry declarations and their local declaration dependencies.
 * The AI entry itself is excluded. No module is executed and callers cannot
 * supply file paths. Symbols must be exported by a selected public entry.
 */
export function getPackageApi(
    options: { subpath?: string; symbol?: string } = {},
): PackageApi {
    const info = getPackageInfo()
    const subpaths: Record<string, string> = {}
    for (const [subpath, entry] of Object.entries(info.exports)) {
        if (subpath !== './ai' && typeof entry !== 'string' && entry.types) {
            subpaths[subpath] = entry.types
        }
    }
    if (
        options.subpath !== undefined &&
        !Object.hasOwn(subpaths, options.subpath)
    ) {
        throw new Error(`Unknown public subpath: ${options.subpath}`)
    }
    if (
        options.symbol !== undefined &&
        !/^[A-Za-z_$][\w$]*$/.test(options.symbol)
    ) {
        throw new Error('Invalid public symbol')
    }
    const selected =
        options.subpath === undefined
            ? subpaths
            : { [options.subpath]: subpaths[options.subpath]! }
    const declarations = new Map<string, PackageDocument>()
    const publicNames = new Set<string>()
    function readDeclaration(path: string): string {
        const url = new URL(path, packageRoot)
        const distRoot = new URL('dist/', packageRoot).href
        if (!url.href.startsWith(distRoot) || !url.pathname.endsWith('.d.ts')) {
            throw new Error('Declaration must remain inside packaged dist')
        }
        const existing = declarations.get(url.href)
        if (existing) return existing.content
        const content = readFileSync(url, 'utf8')
        declarations.set(url.href, {
            path: decodeURIComponent(url.href.slice(packageRoot.href.length)),
            content,
        })
        for (const match of content.matchAll(
            /(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g,
        )) {
            const target = match[2]!.replace(/\.(?:tsx?|jsx?)$/, '.d.ts')
            readDeclaration(new URL(target, url).href)
        }
        return content
    }
    const publicEntries = new Set<string>()
    function collectPublicNames(path: string): void {
        const url = new URL(path, packageRoot)
        if (publicEntries.has(url.href)) return
        publicEntries.add(url.href)
        const content = readDeclaration(path)
        for (const match of content.matchAll(
            /export\s+(?:declare\s+)?(?:abstract\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([\w$]+)/g,
        )) {
            publicNames.add(match[1]!)
        }
        for (const match of content.matchAll(
            /export\s+(?:type\s+)?\{([^}]+)\}/g,
        )) {
            for (const item of match[1]!.split(',')) {
                const name = item
                    .trim()
                    .replace(/^type\s+/, '')
                    .split(/\s+as\s+/)
                    .at(-1)
                if (name) publicNames.add(name.trim())
            }
        }
        for (const match of content.matchAll(
            /export\s+(?:type\s+)?\*\s+from\s*(['"])(\.[^'"]+)\1/g,
        )) {
            collectPublicNames(
                new URL(match[2]!.replace(/\.(?:tsx?|jsx?)$/, '.d.ts'), url)
                    .href,
            )
        }
    }
    for (const path of Object.values(selected)) collectPublicNames(path)
    if (options.symbol !== undefined && !publicNames.has(options.symbol)) {
        throw new Error(`Unknown public symbol: ${options.symbol}`)
    }
    return {
        package: info.name,
        version: info.version,
        subpaths: selected,
        declarations: [...declarations.values()],
    }
}

/** Literal, case-insensitive search of the packaged guides. */
export function searchPackageDocumentation(
    query: string,
): PackageSearchMatch[] {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return (['readme', 'usage'] as const).flatMap((name) => {
        const document = getPackageDocumentation(name)
        return document.content
            .split('\n')
            .flatMap((text, index) =>
                text.toLowerCase().includes(needle)
                    ? [{ path: document.path, line: index + 1, text }]
                    : [],
            )
    })
}

/** Code examples come directly from the installed version's usage guide. */
export function getPackageExamples(): PackageExample[] {
    return [
        ...getPackageDocumentation().content.matchAll(
            /```([^\n]*)\n([\s\S]*?)```/g,
        ),
    ].map((match) => ({
        language: match[1]!.trim(),
        code: match[2]!.trimEnd(),
    }))
}
