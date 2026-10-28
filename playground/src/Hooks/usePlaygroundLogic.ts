import { useRef, useState } from 'react'
import type { MenuItem } from '../../../src/shared/Menu/Types/menu.types.ts'
import { initialFiles, messages } from '../config/playground.config.ts'
import type {
    FileEntry,
    PlaygroundLogicResult,
} from '../Types/playground.types.ts'

export function usePlaygroundLogic(): PlaygroundLogicResult {
    const t = messages.de
    const [files, setFiles] = useState<FileEntry[]>(initialFiles)
    const [selectedId, setSelectedId] = useState('design')
    const [hidden, setHidden] = useState(false)
    const [sort, setSort] = useState('name')
    const [disabled, setDisabled] = useState(false)
    const [controlledOpen, setControlledOpen] = useState(false)
    const [dialogContainer, setDialogContainer] =
        useState<HTMLDialogElement | null>(null)
    const [result, setResult] = useState(t.empty as string)
    const counter = useRef(0)
    const dialog = useRef<HTMLDialogElement>(null)
    const visibleFiles = files.toSorted((a, b) =>
        sort === 'name'
            ? a.name.localeCompare(b.name)
            : a.kind.localeCompare(b.kind),
    )
    const displayedFiles = hidden
        ? [
              ...visibleFiles,
              { id: 'hidden', name: '.menu.config', kind: 'CONFIG' },
          ]
        : visibleFiles

    function handleAction(id: string, fileId = selectedId) {
        const file = files.find((entry) => entry.id === fileId)
        if (id === 'duplicate' && file) {
            const entry = {
                ...file,
                id: file.id + '-' + ++counter.current,
                name: file.name + ' (Kopie)',
            }
            setFiles((previous) => [...previous, entry])
            setSelectedId(entry.id)
        } else if (id === 'delete' && file) {
            setFiles((previous) =>
                previous.filter((entry) => entry.id !== file.id),
            )
            setSelectedId(files.find((entry) => entry.id !== file.id)?.id ?? '')
        }
        const action = t.actionNames[id as keyof typeof t.actionNames] ?? id
        setResult(action + (file ? ': ' + file.name : ''))
    }
    function fileItems(fileId = selectedId): MenuItem[] {
        const unavailable = !files.some((file) => file.id === fileId)
        return [
            { id: 'open', label: t.open, disabled: unavailable },
            { id: 'duplicate', label: t.duplicate, disabled: unavailable },
            {
                id: 'share',
                type: 'submenu',
                label: t.share,
                items: [
                    { id: 'link', label: t.link },
                    {
                        id: 'export',
                        type: 'submenu',
                        label: t.export,
                        items: [
                            { id: 'json', label: t.json },
                            {
                                id: 'formats',
                                type: 'submenu',
                                label: t.formats,
                                items: [{ id: 'text', label: t.text }],
                            },
                        ],
                    },
                ],
            },
            { id: 'print', label: t.unavailable, disabled: true },
            { id: 'sep', type: 'separator' },
            {
                id: 'delete',
                label: t.delete,
                danger: true,
                disabled: unavailable,
            },
        ]
    }
    const preferences: MenuItem[] = [
        {
            type: 'checkbox',
            id: 'hidden',
            label: t.hidden,
            checked: hidden,
            closeOnSelect: false,
            onCheckedChange: (value) => {
                setHidden(value)
                setResult(t.hidden + ': ' + (value ? t.on : t.off))
            },
        },
        { type: 'separator', id: 'view-sep' },
        { type: 'label', id: 'sort-label', label: t.sort },
        {
            type: 'radio',
            id: 'name',
            name: 'sort',
            label: t.name,
            checked: sort === 'name',
            onCheckedChange: () => {
                setSort('name')
                setResult(t.sort + ': ' + t.name)
            },
        },
        {
            type: 'radio',
            id: 'type',
            name: 'sort',
            label: t.type,
            checked: sort === 'type',
            onCheckedChange: () => {
                setSort('type')
                setResult(t.sort + ': ' + t.type)
            },
        },
    ]
    function handleReset() {
        setFiles(initialFiles)
        setSelectedId('design')
        setHidden(false)
        setSort('name')
        setResult(t.empty)
    }
    function handleDialog() {
        setDialogContainer(dialog.current)
        dialog.current?.showModal()
    }

    return {
        state: {
            t,
            selectedId,
            displayedFiles,
            disabled,
            controlledOpen,
            dialogContainer,
            result,
            preferences,
            items: fileItems(),
        },
        handler: {
            handleAction,
            fileItems,
            handleReset,
            handleSelect: setSelectedId,
            handleDialog,
            handleCloseDialog: () => dialog.current?.close(),
            handleToggleControlled: () => setControlledOpen((value) => !value),
        },
        setter: { setDisabled, setControlledOpen },
        refs: { dialog },
    }
}
