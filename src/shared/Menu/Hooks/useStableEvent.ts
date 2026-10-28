import { useCallback, useLayoutEffect, useRef } from 'react'

/** Stable event identity with the latest committed callback; supports React 19.0. */
export function useStableEvent<Args extends unknown[], Result>(
    callback: (...args: Args) => Result,
): (...args: Args) => Result {
    const callbackRef = useRef(callback)
    useLayoutEffect(() => {
        callbackRef.current = callback
    }, [callback])
    return useCallback((...args: Args) => callbackRef.current(...args), [])
}
