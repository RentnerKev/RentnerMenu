import { expect, test } from 'bun:test'
import { positionMenu } from '../../../lib/Menu/position.ts'

test('flips vertically near viewport edge and clamps horizontal collision', () => {
    expect(
        positionMenu(
            {
                left: 270,
                top: 170,
                right: 300,
                bottom: 195,
                width: 30,
                height: 25,
            },
            120,
            100,
            { width: 320, height: 200 },
            'bottom',
            'start',
            6,
            8,
            'ltr',
        ),
    ).toEqual({
        left: 192,
        top: 64,
        side: 'top',
        maxWidth: 304,
        maxHeight: 184,
    })
})

test('honors RTL start alignment and visual viewport offsets', () => {
    const result = positionMenu(
        { left: 100, top: 50, right: 180, bottom: 80, width: 80, height: 30 },
        120,
        100,
        { width: 320, height: 200, left: 20, top: 10 },
        'bottom',
        'start',
        4,
        8,
        'rtl',
    )
    expect(result.left).toBe(60)
    expect(result.top).toBe(84)
    expect(result.maxHeight).toBe(184)
})
