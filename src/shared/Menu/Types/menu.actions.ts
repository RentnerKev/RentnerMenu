import type { MenuCommonProps } from './menu.types.ts'

export type MenuAsyncActionState = 'pending' | 'error'

export interface MenuAsyncActionOptions {
    open: boolean
    onActionError: MenuCommonProps['onActionError']
}
