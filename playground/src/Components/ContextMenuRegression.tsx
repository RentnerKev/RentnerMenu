import { ContextMenu } from '../../../src/shared/Menu/Components/ContextMenu.tsx'
import { Menu } from '../../../src/shared/Menu/Components/Menu.tsx'
import { MenuProvider } from '../../../src/shared/Menu/Components/MenuProvider.tsx'
import { useContextMenuRegressionLogic } from '../Hooks/useContextMenuRegressionLogic.ts'

export function ContextMenuRegression() {
    const { state, handler, setter } = useContextMenuRegressionLogic()

    return (
        <details className="rounded-lg border border-border-dark bg-surface-dark p-4">
            <summary className="cursor-pointer text-sm">
                Kontextmenü-Tests
            </summary>
            <MenuProvider
                align="end"
                contextMenu={{ align: 'start', sideOffset: 8 }}
                style={state.contentStyle}
                classNames={{
                    item: 'text-[#e879f9]!',
                    icon: 'text-[#60a5fa]',
                    indicator: 'text-[#4ade80]!',
                    submenuIndicator: 'text-[#facc15]',
                }}
            >
                <section
                    aria-label="Kontextregression"
                    className="mt-4 grid gap-3"
                >
                    <ContextMenu
                        ariaLabel="Kontext A"
                        items={state.items}
                        onAction={handler.handleAction}
                        longPress
                        targetProps={{
                            'aria-label': 'Kontextziel A',
                            className:
                                'flex min-h-28 flex-wrap items-center gap-3 rounded-md border border-dashed border-border-dark p-4',
                        }}
                    >
                        <button
                            type="button"
                            onClick={handler.handleButton}
                            className="rounded border border-border-dark px-3 py-2"
                        >
                            Zielaktion A
                        </button>
                        <input
                            aria-label="Kontextfeld A"
                            className="w-28 rounded border border-border-dark bg-input-dark px-2 py-1"
                        />
                        <Menu
                            ariaLabel="Eingebettetes Menü"
                            trigger="Eingebettetes Menü"
                            items={state.items}
                            onAction={handler.handleAction}
                        />
                    </ContextMenu>
                    <ContextMenu
                        ariaLabel="Kontext B"
                        items={state.items}
                        open={state.controlledOpen}
                        onOpenChange={setter.setControlledOpen}
                        onAction={handler.handleAction}
                        targetProps={{
                            'aria-label': 'Kontextziel B',
                            className:
                                'min-h-20 rounded-md border border-dashed border-border-dark p-4',
                        }}
                    >
                        <button type="button" onClick={handler.handleButton}>
                            Zielaktion B
                        </button>
                        <input
                            aria-label="Kontextfeld B"
                            className="ms-3 w-28 rounded border border-border-dark bg-input-dark px-2 py-1"
                        />
                    </ContextMenu>
                    <ContextMenu
                        ariaLabel="Kontext RTL"
                        dir="rtl"
                        items={state.items}
                        onAction={handler.handleAction}
                        targetProps={{
                            'aria-label': 'Kontextziel RTL',
                            className:
                                'min-h-20 rounded-md border border-dashed border-border-dark p-4',
                        }}
                    >
                        Kontextziel von rechts nach links
                    </ContextMenu>
                    <ContextMenu
                        ariaLabel="Kontext lokal"
                        side="bottom"
                        align="end"
                        sideOffset={16}
                        items={state.items}
                        targetProps={{
                            'aria-label': 'Kontextziel lokal',
                            className:
                                'min-h-20 rounded-md border border-dashed border-border-dark p-4',
                        }}
                    >
                        Lokale Positionierung
                    </ContextMenu>
                    <button
                        type="button"
                        onClick={handler.handleButton}
                        className="justify-self-start rounded border border-border-dark px-3 py-2"
                    >
                        Nach Kontextzielen
                    </button>
                    <output aria-label="Zielaktionen">
                        Zielaktionen: {state.clicks}
                    </output>
                    <output aria-label="Kontextergebnis">{state.result}</output>
                    <output aria-label="Gesteuerter Kontextzustand">
                        {state.controlledOpen ? 'offen' : 'geschlossen'}
                    </output>
                </section>
            </MenuProvider>
        </details>
    )
}
