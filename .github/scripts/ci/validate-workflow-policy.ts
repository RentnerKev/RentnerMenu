import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { YAML } from 'bun'
import { isMain, isRecord } from '../lib/runtime.ts'

function pinned(value: unknown): boolean {
    return (
        typeof value === 'string' &&
        (value.startsWith('./') ||
            /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[a-f0-9]{40}$/.test(value))
    )
}

export function pinnedActions(source: string): boolean {
    const workflow: unknown = YAML.parse(source)
    if (!isRecord(workflow) || !isRecord(workflow.jobs)) return false
    return Object.values(workflow.jobs).every((job) => {
        if (!isRecord(job)) return false
        if ('uses' in job && !pinned(job.uses)) return false
        if ('steps' in job) {
            if (!Array.isArray(job.steps)) return false
            return job.steps.every(
                (step: unknown) =>
                    isRecord(step) && (!('uses' in step) || pinned(step.uses)),
            )
        }
        return 'uses' in job
    })
}

if (isMain(import.meta.url)) {
    const directory = '.github/workflows'
    for (const name of readdirSync(directory)) {
        if (!/\.ya?ml$/.test(name)) continue
        if (!pinnedActions(readFileSync(join(directory, name), 'utf8')))
            throw new Error(`Remote actions must use full commit SHAs: ${name}`)
    }
}
