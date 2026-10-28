import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.goto('/')
})

test('dropdown supports keyboard selection, disabled skipping, Escape and outside dismissal', async ({
    page,
}) => {
    const trigger = page.getByRole('button', { name: 'Aktionen', exact: true })
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('menuitem', { name: /Öffnen/ })).toBeFocused()
    await page.keyboard.press('End')
    await expect(page.getByRole('menuitem', { name: /Löschen/ })).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByRole('menuitem', { name: /Teilen/ })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await trigger.click()
    await page.getByRole('heading', { name: 'Gute Menüs. Gute Wege.' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await trigger.click()
    await page.getByRole('menuitem', { name: /Öffnen/ }).click()
    await expect(
        page.getByRole('status').filter({ hasText: 'Datei geöffnet' }),
    ).toContainText('Design tokens.json')
    await expect(trigger).toBeFocused()
})

test('context menu acts on its file with mouse and Shift+F10', async ({
    page,
}) => {
    const target = page.locator(
        '[data-rentner-menu-target][aria-label="Release notes.md"]',
    )
    await target.click({ button: 'right' })
    await expect(
        page.getByRole('menu', { name: 'Datei-Kontextmenü: Release notes.md' }),
    ).toBeVisible()
    await page.getByRole('menuitem', { name: /Duplizieren/ }).click()
    await expect(
        page.getByRole('button', {
            name: 'Release notes.md (copy)',
            exact: true,
        }),
    ).toBeVisible()
    await target.focus()
    await page.keyboard.press('Shift+F10')
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(target).toBeFocused()
})

test('nested submenus can be navigated and closed independently', async ({
    page,
}) => {
    await page.getByRole('button', { name: 'Aktionen', exact: true }).click()
    await page.getByRole('menuitem', { name: /Teilen/ }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(
        page.getByRole('menuitem', { name: 'Link kopieren' }),
    ).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('menuitem', { name: 'Als JSON' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('menuitem', { name: 'Als Text' })).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(
        page.getByRole('menuitem', { name: /Weitere Formate/ }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(2)
    await expect(
        page.getByRole('menuitem', { name: /Exportieren/ }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(1)
    await expect(page.getByRole('menuitem', { name: /Teilen/ })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
})

test('checkbox and radio choices persist across closing and opening', async ({
    page,
}) => {
    const trigger = page.getByRole('button', {
        name: 'Ansicht anpassen',
        exact: true,
    })
    await trigger.click()
    await page
        .getByRole('menuitemcheckbox', { name: 'Versteckte Dateien' })
        .click()
    await expect(
        page.getByRole('menuitemcheckbox', { name: 'Versteckte Dateien' }),
    ).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    await expect(
        page.getByRole('button', { name: '.menu.config', exact: true }),
    ).toBeVisible()
    await trigger.click()
    await page
        .getByRole('menuitemradio', { name: 'Dateityp', exact: true })
        .click()
    await trigger.click()
    await expect(
        page.getByRole('menuitemradio', { name: 'Dateityp', exact: true }),
    ).toHaveAttribute('aria-checked', 'true')
    await expect(
        page.getByRole('menuitemradio', { name: 'Name', exact: true }),
    ).toHaveAttribute('aria-checked', 'false')
})

test('controlled state and disabled menus follow playground controls', async ({
    page,
}) => {
    await page.getByRole('button', { name: 'Zustand umschalten' }).click()
    await expect(
        page.getByRole('button', { name: 'Gesteuertes Menü' }),
    ).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(
        page.getByRole('button', { name: 'Gesteuertes Menü' }),
    ).toHaveAttribute('aria-expanded', 'false')
    await page.getByRole('checkbox', { name: 'Menüs deaktivieren' }).check()
    await expect(
        page.getByRole('button', { name: 'Aktionen', exact: true }),
    ).toBeDisabled()
    await page
        .locator('[data-rentner-menu-target]')
        .first()
        .click({ button: 'right', force: true })
    await expect(page.getByRole('menu')).toHaveCount(0)
})

test('RTL uses reversed submenu keys and edge menu stays inside viewport', async ({
    page,
}) => {
    await page.getByRole('button', { name: 'RTL-Menü' }).click()
    await expect(page.getByRole('menu')).toHaveAttribute('dir', 'rtl')
    await page.getByRole('menuitem', { name: /Teilen/ }).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(
        page.getByRole('menuitem', { name: 'Link kopieren' }),
    ).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('menuitem', { name: /Teilen/ })).toBeFocused()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Rand-Menü' }).click()
    const bounds = await page.getByRole('menu').boundingBox()
    expect(bounds).not.toBeNull()
    const viewport = page.viewportSize()!
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
})

test('native dialog keeps menu portal in its own focus layer', async ({
    page,
}) => {
    await page.getByRole('button', { name: 'Dialog öffnen' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Dialog-Aktionen' }).click()
    await expect(dialog.getByRole('menu')).toBeVisible()
    await dialog.getByRole('menuitem', { name: /Öffnen/ }).click()
    await expect(
        dialog.getByRole('button', { name: 'Dialog-Aktionen' }),
    ).toBeFocused()
    await dialog.getByRole('button', { name: 'Schließen', exact: true }).click()
    await expect(dialog).not.toBeVisible()
})

test('dark, light, open menu and native dialog meet axe accessibility rules', async ({
    page,
}) => {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.getByRole('button', { name: 'Aktionen', exact: true }).click()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Light theme' }).click()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.getByRole('button', { name: 'Dialog öffnen' }).click()
    await page.getByRole('button', { name: 'Dialog-Aktionen' }).click()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('mobile layout avoids horizontal page overflow and supports long press', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true)
    await page.getByRole('button', { name: 'Aktionen', exact: true }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    const target = page.locator('[data-rentner-menu-target]').first()
    await target.dispatchEvent('pointerdown', {
        pointerType: 'touch',
        isPrimary: true,
        pointerId: 3,
        clientX: 100,
        clientY: 400,
        bubbles: true,
    })
    await expect(page.getByRole('menu')).toBeVisible()
    await target.dispatchEvent('pointerup', {
        pointerType: 'touch',
        pointerId: 3,
        bubbles: true,
    })
})
