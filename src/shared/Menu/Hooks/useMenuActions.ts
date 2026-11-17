import { useLayoutEffect, useRef, useState } from 'react'
import type {
    MenuAsyncActionOptions,
    MenuAsyncActionState,
} from '../Types/menu.actions.ts'
import type { MenuSelectEvent } from '../Types/menu.types.ts'
import { useStableEvent } from './useStableEvent.ts'

/** Owns in-flight operations across renders, submenu changes, and open sessions. */
export function useMenuActions({ open, onActionError }: MenuAsyncActionOptions) {
    const [states, setStates] = useState<
        ReadonlyMap<string, MenuAsyncActionState>
    >(() => new Map())
    const flights = useRef(new Set<string>())
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
            setStates((current) =>
                new Map([...current].filter(([, state]) => state === 'pending')),
            )
        }
    }, [open])
    const run = useStableEvent((
        key: string,
        operation: () => Promise<void>,
        event: MenuSelectEvent,
        onSuccess: () => void,
    ) => {
        if (flights.current.has(key)) return
        const startedIn = session.current
        flights.current.add(key)
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
                flights.current.delete(key)
                if (mounted.current) {
                    const currentSession = session.current === startedIn
                    setStates((current) => {
                        const next = new Map(current)
                        if (failed && currentSession) next.set(key, 'error')
                        else next.delete(key)
                        return next
                    })
                    if (!failed && currentSession) onSuccess()
                }
            }
        })().catch(() => {
            // A consumer's close observer can throw too; the operation is already settled.
        })
    })
    return {
        state: { states },
        handler: {
            run,
            invalidate,
            isPending: (key: string) => flights.current.has(key),
        },
    }
}
