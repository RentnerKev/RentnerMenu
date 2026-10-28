import {
    isMain,
    requiredEnv,
    containsControlCharacters,
} from '../lib/runtime.ts'

// Includes the established deps type used by Dependabot and cliff.toml.
export const commitTypes = [
    'feat',
    'fix',
    'docs',
    'refactor',
    'test',
    'chore',
    'perf',
    'build',
    'ci',
    'style',
    'revert',
    'deps',
] as const
const pattern = new RegExp(
    `^(${commitTypes.join('|')})(\\([a-z0-9][a-z0-9._/-]*\\))?!?: \\S.*$`,
)

export function validPrTitle(title: string): boolean {
    return !containsControlCharacters(title) && pattern.test(title)
}

if (isMain(import.meta.url) && !validPrTitle(requiredEnv('EVENT_PR_TITLE')))
    throw new Error(
        'PR title must use a Conventional Commit type and a nonempty description',
    )
