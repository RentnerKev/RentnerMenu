import { Menu } from '../../src/shared/Menu/Components/Menu.tsx'
import { ContextMenu } from '../../src/shared/Menu/Components/ContextMenu.tsx'
import { usePlaygroundLogic } from './Hooks/usePlaygroundLogic.ts'

export function App() {
    const {
        state,
        handler,
        setter,
        refs: { dialog },
    } = usePlaygroundLogic()
    return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-5 py-8">
            <h1 className="sr-only">{state.t.playground}</h1>
            <p className="text-sm text-secondary-text">{state.t.hint}</p>
            <section
                aria-label={state.t.files}
                className="grid gap-3 rounded-lg border border-border-dark bg-surface-dark p-4"
            >
                {state.displayedFiles.map((file) => (
                    <ContextMenu
                        key={file.id}
                        ariaLabel={state.t.context + ': ' + file.name}
                        items={handler.fileItems(file.id)}
                        onAction={(id) => handler.handleAction(id, file.id)}
                        disabled={state.disabled}
                        longPress
                        targetProps={{
                            'aria-label': file.name,
                            onFocus: () => handler.handleSelect(file.id),
                            onContextMenu: () => handler.handleSelect(file.id),
                            className:
                                'rounded-md border border-dashed border-border-dark bg-input-dark/40 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        }}
                    >
                        <button
                            type="button"
                            className="max-w-full truncate text-left text-sm underline decoration-gray-600 underline-offset-4"
                            aria-pressed={state.selectedId === file.id}
                            onClick={() => handler.handleSelect(file.id)}
                        >
                            {file.name}
                        </button>
                    </ContextMenu>
                ))}
                {state.displayedFiles.length === 0 && (
                    <p className="text-sm text-secondary-text">
                        {state.t.noFiles}
                    </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                    <Menu
                        ariaLabel={state.t.actions}
                        trigger={state.t.actions}
                        items={state.items}
                        onAction={(id) => handler.handleAction(id)}
                        disabled={state.disabled}
                    />
                    <Menu
                        ariaLabel={state.t.preferences}
                        trigger={state.t.preferences}
                        items={state.preferences}
                        disabled={state.disabled}
                    />
                    <button
                        type="button"
                        className="rounded-md border border-border-dark px-3 py-2 text-sm"
                        onClick={handler.handleReset}
                    >
                        {state.t.reset}
                    </button>
                </div>
            </section>
            <output className="rounded-lg border border-border-dark bg-surface-dark px-4 py-3 text-sm">
                {state.result}
            </output>
            <details className="rounded-lg border border-border-dark bg-surface-dark p-4">
                <summary className="cursor-pointer text-sm">
                    {state.t.moreTests}
                </summary>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <input
                        aria-label={state.t.hoverFocus}
                        className="rounded-md border border-border-dark bg-input-dark px-3 py-2 text-sm"
                    />
                    <Menu
                        openOnHover
                        ariaLabel={state.t.hoverMenu}
                        trigger={state.t.hoverMenu}
                        items={state.items}
                        disabled={state.disabled}
                        onAction={(id) => handler.handleAction(id)}
                    />
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="accent-primary"
                            checked={state.disabled}
                            onChange={(event) =>
                                setter.setDisabled(event.target.checked)
                            }
                        />
                        {state.t.disabled}
                    </label>
                    <Menu
                        ariaLabel={state.t.controlled}
                        trigger={state.t.controlled}
                        items={state.items}
                        open={state.controlledOpen}
                        onOpenChange={setter.setControlledOpen}
                        onAction={(id) => handler.handleAction(id)}
                    />
                    <button
                        type="button"
                        className="rounded-md border border-border-dark px-3 py-2 text-sm"
                        onClick={handler.handleToggleControlled}
                    >
                        {state.t.toggle}
                    </button>
                    <Menu
                        dir="rtl"
                        ariaLabel={state.t.rtl}
                        trigger={state.t.rtl}
                        items={state.items}
                        onAction={(id) => handler.handleAction(id)}
                    />
                    <button
                        type="button"
                        className="rounded-md border border-border-dark px-3 py-2 text-sm"
                        onClick={handler.handleDialog}
                    >
                        {state.t.showDialog}
                    </button>
                    <Menu
                        ariaLabel={state.t.edge}
                        trigger={state.t.edge}
                        items={state.items}
                        onAction={(id) => handler.handleAction(id)}
                        triggerProps={{
                            className: 'fixed right-4 bottom-4 shadow-lg',
                        }}
                    />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Menu
                        asChild
                        ariaLabel={state.t.extensions}
                        items={state.extensionItems}
                        disabled={state.disabled}
                        trigger={
                            <button
                                type="button"
                                className="rounded-full border border-primary px-4 py-2 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                {state.t.extensions}
                            </button>
                        }
                    />
                    <Menu
                        modal
                        ariaLabel={state.t.modalMenu}
                        trigger={state.t.modalMenu}
                        items={state.extensionItems}
                        disabled={state.disabled}
                    />
                    <button
                        type="button"
                        className="rounded-md border border-border-dark px-3 py-2 text-sm"
                        onClick={handler.handleOutsideAction}
                    >
                        {state.t.outsideAction}
                    </button>
                    <output
                        aria-label={state.t.outsideCount}
                        className="text-sm"
                    >
                        {state.t.outsideCount}: {state.outsideCount}
                    </output>
                </div>
                <p
                    id="menu-link-target"
                    tabIndex={-1}
                    className="mt-3 text-sm text-secondary-text"
                >
                    {state.t.linkTarget}
                </p>
            </details>
            <dialog
                ref={dialog}
                aria-label={state.t.dialogTitle}
                className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border border-border-dark bg-surface-dark p-5 text-gray-200 backdrop:bg-black/60"
            >
                <div className="flex flex-wrap items-center gap-3">
                    <Menu
                        ariaLabel={state.t.dialogActions}
                        trigger={state.t.dialogActions}
                        items={state.items}
                        onAction={(id) => handler.handleAction(id)}
                        portalContainer={state.dialogContainer}
                    />
                    <button
                        type="button"
                        className="rounded-md border border-border-dark px-3 py-2 text-sm"
                        onClick={handler.handleCloseDialog}
                    >
                        {state.t.close}
                    </button>
                </div>
            </dialog>
        </main>
    )
}
