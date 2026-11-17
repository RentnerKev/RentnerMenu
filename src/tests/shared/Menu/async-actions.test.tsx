import { afterEach, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Menu } from '../../../index.ts'
import type { MenuActionItem, MenuProps } from '../../../index.ts'

afterEach(cleanup)

function deferred() {
    return Promise.withResolvers<void>()
}

function example(item: Partial<MenuActionItem>, props: Partial<MenuProps> = {}) {
    return <Menu ariaLabel="Commands" items={[{ id: 'save', label: 'Save', ...item }]} {...props} />
}

function open() { fireEvent.click(screen.getByRole('button', { name: 'Commands' })) }
function select() { fireEvent.click(screen.getByRole('menuitem', { name: 'Save' })) }

test('pending action stays open, is accessible and cannot execute twice; success closes and restores focus', async () => {
    const task = deferred()
    const execute = mock(() => task.promise)
    const sync = mock()
    render(example({ onSelect: sync, onSelectAsync: execute, pendingLabel: 'Saving' }))
    open()
    const item = screen.getByRole('menuitem', { name: 'Save' })
    item.focus()
    select()
    expect(item.getAttribute('aria-busy')).toBe('true')
    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe('Saving')
    fireEvent.click(item)
    fireEvent.keyDown(item, { key: 'Enter' })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(item)
    await act(async () => task.resolve())
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Commands' }))
})

test('keyboard activation closes after success despite the native key default being prevented', async () => {
    const task = deferred()
    render(example({ onSelectAsync: () => task.promise }))
    open()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Enter' })
    expect(screen.getByRole('status')).toBeTruthy()
    await act(async () => task.resolve())
    expect(screen.queryByRole('menu')).toBeNull()
})

test.each(['item', 'menu'] as const)('synchronous %s cancellation prevents the async operation', (source) => {
    const execute = mock(async () => {})
    render(example({ onSelect: source === 'item' ? (event) => event.preventDefault() : undefined, onSelectAsync: execute }, {
        onAction: source === 'menu' ? (_id, event) => event.preventDefault() : undefined,
    }))
    open(); select()
    expect(execute).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeTruthy()
})

test('failure is safe and retryable, preserves focus and contains a rejecting observer', async () => {
    const first = deferred()
    const second = deferred()
    const execute = mock(() => execute.mock.calls.length === 1 ? first.promise : second.promise)
    const observed = mock(async () => { throw new Error('observer failure') })
    render(example({ onSelectAsync: execute, description: 'Save changes', errorLabel: 'Please retry' }, { onActionError: observed }))
    open()
    const item = screen.getByRole('menuitem', { name: 'Save' })
    item.focus(); select()
    await act(async () => first.reject(new Error('private server details')))
    expect(screen.getByRole('alert').textContent).toBe('Please retry')
    expect(document.body.textContent).not.toContain('private server details')
    expect(item.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id)
    expect(item.getAttribute('aria-busy')).toBeNull()
    expect(document.activeElement).toBe(item)
    expect(observed).toHaveBeenCalledTimes(1)
    select()
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => second.resolve())
    expect(screen.queryByRole('menu')).toBeNull()
})

test('synchronous throws from the opt-in callback use the same failure contract', async () => {
    render(example({ onSelectAsync: () => { throw 'unexpected' } }))
    open(); select()
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('menu')).toBeTruthy()
})

test.each(['closeOnSelect', 'preventDefault'] as const)('%s keeps a successful async action open', async (mode) => {
    const task = deferred()
    render(example({ closeOnSelect: mode === 'closeOnSelect' ? false : undefined, onSelectAsync: async (event) => {
        await task.promise
        if (mode === 'preventDefault') event.preventDefault()
    } }))
    open(); select()
    await act(async () => task.resolve())
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
})

test('closing and reopening preserves single-flight, but old completion never closes the new session', async () => {
    const task = deferred()
    const execute = mock(() => task.promise)
    render(example({ onSelectAsync: execute }))
    open(); select()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    open(); select()
    expect(execute).toHaveBeenCalledTimes(1)
    await act(async () => task.resolve())
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Save' }))
})

test('rerendered callbacks do not reset pending; failures use the latest error observer', async () => {
    const task = deferred()
    const execute = mock(() => task.promise)
    const replacement = mock(async () => {})
    const firstObserver = mock()
    const latestObserver = mock()
    const view = render(example({ onSelectAsync: execute }, { onActionError: firstObserver }))
    open(); select()
    view.rerender(example({ onSelectAsync: replacement }, { onActionError: latestObserver }))
    select()
    expect(replacement).not.toHaveBeenCalled()
    await act(async () => task.reject(new Error('failed')))
    expect(firstObserver).not.toHaveBeenCalled()
    expect(latestObserver).toHaveBeenCalledTimes(1)
    select()
    await waitFor(() => expect(replacement).toHaveBeenCalledTimes(1))
})

test('unmount suppresses completion side effects but still observes operation rejection', async () => {
    const task = deferred()
    const observed = mock()
    const changed = mock()
    const view = render(example({ onSelectAsync: () => task.promise }, { onActionError: observed, onOpenChange: changed }))
    open(); select()
    view.unmount()
    await act(async () => task.reject(new Error('late failure')))
    expect(observed).toHaveBeenCalledTimes(1)
    expect(changed.mock.calls).toEqual([[true]])
})

test('identical IDs on different submenu paths have independent operations', async () => {
    const first = deferred()
    const second = deferred()
    const one = mock(() => first.promise)
    const two = mock(() => second.promise)
    render(<Menu ariaLabel="Commands" items={[
        { id: 'save', label: 'Root save', onSelectAsync: one, closeOnSelect: false },
        { id: 'more', label: 'More', type: 'submenu', items: [{ id: 'save', label: 'Child save', onSelectAsync: two, closeOnSelect: false }] },
    ]} />)
    open()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Root save' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'More' }))
    const child = screen.getByRole('menuitem', { name: 'Child save' })
    fireEvent.click(child)
    expect(one).toHaveBeenCalledTimes(1)
    expect(two).toHaveBeenCalledTimes(1)
    await act(async () => first.resolve())
    expect(child.getAttribute('aria-busy')).toBe('true')
    await act(async () => second.resolve())
    expect(child.getAttribute('aria-busy')).toBeNull()
})

test('controlled close/reopen invalidates old completion', async () => {
    const task = deferred()
    const changed = mock()
    const view = render(example({ onSelectAsync: () => task.promise }, { open: true, onOpenChange: changed }))
    select()
    view.rerender(example({ onSelectAsync: () => task.promise }, { open: false, onOpenChange: changed }))
    view.rerender(example({ onSelectAsync: () => task.promise }, { open: true, onOpenChange: changed }))
    await act(async () => task.resolve())
    expect(changed).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeTruthy()
})

test('disabling a menu invalidates the old completion before reenabling it', async () => {
    const task = deferred()
    const changed = mock()
    const view = render(example({ onSelectAsync: () => task.promise }, { open: true, onOpenChange: changed }))
    select()
    view.rerender(example({ onSelectAsync: () => task.promise }, { open: true, disabled: true, onOpenChange: changed }))
    view.rerender(example({ onSelectAsync: () => task.promise }, { open: true, onOpenChange: changed }))
    await act(async () => task.resolve())
    expect(changed).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeTruthy()
})


test.each(['open', 'closed'] as const)('restores actionable focus after an old pending action settles in a %s shadow portal', async (mode) => {
    const host = document.createElement('div')
    document.body.append(host)
    const shadow = host.attachShadow({ mode })
    const task = deferred()
    const execute = mock(() => task.promise)
    const view = render(example({ onSelectAsync: execute }, { portalContainer: shadow }))
    try {
        open()
        fireEvent.click(shadow.querySelector('[role="menuitem"]')!)
        fireEvent.keyDown(shadow.querySelector('[role="menu"]')!, { key: 'Escape' })
        open()
        const surface = shadow.querySelector('[role="menu"]')!
        expect(shadow.activeElement).toBe(surface)
        await act(async () => task.resolve())
        expect(execute).toHaveBeenCalledTimes(1)
        expect(shadow.querySelector('[role="menu"]')).toBe(surface)
        expect(shadow.activeElement === shadow.querySelector('[role="menuitem"]')).toBe(true)
    } finally {
        view.unmount()
        host.remove()
    }
})
