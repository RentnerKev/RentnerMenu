import type { PackageIdentity } from './release.types.ts'

export interface ExpectedArtifact extends PackageIdentity {
    integrity: string
}

export interface RegistrySnapshot {
    published: PublishedPackage | undefined
    latest: string | undefined
}

export interface PublishedPackage extends PackageIdentity {
    dist: { integrity: string }
    gitHead?: string
}

export interface NpmChannels {
    latest?: string
}
