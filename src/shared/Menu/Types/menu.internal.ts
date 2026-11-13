import type { useMenuLogic } from '../Hooks/useMenuLogic.ts'
import type { MenuCustomizationProps, MenuProviderProps } from './menu.types.ts'

export type MenuCustomizationContextValue = MenuCustomizationProps &
    Pick<MenuProviderProps, 'menu' | 'contextMenu'>

export type MenuLogicResult = ReturnType<typeof useMenuLogic>

export interface MenuSurfaceProps {
    menu: MenuLogicResult
    level: number
}
