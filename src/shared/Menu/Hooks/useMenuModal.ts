import { useLayoutEffect, useRef } from 'react'
import { refreshMenuModal, registerMenuModal } from '../../../lib/Menu/modal.ts'
import type { MenuModalOptions } from '../Types/menu.modal.ts'
import { useStableEvent } from './useStableEvent.ts'

export function useMenuModal({
    open,
    modal,
    ownerDocument,
    surfaces,
    dismiss,
    focusFirst,
}: MenuModalOptions) {
    const handleDismiss = useStableEvent(dismiss)
    const handleFocusFirst = useStableEvent(focusFirst)
    const lastSurfaces = useRef<HTMLDivElement[]>([])

    useLayoutEffect(() => {
        if (!open || !modal || !ownerDocument) {
            lastSurfaces.current = []
            return
        }
        lastSurfaces.current = Array.from(surfaces.current.values())
        return registerMenuModal(ownerDocument, {
            surfaces,
            dismiss: handleDismiss,
            focusFirst: handleFocusFirst,
        })
    }, [open, modal, ownerDocument, surfaces, handleDismiss, handleFocusFirst])

    // Surface refs can change without changing their owning ref object's identity.
    useLayoutEffect(() => {
        if (!open || !modal || !ownerDocument) return
        const current = surfaces.current
        const previous = lastSurfaces.current
        let changed = current.size !== previous.length
        if (!changed) {
            let index = 0
            for (const element of current.values()) {
                if (previous[index++] !== element) {
                    changed = true
                    break
                }
            }
        }
        if (changed) {
            lastSurfaces.current = Array.from(current.values())
            refreshMenuModal(ownerDocument)
        }
    })
}
