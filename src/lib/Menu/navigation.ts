import type { MenuItem } from '../../shared/Menu/Types/menu.types.ts'

export type InteractiveItem = Exclude<MenuItem, { type: 'separator' | 'label' }>

export function isInteractive(item: MenuItem): item is InteractiveItem {
    return item.type !== 'separator' && item.type !== 'label'
}

/** Disabled items are skipped consistently for arrows, Home/End and typeahead. */
export function enabledItems(items: readonly MenuItem[]): InteractiveItem[] {
    return items.filter(isInteractive).filter((item) => !item.disabled)
}

export function nextItem(
    items: readonly MenuItem[],
    current: string | undefined,
    delta: number,
    loop: boolean,
): string | undefined {
    const enabled = enabledItems(items)
    if (!enabled.length) return undefined
    const index = enabled.findIndex((item) => item.id === current)
    const next =
        index < 0 ? (delta > 0 ? 0 : enabled.length - 1) : index + delta
    return enabled[
        loop
            ? (next + enabled.length) % enabled.length
            : Math.max(0, Math.min(next, enabled.length - 1))
    ]?.id
}

export function matchItem(
    items: readonly MenuItem[],
    current: string | undefined,
    query: string,
): string | undefined {
    const enabled = enabledItems(items)
    const start = enabled.findIndex((item) => item.id === current)
    const letters = Array.from(query)
    const search = letters.every((letter) => letter === letters[0])
        ? letters[0]!
        : query
    for (let offset = 1; offset <= enabled.length; offset++) {
        const item = enabled[(start + offset) % enabled.length]
        if (
            item?.label
                .trim()
                .toLocaleLowerCase()
                .startsWith(search.toLocaleLowerCase())
        )
            return item.id
    }
    return undefined
}

export function menuLevels(
    items: readonly MenuItem[],
    path: readonly string[],
): readonly MenuItem[][] {
    const levels: MenuItem[][] = [[...items]]
    for (const id of path) {
        const parent = levels[levels.length - 1]?.find((item) => item.id === id)
        if (parent?.type !== 'submenu' || parent.disabled) break
        levels.push([...parent.items])
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
