'use client'

import {
    MenuCustomizationContext,
    useMenuCustomization,
} from '../Hooks/useMenuCustomization.ts'
import type { MenuProviderProps } from '../Types/menu.types.ts'

export function MenuProvider({ children, ...props }: MenuProviderProps) {
    const customization = useMenuCustomization(props)
    return (
        <MenuCustomizationContext.Provider value={customization}>
            {children}
        </MenuCustomizationContext.Provider>
    )
}
