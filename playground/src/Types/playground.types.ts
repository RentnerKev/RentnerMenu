import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { MenuItem } from '../../../src/shared/Menu/Types/menu.types.ts'
import type { messages } from '../config/playground.config.ts'

export interface FileEntry {
    id: string
    name: string
    kind: string
}

export interface PlaygroundLogicResult {
    state: {
        t: typeof messages.de
        selectedId: string
        displayedFiles: FileEntry[]
        disabled: boolean
        controlledOpen: boolean
        dialogContainer: HTMLDialogElement | null
        result: string
        preferences: MenuItem[]
        extensionItems: MenuItem[]
        outsideCount: number
        items: MenuItem[]
    }
    handler: {
        handleAction: (id: string, fileId?: string) => void
        fileItems: (fileId?: string) => MenuItem[]
        handleReset: () => void
        handleSelect: (id: string) => void
        handleDialog: () => void
        handleCloseDialog: () => void
        handleToggleControlled: () => void
        handleOutsideAction: () => void
    }
    setter: {
        setDisabled: Dispatch<SetStateAction<boolean>>
        setControlledOpen: Dispatch<SetStateAction<boolean>>
    }
    refs: { dialog: RefObject<HTMLDialogElement | null> }
}
