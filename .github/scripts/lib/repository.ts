import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { RepositoryPolicy } from './Types/repository.types.ts'
import { isRecord, parseJson, requiredEnv } from './runtime.ts'

export function validRepositoryPolicy(
    value: unknown,
): value is RepositoryPolicy {
    return (
        isRecord(value) &&
        typeof value.repository === 'string' &&
        /^RentnerKev\/Rentner(Calendar|Inputs|Menu|Picker|Select|Toasts|Tooltips)$/.test(
            value.repository,
        ) &&
        typeof value.packageName === 'string' &&
        value.packageName ===
            `@rentnerkev/${value.repository.slice('RentnerKev/Rentner'.length).toLowerCase()}`
    )
}

export function repositoryPolicy(): RepositoryPolicy {
    const configuration = parseJson(
        readFileSync(
            fileURLToPath(
                new URL('../../release-policy.json', import.meta.url),
            ),
            'utf8',
        ),
        validRepositoryPolicy,
    )
    if (requiredEnv('GITHUB_REPOSITORY') !== configuration.repository)
        throw new Error('Repository identity mismatch')
    return configuration
}
