import type { Provenance } from './Types/dependabot.types.ts'

export function eligibleDependabot(provenance: Provenance): boolean {
    const { run, pr, repository, runId, attempt, head, prNumber, workflowId } =
        provenance
    if (
        !Number.isSafeInteger(runId) ||
        runId <= 0 ||
        !Number.isSafeInteger(attempt) ||
        attempt <= 0 ||
        !Number.isSafeInteger(prNumber) ||
        prNumber <= 0 ||
        !/^[a-f0-9]{40}$/.test(head)
    )
        return false
    if (
        run.id !== runId ||
        run.run_attempt !== attempt ||
        run.workflow_id !== workflowId ||
        run.name !== 'Dependabot Metadata' ||
        run.path !== '.github/workflows/dependabot-metadata.yml' ||
        run.status !== 'completed' ||
        run.conclusion !== 'success' ||
        run.event !== 'pull_request' ||
        run.actor.login !== 'dependabot[bot]' ||
        run.triggering_actor.login !== 'dependabot[bot]' ||
        run.head_repository.full_name !== repository ||
        run.head_sha !== head ||
        !run.head_branch.startsWith('dependabot/') ||
        run.pull_requests.length !== 1 ||
        run.pull_requests[0].number !== prNumber
    )
        return false
    if (
        pr.number !== prNumber ||
        pr.user.login !== 'dependabot[bot]' ||
        pr.state !== 'open' ||
        pr.draft ||
        pr.base.ref !== 'main' ||
        pr.head.sha !== head ||
        pr.head.repo.full_name !== repository ||
        !pr.head.ref.startsWith('dependabot/')
    )
        return false
    if (
        !provenance.baseWorkflow ||
        provenance.sourceWorkflow !== provenance.baseWorkflow
    )
        return false
    if (
        provenance.totalArtifacts >= 100 ||
        provenance.totalArtifacts !== provenance.artifacts.length
    )
        return false
    const prefix = `dependabot-auto-merge-${prNumber}-${head}-${attempt}-`
    const markers = provenance.artifacts.filter(
        (artifact) =>
            !artifact.expired &&
            (artifact.name === `${prefix}patch` ||
                artifact.name === `${prefix}minor`),
    )
    if (
        markers.length !== 1 ||
        markers[0].workflow_run.id !== runId ||
        markers[0].workflow_run.head_sha !== head ||
        !/^sha256:[a-f0-9]{64}$/.test(markers[0].digest)
    )
        return false
    return (
        provenance.commits.length > 0 &&
        provenance.commits.length < 100 &&
        provenance.commits.every(
            (commit) =>
                commit.author?.login === 'dependabot[bot]' &&
                commit.commit.verification.verified,
        )
    )
}
