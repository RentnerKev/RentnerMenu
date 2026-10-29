import { expect, test } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByText('Weitere Tests', { exact: true }).click()
})

test('custom trigger is a single styled button and links retain native navigation', async ({
    page,
}) => {
    const trigger = page.getByRole('button', {
        name: 'Links und gemischte Auswahl',
        exact: true,
    })
    await expect(trigger).toHaveCount(1)
    await expect(trigger.locator('button')).toHaveCount(0)
    await expect(trigger).toHaveClass(/rounded-full/)
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const link = page.getByRole('menuitem', {
        name: 'Zum Beispielziel',
        exact: true,
    })
    await expect(link).toHaveAttribute('href', '#menu-link-target')
    expect(await link.evaluate((element) => element.tagName)).toBe('A')
    const disabledLink = page.getByRole('menuitem', {
        name: 'Deaktivierter Link',
        exact: true,
    })
    await expect(disabledLink).toHaveAttribute('aria-disabled', 'true')
    await expect(disabledLink).not.toHaveAttribute('href')
    await disabledLink.click({ force: true })
    await expect(page).not.toHaveURL(/#menu-disabled-target$/)
    await expect(page.getByRole('menu')).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/#menu-link-target$/)
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page.locator('#menu-link-target')).toBeVisible()
})

test('native link activation works from the custom trigger keyboard path', async ({
    page,
}) => {
    await page
        .getByRole('button', {
            name: 'Links und gemischte Auswahl',
            exact: true,
        })
        .focus()
    await page.keyboard.press('ArrowDown')
    await expect(
        page.getByRole('menuitem', { name: 'Zum Beispielziel', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#menu-link-target$/)
    await expect(page.getByRole('menu')).toHaveCount(0)
})

test('Control-click opens the native link in a new tab without navigating the opener', async ({
    page,
    context,
}) => {
    await page
        .getByRole('button', {
            name: 'Links und gemischte Auswahl',
            exact: true,
        })
        .click()
    const newPagePromise = context.waitForEvent('page')
    await page
        .getByRole('menuitem', { name: 'Zum Beispielziel', exact: true })
        .click({ modifiers: ['Control'] })
    const newPage = await newPagePromise
    await expect(newPage).toHaveURL(/#menu-link-target$/)
    await expect(page).not.toHaveURL(/#menu-link-target$/)
    await newPage.close()
})

test('a native target blank remains effective through the menu click handler', async ({
    page,
    context,
}) => {
    await page
        .getByRole('button', {
            name: 'Links und gemischte Auswahl',
            exact: true,
        })
        .click()
    const link = page.getByRole('menuitem', {
        name: 'Zum Beispielziel',
        exact: true,
    })
    await link.evaluate((element) => {
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'noopener noreferrer')
    })
    const newPagePromise = context.waitForEvent('page')
    await link.click()
    const newPage = await newPagePromise
    await expect(newPage).toHaveURL(/#menu-link-target$/)
    await expect(page).not.toHaveURL(/#menu-link-target$/)
    await newPage.close()
})

test('a native download starts after the menu selection handler', async ({
    page,
}) => {
    await page
        .getByRole('button', {
            name: 'Links und gemischte Auswahl',
            exact: true,
        })
        .click()
    const link = page.getByRole('menuitem', {
        name: 'Zum Beispielziel',
        exact: true,
    })
    await link.evaluate((element) => {
        const url = URL.createObjectURL(
            new Blob(['Menu download'], { type: 'text/plain' }),
        )
        element.setAttribute('href', url)
        element.setAttribute('download', 'menu-test.txt')
    })
    const downloadPromise = page.waitForEvent('download')
    await link.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('menu-test.txt')
    expect(await download.failure()).toBeNull()
    await expect(page).not.toHaveURL(/^blob:/)
})

test('open custom and modal menus pass automated accessibility checks', async ({
    page,
}) => {
    await page
        .getByRole('button', {
            name: 'Links und gemischte Auswahl',
            exact: true,
        })
        .click()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.keyboard.press('Escape')
    await page
        .getByRole('button', { name: 'Modales Menü', exact: true })
        .click()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('mixed checkbox toggles to true then false while remaining open', async ({
    page,
}) => {
    const trigger = page.getByRole('button', {
        name: 'Links und gemischte Auswahl',
        exact: true,
    })
    await trigger.click()
    const checkbox = page.getByRole('menuitemcheckbox', {
        name: 'Gemischte Auswahl',
        exact: true,
    })
    await expect(checkbox).toHaveAttribute('aria-checked', 'mixed')
    await checkbox.click()
    await expect(checkbox).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('menu')).toBeVisible()
    await checkbox.focus()
    await page.keyboard.press('Space')
    await expect(checkbox).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('Escape')
    await trigger.click()
    await expect(checkbox).toHaveAttribute('aria-checked', 'false')
})

test('modal menu isolates the background, blocks the dismissing click and restores scrolling', async ({
    page,
}) => {
    await page.evaluate(() => {
        document.body.style.minHeight = '1800px'
        document.body.style.setProperty('overflow', 'auto')
        document.documentElement.style.setProperty('overflow-y', 'scroll')
    })
    const trigger = page.getByRole('button', {
        name: 'Modales Menü',
        exact: true,
    })
    const outside = page.getByRole('button', {
        name: 'Aktion außerhalb',
        exact: true,
        includeHidden: true,
    })
    const counter = page.getByRole('status', {
        name: 'Aktionen außerhalb',
        includeHidden: true,
    })
    const outsideBounds = await outside.boundingBox()
    expect(outsideBounds).not.toBeNull()
    await trigger.click()
    const menu = page.getByRole('menu', { name: 'Modales Menü', exact: true })
    await expect(menu).toBeVisible()
    expect(
        await outside.evaluate((element) =>
            Boolean(element.closest('[inert]')),
        ),
    ).toBe(true)
    expect(
        await outside.evaluate((element) =>
            Boolean(element.closest('[aria-hidden="true"]')),
        ),
    ).toBe(true)
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    await expect(page.locator('html')).toHaveCSS('overflow-y', 'hidden')
    await outside.evaluate((element: HTMLButtonElement) => element.focus())
    await expect(
        page.getByRole('menuitem', { name: 'Zum Beispielziel', exact: true }),
    ).toBeFocused()
    const beforeScroll = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 350)
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(beforeScroll)
    await page.mouse.click(
        outsideBounds!.x + outsideBounds!.width / 2,
        outsideBounds!.y + outsideBounds!.height / 2,
    )
    await expect(menu).toHaveCount(0)
    await expect(counter).toHaveText('Aktionen außerhalb: 0')
    expect(
        await outside.evaluate((element) =>
            Boolean(element.closest('[inert]')),
        ),
    ).toBe(false)
    expect(
        await outside.evaluate((element) =>
            Boolean(element.closest('[aria-hidden="true"]')),
        ),
    ).toBe(false)
    expect(
        await page
            .locator('body')
            .evaluate((element) => element.style.overflow),
    ).toBe('auto')
    expect(
        await page
            .locator('html')
            .evaluate((element) => element.style.overflowY),
    ).toBe('scroll')
    await outside.click()
    await expect(counter).toHaveText('Aktionen außerhalb: 1')
    await page.mouse.wheel(0, 350)
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(beforeScroll)
    await trigger.click()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await expect(page.locator('body')).toHaveCSS('overflow', 'auto')
})
