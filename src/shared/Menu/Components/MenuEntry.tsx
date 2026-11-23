import { memo } from 'react'
import type { InteractiveItem } from '../../../lib/Menu/navigation.ts'
import { useMenuEntry } from '../Hooks/useMenuEntry.ts'
import type { MenuEntryProps } from '../Types/menu.entry.ts'
import { MenuIndicator } from './MenuIndicator.tsx'

const BASE_INDICATOR_CLASS =
    'flex w-4 shrink-0 items-center justify-center text-rentner-accent'
const BASE_ICON_CLASS = 'flex w-4 shrink-0 items-center justify-center'
const BASE_LABEL_CLASS = 'block'
const BASE_DESCRIPTION_CLASS = 'mt-0.5 block text-xs text-rentner-muted'
const BASE_SHORTCUT_CLASS = 'ms-5 text-xs text-rentner-muted'
const BASE_SUBMENU_INDICATOR_CLASS = 'flex shrink-0'
const BASE_SEPARATOR_CLASS = 'my-1.5 h-px border-0 bg-rentner-border'
const BASE_GROUP_LABEL_CLASS =
    'px-2.5 py-1.5 text-xs font-semibold text-rentner-muted'

function renderMenuItemContent(
    item: InteractiveItem,
    labelId: string,
    descriptionId: string | undefined,
    errorId: string | undefined,
    classNames: MenuEntryProps['classNames'],
    dir: MenuEntryProps['dir'],
    reserveIcon: boolean | undefined,
    reserveIndicator: boolean | undefined,
    actionState: MenuEntryProps['actionState'],
) {
    return (
        <>
            <span
                aria-hidden="true"
                data-rentner-menu-leading
                className="flex min-w-4 shrink-0 items-center justify-center gap-1"
            >
                {(reserveIndicator ||
                    item.type === 'checkbox' ||
                    item.type === 'radio') && (
                    <span
                        data-rentner-menu-indicator
                        className={
                            classNames?.indicator
                                ? `${BASE_INDICATOR_CLASS} ${classNames.indicator}`
                                : BASE_INDICATOR_CLASS
                        }
                    >
                        {(item.type === 'checkbox' || item.type === 'radio') &&
                            item.checked && (
                                <MenuIndicator
                                    kind={
                                        item.type === 'radio'
                                            ? 'radio'
                                            : item.checked === 'indeterminate'
                                              ? 'mixed'
                                              : 'check'
                                    }
                                />
                            )}
                    </span>
                )}
                {(reserveIcon || item.icon) && (
                    <span
                        data-rentner-menu-icon
                        className={
                            classNames?.icon
                                ? `${BASE_ICON_CLASS} ${classNames.icon}`
                                : BASE_ICON_CLASS
                        }
                    >
                        {item.icon}
                    </span>
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span
                    id={labelId}
                    data-rentner-menu-label
                    className={
                        classNames?.label
                            ? `${BASE_LABEL_CLASS} ${classNames.label}`
                            : BASE_LABEL_CLASS
                    }
                >
                    {item.label}
                </span>
                {(item.type === undefined || item.type === 'item') &&
                    actionState && (
                        <span
                            id={errorId}
                            role={actionState === 'error' ? 'alert' : 'status'}
                            className={
                                actionState === 'error'
                                    ? 'mt-0.5 block text-xs text-rentner-danger'
                                    : 'mt-0.5 block text-xs text-rentner-muted'
                            }
                        >
                            {actionState === 'pending'
                                ? (item.pendingLabel ?? 'Working…')
                                : (item.errorLabel ??
                                  'Action failed. Try again.')}
                        </span>
                    )}
                {item.description && (
                    <span
                        id={descriptionId}
                        data-rentner-menu-description
                        className={
                            classNames?.description
                                ? `${BASE_DESCRIPTION_CLASS} ${classNames.description}`
                                : BASE_DESCRIPTION_CLASS
                        }
                    >
                        {item.description}
                    </span>
                )}
            </span>
            {item.shortcut && (
                <span
                    aria-hidden="true"
                    data-rentner-menu-shortcut
                    className={
                        classNames?.shortcut
                            ? `${BASE_SHORTCUT_CLASS} ${classNames.shortcut}`
                            : BASE_SHORTCUT_CLASS
                    }
                >
                    {item.shortcut}
                </span>
            )}
            {item.type === 'submenu' && (
                <span
                    aria-hidden="true"
                    data-rentner-menu-submenu-indicator
                    className={
                        classNames?.submenuIndicator
                            ? `${BASE_SUBMENU_INDICATOR_CLASS} ${classNames.submenuIndicator}`
                            : BASE_SUBMENU_INDICATOR_CLASS
                    }
                >
                    <MenuIndicator kind="arrow" rtl={dir === 'rtl'} />
                </span>
            )}
        </>
    )
}

export function renderStaticMenuEntry(
    item: Extract<MenuEntryProps['item'], { type: 'separator' | 'label' }>,
    classNames: MenuEntryProps['classNames'],
) {
    if (item.type === 'separator')
        return (
            <hr
                key={item.id}
                aria-orientation="horizontal"
                data-rentner-menu-separator
                className={
                    classNames?.separator
                        ? `${BASE_SEPARATOR_CLASS} ${classNames.separator}`
                        : BASE_SEPARATOR_CLASS
                }
            />
        )
    return (
        <div
            key={item.id}
            role="presentation"
            data-rentner-menu-group-label
            className={
                classNames?.groupLabel
                    ? `${BASE_GROUP_LABEL_CLASS} ${classNames.groupLabel}`
                    : BASE_GROUP_LABEL_CLASS
            }
        >
            {item.label}
        </div>
    )
}

export const InteractiveMenuEntry = memo(function InteractiveMenuEntry(
    props: MenuEntryProps & { item: InteractiveItem },
) {
    const {
        item,
        classNames,
        dir,
        reserveIcon,
        reserveIndicator,
        actionState,
    } = props
    const {
        state,
        handler,
        refs: { setNode },
    } = useMenuEntry(props)
    const content = renderMenuItemContent(
        item,
        state.labelId,
        state.descriptionId,
        state.errorId,
        classNames,
        dir,
        reserveIcon,
        reserveIndicator,
        actionState,
    )
    if (item.type === 'link')
        return (
            <a
                {...state.attributes}
                ref={setNode}
                href={item.disabled ? undefined : item.href}
                target={item.target}
                rel={item.rel}
                download={item.download}
                onFocus={handler.handleFocus}
                onPointerEnter={handler.handlePointerEnter}
                onPointerLeave={handler.handlePointerLeave}
                onPointerDown={handler.handlePointerDown}
                onClick={handler.handleClick}
                onAuxClick={handler.handleAuxClick}
            >
                {content}
            </a>
        )
    return (
        <button
            {...state.attributes}
            type="button"
            ref={setNode}
            onFocus={handler.handleFocus}
            onPointerEnter={handler.handlePointerEnter}
            onPointerLeave={handler.handlePointerLeave}
            onPointerDown={handler.handlePointerDown}
            onClick={handler.handleClick}
        >
            {content}
        </button>
    )
})

export const MenuEntry = memo(function MenuEntry(props: MenuEntryProps) {
    const { item, classNames } = props
    if (item.type === 'separator' || item.type === 'label')
        return renderStaticMenuEntry(item, classNames)
    return <InteractiveMenuEntry {...props} item={item} />
})
