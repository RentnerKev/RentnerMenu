import { expect, test } from 'bun:test'
import { pinnedActions } from '../../../.github/scripts/ci/validate-workflow-policy.ts'
import { parseJson } from '../../../.github/scripts/lib/runtime.ts'
import { validRepositoryPolicy } from '../../../.github/scripts/lib/repository.ts'
import {
    isPackageIdentity,
    isPackedArtifacts,
    isReleaseEvent,
    isReleaseMetadata,
} from '../../../.github/scripts/release/releaseValidation.ts'
import {
    isArtifactsResponse,
    isBotCommits,
    isMetadataRun,
    isPullRequest,
    isWorkflowContents,
    isWorkflowDefinition,
    isWorkflowRunEvent,
} from '../../../.github/scripts/security/dependabotValidation.ts'

const run = {
    id: 42,
    run_attempt: 2,
    workflow_id: 9,
    name: 'Dependabot Metadata',
    path: '.github/workflows/dependabot-metadata.yml',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    head_sha: 'a'.repeat(40),
    head_branch: 'dependabot/bun/react',
    actor: { login: 'dependabot[bot]' },
    triggering_actor: { login: 'dependabot[bot]' },
    head_repository: { full_name: 'RentnerKev/RentnerMenu' },
    pull_requests: [{ number: 7 }],
}
const release = {
    id: 12,
    tag_name: 'v2.0.7',
    draft: false,
    prerelease: false,
    published_at: '2026-10-07T10:00:00Z',
    body: null,
    assets: [{ id: 1, name: 'release-banner.svg', size: 100, digest: null }],
}

function workflow(step: string): string {
    return `jobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - ${step}\n`
}

test('keeps remote action SHA pinning after retiring duplicate updater configuration', () => {
    const sha = 'a'.repeat(40)
    for (const source of [
        workflow(`uses: actions/checkout@${sha} # v7`),
        workflow(`uses: 'github/codeql-action/init@${sha}'`),
        workflow(`{ uses: actions/checkout@${sha} }`),
        workflow(`"uses": actions/checkout@${sha}`),
        workflow('uses: ./.github/actions/local'),
        `jobs:\n  check:\n    uses: "owner/repo/.github/workflows/ci.yml@${sha}"\n`,
        workflow(`run: 'echo "uses: actions/checkout@v7"'`),
    ])
        expect(pinnedActions(source)).toBe(true)
    for (const source of [
        workflow('uses: actions/checkout@v7'),
        workflow('uses: actions/checkout@main'),
        workflow(`uses: actions/checkout@${sha.slice(0, 7)}`),
        workflow('{ uses: actions/checkout@v7 }'),
        workflow('"uses": actions/checkout@v7'),
        workflow('uses: ${{ inputs.action }}'),
        `jobs:\n  check:\n    uses: owner/repo/.github/workflows/ci.yml@main\n`,
        'jobs: null',
        'jobs:\n  check:\n    steps: invalid',
    ])
        expect(pinnedActions(source)).toBe(false)
})

test('validates JSON before exposing a typed automation contract', () => {
    const identity = { name: '@rentnerkev/menu', version: '2.4.5' }
    expect(parseJson(JSON.stringify(identity), isPackageIdentity)).toEqual(
        identity,
    )
    for (const value of [null, [], {}, { name: 3, version: '2.4.5' }])
        expect(() =>
            parseJson(JSON.stringify(value), isPackageIdentity),
        ).toThrow('data shape')
    expect(() => parseJson('{', isPackageIdentity)).toThrow()
})

test('requires matching suite repository and package identities', () => {
    for (const name of [
        'Calendar',
        'Inputs',
        'Menu',
        'Picker',
        'Select',
        'Toasts',
        'Tooltips',
    ])
        expect(
            validRepositoryPolicy({
                repository: `RentnerKev/Rentner${name}`,
                packageName: `@rentnerkev/${name.toLowerCase()}`,
            }),
        ).toBe(true)
    for (const value of [
        null,
        [],
        {},
        {
            repository: 'other/RentnerMenu',
            packageName: '@rentnerkev/menu',
        },
        {
            repository: 'RentnerKev/RentnerMenu',
            packageName: '@rentnerkev/inputs',
        },
        {
            repository: 'RentnerKev/RentnerMenu\n',
            packageName: '@rentnerkev/menu',
        },
    ])
        expect(validRepositoryPolicy(value)).toBe(false)
})

test('rejects malformed release events and banner metadata before publication', () => {
    expect(isReleaseMetadata(release)).toBe(true)
    expect(isReleaseEvent({ release })).toBe(true)
    expect(isReleaseEvent({ inputs: { tag: 'v2.0.7' } })).toBe(true)
    for (const value of [
        null,
        [],
        {},
        { ...release, id: 0 },
        { ...release, body: {} },
        {
            ...release,
            assets: [{ id: 1, name: 'banner', size: -1, digest: null }],
        },
        {
            ...release,
            assets: [{ id: 1, name: 'banner', size: 100, digest: {} }],
        },
    ])
        expect(isReleaseMetadata(value)).toBe(false)
    expect(isReleaseEvent({ inputs: { tag: 1 } })).toBe(false)
    expect(isReleaseEvent({ release: {} })).toBe(false)
})

test('rejects malformed npm pack inventories before artifact inspection', () => {
    expect(
        isPackedArtifacts([
            {
                name: '@rentnerkev/menu',
                version: '2.0.7',
                filename: 'calendar.tgz',
                files: [{ path: 'dist/index.js' }],
            },
        ]),
    ).toBe(true)
    for (const value of [
        null,
        {},
        [{}],
        [{ filename: 'a.tgz', files: [] }],
        [{ name: 3, version: '2.0.7', filename: 'a.tgz', files: [] }],
        [
            {
                name: '@rentnerkev/menu',
                version: 3,
                filename: 'a.tgz',
                files: [],
            },
        ],
        [{ filename: 'a.tgz', files: [null] }],
        [{ filename: 3, files: [] }],
    ])
        expect(isPackedArtifacts(value)).toBe(false)
})

test('checks run, rerun and current PR shapes before evaluating provenance', () => {
    expect(isMetadataRun(run)).toBe(true)
    expect(isMetadataRun({ ...run, conclusion: null })).toBe(true)
    expect(isWorkflowRunEvent({ workflow_run: run })).toBe(true)
    for (const value of [
        null,
        {},
        { ...run, id: -1 },
        { ...run, actor: null },
        { ...run, pull_requests: [{ number: '7' }] },
    ])
        expect(isMetadataRun(value)).toBe(false)
    expect(isWorkflowRunEvent({ workflow_run: {} })).toBe(false)
    const pr = {
        number: 7,
        state: 'open',
        draft: false,
        user: { login: 'dependabot[bot]' },
        base: { ref: 'main', sha: 'b'.repeat(40) },
        head: {
            ref: run.head_branch,
            sha: run.head_sha,
            repo: run.head_repository,
        },
    }
    expect(isPullRequest(pr)).toBe(true)
    expect(isPullRequest({ ...pr, head: null })).toBe(false)
    expect(isPullRequest({ ...pr, number: '7' })).toBe(false)
})

test('checks artifact and commit shapes before authorizing a bot review', () => {
    const artifacts = {
        total_count: 1,
        artifacts: [
            {
                name: 'eligibility',
                expired: false,
                digest: `sha256:${'c'.repeat(64)}`,
                workflow_run: { id: 42, head_sha: run.head_sha },
            },
        ],
    }
    expect(isArtifactsResponse(artifacts)).toBe(true)
    expect(isArtifactsResponse({ total_count: 0, artifacts: [] })).toBe(true)
    expect(isArtifactsResponse({ ...artifacts, total_count: -1 })).toBe(false)
    expect(
        isArtifactsResponse({
            ...artifacts,
            artifacts: [{ ...artifacts.artifacts[0], workflow_run: null }],
        }),
    ).toBe(false)
    const commit = {
        author: { login: 'dependabot[bot]' },
        commit: { verification: { verified: true } },
    }
    expect(isBotCommits([commit])).toBe(true)
    expect(isBotCommits([{ ...commit, author: null }])).toBe(true)
    expect(
        isBotCommits([
            { ...commit, commit: { verification: { verified: 'true' } } },
        ]),
    ).toBe(false)
    expect(isBotCommits({})).toBe(false)
    expect(isWorkflowDefinition({ id: 9, path: run.path })).toBe(true)
    expect(isWorkflowDefinition({ id: 0, path: run.path })).toBe(false)
    expect(isWorkflowContents({ content: 'verified base64 data' })).toBe(true)
    expect(isWorkflowContents({ content: null })).toBe(false)
})
