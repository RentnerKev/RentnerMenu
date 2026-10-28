import { CustomSelect, SelectProvider } from '@rentnerkev/select'
import { Menu } from '../../src/shared/Menu/Components/Menu.tsx'
import { ContextMenu } from '../../src/shared/Menu/Components/ContextMenu.tsx'
import { MenuProvider } from '../../src/shared/Menu/Components/MenuProvider.tsx'
import { usePlaygroundLogic } from './Hooks/usePlaygroundLogic.ts'
import {
    alignOptions,
    directionOptions,
    localeOptions,
    sideOptions,
    sizeOptions,
} from './config/playground.config.ts'
import type { Locale, Settings } from './Types/playground.types.ts'

export function App() {
    const {
        state,
        handler,
        setter,
        refs: { dialog },
    } = usePlaygroundLogic()
    return (
        <SelectProvider locale={state.locale} controlSize="sm">
            <div className="page-shell">
                <header className="topbar">
                    <a className="wordmark" href="#main">
                        <span className="brand-symbol" aria-hidden="true">
                            r<span>›</span>
                        </span>
                        <span>
                            Rentner<span className="text-accent">Menu</span>
                        </span>
                        <span className="version">PLAYGROUND</span>
                    </a>
                    <div className="header-controls">
                        <CustomSelect
                            label={state.t.language}
                            options={localeOptions}
                            value={state.locale}
                            onValueChange={(value) =>
                                setter.setLocale(value as Locale)
                            }
                            className="locale-select"
                        />
                        <button
                            className="icon-button"
                            type="button"
                            aria-label={
                                state.theme === 'dark'
                                    ? 'Light theme'
                                    : 'Dark theme'
                            }
                            onClick={handler.handleToggleTheme}
                        >
                            {state.theme === 'dark' ? '☀' : '☾'}
                        </button>
                    </div>
                </header>
                <main id="main">
                    <section className="hero">
                        <div>
                            <p className="eyebrow">
                                <span className="status-dot" />
                                @rentnerkev/menu
                            </p>
                            <h1>{state.t.title}</h1>
                            <p className="intro">{state.t.intro}</p>
                        </div>
                        <div className="keyboard-note" aria-hidden="true">
                            <span>⌘</span>
                            <span>↑</span>
                            <span>↵</span>
                            <p>click. navigate. done.</p>
                        </div>
                    </section>
                    <MenuProvider
                        dir={state.settings.dir}
                        controlSize={state.settings.controlSize}
                        side={state.settings.side}
                        align={state.settings.align}
                        loop={state.settings.loop}
                    >
                        <div className="workspace-layout">
                            <section
                                className="panel workspace"
                                aria-labelledby="files-heading"
                            >
                                <div className="panel-heading">
                                    <div>
                                        <p className="eyebrow">WORKSPACE</p>
                                        <h2 id="files-heading">
                                            {state.t.files}
                                            <span className="count">
                                                {state.displayedFiles.length}
                                            </span>
                                        </h2>
                                    </div>
                                    <div className="toolbar">
                                        <button
                                            className="subtle-button"
                                            onClick={handler.handleCreate}
                                            type="button"
                                        >
                                            + {state.t.create}
                                        </button>
                                        <Menu
                                            ariaLabel={state.t.actions}
                                            trigger={
                                                <>
                                                    {state.t.actions}{' '}
                                                    <span aria-hidden="true">
                                                        ⌄
                                                    </span>
                                                </>
                                            }
                                            items={state.items}
                                            disabled={state.settings.disabled}
                                            onAction={(id) =>
                                                handler.handleAction(id)
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="workspace-path">
                                    <span aria-hidden="true">⌂</span>
                                    <span>{state.t.workspace}</span>
                                    <span>/</span>
                                    <strong>RentnerMenu</strong>
                                    <button
                                        type="button"
                                        onClick={handler.handleReset}
                                    >
                                        {state.t.reset} ↺
                                    </button>
                                </div>
                                <div className="file-column-head">
                                    <span>{state.t.name}</span>
                                    <span>{state.t.type}</span>
                                    <span>KB</span>
                                </div>
                                <div
                                    className={`file-list ${state.compact ? 'compact' : ''}`}
                                    dir={state.settings.dir}
                                >
                                    {state.displayedFiles.map((file) => (
                                        <ContextMenu
                                            key={file.id}
                                            ariaLabel={`${state.t.context}: ${file.name}`}
                                            disabled={state.settings.disabled}
                                            items={handler.fileItems(file.id)}
                                            onAction={(id) =>
                                                handler.handleAction(
                                                    id,
                                                    file.id,
                                                )
                                            }
                                            longPress
                                            targetProps={{
                                                'aria-label': file.name,
                                                onFocus: () =>
                                                    handler.handleSelect(
                                                        file.id,
                                                    ),
                                                onContextMenu: () =>
                                                    handler.handleSelect(
                                                        file.id,
                                                    ),
                                                className: `file-row ${state.selected?.id === file.id ? 'selected' : ''}`,
                                            }}
                                        >
                                            <button
                                                className="file-select"
                                                type="button"
                                                onClick={() =>
                                                    handler.handleSelect(
                                                        file.id,
                                                    )
                                                }
                                                aria-pressed={
                                                    state.selected?.id ===
                                                    file.id
                                                }
                                            >
                                                <span
                                                    className={`file-icon ${file.color}`}
                                                    aria-hidden="true"
                                                >
                                                    {file.kind === 'DIR'
                                                        ? '▰'
                                                        : '⌘'}
                                                </span>
                                                <span>{file.name}</span>
                                            </button>
                                            <span className="file-kind">
                                                {file.kind}
                                            </span>
                                            <span className="file-size">
                                                {file.size}
                                            </span>
                                        </ContextMenu>
                                    ))}
                                </div>
                                <div className="workspace-bottom">
                                    <span>
                                        <kbd>⇧</kbd> <kbd>F10</kbd>{' '}
                                        {state.t.hint}
                                    </span>
                                    <span>
                                        {state.t.selected}:{' '}
                                        <strong>
                                            {state.selected?.name ?? '—'}
                                        </strong>
                                    </span>
                                </div>
                                {state.preview ? (
                                    <output className="file-preview">
                                        <span aria-hidden="true">↗</span>{' '}
                                        {state.t.opened}:{' '}
                                        <strong>{state.preview}</strong>
                                        <code>
                                            {
                                                '{ "package": "@rentnerkev/menu", "ready": true }'
                                            }
                                        </code>
                                    </output>
                                ) : null}
                            </section>
                            <aside
                                className="panel inspector"
                                aria-labelledby="inspector-heading"
                            >
                                <div className="panel-heading">
                                    <div>
                                        <p className="eyebrow">LIVE CONFIG</p>
                                        <h2 id="inspector-heading">
                                            {state.t.inspector}
                                        </h2>
                                    </div>
                                    <span
                                        className="config-symbol"
                                        aria-hidden="true"
                                    >
                                        ⚙
                                    </span>
                                </div>
                                <p className="panel-description">
                                    {state.t.inspectHint}
                                </p>
                                <div className="control-grid">
                                    <CustomSelect
                                        label={state.t.direction}
                                        options={directionOptions}
                                        value={state.settings.dir}
                                        onValueChange={(value) =>
                                            handler.handleSetting(
                                                'dir',
                                                value as Settings['dir'],
                                            )
                                        }
                                    />
                                    <CustomSelect
                                        label={state.t.size}
                                        options={sizeOptions}
                                        value={state.settings.controlSize}
                                        onValueChange={(value) =>
                                            handler.handleSetting(
                                                'controlSize',
                                                value as Settings['controlSize'],
                                            )
                                        }
                                    />
                                    <CustomSelect
                                        label={state.t.side}
                                        options={sideOptions}
                                        value={state.settings.side}
                                        onValueChange={(value) =>
                                            handler.handleSetting(
                                                'side',
                                                value as Settings['side'],
                                            )
                                        }
                                    />
                                    <CustomSelect
                                        label={state.t.align}
                                        options={alignOptions}
                                        value={state.settings.align}
                                        onValueChange={(value) =>
                                            handler.handleSetting(
                                                'align',
                                                value as Settings['align'],
                                            )
                                        }
                                    />
                                </div>
                                <label className="toggle-row">
                                    <span>{state.t.loop}</span>
                                    <input
                                        type="checkbox"
                                        checked={state.settings.loop}
                                        onChange={(event) =>
                                            handler.handleSetting(
                                                'loop',
                                                event.target.checked,
                                            )
                                        }
                                    />
                                </label>
                                <label className="toggle-row">
                                    <span>{state.t.disabled}</span>
                                    <input
                                        type="checkbox"
                                        checked={state.settings.disabled}
                                        onChange={(event) =>
                                            handler.handleSetting(
                                                'disabled',
                                                event.target.checked,
                                            )
                                        }
                                    />
                                </label>
                                <div className="config-readout">
                                    <span>
                                        side: <b>{state.settings.side}</b>
                                    </span>
                                    <span>
                                        align: <b>{state.settings.align}</b>
                                    </span>
                                    <span>
                                        dir: <b>{state.settings.dir}</b>
                                    </span>
                                </div>
                            </aside>
                        </div>
                        <section
                            className="examples-section"
                            aria-labelledby="examples-heading"
                        >
                            <div className="section-heading">
                                <div>
                                    <h2 id="examples-heading">
                                        {state.t.fixtures}
                                    </h2>
                                    <p>{state.t.fixturesHint}</p>
                                </div>
                                <span className="section-rule" />
                            </div>
                            <div className="example-grid">
                                <article className="example-card">
                                    <span
                                        className="example-symbol"
                                        aria-hidden="true"
                                    >
                                        ☷
                                    </span>
                                    <h3>{state.t.preferences}</h3>
                                    <p>{state.t.persistent}</p>
                                    <Menu
                                        ariaLabel={state.t.preferences}
                                        trigger={
                                            <>
                                                {state.t.options}{' '}
                                                <span aria-hidden="true">
                                                    ⌄
                                                </span>
                                            </>
                                        }
                                        items={state.preferences}
                                    />
                                </article>
                                <article className="example-card">
                                    <span
                                        className="example-symbol"
                                        aria-hidden="true"
                                    >
                                        ⇄
                                    </span>
                                    <h3>{state.t.controlled}</h3>
                                    <p>{state.t.controlledHint}</p>
                                    <div className="example-controls">
                                        <Menu
                                            ariaLabel={
                                                state.t.controlledTrigger
                                            }
                                            trigger={state.t.controlledTrigger}
                                            items={state.items}
                                            open={state.controlledOpen}
                                            onOpenChange={
                                                setter.setControlledOpen
                                            }
                                            onAction={(id) =>
                                                handler.handleAction(id)
                                            }
                                        />
                                        <button
                                            className="small-button"
                                            type="button"
                                            onClick={
                                                handler.handleToggleControlled
                                            }
                                        >
                                            {state.t.toggle}
                                        </button>
                                        <span
                                            className="state-chip"
                                            data-open={state.controlledOpen}
                                        >
                                            {state.controlledOpen
                                                ? state.t.statusOpen
                                                : state.t.statusClosed}
                                        </span>
                                    </div>
                                </article>
                                <article className="example-card">
                                    <span
                                        className="example-symbol"
                                        aria-hidden="true"
                                    >
                                        ←
                                    </span>
                                    <h3>{state.t.rtl}</h3>
                                    <p>{state.t.rtlHint}</p>
                                    <Menu
                                        dir="rtl"
                                        ariaLabel={state.t.rtlTrigger}
                                        trigger={
                                            <>
                                                {state.t.rtlTrigger}{' '}
                                                <span aria-hidden="true">
                                                    ←
                                                </span>
                                            </>
                                        }
                                        items={state.items}
                                        onAction={(id) =>
                                            handler.handleAction(id)
                                        }
                                    />
                                </article>
                                <article className="example-card">
                                    <span
                                        className="example-symbol"
                                        aria-hidden="true"
                                    >
                                        ▣
                                    </span>
                                    <h3>{state.t.dialog}</h3>
                                    <p>{state.t.dialogHint}</p>
                                    <button
                                        className="subtle-button"
                                        type="button"
                                        onClick={handler.handleDialog}
                                    >
                                        {state.t.showDialog} ↗
                                    </button>
                                </article>
                            </div>
                        </section>
                        <div className="bottom-grid">
                            <section
                                className="panel log-panel"
                                aria-labelledby="log-heading"
                            >
                                <div className="panel-heading">
                                    <h2 id="log-heading">
                                        {state.t.log}
                                        <span className="count">
                                            {state.logs.length}
                                        </span>
                                    </h2>
                                    <button
                                        type="button"
                                        className="small-button"
                                        onClick={handler.handleClear}
                                    >
                                        {state.t.clear}
                                    </button>
                                </div>
                                <ol
                                    className="log-list"
                                    aria-live="polite"
                                    aria-relevant="additions"
                                >
                                    {state.logs.length ? (
                                        state.logs.map((entry) => (
                                            <li key={entry.id}>
                                                <span className="log-index">
                                                    {String(entry.id).padStart(
                                                        2,
                                                        '0',
                                                    )}
                                                </span>
                                                <div>
                                                    <strong>
                                                        {entry.action}
                                                    </strong>
                                                    <span>{entry.detail}</span>
                                                </div>
                                                <span
                                                    className="log-dot"
                                                    aria-hidden="true"
                                                />
                                            </li>
                                        ))
                                    ) : (
                                        <li className="empty-log">
                                            <span aria-hidden="true">↳</span>
                                            <p>{state.t.empty}</p>
                                        </li>
                                    )}
                                </ol>
                            </section>
                            <section
                                className="panel code-panel"
                                aria-labelledby="code-heading"
                            >
                                <div className="panel-heading">
                                    <h2 id="code-heading">{state.t.code}</h2>
                                    <button
                                        className="small-button"
                                        type="button"
                                        onClick={() =>
                                            void handler.handleCopy()
                                        }
                                    >
                                        {state.t.copy} ⧉
                                    </button>
                                </div>
                                <pre
                                    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Scrollable code needs keyboard access in Safari.
                                    tabIndex={0}
                                    aria-labelledby="code-heading"
                                >
                                    <code>{state.code}</code>
                                </pre>
                                <output className="copy-status">
                                    {state.copyMessage}
                                </output>
                            </section>
                        </div>
                        <section className="edge-area">
                            <div>
                                <h3>{state.t.edge}</h3>
                                <p>{state.t.edgeHint}</p>
                            </div>
                            <Menu
                                ariaLabel={state.t.edgeTrigger}
                                trigger={<>{state.t.edgeTrigger} ↘</>}
                                side="right"
                                align="end"
                                items={state.items}
                                onAction={(id) => handler.handleAction(id)}
                            />
                        </section>
                        <dialog
                            ref={dialog}
                            className="demo-dialog"
                            aria-labelledby="dialog-title"
                        >
                            <p className="eyebrow">PORTAL CONTAINER</p>
                            <h2 id="dialog-title">{state.t.dialogTitle}</h2>
                            <p>{state.t.dialogHint}</p>
                            <div className="dialog-actions">
                                <Menu
                                    ariaLabel={state.t.dialogTrigger}
                                    trigger={state.t.dialogTrigger}
                                    portalContainer={state.dialogContainer}
                                    items={state.items}
                                    onAction={(id) => handler.handleAction(id)}
                                />
                                <button
                                    type="button"
                                    className="subtle-button"
                                    onClick={handler.handleCloseDialog}
                                >
                                    {state.t.close}
                                </button>
                            </div>
                        </dialog>
                    </MenuProvider>
                </main>
                <footer>
                    <span>@rentnerkev/menu</span>
                    <span>{state.t.footer}</span>
                    <a href="#main">↑</a>
                </footer>
            </div>
        </SelectProvider>
    )
}
