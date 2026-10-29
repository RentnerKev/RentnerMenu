import { useLayoutEffect } from 'react'
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

    useLayoutEffect(() => {
        if (!open || !modal || !ownerDocument) return
        return registerMenuModal(ownerDocument, {
            surfaces,
            dismiss: handleDismiss,
            focusFirst: handleFocusFirst,
        })
    }, [open, modal, ownerDocument, surfaces, handleDismiss, handleFocusFirst])

    // Surface refs can change without changing their owning ref object's identity.
    useLayoutEffect(() => {
        if (open && modal && ownerDocument) refreshMenuModal(ownerDocument)
    })
}
