import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('summary').filter({ hasText: 'Async actions' }).click()
})

test('async keyboard action announces pending and failure, preserves focus, retries and closes on success', async ({
    page,
}) => {
    const trigger = page.getByRole('button', {
        name: 'Async actions',
        exact: true,
    })
    await trigger.click()
    const action = page.getByRole('menuitem', { name: 'Save asynchronously' })
    await expect(action).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(action).toHaveAttribute('aria-busy', 'true')
    await expect(
        page.getByRole('status').filter({ hasText: 'Saving changes...' }),
    ).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toHaveText(
        'Saving failed. Try again.',
    )
    await expect(action).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(action).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(
        page.getByRole('status').filter({ hasText: 'Changes saved' }),
    ).toHaveText('Changes saved')
})

test('dismissed async action cannot close a reopened menu', async ({
    page,
}) => {
    const trigger = page.getByRole('button', {
        name: 'Async actions',
        exact: true,
    })
    await trigger.click()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await trigger.click()
    const action = page.getByRole('menuitem', { name: 'Save asynchronously' })
    await expect(action).toHaveAttribute('aria-busy', 'true')
    await expect(action).not.toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(action).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toHaveCount(0)
})

test('first open after reload paints the right-aligned menu at its anchor', async ({
    page,
}) => {
    const samples = await page.evaluate(async () => {
        const trigger = [...document.querySelectorAll('button')].find(
            (node) => node.textContent === 'Async actions',
        )
        if (!trigger) throw new Error('Missing trigger')
        trigger.click()
        const frames = []
        for (let frame = 0; frame < 8; frame++) {
            // Paint frames must be observed sequentially to catch first-open jumps.
            // eslint-disable-next-line no-await-in-loop
            await new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
            )
            const surface = document.querySelector<HTMLElement>(
                '[data-rentner-menu-content]',
            )
            if (surface && getComputedStyle(surface).visibility === 'visible') {
                const rect = surface.getBoundingClientRect()
                const anchor = trigger.getBoundingClientRect()
                frames.push({
                    left: rect.left,
                    right: rect.right,
                    anchorRight: anchor.right,
                    width: rect.width,
                })
            }
        }
        return frames
    })
    expect(samples.length).toBeGreaterThan(0)
    for (const sample of samples) {
        expect(sample.width).toBeGreaterThan(0)
        expect(Math.abs(sample.right - sample.anchorRight)).toBeLessThanOrEqual(
            1,
        )
        expect(sample.left).toBeGreaterThan(0)
    }
})

test('settling an old pending action restores keyboard selection in a shadow portal', async ({
    page,
}) => {
    await page.goto('/?asyncPortal=shadow')
    await page.locator('summary').filter({ hasText: 'Async actions' }).click()
    await expect(page.getByTestId('async-shadow-portal')).toBeAttached()
    await page.clock.install({ time: new Date('2026-11-17T10:00:00Z') })
    await page.clock.pauseAt(new Date('2026-11-17T11:00:00Z'))
    const trigger = page.getByRole('button', {
        name: 'Async actions',
        exact: true,
    })
    await trigger.click()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await trigger.click()
    const menu = page.getByRole('menu')
    const action = page.getByRole('menuitem', { name: 'Save asynchronously' })
    await expect(menu).toBeFocused()
    await expect(action).toHaveAttribute('aria-busy', 'true')
    await page.clock.runFor(800)
    await expect(action).not.toHaveAttribute('aria-busy', 'true')
    await expect(action).toBeFocused()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.keyboard.press('Enter')
    await page.clock.runFor(800)
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
})
