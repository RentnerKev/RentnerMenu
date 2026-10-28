import { writeFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { isMain, parseJson } from '../lib/runtime.ts'
import {
    checkoutOperations,
    preparedManifest,
    verifySourceCheckout,
} from './identity.ts'
import { isPackageIdentity } from './releaseValidation.ts'
import type { ReleasePreparationOperations } from './Types/release.types.ts'

export function prepareRelease(
    operations: ReleasePreparationOperations = {
        ...checkoutOperations,
        writeManifest: (text) => writeFileSync('package.json', text),
    },
) {
    const source = verifySourceCheckout(operations)
    const manifest = parseJson(operations.readManifest(), isPackageIdentity)
    const prepared = preparedManifest(source)
    if (
        !isDeepStrictEqual(manifest, source.manifest) &&
        !isDeepStrictEqual(manifest, prepared)
    )
        throw new Error(
            'Release preparation refuses unrelated manifest changes',
        )
    operations.writeManifest(`${JSON.stringify(prepared, null, 4)}\n`)
    return source
}

if (isMain(import.meta.url)) prepareRelease()
