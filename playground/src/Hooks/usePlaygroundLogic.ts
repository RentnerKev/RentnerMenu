import { useEffect, useRef, useState } from 'react'
import type { MenuItem } from '../../../src/shared/Menu/Types/menu.types.ts'
import { initialFiles, messages } from '../config/playground.config.ts'
import type {
    FileEntry,
    Locale,
    LogEntry,
    PlaygroundLogicResult,
    Settings,
} from '../Types/playground.types.ts'

export function usePlaygroundLogic(): PlaygroundLogicResult {
    const [locale, setLocale] = useState<Locale>('de')
    const [theme, setTheme] = useState<'dark' | 'light'>('dark')
    const [settings, setSettings] = useState<Settings>({
        dir: 'ltr',
        controlSize: 'md',
        side: 'bottom',
        align: 'start',
        loop: true,
        disabled: false,
    })
    const [files, setFiles] = useState<FileEntry[]>(initialFiles)
    const [selectedId, setSelectedId] = useState('design')
    const [hidden, setHidden] = useState(false)
    const [compact, setCompact] = useState(false)
    const [sort, setSort] = useState('name')
    const [controlledOpen, setControlledOpen] = useState(false)
    const [dialogContainer, setDialogContainer] =
        useState<HTMLDialogElement | null>(null)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [copyMessage, setCopyMessage] = useState('')
    const [preview, setPreview] = useState('')
    const counter = useRef(0)
    const dialog = useRef<HTMLDialogElement>(null)
    const t = messages[locale]
    const selected = files.find((file) => file.id === selectedId)
    const visibleFiles = files.toSorted((a, b) =>
        sort === 'name'
            ? a.name.localeCompare(b.name)
            : a.kind.localeCompare(b.kind),
    )
    const displayedFiles = hidden
        ? [
              ...visibleFiles,
              {
                  id: 'hidden',
                  name: '.menu.config',
                  kind: 'CONFIG',
                  size: '320 B',
                  color: 'purple',
              },
          ]
        : visibleFiles
    const code = `import { Menu, MenuProvider } from '@rentnerkev/menu'\nimport '@rentnerkev/menu/theme.css'\n\n<MenuProvider dir="${settings.dir}" controlSize="${settings.controlSize}">\n  <Menu\n    ariaLabel="${t.actions}"\n    trigger="${t.actions}"\n    side="${settings.side}" align="${settings.align}"\n    items={[\n      { id: 'open', label: '${t.open}' },\n      { id: 'delete', label: '${t.delete}', danger: true },\n    ]}\n    onAction={(id) => console.log(id)}\n  />\n</MenuProvider>`

    useEffect(() => {
        document.documentElement.lang = locale
        document.documentElement.dataset.theme = theme
        document.documentElement.style.colorScheme = theme
    }, [locale, theme])

    function log(action: string, detail: string) {
        counter.current += 1
        setLogs((previous) =>
            [{ id: counter.current, action, detail }, ...previous].slice(0, 8),
        )
    }
    function handleSetting<K extends keyof Settings>(
        key: K,
        value: Settings[K],
    ) {
        setSettings((previous) => ({ ...previous, [key]: value }))
    }
    function handleAction(id: string, fileId = selectedId) {
        const file = files.find((entry) => entry.id === fileId)
        if (id === 'open' && file) {
            setPreview(file.name)
            log(t.opened, file.name)
        } else if (id === 'duplicate' && file) {
            const entry = {
                ...file,
                id: `${file.id}-${++counter.current}`,
                name: `${file.name} (copy)`,
            }
            setFiles((previous) => [...previous, entry])
            setSelectedId(entry.id)
            log(t.copiedFile, entry.name)
        } else if (id === 'delete' && file) {
            setFiles((previous) =>
                previous.filter((entry) => entry.id !== file.id),
            )
            setSelectedId(files.find((entry) => entry.id !== file.id)?.id ?? '')
            setPreview('')
            log(t.removed, file.name)
        } else {
            log(id === 'link' ? t.link : t.export, file?.name ?? t.workspace)
            if (id === 'link')
                void handleCopy(
                    `https://example.test/workspace/${encodeURIComponent(fileId)}`,
                    false,
                )
            if (id === 'json' || id === 'text') {
                const url = URL.createObjectURL(
                    new Blob(
                        [
                            id === 'json'
                                ? JSON.stringify(file ?? {}, null, 2)
                                : (file?.name ?? ''),
                        ],
                        {
                            type:
                                id === 'json'
                                    ? 'application/json'
                                    : 'text/plain',
                        },
                    ),
                )
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = `menu-demo.${id === 'json' ? 'json' : 'txt'}`
                anchor.click()
                URL.revokeObjectURL(url)
            }
        }
    }
    function fileItems(fileId = selectedId): MenuItem[] {
        const unavailable = !files.some((file) => file.id === fileId)
        return [
            {
                type: 'label',
                id: 'file-label',
                label:
                    files.find((file) => file.id === fileId)?.name ?? t.files,
            },
            {
                id: 'open',
                label: t.open,
                icon: '↗',
                shortcut: '↵',
                disabled: unavailable,
            },
            {
                id: 'duplicate',
                label: t.duplicate,
                icon: '⧉',
                disabled: unavailable,
            },
            {
                id: 'share',
                type: 'submenu',
                label: t.share,
                icon: '↗',
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
                icon: '×',
                danger: true,
                disabled: unavailable,
            },
        ]
    }
    const preferences: MenuItem[] = [
        { type: 'label', id: 'view-label', label: t.options },
        {
            type: 'checkbox',
            id: 'hidden',
            label: t.hidden,
            checked: hidden,
            closeOnSelect: false,
            onCheckedChange: (value) => {
                setHidden(value)
                log(t.changed, t.hidden)
            },
        },
        {
            type: 'checkbox',
            id: 'compact',
            label: t.compact,
            checked: compact,
            closeOnSelect: false,
            onCheckedChange: (value) => {
                setCompact(value)
                log(t.changed, t.compact)
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
                log(t.changed, t.name)
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
                log(t.changed, t.type)
            },
        },
    ]
    async function handleCopy(value = code, report = true) {
        try {
            await navigator.clipboard.writeText(value)
            if (report) setCopyMessage(t.copied)
        } catch {
            setCopyMessage(t.copyError)
        }
    }
    function handleCreate() {
        const entry = {
            id: `new-${++counter.current}`,
            name: `Untitled-${counter.current}.md`,
            kind: 'MD',
            size: '0 B',
            color: 'purple',
        }
        setFiles((previous) => [...previous, entry])
        setSelectedId(entry.id)
        log(t.created, entry.name)
    }
    function handleReset() {
        setFiles(initialFiles)
        setSelectedId('design')
        setPreview('')
        log(t.restored, t.workspace)
    }
    function handleSelect(id: string) {
        setSelectedId(id)
    }
    function handleDialog() {
        setDialogContainer(dialog.current)
        dialog.current?.showModal()
    }

    return {
        state: {
            locale,
            theme,
            settings,
            t,
            selected,
            displayedFiles,
            compact,
            controlledOpen,
            dialogContainer,
            logs,
            copyMessage,
            preview,
            code,
            preferences,
            items: fileItems(),
        },
        handler: {
            handleSetting,
            handleAction,
            fileItems,
            handleCopy,
            handleCreate,
            handleReset,
            handleSelect,
            handleDialog,
            handleCloseDialog: () => dialog.current?.close(),
            handleToggleTheme: () =>
                setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
            handleClear: () => setLogs([]),
            handleToggleControlled: () => setControlledOpen((value) => !value),
        },
        setter: { setLocale, setControlledOpen },
        refs: { dialog },
    }
}
