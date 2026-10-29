import type { MenuItem } from '../../shared/Menu/Types/menu.types.ts'

export type InteractiveItem = Exclude<MenuItem, { type: 'separator' | 'label' }>

export function isInteractive(item: MenuItem): item is InteractiveItem {
    return item.type !== 'separator' && item.type !== 'label'
}

/** Disabled items are skipped consistently for arrows, Home/End and typeahead. */
export function enabledItems(items: readonly MenuItem[]): InteractiveItem[] {
    return items.filter(
        (item): item is InteractiveItem =>
            isInteractive(item) && !item.disabled,
    )
}

export function createMenuIndex(items: readonly MenuItem[]) {
    const byId = new Map<string, MenuItem>()
    const enabled: InteractiveItem[] = []
    const enabledPositions = new Map<string, number>()
    const normalizedLabels: string[] = []
    for (const item of items) {
        // Match find/findIndex semantics even when consumer IDs are duplicated.
        if (!byId.has(item.id)) byId.set(item.id, item)
        if (!isInteractive(item) || item.disabled) continue
        if (!enabledPositions.has(item.id))
            enabledPositions.set(item.id, enabled.length)
        enabled.push(item)
        normalizedLabels.push(item.label.trim().toLocaleLowerCase())
    }
    return { byId, enabled, enabledPositions, normalizedLabels }
}

/** Per-menu cache; immutable source arrays can be reclaimed when consumers replace them. */
export function createMenuIndexer() {
    const cache = new WeakMap<
        readonly MenuItem[],
        ReturnType<typeof createMenuIndex>
    >()
    return (items: readonly MenuItem[]) => {
        let index = cache.get(items)
        if (!index) {
            index = createMenuIndex(items)
            cache.set(items, index)
        }
        return index
    }
}

export function nextIndexedItem(
    index: ReturnType<typeof createMenuIndex>,
    current: string | undefined,
    delta: number,
    loop: boolean,
): string | undefined {
    const { enabled, enabledPositions } = index
    if (!enabled.length) return undefined
    const position =
        current === undefined ? -1 : (enabledPositions.get(current) ?? -1)
    const next =
        position < 0 ? (delta > 0 ? 0 : enabled.length - 1) : position + delta
    return enabled[
        loop
            ? (next + enabled.length) % enabled.length
            : Math.max(0, Math.min(next, enabled.length - 1))
    ]?.id
}

export function nextItem(
    items: readonly MenuItem[],
    current: string | undefined,
    delta: number,
    loop: boolean,
): string | undefined {
    return nextIndexedItem(createMenuIndex(items), current, delta, loop)
}

export function matchIndexedItem(
    index: ReturnType<typeof createMenuIndex>,
    current: string | undefined,
    query: string,
): string | undefined {
    const { enabled, enabledPositions, normalizedLabels } = index
    const start =
        current === undefined ? -1 : (enabledPositions.get(current) ?? -1)
    const letters = Array.from(query)
    const search = letters.every((letter) => letter === letters[0])
        ? letters[0]!
        : query
    // Preserve the existing empty-menu and repeated Unicode-character behavior.
    if (!enabled.length) return undefined
    const normalizedSearch = search.toLocaleLowerCase()
    for (let offset = 1; offset <= enabled.length; offset++) {
        const position = (start + offset) % enabled.length
        if (normalizedLabels[position]?.startsWith(normalizedSearch))
            return enabled[position]?.id
    }
    return undefined
}

export function matchItem(
    items: readonly MenuItem[],
    current: string | undefined,
    query: string,
): string | undefined {
    return matchIndexedItem(createMenuIndex(items), current, query)
}

export function menuLevels(
    items: readonly MenuItem[],
    path: readonly string[],
): readonly (readonly MenuItem[])[] {
    const levels: (readonly MenuItem[])[] = [items]
    for (const id of path) {
        const parent = levels[levels.length - 1]?.find((item) => item.id === id)
        if (parent?.type !== 'submenu' || parent.disabled) break
        levels.push(parent.items)
    }
    return levels
}

/** Adjacent radio items with the same name form one accessible group. */
export function groupMenuItems(items: readonly MenuItem[]) {
    const groups: { id: string; name?: string; items: MenuItem[] }[] = []
    for (const item of items) {
        const previous = groups.at(-1)
        if (item.type === 'radio' && previous?.name === item.name)
            previous.items.push(item)
        else
            groups.push({
                id: item.id,
                name: item.type === 'radio' ? item.name : undefined,
                items: [item],
            })
    }
    return groups
}
