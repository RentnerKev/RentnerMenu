import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.title.startsWith('long press'))
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
    await page.goto('/')
    await page.getByText('Kontextmenü-Tests', { exact: true }).click()
    // Leave space for collision-free assertions and native scrolling to each target.
    await page.evaluate(() => {
        document.body.style.paddingBottom = '800px'
    })
    await page
        .getByRole('group', { name: 'Kontextziel A', exact: true })
        .evaluate((element) => element.scrollIntoView({ block: 'start' }))
})

test('same-target primary clicks dismiss and preserve descendant action and focus', async ({
    page,
}) => {
    const target = page.getByRole('group', {
        name: 'Kontextziel A',
        exact: true,
    })
    const button = page.getByRole('button', {
        name: 'Zielaktion A',
        exact: true,
    })
    await target.click({ button: 'right', position: { x: 12, y: 12 } })
    await expect(
        page.getByRole('menu', { name: 'Kontext A', exact: true }),
    ).toBeVisible()
    await button.click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(
        page.getByRole('status', { name: 'Zielaktionen', exact: true }),
    ).toHaveText('Zielaktionen: 1')
    // Text inputs provide a native click-focus destination in all three browsers.
    await target.click({ button: 'right', position: { x: 12, y: 12 } })
    const input = page.getByRole('textbox', {
        name: 'Kontextfeld A',
        exact: true,
    })
    await input.click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(input).toBeFocused()
    await target.click({ button: 'right', position: { x: 12, y: 12 } })
    await target.click({ position: { x: 12, y: 12 } })
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(
        page.getByRole('status', { name: 'Zielaktionen', exact: true }),
    ).toHaveText('Zielaktionen: 1')
})

test('controlled and uncontrolled targets switch on right click and dismiss on another target action', async ({
    page,
}) => {
    const a = page.getByRole('group', { name: 'Kontextziel A', exact: true })
    const b = page.getByRole('group', { name: 'Kontextziel B', exact: true })
    const controlled = page.getByRole('status', {
        name: 'Gesteuerter Kontextzustand',
    })
    await a.click({ button: 'right', position: { x: 12, y: 12 } })
    await b.click({ button: 'right', position: { x: 12, y: 12 } })
    await expect(page.getByRole('menu')).toHaveCount(1)
    await expect(
        page.getByRole('menu', { name: 'Kontext B', exact: true }),
    ).toBeVisible()
    await expect(controlled).toHaveText('offen')
    await a.click({ button: 'right', position: { x: 12, y: 12 } })
    await expect(page.getByRole('menu')).toHaveCount(1)
    await expect(
        page.getByRole('menu', { name: 'Kontext A', exact: true }),
    ).toBeVisible()
    await expect(controlled).toHaveText('geschlossen')
    await page
        .getByRole('button', { name: 'Zielaktion B', exact: true })
        .click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(a).not.toBeFocused()
    await expect(
        page.getByRole('status', { name: 'Zielaktionen', exact: true }),
    ).toHaveText('Zielaktionen: 1')
})

test('embedded menu opens on the dismissing click and keeps shared dropdown alignment', async ({
    page,
}) => {
    const target = page.getByRole('group', {
        name: 'Kontextziel A',
        exact: true,
    })
    const trigger = page.getByRole('button', {
        name: 'Eingebettetes Menü',
        exact: true,
    })
    await target.click({ button: 'right', position: { x: 12, y: 12 } })
    await trigger.click()
    await expect(page.getByRole('menu')).toHaveCount(1)
    const menu = page.getByRole('menu', {
        name: 'Eingebettetes Menü',
        exact: true,
    })
    await expect(menu).toBeVisible()
    const anchor = (await trigger.boundingBox())!
    await expect
        .poll(async () => {
            const bounds = (await menu.boundingBox())!
            return Math.abs(bounds.x + bounds.width - anchor.x - anchor.width)
        })
        .toBeLessThan(1)
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
})

test('context submenu selection closes the tree and Escape and Tab restore native focus paths', async ({
    page,
}) => {
    const target = page.getByRole('group', {
        name: 'Kontextziel B',
        exact: true,
    })
    await target.focus()
    await page.keyboard.press('Shift+F10')
    const parent = page.getByRole('menuitem', {
        name: 'Kontext teilen',
        exact: true,
    })
    await parent.focus()
    await page.keyboard.press('ArrowRight')
    const child = page.getByRole('menuitem', {
        name: 'Kontextlink kopieren',
        exact: true,
    })
    await expect(child).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(parent).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await child.click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(
        page.getByRole('status', { name: 'Kontextergebnis' }),
    ).toHaveText('Kontextaktion: copy')
    await expect(target).toBeFocused()
    await page.keyboard.press('Shift+F10')
    await page.keyboard.press('Escape')
    await expect(target).toBeFocused()
    await page.keyboard.press('Shift+F10')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(
        page.getByRole('button', { name: 'Zielaktion B', exact: true }),
    ).toBeFocused()
})

for (const rtl of [false, true]) {
    test(`pointer context starts ${rtl ? 'left in RTL' : 'right in LTR'} while keyboard context anchors below the target`, async ({
        page,
    }) => {
        const target = page.getByRole('group', {
            name: rtl ? 'Kontextziel RTL' : 'Kontextziel A',
            exact: true,
        })
        await target.evaluate((element) =>
            element.scrollIntoView({ block: 'start' }),
        )
        const anchor = (await target.boundingBox())!
        const x = Math.round(anchor.x + anchor.width / 2)
        const y = Math.round(anchor.y + 16)
        await page.mouse.click(x, y, { button: 'right' })
        const menu = page.getByRole('menu', {
            name: rtl ? 'Kontext RTL' : 'Kontext A',
            exact: true,
        })
        await expect(menu).toBeVisible()
        await expect
            .poll(async () => {
                const bounds = (await menu.boundingBox())!
                return Math.abs(
                    (rtl ? bounds.x + bounds.width : bounds.x) -
                        (x + (rtl ? -8 : 8)),
                )
            })
            .toBeLessThan(1)
        await expect
            .poll(async () => Math.abs((await menu.boundingBox())!.y - y))
            .toBeLessThan(1)
        await page.keyboard.press('Escape')
        await target.focus()
        await page.keyboard.press('Shift+F10')
        await expect(menu).toBeVisible()
        await expect
            .poll(async () => {
                const bounds = (await menu.boundingBox())!
                return Math.abs(
                    (rtl ? bounds.x + bounds.width : bounds.x) -
                        (rtl ? anchor.x + anchor.width : anchor.x),
                )
            })
            .toBeLessThan(1)
        await expect
            .poll(async () =>
                Math.abs(
                    (await menu.boundingBox())!.y -
                        anchor.y -
                        anchor.height -
                        8,
                ),
            )
            .toBeLessThan(1)
    })
}

test('local position overrides context defaults and pointer collision stays in the viewport', async ({
    page,
}) => {
    const local = page.getByRole('group', {
        name: 'Kontextziel lokal',
        exact: true,
    })
    await local.evaluate((element) =>
        element.scrollIntoView({ block: 'start' }),
    )
    const anchor = (await local.boundingBox())!
    const x = Math.round(anchor.x + anchor.width / 2)
    const y = Math.round(anchor.y + 12)
    await page.mouse.click(x, y, { button: 'right' })
    const menu = page.getByRole('menu', { name: 'Kontext lokal', exact: true })
    await expect(menu).toBeVisible()
    await expect
        .poll(async () => Math.abs((await menu.boundingBox())!.y - y - 16))
        .toBeLessThan(1)
    await expect
        .poll(async () => {
            const bounds = (await menu.boundingBox())!
            return Math.abs(bounds.x + bounds.width - x)
        })
        .toBeLessThan(1)
    await page.keyboard.press('Escape')
    const target = page.getByRole('group', {
        name: 'Kontextziel A',
        exact: true,
    })
    await target.evaluate((element) => {
        element.style.position = 'fixed'
        element.style.right = '0'
        element.style.bottom = '0'
        element.style.width = '100px'
        element.style.zIndex = '5'
    })
    const viewport = page.viewportSize()!
    await page.mouse.click(viewport.width - 4, viewport.height - 4, {
        button: 'right',
    })
    const collision = page.getByRole('menu', { name: 'Kontext A', exact: true })
    await expect(collision).toBeVisible()
    const bounds = (await collision.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
})

test('content and item tokens apply and icon checkbox and submenu indicator colors are independent', async ({
    page,
}) => {
    await page
        .getByRole('group', { name: 'Kontextziel A', exact: true })
        .click({ button: 'right', position: { x: 12, y: 12 } })
    const menu = page.getByRole('menu', { name: 'Kontext A', exact: true })
    await expect(menu).toHaveCSS('padding-top', '10px')
    await expect(menu).toHaveCSS('border-radius', '18px')
    await expect(menu).toHaveCSS('border-top-width', '3px')
    const checkbox = page.getByRole('menuitemcheckbox', {
        name: 'Kontextauswahl',
        exact: true,
    })
    await expect(checkbox).toHaveCSS('padding-left', '14px')
    await expect(checkbox).toHaveCSS('padding-top', '9px')
    await expect(checkbox).toHaveCSS('border-radius', '11px')
    await expect(checkbox).toHaveCSS('column-gap', '12px')
    const action = page.getByRole('menuitem', {
        name: 'Kontext öffnen',
        exact: true,
    })
    expect(
        await checkbox
            .locator('[data-rentner-menu-label]')
            .evaluate((element) => element.getBoundingClientRect().left),
    ).toBe(
        await action
            .locator('[data-rentner-menu-label]')
            .evaluate((element) => element.getBoundingClientRect().left),
    )
    await expect(checkbox).toHaveCSS('color', 'rgb(232, 121, 249)')
    const icon = checkbox.locator('[data-rentner-menu-icon]')
    const indicator = checkbox.locator('[data-rentner-menu-indicator]')
    await expect(icon).toHaveCSS('color', 'rgb(96, 165, 250)')
    await expect(indicator).toHaveCSS('color', 'rgb(74, 222, 128)')
    expect(
        await checkbox.evaluate(
            (element) =>
                element.querySelector('[data-rentner-menu-icon]')
                    ?.parentElement ===
                element.querySelector('[data-rentner-menu-indicator]')
                    ?.parentElement,
        ),
    ).toBe(true)
    await expect(
        checkbox.locator(
            '[data-rentner-menu-icon] [data-rentner-menu-indicator]',
        ),
    ).toHaveCount(0)
    const parent = page.getByRole('menuitem', {
        name: 'Kontext teilen',
        exact: true,
    })
    await expect(parent.locator('[data-rentner-menu-icon]')).toHaveCSS(
        'color',
        'rgb(96, 165, 250)',
    )
    await expect(
        parent.locator('[data-rentner-menu-submenu-indicator]'),
    ).toHaveCSS('color', 'rgb(250, 204, 21)')
    await checkbox.click()
    await expect(checkbox).toHaveAttribute('aria-checked', 'false')
    await expect(menu).toBeVisible()
})

test('long press suppresses its compatibility click before a normal descendant tap', async ({
    page,
}) => {
    const button = page.getByRole('button', {
        name: 'Zielaktion A',
        exact: true,
    })
    const counter = page.getByRole('status', {
        name: 'Zielaktionen',
        exact: true,
    })
    const bounds = (await button.boundingBox())!
    const point = { clientX: bounds.x + 8, clientY: bounds.y + 8 }
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
    await button.dispatchEvent('pointerdown', {
        ...point,
        pointerType: 'touch',
        isPrimary: true,
        pointerId: 3,
        bubbles: true,
    })
    await page.clock.runFor(560)
    await expect(
        page.getByRole('menu', { name: 'Kontext A', exact: true }),
    ).toBeVisible()
    await button.dispatchEvent('pointerup', {
        ...point,
        pointerType: 'touch',
        isPrimary: true,
        pointerId: 3,
        bubbles: true,
    })
    await button.dispatchEvent('click', {
        ...point,
        detail: 1,
        bubbles: true,
        cancelable: true,
    })
    await expect(counter).toHaveText('Zielaktionen: 0')
    await expect(
        page.getByRole('menu', { name: 'Kontext A', exact: true }),
    ).toBeVisible()
    await button.dispatchEvent('pointerdown', {
        ...point,
        pointerType: 'touch',
        isPrimary: true,
        pointerId: 4,
        bubbles: true,
    })
    await button.dispatchEvent('pointerup', {
        ...point,
        pointerType: 'touch',
        isPrimary: true,
        pointerId: 4,
        bubbles: true,
    })
    await button.dispatchEvent('click', {
        ...point,
        detail: 1,
        bubbles: true,
        cancelable: true,
    })
    await expect(counter).toHaveText('Zielaktionen: 1')
    await expect(page.getByRole('menu')).toHaveCount(0)
})

test('long press cancellation does not swallow subsequent keyboard activation', async ({
    page,
}) => {
    const button = page.getByRole('button', {
        name: 'Zielaktion A',
        exact: true,
    })
    const bounds = (await button.boundingBox())!
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
    await button.dispatchEvent('pointerdown', {
        pointerType: 'touch',
        isPrimary: true,
        pointerId: 3,
        clientX: bounds.x + 8,
        clientY: bounds.y + 8,
    })
    await page.clock.runFor(560)
    await expect(
        page.getByRole('menu', { name: 'Kontext A', exact: true }),
    ).toBeVisible()
    await button.dispatchEvent('pointercancel', {
        pointerType: 'touch',
        isPrimary: true,
        pointerId: 3,
    })
    await page.keyboard.press('Escape')
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(
        page.getByRole('status', { name: 'Zielaktionen', exact: true }),
    ).toHaveText('Zielaktionen: 1')
    await expect(page.getByRole('menu')).toHaveCount(0)
})

for (const light of [false, true]) {
    test(`default selection and action colors stay independent in the ${light ? 'light' : 'dark'} theme`, async ({
        page,
    }) => {
        await page.evaluate((isLight) => {
            const root = document.documentElement
            root.style.setProperty(
                '--rentner-surface',
                isLight ? '#ffffff' : '#181a1f',
            )
            root.style.setProperty(
                '--rentner-foreground',
                isLight ? '#181a1f' : '#ffffff',
            )
            root.style.setProperty(
                '--rentner-accent',
                isLight ? '#047857' : '#13ecd6',
            )
        }, light)
        await page
            .getByRole('button', { name: 'Ansicht anpassen', exact: true })
            .click()
        const checkbox = page.getByRole('menuitemcheckbox', {
            name: 'Versteckte Dateien',
            exact: true,
        })
        await expect(checkbox).toHaveCSS(
            'color',
            light ? 'rgb(24, 26, 31)' : 'rgb(255, 255, 255)',
        )
        await expect(
            checkbox.locator('[data-rentner-menu-indicator]'),
        ).toHaveCSS('color', light ? 'rgb(4, 120, 87)' : 'rgb(19, 236, 214)')
        await expect(page.getByRole('menu')).toHaveCSS(
            'background-color',
            light ? 'rgb(255, 255, 255)' : 'rgb(24, 26, 31)',
        )
    })
}
