export interface MetadataRun {
    id: number
    run_attempt: number
    workflow_id: number
    name: string
    path: string
    event: string
    status: string
    conclusion: string | null
    head_sha: string
    head_branch: string
    actor: { login: string }
    triggering_actor: { login: string }
    head_repository: { full_name: string }
    pull_requests: { number: number }[]
}

export interface PullRequest {
    number: number
    state: string
    draft: boolean
    user: { login: string }
    base: { ref: string; sha: string }
    head: { sha: string; ref: string; repo: { full_name: string } }
}

export interface EligibilityArtifact {
    name: string
    expired: boolean
    digest: string
    workflow_run: { id: number; head_sha: string }
}

export interface BotCommit {
    author: { login: string } | null
    commit: { verification: { verified: boolean } }
}

export interface Provenance {
    repository: string
    runId: number
    attempt: number
    head: string
    prNumber: number
    workflowId: number
    run: MetadataRun
    pr: PullRequest
    artifacts: EligibilityArtifact[]
    totalArtifacts: number
    commits: BotCommit[]
    sourceWorkflow: string
    baseWorkflow: string
}

export interface WorkflowDefinition {
    id: number
    path: string
}

export interface WorkflowContents {
    content: string
}

export interface ArtifactsResponse {
    artifacts: EligibilityArtifact[]
    total_count: number
}

export interface AutoMergeIdentity {
    repository: string
    prNumber: number
    head: string
}

export interface WorkflowRunEvent {
    workflow_run: MetadataRun
}

export interface PullRequestSummary {
    number: number
    user: { login: string }
}

export interface RebasePullRequest extends PullRequest {
    auto_merge: { merge_method: string } | null
}

export interface CommitHead {
    sha: string
}

export interface CommitComparison {
    behind_by: number
}

export interface RebaseComment {
    body: string
    created_at: string
    user: { login: string }
}

export interface RebaseOperations {
    user: () => string
    mainHead: () => string
    pullRequests: (page: number) => PullRequestSummary[]
    pullRequest: (number: number) => RebasePullRequest
    commits: (number: number) => BotCommit[]
    comparison: (base: string, head: string) => CommitComparison
    comments: (number: number, page: number) => RebaseComment[]
    comment: (number: number, body: string) => void
}
