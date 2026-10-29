import { useCallback, useEffect, useRef } from 'react'
import type { MenuHoverOptions } from '../Types/menu.hover.ts'
import { useStableEvent } from './useStableEvent.ts'

export function useMenuHover(options: MenuHoverOptions) {
    const openedByHover = useRef(false)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const cancel = useCallback(() => {
        clearTimeout(timer.current)
        timer.current = undefined
    }, [])
    const takeControl = useCallback(() => {
        cancel()
        openedByHover.current = false
    }, [cancel])
    const enter = useStableEvent(() => {
        if (!options.enabled || options.disabled) return
        cancel()
        if (options.open) return
        const open = () => {
            timer.current = undefined
            openedByHover.current = true
            options.onOpen()
        }
        if (options.openDelayMs <= 0) open()
        else timer.current = setTimeout(open, options.openDelayMs)
    })
    const leave = useStableEvent(() => {
        cancel()
        if (!options.open || !openedByHover.current) return
        timer.current = setTimeout(
            () => {
                timer.current = undefined
                options.onClose()
            },
            Math.max(0, options.closeDelayMs),
        )
    })

    useEffect(() => {
        if (!options.enabled || options.disabled || !options.open) takeControl()
    }, [options.enabled, options.disabled, options.open, takeControl])
    useEffect(() => cancel, [cancel])

    return {
        refs: { openedByHover },
        handler: { enter, leave, takeControl, cancel },
    }
}
