import { expect, test } from 'bun:test'
import {
    insidePointerCorridor,
    submenuCorridor,
} from '../../../lib/Menu/pointer.ts'

test('diagonal submenu travel is protected only within the right-facing corridor', () => {
    const corridor = submenuCorridor(
        { x: 100, y: 40 },
        { left: 200, right: 360, top: 10, bottom: 160 },
        'right',
    )
    expect(insidePointerCorridor({ x: 160, y: 85 }, corridor)).toBe(true)
    expect(insidePointerCorridor({ x: 199, y: 155 }, corridor)).toBe(true)
    expect(insidePointerCorridor({ x: 110, y: 140 }, corridor)).toBe(false)
    expect(insidePointerCorridor({ x: 85, y: 40 }, corridor)).toBe(false)
    expect(insidePointerCorridor({ x: 210, y: 80 }, corridor)).toBe(false)
})

test('RTL and collision-flipped submenus protect the left-facing route', () => {
    const corridor = submenuCorridor(
        { x: 300, y: 40 },
        { left: 20, right: 200, top: 10, bottom: 160 },
        'left',
    )
    expect(insidePointerCorridor({ x: 240, y: 85 }, corridor)).toBe(true)
    expect(insidePointerCorridor({ x: 201, y: 155 }, corridor)).toBe(true)
    expect(insidePointerCorridor({ x: 290, y: 140 }, corridor)).toBe(false)
    expect(insidePointerCorridor({ x: 315, y: 40 }, corridor)).toBe(false)
})

test('overlapping edges do not create an unbounded degenerate corridor', () => {
    const corridor = submenuCorridor(
        { x: 108, y: 40 },
        { left: 100, right: 260, top: 10, bottom: 160 },
        'right',
    )
    expect(insidePointerCorridor({ x: 100, y: 50 }, corridor)).toBe(false)
    expect(insidePointerCorridor({ x: 100, y: 1000 }, corridor)).toBe(false)
})
