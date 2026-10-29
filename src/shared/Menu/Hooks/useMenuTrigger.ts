import { cloneElement, Fragment, isValidElement, useCallback } from 'react'
import type {
    ButtonHTMLAttributes,
    ReactElement,
    Ref,
    RefAttributes,
    SyntheticEvent,
} from 'react'
import type {
    MenuCustomizationProps,
    MenuDirection,
    MenuProps,
} from '../Types/menu.types.ts'

type TriggerProps = ButtonHTMLAttributes<HTMLButtonElement> &
    RefAttributes<HTMLButtonElement>

function composeHandlers(
    child: (event: SyntheticEvent<HTMLButtonElement>) => void,
    parent: (event: SyntheticEvent<HTMLButtonElement>) => void,
) {
    return (event: SyntheticEvent<HTMLButtonElement>) => {
        child(event)
        if (!event.defaultPrevented) parent(event)
    }
}

function attachRef(
    ref: Ref<HTMLButtonElement> | undefined,
    node: HTMLButtonElement,
) {
    if (typeof ref === 'function') {
        const cleanup = ref(node)
        return () => {
            if (typeof cleanup === 'function') cleanup()
            else ref(null)
        }
    }
    if (ref) ref.current = node
    return () => {
        if (ref) ref.current = null
    }
}

export function useMenuTrigger(
    props: MenuProps,
    open: boolean,
    id: string,
    dir: MenuDirection,
    customization: MenuCustomizationProps,
    setTrigger: (node: HTMLButtonElement | null) => () => void,
    handleClick: NonNullable<TriggerProps['onClick']>,
    handleKeyDown: NonNullable<TriggerProps['onKeyDown']>,
) {
    const child =
        props.asChild && isValidElement<TriggerProps>(props.trigger)
            ? props.trigger
            : undefined
    const childRef = child?.props.ref
    const mergedRef = useCallback(
        (node: HTMLButtonElement | null) => {
            if (!node) return
            if (node.tagName !== 'BUTTON')
                throw new Error(
                    'Menu asChild trigger must render a native button.',
                )
            const cleanupChild = attachRef(childRef, node)
            const cleanupMenu = setTrigger(node)
            return () => {
                cleanupChild()
                cleanupMenu()
            }
        },
        [childRef, setTrigger],
    )
    if (
        props.asChild &&
        (!child ||
            child.type === Fragment ||
            (typeof child.type === 'string' && child.type !== 'button'))
    )
        throw new Error('Menu asChild requires a single button element.')

    const buttonProps: TriggerProps = {
        ...props.triggerProps,
        ref: setTrigger,
        type: props.triggerProps?.type ?? 'button',
        disabled: props.disabled,
        'aria-label': props.triggerProps?.['aria-label'] ?? props.ariaLabel,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? `${id}-content-0` : undefined,
        dir,
        className: `inline-flex h-rentner-control-md items-center justify-center gap-2 rounded-rentner-control border border-rentner-border bg-rentner-control px-3 font-sans text-sm text-rentner-foreground outline-none focus-visible:ring-2 focus-visible:ring-rentner-accent disabled:cursor-not-allowed disabled:opacity-40 ${customization.classNames?.trigger ?? ''} ${props.triggerProps?.className ?? ''}`,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
    }
    let customTrigger: ReactElement | undefined
    if (child) {
        const customButtonProps: TriggerProps = {
            ...buttonProps,
            onClick(event) {
                if (!event.currentTarget.disabled) handleClick(event)
            },
            onKeyDown(event) {
                if (!event.currentTarget.disabled) handleKeyDown(event)
            },
        }
        const merged: Record<string, unknown> = {
            ...child.props,
            ...customButtonProps,
            ref: mergedRef,
            type: props.triggerProps?.type ?? child.props.type ?? 'button',
            disabled: props.disabled || child.props.disabled,
            'aria-label':
                props.triggerProps?.['aria-label'] ??
                child.props['aria-label'] ??
                props.ariaLabel,
            className: `${child.props.className ?? ''} ${customization.classNames?.trigger ?? ''} ${props.triggerProps?.className ?? ''}`,
            style: { ...child.props.style, ...props.triggerProps?.style },
            'data-rentner-menu-trigger': '',
            'data-size': customization.controlSize ?? 'md',
        }
        for (const [key, parentHandler] of Object.entries(customButtonProps)) {
            const childHandler = (child.props as Record<string, unknown>)[key]
            if (
                /^on[A-Z]/.test(key) &&
                typeof parentHandler === 'function' &&
                typeof childHandler === 'function'
            )
                merged[key] = composeHandlers(
                    childHandler as (
                        event: SyntheticEvent<HTMLButtonElement>,
                    ) => void,
                    parentHandler as (
                        event: SyntheticEvent<HTMLButtonElement>,
                    ) => void,
                )
        }
        customTrigger = cloneElement(child, merged)
    }
    return { state: { buttonProps, customTrigger } }
}
