import { constants as bufferConstants } from 'node:buffer'
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs'
import type { RegularFileLimits } from './Types/regular-file.types.ts'

// The caller owns the descriptor. Keeping validation and reads on it prevents
// pathname replacement from changing which file is read.
export function readRegularDescriptor(
    descriptor: number,
    limits: RegularFileLimits = {},
): Buffer {
    const { minBytes = 0, maxBytes = bufferConstants.MAX_LENGTH - 1 } = limits
    if (
        !Number.isSafeInteger(minBytes) ||
        !Number.isSafeInteger(maxBytes) ||
        minBytes < 0 ||
        maxBytes < minBytes ||
        maxBytes >= bufferConstants.MAX_LENGTH
    )
        throw new Error('Invalid regular file size limits')
    const metadata = fstatSync(descriptor)
    if (
        !metadata.isFile() ||
        !Number.isSafeInteger(metadata.size) ||
        metadata.size < minBytes ||
        metadata.size > maxBytes
    )
        throw new Error('Expected regular file within its size limits')

    // One extra byte detects growth without reading an unbounded stream.
    const capacity = metadata.size + 1
    const chunks: Buffer[] = []
    let total = 0
    while (total < capacity) {
        const chunk = Buffer.allocUnsafe(Math.min(65_536, capacity - total))
        const count = readSync(descriptor, chunk, 0, chunk.length, total)
        if (count === 0) break
        chunks.push(chunk.subarray(0, count))
        total += count
    }
    if (total !== metadata.size || fstatSync(descriptor).size !== metadata.size)
        throw new Error('Regular file size changed while reading')
    return Buffer.concat(chunks, total)
}

export function readRegularFile(
    path: string,
    limits: RegularFileLimits = {},
): Buffer {
    // These automation scripts run on Linux. Fail closed on platforms which
    // cannot atomically refuse a final-component symlink, including Windows.
    if (typeof constants.O_NOFOLLOW !== 'number' || constants.O_NOFOLLOW === 0)
        throw new Error('Atomic regular file reads require O_NOFOLLOW support')
    // NONBLOCK prevents a substituted FIFO from hanging before fstat rejects it.
    const descriptor = openSync(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_NONBLOCK ?? 0),
    )
    try {
        return readRegularDescriptor(descriptor, limits)
    } finally {
        closeSync(descriptor)
    }
}
