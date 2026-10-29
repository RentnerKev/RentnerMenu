import type { RefObject } from 'react'

export interface MenuModalOptions {
    open: boolean
    modal: boolean
    ownerDocument: Document | undefined
    surfaces: RefObject<Map<number, HTMLDivElement>>
    dismiss: () => void
    focusFirst: () => void
}
