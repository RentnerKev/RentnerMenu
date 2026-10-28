import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const manifest = await Bun.file(join(root, 'package.json')).json()
const temporary = mkdtempSync(join(tmpdir(), 'rentnermenu-consumer-'))
assert.equal(dirname(resolve(temporary)), resolve(tmpdir()))
assert.ok(temporary.includes('rentnermenu-consumer-'))
const run = (args: string[], cwd = temporary) => {
    const result = Bun.spawnSync(args, { cwd, stdout: 'pipe', stderr: 'pipe' })
    assert.equal(
        result.exitCode,
        0,
        `${args.join(' ')}\n${result.stdout}\n${result.stderr}`,
    )
    return result.stdout.toString()
}

try {
    run(
        ['bun', 'pm', 'pack', '--ignore-scripts', '--destination', temporary],
        root,
    )
    const artifact = join(temporary, `rentnerkev-menu-${manifest.version}.tgz`)
    assert.ok(existsSync(artifact), 'Actual npm tarball must exist')
    const react =
        process.env.CONSUMER_REACT_VERSION ?? manifest.devDependencies.react
    await Bun.write(
        join(temporary, 'package.json'),
        JSON.stringify({
            name: 'rentnermenu-packed-consumer',
            private: true,
            type: 'module',
            dependencies: {
                '@rentnerkev/menu': `file:${artifact}`,
                react,
                'react-dom': react,
            },
            devDependencies: {
                typescript: manifest.devDependencies.typescript,
                '@types/react': manifest.devDependencies['@types/react'],
                '@types/react-dom':
                    manifest.devDependencies['@types/react-dom'],
            },
        }),
    )
    run(['bun', 'install', '--ignore-scripts'])
    const installed = join(temporary, 'node_modules/@rentnerkev/menu')
    for (const [entry, target] of Object.entries(manifest.exports)) {
        for (const file of typeof target === 'string'
            ? [target]
            : Object.values(target as Record<string, string>)) {
            assert.ok(
                existsSync(join(installed, file)),
                `Export ${entry} must exist: ${file}`,
            )
        }
    }
    assert.ok(
        !existsSync(join(installed, 'playground')),
        'Playground must not leak into package',
    )
    assert.ok(
        !existsSync(join(installed, 'src/tests')),
        'Tests must not leak into package',
    )
    assert.equal(
        Object.keys(manifest.dependencies ?? {}).length,
        0,
        'No extra runtime dependency chain',
    )
    await Bun.write(
        join(temporary, 'consumer.tsx'),
        `
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Menu, ContextMenu, MenuProvider, type MenuItem } from '@rentnerkev/menu'
import { Menu as DirectMenu } from '@rentnerkev/menu/menu'
import { ContextMenu as DirectContextMenu } from '@rentnerkev/menu/context-menu'
import { MenuProvider as DirectProvider } from '@rentnerkev/menu/provider'
import type { MenuProps } from '@rentnerkev/menu/types'
const items: readonly MenuItem[] = [{ id: 'open', label: 'Open' }]
const props: MenuProps = { ariaLabel: 'Actions', items }
const markup = renderToString(createElement(MenuProvider, null, createElement(Menu, props)))
if (!markup.includes('Actions')) throw new Error('SSR trigger missing')
renderToString(createElement(ContextMenu, { ...props, children: 'File' }))
if (Menu !== DirectMenu || ContextMenu !== DirectContextMenu || MenuProvider !== DirectProvider) throw new Error('Subpath exports differ')
`,
    )
    await Bun.write(
        join(temporary, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: {
                strict: true,
                noEmit: true,
                skipLibCheck: true,
                target: 'ESNext',
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
                jsx: 'react-jsx',
                lib: ['ESNext', 'DOM'],
            },
            include: ['consumer.tsx'],
        }),
    )
    run(['bun', 'run', '--bun', 'tsc', '--noEmit'])
    const build = await Bun.build({
        entrypoints: [join(temporary, 'consumer.tsx')],
        target: 'node',
        format: 'esm',
        external: ['react', 'react-dom/server', '@rentnerkev/menu'],
    })
    assert.ok(build.success, build.logs.join('\n'))
    await Bun.write(join(temporary, 'consumer.mjs'), build.outputs[0]!)
    run(['node', 'consumer.mjs'])
    await Bun.write(
        join(temporary, 'browser.tsx'),
        `export { Menu, ContextMenu, MenuProvider } from '@rentnerkev/menu'`,
    )
    const browser = await Bun.build({
        entrypoints: [join(temporary, 'browser.tsx')],
        target: 'browser',
        minify: true,
    })
    assert.ok(browser.success, browser.logs.join('\n'))
    const javascript = await browser.outputs[0]!.text()
    assert.ok(
        !javascript.includes('node:fs'),
        'Node-only AI helpers must stay outside browser exports',
    )
    const aiPath = join(installed, 'dist/ai.js')
    const ai = await import(aiPath)
    assert.equal(ai.getPackageInfo().name, '@rentnerkev/menu')
    assert.equal(ai.getPackageInfo().version, manifest.version)
    assert.ok(ai.getPackageDocumentation().content.includes('@rentnerkev/menu'))
    assert.ok(ai.getPackageApi({ symbol: 'Menu' }).declarations.length > 0)
    assert.ok(ai.getPackageExamples().length > 0)
    assert.throws(() => ai.getPackageApi({ subpath: '../../outside' }))
    assert.throws(() => ai.getPackageApi({ symbol: 'NotPublic' }))
    const map = JSON.parse(
        readFileSync(
            join(installed, 'dist/shared/Menu/Components/Menu.js.map'),
            'utf8',
        ),
    )
    assert.ok(map.sourcesContent?.every((source: string) => source.length > 0))
    console.log(
        `Packed consumer passed: native Node ESM, SSR, TypeScript, subpaths, browser bundle (${javascript.length} bytes), installed docs.`,
    )
} finally {
    rmSync(temporary, { recursive: true, force: true })
}
