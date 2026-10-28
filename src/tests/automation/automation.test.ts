import type { ReleaseMetadata } from '../../../.github/scripts/release/Types/release.types.ts'
import { describe, expect, test } from 'bun:test'
import { eligibleDependabot } from '../../../.github/scripts/security/dependabot-provenance.ts'
import { updateLevel } from '../../../.github/scripts/security/classify-update.ts'
import {
    stableVersion,
    validRelease,
} from '../../../.github/scripts/release/identity.ts'
import {
    releaseBody,
    startMarker,
    endMarker,
} from '../../../.github/scripts/release/notes.ts'
import { validPrTitle } from '../../../.github/scripts/ci/validate-pr-title.ts'
import type { Provenance } from '../../../.github/scripts/security/Types/dependabot.types'

const head = 'a'.repeat(40)
function provenance(): Provenance {
    return {
        repository: 'RentnerKev/RentnerMenu',
        runId: 42,
        attempt: 2,
        head,
        prNumber: 7,
        workflowId: 9,
        run: {
            id: 42,
            run_attempt: 2,
            workflow_id: 9,
            name: 'Dependabot Metadata',
            path: '.github/workflows/dependabot-metadata.yml',
            event: 'pull_request',
            status: 'completed',
            conclusion: 'success',
            head_sha: head,
            head_branch: 'dependabot/bun/react',
            actor: { login: 'dependabot[bot]' },
            triggering_actor: { login: 'dependabot[bot]' },
            head_repository: { full_name: 'RentnerKev/RentnerMenu' },
            pull_requests: [{ number: 7 }],
        },
        pr: {
            number: 7,
            state: 'open',
            draft: false,
            user: { login: 'dependabot[bot]' },
            base: { ref: 'main', sha: 'b'.repeat(40) },
            head: {
                sha: head,
                ref: 'dependabot/bun/react',
                repo: { full_name: 'RentnerKev/RentnerMenu' },
            },
        },
        artifacts: [
            {
                name: `dependabot-auto-merge-7-${head}-2-patch`,
                expired: false,
                digest: `sha256:${'c'.repeat(64)}`,
                workflow_run: { id: 42, head_sha: head },
            },
        ],
        totalArtifacts: 1,
        commits: [
            {
                author: { login: 'dependabot[bot]' },
                commit: { verification: { verified: true } },
            },
        ],
        sourceWorkflow: 'trusted metadata definition',
        baseWorkflow: 'trusted metadata definition',
    }
}
const release: ReleaseMetadata = {
    id: 12,
    tag_name: 'v2.0.7',
    draft: false,
    prerelease: false,
    published_at: '2026-10-07T10:00:00Z',
    body: null,
    assets: [],
}

describe('privileged automation provenance', () => {
    test('accepts exactly one verified minor or patch marker', () => {
        const input = provenance()
        expect(eligibleDependabot(input)).toBe(true)
        input.artifacts[0].name = input.artifacts[0].name.replace(
            '-patch',
            '-minor',
        )
        expect(eligibleDependabot(input)).toBe(true)
        input.artifacts[0].name = input.artifacts[0].name.replace(
            '-minor',
            '-major',
        )
        expect(eligibleDependabot(input)).toBe(false)
    })
    test('rejects stale attempts and changed current heads', () => {
        const input = provenance()
        input.run.run_attempt = 3
        expect(eligibleDependabot(input)).toBe(false)
        const changed = provenance()
        changed.pr.head.sha = 'd'.repeat(40)
        expect(eligibleDependabot(changed)).toBe(false)
    })
    test('rejects workflow spoofing and PR-modified metadata definitions', () => {
        const input = provenance()
        input.run.workflow_id = 10
        expect(eligibleDependabot(input)).toBe(false)
        const path = provenance()
        path.run.path = '.github/workflows/evil.yml'
        expect(eligibleDependabot(path)).toBe(false)
        const changed = provenance()
        changed.sourceWorkflow = 'upload forged marker'
        expect(eligibleDependabot(changed)).toBe(false)
    })
    test('rejects forks, reruns by humans and unverified commits', () => {
        const fork = provenance()
        fork.pr.head.repo.full_name = 'attacker/fork'
        expect(eligibleDependabot(fork)).toBe(false)
        const rerun = provenance()
        rerun.run.triggering_actor.login = 'someone'
        expect(eligibleDependabot(rerun)).toBe(false)
        const commit = provenance()
        commit.commits[0].commit.verification.verified = false
        expect(eligibleDependabot(commit)).toBe(false)
    })
    test('rejects duplicate, expired, wrong-run and unverifiable artifacts', () => {
        const duplicate = provenance()
        duplicate.artifacts.push({ ...duplicate.artifacts[0] })
        duplicate.totalArtifacts = 2
        expect(eligibleDependabot(duplicate)).toBe(false)
        const expired = provenance()
        expired.artifacts[0].expired = true
        expect(eligibleDependabot(expired)).toBe(false)
        const wrongRun = provenance()
        wrongRun.artifacts[0].workflow_run.id = 43
        expect(eligibleDependabot(wrongRun)).toBe(false)
        const digest = provenance()
        digest.artifacts[0].digest = ''
        expect(eligibleDependabot(digest)).toBe(false)
    })
    test('never grants eligibility for missing maintainer evidence or non-SemVer updates', () => {
        expect(updateLevel('false', 'version-update:semver-patch')).toBe(
            'patch',
        )
        expect(updateLevel('false', 'version-update:semver-minor')).toBe(
            'minor',
        )
        expect(updateLevel(undefined, 'version-update:semver-patch')).toBe('')
        expect(updateLevel('true', 'version-update:semver-patch')).toBe('')
        expect(updateLevel('false', 'version-update:semver-major')).toBe('')
        expect(updateLevel('false', 'version-update:lockfile')).toBe('')
    })
})

describe('release and metadata policy', () => {
    test('requires exact stable tag syntax and published stable channel identity', () => {
        expect(stableVersion('v2.0.7')).toBe('2.0.7')
        for (const invalid of [
            'v02.0.7',
            '2.0.7',
            'v2.0.7-beta.1',
            'v2.0.7\n',
            'v2.0.7;echo nope',
        ])
            expect(() => stableVersion(invalid)).toThrow()
        expect(validRelease(release, 'v2.0.7')).toBe(true)
        expect(validRelease({ ...release, draft: true }, 'v2.0.7')).toBe(false)
        expect(validRelease({ ...release, prerelease: true }, 'v2.0.7')).toBe(
            false,
        )
        expect(
            validRelease({ ...release, published_at: 'invalid' }, 'v2.0.7'),
        ).toBe(false)
    })
    test('preserves authored notes outside the managed section and reruns idempotently', () => {
        const existing =
            '## Maintainer highlights\nMeasured improvements, with limits.'
        const body = releaseBody(
            existing,
            '## Changelog\n- fix: example',
            release,
            'RentnerKev/RentnerMenu',
            'https://github.com',
        )
        expect(body).toContain(existing)
        expect(body.startsWith('![RentnerMenu release banner]')).toBe(true)
        expect(body).not.toContain('Production-ready')
        expect(
            releaseBody(
                body,
                '## Changelog\n- fix: example',
                release,
                'RentnerKev/RentnerMenu',
                'https://github.com',
            ),
        ).toBe(body)
        const changed = releaseBody(
            body + '\nAuthor footnote',
            'New generated notes',
            release,
            'RentnerKev/RentnerMenu',
            'https://github.com',
        )
        expect(changed).toContain('Author footnote')
        expect(changed).not.toContain('fix: example')
    })
    test('refuses ambiguous markers rather than overwriting human notes', () => {
        for (const body of [
            startMarker,
            endMarker,
            `${endMarker}${startMarker}`,
            `${startMarker}${startMarker}${endMarker}`,
        ])
            expect(() =>
                releaseBody(
                    body,
                    'notes',
                    release,
                    'RentnerKev/RentnerMenu',
                    'https://github.com',
                ),
            ).toThrow()
    })
    test('accepts established commit types and rejects controls and empty descriptions', () => {
        for (const title of [
            'fix: Bug behoben',
            'feat(ui)!: Neue API',
            'deps: update react',
            'refactor(tooltip): Logic extrahiert',
        ])
            expect(validPrTitle(title)).toBe(true)
        for (const title of [
            'fix: ',
            'fix: hello\nworld',
            'feat: test\0',
            'codex: task',
            'fix: \ttest',
        ])
            expect(validPrTitle(title)).toBe(false)
    })
})
