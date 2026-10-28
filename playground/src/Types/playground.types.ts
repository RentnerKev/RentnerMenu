import type {
    MenuAlign,
    MenuDirection,
    MenuSide,
} from '../../../src/shared/Menu/Types/menu.types.ts'
import type { MenuItem } from '../../../src/shared/Menu/Types/menu.types.ts'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { messages } from '../config/playground.config.ts'

export type Locale = 'de' | 'en'
export type Settings = {
    dir: MenuDirection
    controlSize: 'sm' | 'md' | 'lg'
    side: MenuSide
    align: MenuAlign
    loop: boolean
    disabled: boolean
}
export type FileEntry = {
    id: string
    name: string
    kind: string
    size: string
    color: string
}
export type LogEntry = { id: number; action: string; detail: string }

export interface PlaygroundLogicResult {
    state: {
        locale: Locale
        theme: 'dark' | 'light'
        settings: Settings
        t: (typeof messages)[Locale]
        selected: FileEntry | undefined
        displayedFiles: FileEntry[]
        compact: boolean
        controlledOpen: boolean
        dialogContainer: HTMLDialogElement | null
        logs: LogEntry[]
        copyMessage: string
        preview: string
        code: string
        preferences: MenuItem[]
        items: MenuItem[]
    }
    handler: {
        handleSetting: <K extends keyof Settings>(
            key: K,
            value: Settings[K],
        ) => void
        handleAction: (id: string, fileId?: string) => void
        fileItems: (fileId?: string) => MenuItem[]
        handleCopy: (value?: string, report?: boolean) => Promise<void>
        handleCreate: () => void
        handleReset: () => void
        handleSelect: (id: string) => void
        handleDialog: () => void
        handleCloseDialog: () => void
        handleToggleTheme: () => void
        handleClear: () => void
        handleToggleControlled: () => void
    }
    setter: {
        setLocale: Dispatch<SetStateAction<Locale>>
        setControlledOpen: Dispatch<SetStateAction<boolean>>
    }
    refs: { dialog: RefObject<HTMLDialogElement | null> }
}
