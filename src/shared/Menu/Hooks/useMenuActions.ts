import { useLayoutEffect, useRef, useState } from 'react'
import type {
    MenuAsyncActionOptions,
    MenuAsyncActionState,
} from '../Types/menu.actions.ts'
import type { MenuSelectEvent } from '../Types/menu.types.ts'
import { useStableEvent } from './useStableEvent.ts'

const EMPTY_ACTION_STATES: ReadonlyMap<string, MenuAsyncActionState> = new Map()

/** Owns in-flight operations across renders, submenu changes, and open sessions. */
export function useMenuActions({
    open,
    onActionError,
}: MenuAsyncActionOptions) {
    const [states, setStates] =
        useState<ReadonlyMap<string, MenuAsyncActionState>>(EMPTY_ACTION_STATES)
    const flights = useRef<Set<string> | null>(null)
    const mounted = useRef(false)
    const session = useRef(0)
    const previousOpen = useRef(false)
    const reportError = useStableEvent(
        async (error: unknown, event: MenuSelectEvent) => {
            try {
                await onActionError?.(error, event)
            } catch {
                // Observer failures must not create another unhandled rejection.
            }
        },
    )
    const invalidate = useStableEvent(() => {
        session.current++
    })
    useLayoutEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
            invalidate()
        }
    }, [invalidate])
    useLayoutEffect(() => {
        if (previousOpen.current !== open) {
            session.current++
            previousOpen.current = open
            setStates((current) => {
                if (current.size === 0) return current
                let hasNonPending = false
                for (const state of current.values()) {
                    if (state !== 'pending') {
                        hasNonPending = true
                        break
                    }
                }
                if (!hasNonPending) return current
                const next = new Map<string, MenuAsyncActionState>()
                for (const [key, state] of current) {
                    if (state === 'pending') next.set(key, state)
                }
                return next.size === 0 ? EMPTY_ACTION_STATES : next
            })
        }
    }, [open])
    const run = useStableEvent(
        (
            key: string,
            operation: () => Promise<void>,
            event: MenuSelectEvent,
            onSuccess: () => void,
        ) => {
            const activeFlights = (flights.current ??= new Set())
            if (activeFlights.has(key)) return
            const startedIn = session.current
            activeFlights.add(key)
            setStates((current) => new Map(current).set(key, 'pending'))
            // The async boundary also captures callbacks that throw before returning a Promise.
            void (async () => {
                let failed = false
                try {
                    await operation()
                } catch (error: unknown) {
                    failed = true
                    void reportError(error, event)
                } finally {
                    activeFlights.delete(key)
                    if (mounted.current) {
                        const currentSession = session.current === startedIn
                        setStates((current) => {
                            if (failed && currentSession) {
                                return new Map(current).set(key, 'error')
                            }
                            if (!current.has(key)) return current
                            const next = new Map(current)
                            next.delete(key)
                            return next.size === 0 ? EMPTY_ACTION_STATES : next
                        })
                        if (!failed && currentSession) onSuccess()
                    }
                }
            })().catch(() => {
                // A consumer's close observer can throw too; the operation is already settled.
            })
        },
    )
    const isPending = useStableEvent(
        (key: string) => flights.current?.has(key) ?? false,
    )
    const hasPending = useStableEvent(() => (flights.current?.size ?? 0) > 0)
    return {
        state: { states },
        handler: {
            run,
            invalidate,
            isPending,
            hasPending,
        },
    }
}
