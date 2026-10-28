import type {
    AutoMergeIdentity,
    AutoMergeOperations,
} from './Types/dependabot.types.ts'
import { api, command, eventData, isMain } from '../lib/runtime.ts'
import { repositoryPolicy } from '../lib/repository.ts'
import {
    isArtifactsResponse,
    isBotCommits,
    isMetadataRun,
    isPullRequest,
    isWorkflowContents,
    isWorkflowDefinition,
    isWorkflowRunEvent,
} from './dependabotValidation.ts'
import { eligibleDependabot } from './dependabot-provenance.ts'

function verify(): AutoMergeIdentity | undefined {
    const { repository } = repositoryPolicy()
    const event = eventData(isWorkflowRunEvent).workflow_run
    if (
        !Number.isSafeInteger(event.id) ||
        event.id <= 0 ||
        !Number.isSafeInteger(event.run_attempt) ||
        event.run_attempt <= 0 ||
        !/^[a-f0-9]{40}$/.test(event.head_sha) ||
        event.pull_requests.length !== 1
    )
        return undefined
    const run = api(
        `repos/${repository}/actions/runs/${event.id}/attempts/${event.run_attempt}`,
        isMetadataRun,
    )
    const current = api(
        `repos/${repository}/actions/runs/${event.id}`,
        isMetadataRun,
    )
    if (current.run_attempt !== event.run_attempt) return undefined
    const prNumber = event.pull_requests[0].number
    if (!Number.isSafeInteger(prNumber) || prNumber <= 0) return undefined
    const pr = api(`repos/${repository}/pulls/${prNumber}`, isPullRequest)
    const workflow = api(
        `repos/${repository}/actions/workflows/dependabot-metadata.yml`,
        isWorkflowDefinition,
    )
    if (workflow.path !== '.github/workflows/dependabot-metadata.yml')
        return undefined
    const artifacts = api(
        `repos/${repository}/actions/runs/${event.id}/artifacts?per_page=100`,
        isArtifactsResponse,
    )
    const commits = api(
        `repos/${repository}/pulls/${prNumber}/commits?per_page=100`,
        isBotCommits,
    )
    const definition = (ref: string) =>
        api(
            `repos/${repository}/contents/.github/workflows/dependabot-metadata.yml?ref=${encodeURIComponent(ref)}`,
            isWorkflowContents,
        ).content
    if (
        !eligibleDependabot({
            repository,
            runId: event.id,
            attempt: event.run_attempt,
            head: event.head_sha,
            prNumber,
            workflowId: workflow.id,
            run,
            pr,
            artifacts: artifacts.artifacts,
            totalArtifacts: artifacts.total_count,
            commits,
            sourceWorkflow: definition(event.head_sha),
            baseWorkflow: definition(pr.base.sha),
        })
    )
        return undefined
    return { repository, prNumber, head: event.head_sha }
}

export function enableVerifiedDependabotMerge(
    operations: AutoMergeOperations,
): boolean {
    const initial = operations.verify()
    if (!initial) return false
    const matches = (
        identity: AutoMergeIdentity | undefined,
    ): identity is AutoMergeIdentity =>
        identity !== undefined &&
        identity.repository === initial.repository &&
        identity.prNumber === initial.prNumber &&
        identity.head === initial.head
    const fresh = operations.verify()
    if (!matches(fresh)) throw new Error('Dependabot provenance changed')
    operations.approve(fresh)
    const beforeMerge = operations.verify()
    if (!matches(beforeMerge))
        throw new Error('Dependabot head changed before merge')
    operations.enableAutoMerge(beforeMerge)
    return true
}

if (isMain(import.meta.url)) {
    enableVerifiedDependabotMerge({
        verify,
        approve: (identity) => {
            api(
                'repos/' +
                    identity.repository +
                    '/pulls/' +
                    identity.prNumber +
                    '/reviews',
                'POST',
                { event: 'APPROVE', commit_id: identity.head },
            )
        },
        enableAutoMerge: (identity) => {
            command('gh', [
                'pr',
                'merge',
                String(identity.prNumber),
                '--repo',
                identity.repository,
                '--auto',
                '--squash',
                '--match-head-commit',
                identity.head,
            ])
        },
    })
}
