import { describe, expect, test } from 'bun:test'
import {
    enabledItems,
    groupMenuItems,
    matchItem,
    menuLevels,
    nextItem,
} from '../../../lib/Menu/navigation.ts'
import type { MenuItem } from '../../../shared/Menu/Types/menu.types.ts'

const items: MenuItem[] = [
    { id: 'heading', type: 'label', label: 'Actions' },
    { id: 'archive', label: 'Archive' },
    { id: 'disabled', label: 'Blocked', disabled: true },
    { id: 'divider', type: 'separator' },
    { id: 'copy', label: 'Copy' },
    { id: 'clear', label: 'Clear' },
]

function radio(id: string): MenuItem {
    return {
        id,
        type: 'radio',
        name: 'Sort order',
        label: id,
        checked: false,
        onCheckedChange() {},
    }
}

describe('menu navigation policy', () => {
    test('groups adjacent named radios without merging separate sections', () => {
        const groups = groupMenuItems([
            radio('name'),
            radio('date'),
            { id: 'separator', type: 'separator' },
            radio('size'),
        ])
        expect(groups.map((group) => [group.name, group.items.length])).toEqual(
            [
                ['Sort order', 2],
                [undefined, 1],
                ['Sort order', 1],
            ],
        )
    })
    test('skips disabled items, separators and labels consistently', () => {
        expect(enabledItems(items).map((item) => item.id)).toEqual([
            'archive',
            'copy',
            'clear',
        ])
        expect(nextItem(items, 'archive', 1, true)).toBe('copy')
        expect(nextItem(items, 'archive', -1, true)).toBe('clear')
        expect(nextItem(items, 'archive', -1, false)).toBe('archive')
        expect(nextItem([], undefined, 1, true)).toBeUndefined()
    })
    test('typeahead cycles repeated characters and matches multi-character prefixes', () => {
        expect(matchItem(items, 'archive', 'c')).toBe('copy')
        expect(matchItem(items, 'copy', 'cc')).toBe('clear')
        expect(matchItem(items, 'copy', 'co')).toBe('copy')
        expect(matchItem(items, undefined, 'b')).toBeUndefined()
    })
    test('invalidated or disabled submenu paths are discarded', () => {
        const nested: MenuItem[] = [
            { id: 'sub', type: 'submenu', label: 'More', items },
        ]
        expect(menuLevels(nested, ['sub', 'missing'])).toHaveLength(2)
        expect(
            menuLevels(
                [{ ...nested[0]!, disabled: true } as MenuItem],
                ['sub'],
            ),
        ).toHaveLength(1)
    })
})
