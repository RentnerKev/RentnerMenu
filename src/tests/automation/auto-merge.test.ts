import { describe, expect, test } from 'bun:test'
import { enableVerifiedDependabotMerge } from '../../../.github/scripts/security/auto-merge.ts'
import type {
    AutoMergeIdentity,
    AutoMergeOperations,
} from '../../../.github/scripts/security/Types/dependabot.types.ts'

const identity: AutoMergeIdentity = {
    repository: 'RentnerKev/RentnerMenu',
    prNumber: 7,
    head: 'a'.repeat(40),
}

function fixture() {
    const events: string[] = []
    const operations: AutoMergeOperations = {
        verify: () => {
            events.push('verify')
            return identity
        },
        approve: (selected) => {
            expect(selected).toEqual(identity)
            events.push('approve')
        },
        enableAutoMerge: (selected) => {
            expect(selected).toEqual(identity)
            events.push('merge')
        },
    }
    return { events, operations }
}

describe('verified Dependabot merge orchestration', () => {
    test('does not approve or enable a merge without verified bot eligibility', () => {
        const { events, operations } = fixture()
        operations.verify = () => undefined
        expect(enableVerifiedDependabotMerge(operations)).toBe(false)
        expect(events).toEqual([])
    })

    test('rechecks provenance before approval and before enabling auto-merge', () => {
        const { events, operations } = fixture()
        expect(enableVerifiedDependabotMerge(operations)).toBe(true)
        expect(events).toEqual([
            'verify',
            'verify',
            'approve',
            'verify',
            'merge',
        ])
    })

    test('rejects any identity change before submitting a review', () => {
        for (const changed of [
            undefined,
            { ...identity, head: 'b'.repeat(40) },
            { ...identity, repository: 'Other/Repo' },
            { ...identity, prNumber: 8 },
        ]) {
            const { events, operations } = fixture()
            let calls = 0
            operations.verify = () => (++calls === 1 ? identity : changed)
            expect(() => enableVerifiedDependabotMerge(operations)).toThrow(
                'provenance changed',
            )
            expect(events).toEqual([])
        }
    })

    test('does not enable a merge after a head changes following approval', () => {
        const { events, operations } = fixture()
        let calls = 0
        operations.verify = () =>
            ++calls < 3 ? identity : { ...identity, head: 'b'.repeat(40) }
        expect(() => enableVerifiedDependabotMerge(operations)).toThrow(
            'head changed',
        )
        expect(events).toEqual(['approve'])
    })

    test('does not continue when submitting the approval fails', () => {
        const { events, operations } = fixture()
        operations.approve = () => {
            throw new Error('Review permission denied')
        }
        expect(() => enableVerifiedDependabotMerge(operations)).toThrow(
            'Review permission denied',
        )
        expect(events).toEqual(['verify', 'verify'])
    })
})
