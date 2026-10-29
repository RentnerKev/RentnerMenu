import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.goto('/')
})

test('externally opened menu accepts immediate Escape across repeated openings', async ({
    page,
}) => {
    await page.getByText('Weitere Tests', { exact: true }).click()
    const toggle = page.getByRole('button', { name: 'Zustand umschalten' })
    const trigger = page.getByRole('button', { name: 'Gesteuertes Menü' })
    /* oxlint-disable eslint/no-await-in-loop -- Each open/close cycle must finish on this same component before the next one. */
    for (let attempt = 0; attempt < 8; attempt++) {
        await toggle.click()
        // Keep the original failing sequence: do not wait for focus or add a delay.
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
        await page.keyboard.press('Escape')
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')
        await expect(trigger).toBeFocused()
    }
    /* oxlint-enable eslint/no-await-in-loop */
})

test('modal Tab and Shift+Tab release isolation and continue from the trigger', async ({
    page,
}) => {
    await page.getByText('Weitere Tests', { exact: true }).click()
    const trigger = page.getByRole('button', {
        name: 'Modales Menü',
        exact: true,
    })
    await trigger.click()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(
        page.getByRole('button', { name: 'Aktion außerhalb', exact: true }),
    ).toBeFocused()
    await trigger.click()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(
        page.getByRole('button', {
            name: 'Links und gemischte Auswahl',
            exact: true,
        }),
    ).toBeFocused()
    expect(await page.locator('[inert]').count()).toBe(0)
})

test('open submenus follow their parent after page scrolling changes root coordinates', async ({
    page,
}) => {
    await page.evaluate(() => {
        document.body.style.minHeight = '2000px'
    })
    await page.getByRole('button', { name: 'Aktionen', exact: true }).click()
    // Exercise keyboard focus while the page moves, with the pointer clear of menu hit targets.
    await page.mouse.move(0, 0)
    const parent = page.getByRole('menuitem', { name: 'Teilen', exact: true })
    await parent.focus()
    await page.keyboard.press('ArrowRight')
    const submenu = page.getByRole('menu').filter({
        has: page.getByRole('menuitem', {
            name: 'Link kopieren',
            exact: true,
        }),
    })
    const initial = (await submenu.boundingBox())!
    await page.evaluate(() => window.scrollBy(0, 80))
    await expect
        .poll(async () => (await submenu.boundingBox())!.y)
        .toBeLessThan(initial.y - 30)
    await expect
        .poll(async () =>
            Math.abs(
                (await submenu.boundingBox())!.y -
                    (await parent.boundingBox())!.y,
            ),
        )
        .toBeLessThan(1)
    await expect(
        page.getByRole('menuitem', { name: 'Link kopieren', exact: true }),
    ).toBeFocused()
})

for (const rtl of [false, true]) {
    test(`diagonal pointer travel retains ${rtl ? 'RTL' : 'LTR'} submenu and normal sibling hover still closes it`, async ({
        page,
    }) => {
        if (rtl) await page.getByText('Weitere Tests', { exact: true }).click()
        await page
            .getByRole('button', {
                name: rtl ? 'RTL-Menü' : 'Aktionen',
                exact: true,
            })
            .click()
        const parent = page.getByRole('menuitem', {
            name: 'Teilen',
            exact: true,
        })
        const parentBox = (await parent.boundingBox())!
        const parentMenu = page.getByRole('menu', {
            name: rtl ? 'RTL-Menü' : 'Aktionen',
            exact: true,
        })
        const parentBounds = (await parentMenu.boundingBox())!
        const sign = rtl ? -1 : 1
        await page.mouse.move(
            rtl ? parentBox.x + 70 : parentBox.x + parentBox.width - 70,
            parentBox.y + parentBox.height / 2,
        )
        const submenu = page.getByRole('menu').filter({
            has: page.getByRole('menuitem', {
                name: 'Link kopieren',
                exact: true,
            }),
        })
        await expect(submenu).toBeVisible()
        // A taller submenu creates a diagonal path across another enabled parent item.
        await submenu.evaluate((element) => {
            element.style.minHeight = '260px'
        })
        await expect(submenu).toHaveCSS('min-height', '260px')
        const sibling = page.getByRole('menuitem', {
            name: 'Löschen',
            exact: true,
        })
        const siblingBox = (await sibling.boundingBox())!
        const nearX = rtl
            ? parentBounds.x + 8
            : parentBounds.x + parentBounds.width - 8
        await page.mouse.move(nearX, siblingBox.y + siblingBox.height / 2, {
            steps: 4,
        })
        await page.waitForTimeout(280)
        await expect(submenu).toBeVisible()
        const submenuBox = (await submenu.boundingBox())!
        await page.mouse.move(
            rtl ? submenuBox.x + submenuBox.width - 24 : submenuBox.x + 24,
            submenuBox.y + 180,
            { steps: 2 },
        )
        await expect(parent).toHaveAttribute('aria-expanded', 'true')
        // Move away from the protected diagonal and use the ordinary sibling path.
        await page.mouse.move(
            nearX - sign * 100,
            siblingBox.y + siblingBox.height / 2,
        )
        await expect(sibling).toBeFocused()
        await expect(submenu).toHaveCount(0)
    })
}
