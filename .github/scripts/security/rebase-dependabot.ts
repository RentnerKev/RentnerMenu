import type {
    RebaseOperations,
    RebasePullRequest,
} from './Types/dependabot.types.ts'
import { api, isMain } from '../lib/runtime.ts'
import { repositoryPolicy } from '../lib/repository.ts'
import {
    isBotCommits,
    isCommitComparison,
    isCommitHead,
    isLogin,
    isPullRequestSummaries,
    isRebaseComments,
    isRebasePullRequest,
} from './dependabotValidation.ts'

function eligibleRebase(pr: RebasePullRequest, repository: string): boolean {
    return (
        pr.state === 'open' &&
        !pr.draft &&
        pr.user.login === 'dependabot[bot]' &&
        pr.base.ref === 'main' &&
        pr.head.repo.full_name === repository &&
        pr.head.ref.startsWith('dependabot/') &&
        isCommitHead(pr.head) &&
        pr.auto_merge !== null
    )
}

function* pages<T>(load: (page: number) => T[]) {
    for (let page = 1; ; page++) {
        const values = load(page)
        yield* values
        if (values.length < 100) return
    }
}

export function rebaseDependabot(
    repository: string,
    operations: RebaseOperations,
    now: number = Date.now(),
): void {
    const user = operations.user()
    if (!user || user.endsWith('[bot]'))
        throw new Error(
            'Dependabot rebase commands require a personal account with push access',
        )
    for (const summary of pages(operations.pullRequests)) {
        if (summary.user.login !== 'dependabot[bot]') continue
        const pr = operations.pullRequest(summary.number)
        if (pr.number !== summary.number || !eligibleRebase(pr, repository))
            continue
        const base = operations.mainHead()
        if (operations.comparison(base, pr.head.sha).behind_by === 0) continue
        const commits = operations.commits(pr.number)
        if (
            commits.length === 0 ||
            commits.length >= 100 ||
            !commits.every(
                (commit) =>
                    commit.author?.login === 'dependabot[bot]' &&
                    commit.commit.verification.verified,
            )
        )
            continue

        // Let Dependabot update its own commits and trigger fresh PR checks.
        const body = `@dependabot rebase\n\n<!-- dependabot-rebase:${pr.head.sha}:${base} -->`
        const pending = Array.from(
            pages((page) => operations.comments(pr.number, page)),
        ).some(
            (comment) =>
                comment.user.login === user &&
                comment.body === body &&
                now - Date.parse(comment.created_at) < 30 * 60 * 1000,
        )
        if (pending) continue

        const fresh = operations.pullRequest(pr.number)
        if (
            fresh.number !== pr.number ||
            !eligibleRebase(fresh, repository) ||
            fresh.head.sha !== pr.head.sha ||
            operations.mainHead() !== base
        )
            continue
        operations.comment(pr.number, body)
        console.log(`Requested Dependabot rebase for PR #${pr.number}`)
    }
}

if (isMain(import.meta.url)) {
    if (!process.env.GH_TOKEN)
        throw new Error(
            'Configure repository secret DEPENDABOT_REBASE_TOKEN for automatic rebases',
        )
    const { repository } = repositoryPolicy()
    rebaseDependabot(repository, {
        user: () => api('user', isLogin).login,
        mainHead: () =>
            api(`repos/${repository}/commits/main`, isCommitHead).sha,
        pullRequests: (page) =>
            api(
                `repos/${repository}/pulls?state=open&base=main&per_page=100&page=${page}`,
                isPullRequestSummaries,
            ),
        pullRequest: (number) =>
            api(`repos/${repository}/pulls/${number}`, isRebasePullRequest),
        commits: (number) =>
            api(
                `repos/${repository}/pulls/${number}/commits?per_page=100`,
                isBotCommits,
            ),
        comparison: (base, head) =>
            api(
                `repos/${repository}/compare/${base}...${head}?per_page=1`,
                isCommitComparison,
            ),
        comments: (number, page) =>
            api(
                `repos/${repository}/issues/${number}/comments?per_page=100&page=${page}`,
                isRebaseComments,
            ),
        comment: (number, body) => {
            api(`repos/${repository}/issues/${number}/comments`, 'POST', {
                body,
            })
        },
    })
}
