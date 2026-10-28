import type {
    PackageIdentity,
    PackedArtifact,
    ReleaseEvent,
    ReleaseMetadata,
} from './Types/release.types.ts'
import { isRecord, positiveInteger } from '../lib/runtime.ts'

export function isReleaseMetadata(value: unknown): value is ReleaseMetadata {
    return (
        isRecord(value) &&
        positiveInteger(value.id) &&
        typeof value.tag_name === 'string' &&
        typeof value.draft === 'boolean' &&
        typeof value.prerelease === 'boolean' &&
        typeof value.published_at === 'string' &&
        (value.body === null || typeof value.body === 'string') &&
        Array.isArray(value.assets) &&
        value.assets.every(
            (asset: unknown) =>
                isRecord(asset) &&
                positiveInteger(asset.id) &&
                typeof asset.name === 'string' &&
                typeof asset.size === 'number' &&
                Number.isSafeInteger(asset.size) &&
                asset.size >= 0 &&
                (asset.digest === null || typeof asset.digest === 'string'),
        )
    )
}

export function isReleaseEvent(value: unknown): value is ReleaseEvent {
    return (
        isRecord(value) &&
        (value.release === undefined || isReleaseMetadata(value.release)) &&
        (value.inputs === undefined ||
            (isRecord(value.inputs) &&
                (value.inputs.tag === undefined ||
                    typeof value.inputs.tag === 'string')))
    )
}

export function isPackageIdentity(value: unknown): value is PackageIdentity {
    return (
        isRecord(value) &&
        typeof value.name === 'string' &&
        typeof value.version === 'string'
    )
}

export function isPackedArtifacts(value: unknown): value is PackedArtifact[] {
    return (
        Array.isArray(value) &&
        value.every(
            (artifact: unknown) =>
                isRecord(artifact) &&
                typeof artifact.name === 'string' &&
                typeof artifact.version === 'string' &&
                typeof artifact.filename === 'string' &&
                Array.isArray(artifact.files) &&
                artifact.files.every(
                    (file: unknown) =>
                        isRecord(file) && typeof file.path === 'string',
                ),
        )
    )
}
