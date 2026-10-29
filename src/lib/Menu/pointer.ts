interface Point {
    x: number
    y: number
}

export interface PointerCorridor {
    origin: Point
    near: Point
    far: Point
}

/** Protect the diagonal route from a submenu trigger to the submenu's near edge. */
export function submenuCorridor(
    origin: Point,
    submenu: { left: number; right: number; top: number; bottom: number },
    direction: 'left' | 'right',
): PointerCorridor {
    const edge = direction === 'right' ? submenu.left : submenu.right
    return {
        origin: { x: origin.x + (direction === 'right' ? -8 : 8), y: origin.y },
        near: { x: edge, y: submenu.top - 8 },
        far: { x: edge, y: submenu.bottom + 8 },
    }
}

export function insidePointerCorridor(point: Point, corridor: PointerCorridor) {
    const { origin: a, near: b, far: c } = corridor
    if (a.x === b.x) return false
    const cross = (start: Point, end: Point) =>
        (point.x - end.x) * (start.y - end.y) -
        (start.x - end.x) * (point.y - end.y)
    const first = cross(a, b)
    const second = cross(b, c)
    const third = cross(c, a)
    const negative = first < 0 || second < 0 || third < 0
    const positive = first > 0 || second > 0 || third > 0
    return !(negative && positive)
}
