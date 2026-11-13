import type {
    MenuItem,
    MenuStyle,
} from '../../../src/shared/Menu/Types/menu.types.ts'

export interface ContextMenuRegressionLogicResult {
    state: {
        controlledOpen: boolean
        clicks: number
        result: string
        items: MenuItem[]
        contentStyle: MenuStyle
    }
    handler: {
        handleButton: () => void
        handleAction: (id: string) => void
    }
    setter: { setControlledOpen: (open: boolean) => void }
}
