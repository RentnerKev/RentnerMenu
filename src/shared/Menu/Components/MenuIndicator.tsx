export function MenuIndicator({
    kind,
    rtl = false,
}: {
    kind: 'check' | 'radio' | 'arrow'
    rtl?: boolean
}) {
    return (
        <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0"
        >
            {kind === 'check' && (
                <path
                    d="m3.5 8 3 3 6-6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
            {kind === 'radio' && (
                <circle cx="8" cy="8" r="3" fill="currentColor" />
            )}
            {kind === 'arrow' && (
                <path
                    d={rtl ? 'm10 4-4 4 4 4' : 'm6 4 4 4-4 4'}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </svg>
    )
}
