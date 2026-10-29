import { describe, expect, test } from 'bun:test'
import {
    createMenuIndex,
    enabledItems,
    groupMenuItems,
    matchIndexedItem,
    matchItem,
    menuLevels,
    nextIndexedItem,
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
    test('indexes mixed readonly items while keeping disabled and structural lookup entries', () => {
        const source: readonly MenuItem[] = Object.freeze([
            ...items,
            { id: '', label: ' Empty' },
            {
                id: 'check',
                type: 'checkbox',
                label: 'Checked',
                checked: false,
                onCheckedChange() {},
            },
            radio('radio'),
            { id: 'sub', type: 'submenu', label: 'More', items: [] },
        ])
        const index = createMenuIndex(source)
        expect(index.byId.get('heading')).toBe(source[0])
        expect(index.byId.get('disabled')).toBe(source[2])
        expect(index.byId.get('divider')).toBe(source[3])
        expect(index.byId.get('')).toBe(source[6])
        expect(index.enabled.map((item) => item.id)).toEqual([
            'archive',
            'copy',
            'clear',
            '',
            'check',
            'radio',
            'sub',
        ])
        expect(index.enabledPositions.get('')).toBe(3)
        expect(index.enabledPositions.has('disabled')).toBe(false)
        expect(index.normalizedLabels).toEqual([
            'archive',
            'copy',
            'clear',
            'empty',
            'checked',
            'radio',
            'more',
        ])
        expect(source).toHaveLength(10)
    })

    test('indexed arrows preserve bounds, wrapping and empty-string IDs', () => {
        const index = createMenuIndex([
            { id: '', label: 'First' },
            { id: 'disabled', label: 'Disabled', disabled: true },
            { id: 'last', label: 'Last' },
        ])
        expect(nextIndexedItem(index, undefined, 1, true)).toBe('')
        expect(nextIndexedItem(index, undefined, -1, true)).toBe('last')
        expect(nextIndexedItem(index, '', 1, true)).toBe('last')
        expect(nextIndexedItem(index, '', -1, true)).toBe('last')
        expect(nextIndexedItem(index, '', -1, false)).toBe('')
        expect(nextIndexedItem(index, 'last', 1, false)).toBe('last')
        expect(nextIndexedItem(index, 'disabled', 1, true)).toBe('')
        expect(
            nextIndexedItem(createMenuIndex([]), '', 1, true),
        ).toBeUndefined()
    })

    test('cached typeahead preserves case, trimming, Unicode and cycling semantics', () => {
        const source: readonly MenuItem[] = [
            { id: '', label: '  Äpfel ' },
            { id: 'disabled', label: 'Ärger', disabled: true },
            { id: 'second', label: 'Ähre' },
            { id: 'astral', label: '😀 First' },
            { id: 'astral-second', label: '😀 Second' },
        ]
        const index = createMenuIndex(source)
        expect(matchIndexedItem(index, undefined, 'Ä')).toBe('')
        expect(matchIndexedItem(index, '', 'ää')).toBe('second')
        expect(matchIndexedItem(index, 'second', 'ÄP')).toBe('')
        expect(matchIndexedItem(index, 'astral', '😀😀')).toBe('astral-second')
        expect(matchIndexedItem(index, 'astral-second', '😀 F')).toBe('astral')
        expect(matchIndexedItem(index, undefined, 'är')).toBeUndefined()
        expect(
            matchIndexedItem(createMenuIndex([]), undefined, 'a'),
        ).toBeUndefined()
        for (const current of [undefined, '', 'second', 'astral', 'missing']) {
            for (const query of ['ä', 'ää', 'ÄP', '😀😀', '😀 F', 'missing']) {
                expect(matchIndexedItem(index, current, query)).toBe(
                    matchItem(source, current, query),
                )
            }
        }
    })

    test('submenu levels retain immutable source arrays and item identities', () => {
        const leaf: readonly MenuItem[] = Object.freeze([
            { id: '', label: 'Leaf' },
        ])
        const middle: readonly MenuItem[] = Object.freeze([
            { id: '', type: 'submenu', label: 'Empty ID submenu', items: leaf },
        ])
        const root: readonly MenuItem[] = Object.freeze([
            { id: 'more', type: 'submenu', label: 'More', items: middle },
        ])
        const levels = menuLevels(root, ['more', '', 'missing'])
        expect(levels).toHaveLength(3)
        expect(levels[0]).toBe(root)
        expect(levels[1]).toBe(middle)
        expect(levels[2]).toBe(leaf)
        expect(menuLevels(root, ['more', ''])[1]).toBe(middle)
        expect(createMenuIndex(levels[2]!).byId.get('')).toBe(leaf[0])
    })
})
