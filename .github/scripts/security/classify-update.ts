import { isMain, output } from '../lib/runtime.ts'

export function updateLevel(
    maintainerChanges: string | undefined,
    updateType: string | undefined,
): string {
    if (maintainerChanges !== 'false') return ''
    if (updateType === 'version-update:semver-patch') return 'patch'
    if (updateType === 'version-update:semver-minor') return 'minor'
    return ''
}

if (isMain(import.meta.url))
    output(
        'update-level',
        updateLevel(process.env.MAINTAINER_CHANGES, process.env.UPDATE_TYPE),
    )
