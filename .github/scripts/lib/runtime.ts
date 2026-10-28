import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function isMain(url: string): boolean {
    return (
        Boolean(process.argv[1]) &&
        resolve(process.argv[1]) === fileURLToPath(url)
    )
}

export function requiredEnv(name: string): string {
    const value = process.env[name]
    if (!value || containsControlCharacters(value))
        throw new Error(`Invalid ${name}`)
    return value
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function positiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function parseJson<T>(
    text: string,
    validate: (value: unknown) => value is T,
): T {
    const value: unknown = JSON.parse(text)
    if (!validate(value)) throw new Error('Unexpected automation data shape')
    return value
}

export function eventData<T>(validate: (value: unknown) => value is T): T {
    return parseJson(
        readFileSync(requiredEnv('GITHUB_EVENT_PATH'), 'utf8'),
        validate,
    )
}

export function output(name: string, value: string): void {
    if (!/^[a-z][a-z0-9_-]*$/.test(name) || containsControlCharacters(value))
        throw new Error('Unsafe workflow output')
    appendFileSync(requiredEnv('GITHUB_OUTPUT'), `${name}=${value}\n`)
}

export function command(
    program: string,
    args: readonly string[],
    input?: string,
): string {
    try {
        return execFileSync(program, [...args], {
            encoding: 'utf8',
            input,
            maxBuffer: 10_000_000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
    } catch {
        // CLI errors can contain authentication headers or untrusted payloads.
        throw new Error(`${program} command failed`)
    }
}

export function api<T>(
    endpoint: string,
    validate: (value: unknown) => value is T,
): T
export function api(
    endpoint: string,
    method: 'POST' | 'PATCH',
    body: object,
): unknown
export function api(
    endpoint: string,
    operation: ((value: unknown) => boolean) | 'POST' | 'PATCH',
    body?: object,
): unknown {
    const method = typeof operation === 'function' ? 'GET' : operation
    const args = ['api', '--method', method, endpoint]
    if (body) args.push('--input', '-')
    const value: unknown = JSON.parse(
        command('gh', args, body ? JSON.stringify(body) : undefined),
    )
    if (typeof operation === 'function' && !operation(value))
        throw new Error('Unexpected GitHub API response shape')
    return value
}

export function containsControlCharacters(value: string): boolean {
    return Array.from(value).some((character) => {
        const point = character.codePointAt(0)!
        return (
            point < 32 ||
            (point >= 127 && point <= 159) ||
            point === 0x2028 ||
            point === 0x2029
        )
    })
}
