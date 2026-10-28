import type {
    ArtifactsResponse,
    BotCommit,
    CommitComparison,
    CommitHead,
    MetadataRun,
    PullRequest,
    PullRequestSummary,
    RebaseComment,
    RebasePullRequest,
    WorkflowContents,
    WorkflowDefinition,
    WorkflowRunEvent,
} from './Types/dependabot.types.ts'
import { isRecord, positiveInteger } from '../lib/runtime.ts'

export function isLogin(value: unknown): value is { login: string } {
    return isRecord(value) && typeof value.login === 'string'
}

function isRepository(value: unknown): value is { full_name: string } {
    return isRecord(value) && typeof value.full_name === 'string'
}

export function isMetadataRun(value: unknown): value is MetadataRun {
    return (
        isRecord(value) &&
        positiveInteger(value.id) &&
        positiveInteger(value.run_attempt) &&
        positiveInteger(value.workflow_id) &&
        typeof value.name === 'string' &&
        typeof value.path === 'string' &&
        typeof value.event === 'string' &&
        typeof value.status === 'string' &&
        (value.conclusion === null || typeof value.conclusion === 'string') &&
        typeof value.head_sha === 'string' &&
        typeof value.head_branch === 'string' &&
        isLogin(value.actor) &&
        isLogin(value.triggering_actor) &&
        isRepository(value.head_repository) &&
        Array.isArray(value.pull_requests) &&
        value.pull_requests.every(
            (pr: unknown) => isRecord(pr) && positiveInteger(pr.number),
        )
    )
}

export function isWorkflowRunEvent(value: unknown): value is WorkflowRunEvent {
    return isRecord(value) && isMetadataRun(value.workflow_run)
}

export function isPullRequest(value: unknown): value is PullRequest {
    return (
        isRecord(value) &&
        positiveInteger(value.number) &&
        typeof value.state === 'string' &&
        typeof value.draft === 'boolean' &&
        isLogin(value.user) &&
        isRecord(value.base) &&
        typeof value.base.ref === 'string' &&
        typeof value.base.sha === 'string' &&
        isRecord(value.head) &&
        typeof value.head.sha === 'string' &&
        typeof value.head.ref === 'string' &&
        isRepository(value.head.repo)
    )
}

export function isWorkflowDefinition(
    value: unknown,
): value is WorkflowDefinition {
    return (
        isRecord(value) &&
        positiveInteger(value.id) &&
        typeof value.path === 'string'
    )
}

export function isWorkflowContents(value: unknown): value is WorkflowContents {
    return isRecord(value) && typeof value.content === 'string'
}

export function isArtifactsResponse(
    value: unknown,
): value is ArtifactsResponse {
    return (
        isRecord(value) &&
        typeof value.total_count === 'number' &&
        Number.isSafeInteger(value.total_count) &&
        value.total_count >= 0 &&
        Array.isArray(value.artifacts) &&
        value.artifacts.every(
            (artifact: unknown) =>
                isRecord(artifact) &&
                typeof artifact.name === 'string' &&
                typeof artifact.expired === 'boolean' &&
                typeof artifact.digest === 'string' &&
                isRecord(artifact.workflow_run) &&
                positiveInteger(artifact.workflow_run.id) &&
                typeof artifact.workflow_run.head_sha === 'string',
        )
    )
}

export function isBotCommits(value: unknown): value is BotCommit[] {
    return (
        Array.isArray(value) &&
        value.every(
            (commit: unknown) =>
                isRecord(commit) &&
                (commit.author === null || isLogin(commit.author)) &&
                isRecord(commit.commit) &&
                isRecord(commit.commit.verification) &&
                typeof commit.commit.verification.verified === 'boolean',
        )
    )
}

export function isPullRequestSummaries(
    value: unknown,
): value is PullRequestSummary[] {
    return (
        Array.isArray(value) &&
        value.every(
            (pr: unknown) =>
                isRecord(pr) && positiveInteger(pr.number) && isLogin(pr.user),
        )
    )
}

export function isRebasePullRequest(
    value: unknown,
): value is RebasePullRequest {
    return (
        isPullRequest(value) &&
        isRecord(value) &&
        (value.auto_merge === null ||
            (isRecord(value.auto_merge) &&
                typeof value.auto_merge.merge_method === 'string'))
    )
}

export function isCommitHead(value: unknown): value is CommitHead {
    return (
        isRecord(value) &&
        typeof value.sha === 'string' &&
        value.sha.length === 40 &&
        /^[a-f0-9]{40}$/.test(value.sha)
    )
}

export function isCommitComparison(value: unknown): value is CommitComparison {
    return (
        isRecord(value) &&
        typeof value.behind_by === 'number' &&
        Number.isSafeInteger(value.behind_by) &&
        value.behind_by >= 0
    )
}

export function isRebaseComments(value: unknown): value is RebaseComment[] {
    return (
        Array.isArray(value) &&
        value.every(
            (comment: unknown) =>
                isRecord(comment) &&
                typeof comment.body === 'string' &&
                typeof comment.created_at === 'string' &&
                Number.isFinite(Date.parse(comment.created_at)) &&
                isLogin(comment.user),
        )
    )
}
