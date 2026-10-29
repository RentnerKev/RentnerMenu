export interface MenuHoverOptions {
    enabled: boolean
    disabled: boolean
    open: boolean
    openDelayMs: number
    closeDelayMs: number
    onOpen: () => void
    onClose: () => void
}
