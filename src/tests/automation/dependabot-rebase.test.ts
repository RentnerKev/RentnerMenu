import type {
    BotCommit,
    RebaseComment,
    RebaseOperations,
    RebasePullRequest,
} from '../../../.github/scripts/security/Types/dependabot.types.ts'
import { describe, expect, test } from 'bun:test'
import { rebaseDependabot } from '../../../.github/scripts/security/rebase-dependabot.ts'
import {
    isCommitComparison,
    isCommitHead,
    isPullRequestSummaries,
    isRebaseComments,
    isRebasePullRequest,
} from '../../../.github/scripts/security/dependabotValidation.ts'

const repository = 'RentnerKev/RentnerMenu'
const head = 'a'.repeat(40)
const main = 'b'.repeat(40)
const now = Date.parse('2026-10-12T12:00:00Z')
const body = `@dependabot rebase\n\n<!-- dependabot-rebase:${head}:${main} -->`

function fixture() {
    const pr: RebasePullRequest = {
        number: 7,
        state: 'open',
        draft: false,
        user: { login: 'dependabot[bot]' },
        base: { ref: 'main', sha: main },
        head: {
            sha: head,
            ref: 'dependabot/bun/react',
            repo: { full_name: repository },
        },
        auto_merge: { merge_method: 'squash' },
    }
    const commits: BotCommit[] = [
        {
            author: { login: 'dependabot[bot]' },
            commit: { verification: { verified: true } },
        },
    ]
    const comments: RebaseComment[] = []
    const requests: { number: number; body: string }[] = []
    const operations: RebaseOperations = {
        user: () => 'RentnerKev',
        mainHead: () => main,
        pullRequests: () => [{ number: pr.number, user: pr.user }],
        pullRequest: () => structuredClone(pr),
        commits: () => commits,
        comparison: () => ({ behind_by: 1 }),
        comments: () => comments,
        comment: (number, commentBody) => {
            requests.push({ number, body: commentBody })
        },
    }
    return { pr, commits, comments, requests, operations }
}

function previousComment(minutes: number): RebaseComment {
    return {
        body,
        created_at: new Date(now - minutes * 60 * 1000).toISOString(),
        user: { login: 'RentnerKev' },
    }
}

describe('Dependabot rebase queue', () => {
    test('rejects app identities before posting Dependabot commands', () => {
        const input = fixture()
        input.operations.user = () => 'github-actions[bot]'
        expect(() =>
            rebaseDependabot(repository, input.operations, now),
        ).toThrow('personal account')
        expect(input.requests).toEqual([])
    })

    test('requests rebases for every outdated auto-merge PR against current main', () => {
        const input = fixture()
        input.operations.pullRequests = () => [
            { number: 7, user: input.pr.user },
            { number: 8, user: input.pr.user },
        ]
        input.operations.pullRequest = (number) => ({ ...input.pr, number })
        const comparisons: string[][] = []
        input.operations.comparison = (base, current) => {
            comparisons.push([base, current])
            return { behind_by: 2 }
        }
        rebaseDependabot(repository, input.operations, now)
        expect(input.requests).toEqual([
            { number: 7, body },
            { number: 8, body },
        ])
        expect(comparisons).toEqual([
            [main, head],
            [main, head],
        ])
    })

    test('continues after later main merges and stops when branches are current', () => {
        const input = fixture()
        rebaseDependabot(repository, input.operations, now)
        input.operations.mainHead = () => 'c'.repeat(40)
        rebaseDependabot(repository, input.operations, now)
        expect(input.requests).toHaveLength(2)
        expect(input.requests[1].body).toContain('c'.repeat(40))
        input.operations.comparison = () => ({ behind_by: 0 })
        rebaseDependabot(repository, input.operations, now)
        expect(input.requests).toHaveLength(2)
    })

    test.each([
        'closed',
        'draft',
        'human',
        'fork',
        'other base',
        'other branch',
        'no auto-merge',
    ])('skips ineligible PRs: %s', (reason) => {
        const input = fixture()
        switch (reason) {
            case 'closed':
                input.pr.state = 'closed'
                break
            case 'draft':
                input.pr.draft = true
                break
            case 'human':
                input.pr.user.login = 'maintainer'
                break
            case 'fork':
                input.pr.head.repo.full_name = 'other/fork'
                break
            case 'other base':
                input.pr.base.ref = 'develop'
                break
            case 'other branch':
                input.pr.head.ref = 'fix/dependency'
                break
            case 'no auto-merge':
                input.pr.auto_merge = null
                break
        }
        rebaseDependabot(repository, input.operations, now)
        expect(input.requests).toEqual([])
    })

    test('leaves human, unsigned, empty and truncated commit histories untouched', () => {
        for (const kind of ['human', 'unsigned', 'empty', 'truncated']) {
            const input = fixture()
            if (kind === 'human')
                input.commits[0].author = { login: 'maintainer' }
            if (kind === 'unsigned')
                input.commits[0].commit.verification.verified = false
            if (kind === 'empty') input.commits.length = 0
            if (kind === 'truncated')
                input.commits.push(
                    ...Array<BotCommit>(99).fill(input.commits[0]),
                )
            rebaseDependabot(repository, input.operations, now)
            expect(input.requests).toEqual([])
        }
    })

    test('deduplicates pending requests and retries a stalled request after 30 minutes', () => {
        const input = fixture()
        input.comments.push(previousComment(5))
        rebaseDependabot(repository, input.operations, now)
        expect(input.requests).toEqual([])
        input.comments[0] = previousComment(30)
        rebaseDependabot(repository, input.operations, now)
        expect(input.requests).toEqual([{ number: 7, body }])
    })

    test('a request for another head or another account does not block progress', () => {
        for (const kind of ['other head', 'human']) {
            const input = fixture()
            const comment = previousComment(5)
            if (kind === 'other head')
                comment.body = body.replace(head, 'd'.repeat(40))
            else comment.user.login = 'maintainer'
            input.comments.push(comment)
            rebaseDependabot(repository, input.operations, now)
            expect(input.requests).toEqual([{ number: 7, body }])
        }
    })

    test('finds eligible PRs and pending requests beyond the first API page', () => {
        const input = fixture()
        const pullPages: number[] = []
        input.operations.pullRequests = (page) => {
            pullPages.push(page)
            return page === 1
                ? Array.from({ length: 100 }, (_, index) => ({
                      number: index + 100,
                      user: { login: 'maintainer' },
                  }))
                : [{ number: 7, user: input.pr.user }]
        }
        const commentPages: number[] = []
        input.operations.comments = (_number, page) => {
            commentPages.push(page)
            return page === 1
                ? Array.from({ length: 100 }, () => ({
                      ...previousComment(5),
                      body: 'A maintainer comment',
                  }))
                : [previousComment(5)]
        }
        rebaseDependabot(repository, input.operations, now)
        expect(pullPages).toEqual([1, 2])
        expect(commentPages).toEqual([1, 2])
        expect(input.requests).toEqual([])
    })

    test('rechecks the head and current eligibility immediately before writing', () => {
        for (const kind of ['head', 'closed', 'auto-merge']) {
            const input = fixture()
            let reads = 0
            input.operations.pullRequest = () => {
                const fresh = structuredClone(input.pr)
                if (++reads === 2) {
                    if (kind === 'head') fresh.head.sha = 'd'.repeat(40)
                    if (kind === 'closed') fresh.state = 'closed'
                    if (kind === 'auto-merge') fresh.auto_merge = null
                }
                return fresh
            }
            rebaseDependabot(repository, input.operations, now)
            expect(input.requests).toEqual([])
        }
    })

    test('defers to the next sweep if main advances before the request', () => {
        const input = fixture()
        let reads = 0
        input.operations.mainHead = () =>
            ++reads === 1 ? main : 'c'.repeat(40)
        rebaseDependabot(repository, input.operations, now)
        expect(input.requests).toEqual([])
    })
})

test('validates GitHub response shapes before processing the rebase queue', () => {
    const input = fixture()
    expect(isRebasePullRequest(input.pr)).toBe(true)
    expect(isRebasePullRequest({ ...input.pr, auto_merge: null })).toBe(true)
    expect(isRebasePullRequest({ ...input.pr, auto_merge: undefined })).toBe(
        false,
    )
    expect(isRebasePullRequest({ ...input.pr, auto_merge: {} })).toBe(false)
    expect(isPullRequestSummaries([{ number: 7, user: input.pr.user }])).toBe(
        true,
    )
    expect(isPullRequestSummaries([{ number: '7', user: input.pr.user }])).toBe(
        false,
    )
    expect(isCommitHead({ sha: main })).toBe(true)
    for (const sha of ['main', main + '\n', ';echo bad', 7])
        expect(isCommitHead({ sha })).toBe(false)
    expect(isCommitComparison({ behind_by: 0 })).toBe(true)
    for (const behind_by of [-1, 1.5, '1', null])
        expect(isCommitComparison({ behind_by })).toBe(false)
    expect(isRebaseComments([previousComment(5)])).toBe(true)
    expect(
        isRebaseComments([{ ...previousComment(5), created_at: 'invalid' }]),
    ).toBe(false)
})
