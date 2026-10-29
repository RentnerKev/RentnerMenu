/* oxlint-disable no-await-in-loop -- Benchmark builds, samples and input steps must run serially to avoid overlapping measurements. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import type { BrowserType } from '@playwright/test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const source = fileURLToPath(new URL('./', import.meta.url))
const pinned = {
    '@rentnerkev/menu': '0.1.1',
    '@radix-ui/react-dropdown-menu': '2.2.1',
    '@radix-ui/react-context-menu': '2.4.1',
    react: '19.3.1',
    'react-dom': '19.3.1',
} as const
const variants = ['baseline', 'candidate', 'radix'] as const
type Variant = (typeof variants)[number]
type Measurement = Record<string, number>
type Sample = {
    variant: Variant
    count: number
    sample: number
    openFocusMs: number
    openDispatchMs: number
    readyAtDispatch: boolean
    visibleAtFocus: boolean
    keyboardDispatchMs: number
    keyboardReached: string
    hoverDispatchMs: number
    hoverFocusMatches: number
    burstDispatchMs: number
    openMeasures: Measurement
    keyboardMeasures: Measurement
    hoverMeasures: Measurement
    burstMeasures: Measurement
    menuItems: number
}

function options() {
    const args = new Map(
        process.argv.slice(2).map((argument) => {
            assert.ok(
                argument.startsWith('--'),
                `Expected --flag=value: ${argument}`,
            )
            const separator = argument.indexOf('=')
            return separator < 0
                ? [argument.slice(2), 'true']
                : [argument.slice(2, separator), argument.slice(separator + 1)]
        }),
    )
    const selected = (args.get('variants') ?? variants.join(',')).split(',')
    assert.ok(
        selected.every((variant) => variants.includes(variant as Variant)),
        'Unknown variant',
    )
    const sizes = (args.get('sizes') ?? '25,250').split(',').map(Number)
    const samples = Number(args.get('samples') ?? (args.has('smoke') ? 3 : 20))
    const warmups = Number(args.get('warmups') ?? (args.has('smoke') ? 1 : 5))
    assert.ok(
        sizes.length &&
            sizes.every((size) => Number.isInteger(size) && size >= 10),
        'Sizes must contain at least 10 entries',
    )
    assert.ok(
        Number.isInteger(samples) &&
            samples > 0 &&
            Number.isInteger(warmups) &&
            warmups >= 0,
        'Invalid sample/warmup count',
    )
    const browser = args.get('browser') ?? 'chromium'
    assert.ok(
        ['chromium', 'firefox', 'webkit'].includes(browser),
        'Unknown browser',
    )
    return {
        variants: selected as Variant[],
        sizes,
        samples,
        warmups,
        browser,
        profile: args.get('profile') === 'true',
        dependencyRoot: args.get('dependency-root'),
        output: args.get('output'),
    }
}

async function createTemporary() {
    const directory = await mkdtemp(join(tmpdir(), 'rentnermenu-benchmark-'))
    // Only paths created by this invocation are admitted to recursive cleanup.
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
    assert.ok(basename(directory).startsWith('rentnermenu-benchmark-'))
    return directory
}

async function prepareDependencies(directory: string, install: boolean) {
    if (install) {
        await writeFile(
            join(directory, 'package.json'),
            JSON.stringify(
                {
                    name: 'rentnermenu-benchmark-dependencies',
                    private: true,
                    type: 'module',
                    dependencies: pinned,
                },
                null,
                2,
            ),
        )
        const installer = Bun.spawn(
            [process.execPath, 'install', '--ignore-scripts'],
            {
                cwd: directory,
                stdout: 'pipe',
                stderr: 'pipe',
            },
        )
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(installer.stdout).text(),
            new Response(installer.stderr).text(),
            installer.exited,
        ])
        assert.equal(
            exitCode,
            0,
            `Benchmark dependency installation failed:\n${stdout}\n${stderr}`,
        )
    }
    for (const [name, version] of Object.entries(pinned)) {
        const installed = JSON.parse(
            await readFile(
                join(directory, 'node_modules', name, 'package.json'),
                'utf8',
            ),
        ) as { version: string }
        assert.equal(
            installed.version,
            version,
            `Expected pinned ${name}@${version}`,
        )
    }
}

async function compile(
    entry: string,
    dependencyRequire: NodeJS.Require,
    externalReact: boolean,
) {
    const result = await Bun.build({
        entrypoints: [entry],
        target: 'browser',
        format: 'esm',
        minify: true,
        define: { 'process.env.NODE_ENV': '"production"' },
        external: externalReact
            ? ['react', 'react-dom', 'react/*', 'react-dom/*']
            : [],
        plugins: externalReact
            ? []
            : [
                  {
                      name: 'shared-react',
                      setup(build) {
                          build.onResolve(
                              { filter: /^(react|react-dom)(\/.*)?$/ },
                              (args) => ({
                                  path: dependencyRequire.resolve(args.path),
                              }),
                          )
                      },
                  },
              ],
    })
    assert.ok(result.success, result.logs.join('\n'))
    return Buffer.from(await result.outputs[0]!.arrayBuffer())
}

async function buildFixtures(
    directory: string,
    dependencyRoot: string,
    settings: ReturnType<typeof options>,
) {
    const dependencyRequire = createRequire(
        join(dependencyRoot, 'package.json'),
    )
    const modules = {
        baseline: join(
            dependencyRoot,
            'node_modules/@rentnerkev/menu/dist/index.js',
        ),
        candidate: join(root, 'src/index.ts'),
        radix: dependencyRequire
            .resolve('@radix-ui/react-dropdown-menu')
            .replace(/\.js$/, '.mjs'),
    }
    const contextModule = dependencyRequire
        .resolve('@radix-ui/react-context-menu')
        .replace(/\.js$/, '.mjs')
    const fixture = await readFile(join(source, 'fixture.tsx.template'), 'utf8')
    const scripts = new Map<Variant, Buffer>()
    const bundles = []
    for (const variant of settings.variants) {
        const entry = join(directory, `fixture-${variant}.tsx`)
        await writeFile(
            entry,
            fixture
                .replace("'__menu__'", JSON.stringify(modules[variant]))
                .replace("'__variant__'", JSON.stringify(variant))
                .replace(
                    "'__client__'",
                    JSON.stringify(
                        settings.profile
                            ? 'react-dom/profiling'
                            : 'react-dom/client',
                    ),
                )
                .replace('__profile__', String(settings.profile)),
        )
        scripts.set(variant, await compile(entry, dependencyRequire, false))
        for (const scenario of ['dropdown', 'both']) {
            const code =
                variant === 'radix'
                    ? scenario === 'dropdown'
                        ? `export { Root, Trigger, Portal, Content, Item, CheckboxItem, RadioGroup, RadioItem, ItemIndicator, Label, Separator, Sub, SubTrigger, SubContent } from ${JSON.stringify(modules.radix)}`
                        : `export * as DropdownMenu from ${JSON.stringify(modules.radix)}; export * as ContextMenu from ${JSON.stringify(contextModule)}`
                    : `export { ${scenario === 'dropdown' ? 'Menu' : 'Menu, ContextMenu, MenuProvider'} } from ${JSON.stringify(modules[variant])}`
            const bundleEntry = join(directory, `${scenario}-${variant}.ts`)
            await writeFile(bundleEntry, code)
            const first = await compile(bundleEntry, dependencyRequire, true)
            const second = await compile(bundleEntry, dependencyRequire, true)
            assert.ok(
                first.equals(second),
                `Non-deterministic ${variant}/${scenario} bundle`,
            )
            bundles.push({
                variant,
                scenario,
                bytes: first.length,
                gzipBytes: gzipSync(first, { level: 9 }).length,
                sha256: createHash('sha256').update(first).digest('hex'),
                deterministicRepeat: true,
            })
        }
    }
    return { scripts, bundles }
}

function statistics(values: number[]) {
    const sorted = values.toSorted((a, b) => a - b)
    const percentile = (fraction: number) =>
        sorted[
            Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
        ]!
    return { median: percentile(0.5), p95: percentile(0.95) }
}

function summarize(raw: Sample[], settings: ReturnType<typeof options>) {
    return settings.sizes.flatMap((count) =>
        settings.variants.map((variant) => {
            const rows = raw.filter(
                (row) => row.count === count && row.variant === variant,
            )
            const metrics: Record<string, unknown> = {}
            for (const metric of [
                'openFocusMs',
                'openDispatchMs',
                'keyboardDispatchMs',
                'hoverDispatchMs',
                'burstDispatchMs',
            ] as const)
                metrics[metric] = statistics(rows.map((row) => row[metric]))
            for (const phase of [
                'openMeasures',
                'keyboardMeasures',
                'hoverMeasures',
                'burstMeasures',
            ] as const)
                metrics[phase] = Object.fromEntries(
                    [
                        'rectangles',
                        'widthReads',
                        'heightReads',
                        'commits',
                        'renderMs',
                    ].map((metric) => [
                        metric,
                        statistics(rows.map((row) => row[phase][metric]!)),
                    ]),
                )
            return {
                variant,
                count,
                samples: rows.length,
                focusReadyAtDispatch: rows.filter((row) => row.readyAtDispatch)
                    .length,
                metrics,
            }
        }),
    )
}

const settings = options()
const temporary = await createTemporary()
const dependencyRoot = settings.dependencyRoot
    ? resolve(settings.dependencyRoot)
    : temporary
let browser: Awaited<ReturnType<BrowserType['launch']>> | undefined
try {
    await prepareDependencies(dependencyRoot, !settings.dependencyRoot)
    const { scripts, bundles } = await buildFixtures(
        temporary,
        dependencyRoot,
        settings,
    )
    const css = await readFile(join(source, 'fixture.css'), 'utf8')
    const playwright = createRequire(join(root, 'package.json'))(
        '@playwright/test',
    ) as Record<string, BrowserType>
    browser = await playwright[settings.browser]!.launch()
    const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
    })
    const errors: string[] = []
    const raw: Sample[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const count of settings.sizes) {
        for (const variant of settings.variants) {
            await page.goto('about:blank')
            await page.setContent(
                `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><main id="root"></main></body></html>`,
            )
            await page.evaluate((fixtureCount) => {
                Reflect.set(window, 'fixtureCount', fixtureCount)
            }, count)
            await page.addScriptTag({
                content: scripts.get(variant)!.toString(),
                type: 'module',
            })
            await page.waitForFunction(() =>
                Reflect.get(window, 'fixtureReady')?.(),
            )
            for (
                let sample = -settings.warmups;
                sample < settings.samples;
                sample++
            ) {
                const measurement = await page.evaluate<Sample>(() =>
                    Reflect.get(window, 'sample')(),
                )
                assert.equal(
                    measurement.menuItems,
                    count,
                    `${variant}/${count}: item count`,
                )
                assert.equal(
                    measurement.keyboardReached,
                    'item-8',
                    `${variant}/${count}: keyboard focus`,
                )
                assert.equal(
                    measurement.hoverFocusMatches,
                    8,
                    `${variant}/${count}: hover focus`,
                )
                assert.ok(
                    measurement.visibleAtFocus,
                    `${variant}/${count}: focused item must be visible`,
                )
                if (sample >= 0)
                    raw.push({ ...measurement, variant, count, sample })
            }
            console.error(
                `Measured ${variant}/${count}: ${settings.samples} samples after ${settings.warmups} warmups`,
            )
        }
    }
    assert.deepEqual(errors, [], 'Browser page errors invalidate results')
    const report = {
        date: new Date().toISOString(),
        browser: {
            name: settings.browser,
            version: browser.version(),
            viewport: '1280x900',
            headless: true,
        },
        versions: {
            bun: Bun.version,
            ...pinned,
            candidate: 'repository src/index.ts',
        },
        protocol: {
            variants: settings.variants,
            sizes: settings.sizes,
            samples: settings.samples,
            warmups: settings.warmups,
            keyboardArrows: 8,
            hoverItems: 8,
            burstScrollEvents: 20,
            burstResizeEvents: 20,
            nodeEnvironment: 'production',
            reactProductionProfiling: settings.profile,
            timing: 'performance.now inside browser; excludes Playwright round-trip latency',
            readiness:
                'focusin timestamp; menuitem role plus visible computed style; warm fixture repeatedly opens/closes',
            geometry:
                'Element.getBoundingClientRect and HTMLElement.offsetWidth/offsetHeight wrappers; harness makes no rectangle calls',
            bundles:
                'Minified browser ESM; shared React/ReactDOM external; gzip level 9; two builds byte-identical',
        },
        limitations: [
            'Synthetic input exercises handlers; no trusted-pointer hit testing or OS input latency.',
            'Equivalent decoration and CSS; Rentner button items and Radix div items have different intrinsic/wrapper DOM.',
            'Common CSS only; measures library logic without application Tailwind CSS.',
            'Dispatch CPU measures synchronous dispatch only, excluding deferred React/effect/layout work.',
            'Optional --profile=true uses React production profiling build; render durations exclude browser layout/paint and instrumentation adds shared overhead.',
            'Geometry wrappers add shared overhead; focus readiness includes scheduling, so it is not CPU time.',
            'Burst deliberately sends 40 unchanged-geometry events in one task: coalescing diagnostic, not typical traffic.',
            'Fixed variant order per size; no thermal/frequency isolation; limited-sample p95 is descriptive.',
            'Byte sizes imply no runtime speedup; both-menu namespace bundle retains extra Radix exports.',
        ],
        bundles,
        summaries: summarize(raw, settings),
        errors,
        raw,
    }
    if (settings.output)
        await writeFile(
            resolve(settings.output),
            JSON.stringify(report, null, 2),
        )
    console.log(
        JSON.stringify({
            browser: report.browser,
            versions: report.versions,
            profile: settings.profile,
            samples: settings.samples,
            warmups: settings.warmups,
            output: settings.output ? resolve(settings.output) : undefined,
        }),
    )
    console.table(
        bundles.map(({ variant, scenario, bytes, gzipBytes }) => ({
            variant,
            scenario,
            bytes,
            gzipBytes,
        })),
    )
    const pair = (values: number[]) => {
        const { median, p95 } = statistics(values)
        return `${median.toFixed(2)}/${p95.toFixed(2)}`
    }
    console.table(
        settings.sizes.flatMap((count) =>
            settings.variants.map((variant) => {
                const rows = raw.filter(
                    (row) => row.count === count && row.variant === variant,
                )
                return {
                    variant,
                    count,
                    'focus ms median/p95': pair(
                        rows.map((row) => row.openFocusMs),
                    ),
                    '8 arrows dispatch ms': pair(
                        rows.map((row) => row.keyboardDispatchMs),
                    ),
                    '8 hover dispatch ms': pair(
                        rows.map((row) => row.hoverDispatchMs),
                    ),
                    'arrow commits': settings.profile
                        ? pair(rows.map((row) => row.keyboardMeasures.commits!))
                        : '-',
                    'arrow render ms': settings.profile
                        ? pair(
                              rows.map((row) => row.keyboardMeasures.renderMs!),
                          )
                        : '-',
                    'hover commits': settings.profile
                        ? pair(rows.map((row) => row.hoverMeasures.commits!))
                        : '-',
                    'hover render ms': settings.profile
                        ? pair(rows.map((row) => row.hoverMeasures.renderMs!))
                        : '-',
                    'burst rect reads': pair(
                        rows.map((row) => row.burstMeasures.rectangles!),
                    ),
                    'burst commits': settings.profile
                        ? pair(rows.map((row) => row.burstMeasures.commits!))
                        : '-',
                }
            }),
        ),
    )
    console.log(
        'Synthetic events; synchronous dispatch excludes deferred work. Render durations use optional production profiling. Burst is 40 same-task unchanged-geometry events. Bundle size implies no runtime speedup. See optional JSON output for full protocol, raw data and limitations.',
    )
} finally {
    try {
        await browser?.close()
    } finally {
        assert.equal(dirname(resolve(temporary)), resolve(tmpdir()))
        assert.ok(basename(temporary).startsWith('rentnermenu-benchmark-'))
        await rm(temporary, { recursive: true, force: true })
    }
}

// Bun can retain Playwright transport handles after awaited browser/temp cleanup.
process.exit(0)
