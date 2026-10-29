import { memo } from 'react'
import type { InteractiveItem } from '../../../lib/Menu/navigation.ts'
import { useMenuEntry } from '../Hooks/useMenuEntry.ts'
import type { MenuEntryProps } from '../Types/menu.entry.ts'
import { MenuIndicator } from './MenuIndicator.tsx'

function MenuItemContent({
    item,
    menuId,
    classNames,
    dir,
    level,
}: Pick<MenuEntryProps, 'menuId' | 'classNames' | 'dir' | 'level'> & {
    item: InteractiveItem
}) {
    return (
        <>
            <span
                aria-hidden="true"
                data-rentner-menu-indicator
                className={`flex w-4 shrink-0 items-center justify-center text-rentner-accent ${classNames?.indicator ?? ''}`}
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
                {item.icon && (
                    <span className={classNames?.icon}>{item.icon}</span>
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span
                    id={`${menuId}-label-${level}-${encodeURIComponent(item.id)}`}
                    data-rentner-menu-label
                    className={`block ${classNames?.label ?? ''}`}
                >
                    {item.label}
                </span>
                {item.description && (
                    <span
                        id={`${menuId}-description-${level}-${encodeURIComponent(item.id)}`}
                        data-rentner-menu-description
                        className={`mt-0.5 block text-xs text-rentner-muted ${classNames?.description ?? ''}`}
                    >
                        {item.description}
                    </span>
                )}
            </span>
            {item.shortcut && (
                <span
                    aria-hidden="true"
                    data-rentner-menu-shortcut
                    className={`ms-5 text-xs text-rentner-muted ${classNames?.shortcut ?? ''}`}
                >
                    {item.shortcut}
                </span>
            )}
            {item.type === 'submenu' && (
                <MenuIndicator kind="arrow" rtl={dir === 'rtl'} />
            )}
        </>
    )
}

export const MenuEntry = memo(function MenuEntry(props: MenuEntryProps) {
    const { item, menuId, level, classNames, dir } = props
    const {
        state,
        handler,
        refs: { setNode },
    } = useMenuEntry(props)
    if (item.type === 'separator')
        return (
            <hr
                aria-orientation="horizontal"
                data-rentner-menu-separator
                className={`my-1.5 h-px border-0 bg-rentner-border ${classNames?.separator ?? ''}`}
            />
        )
    if (item.type === 'label')
        return (
            <div
                role="presentation"
                data-rentner-menu-group-label
                className={`px-2.5 py-1.5 text-xs font-semibold text-rentner-muted ${classNames?.groupLabel ?? ''}`}
            >
                {item.label}
            </div>
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
                <MenuItemContent
                    item={item}
                    menuId={menuId}
                    level={level}
                    classNames={classNames}
                    dir={dir}
                />
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
            <MenuItemContent
                item={item}
                menuId={menuId}
                level={level}
                classNames={classNames}
                dir={dir}
            />
        </button>
    )
})
