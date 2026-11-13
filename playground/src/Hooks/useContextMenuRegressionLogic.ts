import { useState } from 'react'
import type {
    MenuItem,
    MenuStyle,
} from '../../../src/shared/Menu/Types/menu.types.ts'
import type { ContextMenuRegressionLogicResult } from '../Types/context-menu-regression.types.ts'

export function useContextMenuRegressionLogic(): ContextMenuRegressionLogicResult {
    const [controlledOpen, setControlledOpen] = useState(false)
    const [clicks, setClicks] = useState(0)
    const [checked, setChecked] = useState(true)
    const [result, setResult] = useState('Keine Kontextaktion')
    const items: MenuItem[] = [
        { id: 'open', label: 'Kontext öffnen', icon: '↗' },
        {
            id: 'checked',
            type: 'checkbox',
            label: 'Kontextauswahl',
            icon: '◆',
            checked,
            closeOnSelect: false,
            onCheckedChange: setChecked,
        },
        {
            id: 'share',
            type: 'submenu',
            label: 'Kontext teilen',
            icon: '↗',
            items: [{ id: 'copy', label: 'Kontextlink kopieren' }],
        },
    ]
    const contentStyle: MenuStyle = {
        '--rentner-menu-content-padding': '10px',
        '--rentner-menu-content-radius': '18px',
        '--rentner-menu-content-border-width': '3px',
        '--rentner-menu-item-padding-x': '14px',
        '--rentner-menu-item-padding-y': '9px',
        '--rentner-menu-item-radius': '11px',
        '--rentner-menu-item-gap': '12px',
    }

    return {
        state: { controlledOpen, clicks, result, items, contentStyle },
        handler: {
            handleButton: () => setClicks((value) => value + 1),
            handleAction: (id) => setResult('Kontextaktion: ' + id),
        },
        setter: { setControlledOpen },
    }
}
