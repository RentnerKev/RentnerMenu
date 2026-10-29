import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByText('Weitere Tests', { exact: true }).click()
})

test('Escape dismisses a hovered menu without stealing the input focus', async ({
    page,
}) => {
    const search = page.getByRole('textbox', {
        name: 'Fokus beim Hover behalten',
    })
    await search.fill('Still typing')
    await page.getByRole('button', { name: 'Hover-Menü', exact: true }).hover()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(search).toBeFocused()
})

test('hover opens without stealing input focus and closes after leaving the trigger', async ({
    page,
}) => {
    const search = page.getByRole('textbox', {
        name: 'Fokus beim Hover behalten',
    })
    const trigger = page.getByRole('button', {
        name: 'Hover-Menü',
        exact: true,
    })
    await search.fill('Keep typing')
    await trigger.hover()
    await expect(
        page.getByRole('menu', { name: 'Hover-Menü', exact: true }),
    ).toBeVisible()
    await expect(search).toBeFocused()
    await page.getByRole('button', { name: 'Zustand umschalten' }).hover()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(search).toBeFocused()
})

test('keyboard takes over hover and Escape restores the trigger', async ({
    page,
}) => {
    const trigger = page.getByRole('button', {
        name: 'Hover-Menü',
        exact: true,
    })
    await trigger.hover()
    await expect(page.getByRole('menu')).toBeVisible()
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    await expect(
        page.getByRole('menuitem', { name: 'Öffnen', exact: true }),
    ).toBeFocused()
    await page.getByRole('button', { name: 'Zustand umschalten' }).hover()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(trigger).toBeFocused()
})

test('a click opens immediately and pointer departure leaves keyboard ownership intact', async ({
    page,
}) => {
    const trigger = page.getByRole('button', {
        name: 'Hover-Menü',
        exact: true,
    })
    await trigger.click()
    await expect(
        page.getByRole('menuitem', { name: 'Öffnen', exact: true }),
    ).toBeFocused()
    await page.getByRole('button', { name: 'Zustand umschalten' }).hover()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
})
