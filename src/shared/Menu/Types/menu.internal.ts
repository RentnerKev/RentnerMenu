import type { useMenuLogic } from '../Hooks/useMenuLogic.ts'

export type MenuLogicResult = ReturnType<typeof useMenuLogic>

export interface MenuSurfaceProps {
    menu: MenuLogicResult
    level: number
}
