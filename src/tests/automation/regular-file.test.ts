import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import * as fs from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import {
    readRegularDescriptor,
    readRegularFile,
} from '../../../.github/scripts/lib/regularFile.ts'
import {
    readNotes,
    startMarker,
} from '../../../.github/scripts/release/notes.ts'

const directories: string[] = []
const supportsNoFollow =
    typeof fs.constants.O_NOFOLLOW === 'number' && fs.constants.O_NOFOLLOW !== 0
const posixTest = supportsNoFollow ? test : test.skip

function fixture(contents: string | Buffer = 'release notes') {
    const directory = fs.mkdtempSync(join(tmpdir(), 'rentner-regular-file-'))
    directories.push(directory)
    const path = join(directory, 'artifact')
    fs.writeFileSync(path, contents)
    return { directory, path }
}

// Deliberately replace the fixture's pathname while its original descriptor is
// open. This models an attacker swapping the file after open, not a safe read.
function replaceFixture(target: ReturnType<typeof fixture>) {
    fs.renameSync(target.path, join(target.directory, 'original'))
    fs.writeFileSync(target.path, 'replacement')
}

afterEach(() => {
    for (const directory of directories.splice(0)) {
        const absolute = resolve(directory)
        if (
            !absolute.startsWith(`${resolve(tmpdir())}${sep}`) ||
            !basename(absolute).startsWith('rentner-regular-file-')
        )
            throw new Error('Refusing cleanup outside test fixture directory')
        fs.rmSync(absolute, { recursive: true, force: true })
    }
})

describe('descriptor-bound regular file reads', () => {
    test('reads bytes without changing tarball SHA512 integrity', () => {
        const bytes = Buffer.from([0, 255, 1, 128, 0, 37])
        const { path } = fixture(bytes)
        const descriptor = fs.openSync(path, fs.constants.O_RDONLY)
        try {
            const actual = readRegularDescriptor(descriptor)
            expect(actual).toEqual(bytes)
            expect(createHash('sha512').update(actual).digest('base64')).toBe(
                createHash('sha512').update(bytes).digest('base64'),
            )
        } finally {
            fs.closeSync(descriptor)
        }
    })

    posixTest('reads the opened file when its pathname is replaced', () => {
        const target = fixture('original')
        const descriptor = fs.openSync(target.path, fs.constants.O_RDONLY)
        try {
            replaceFixture(target)
            expect(readRegularDescriptor(descriptor).toString()).toBe(
                'original',
            )
        } finally {
            fs.closeSync(descriptor)
        }
    })

    test('accepts the exact notes limit and rejects empty/oversized notes', () => {
        for (const size of [0, 1_000_000, 1_000_001]) {
            const { path } = fixture(Buffer.alloc(size, 65))
            const descriptor = fs.openSync(path, fs.constants.O_RDONLY)
            try {
                const read = () =>
                    readRegularDescriptor(descriptor, {
                        minBytes: 1,
                        maxBytes: 1_000_000,
                    })
                if (size === 1_000_000) expect(read().length).toBe(size)
                else expect(read).toThrow('size limits')
            } finally {
                fs.closeSync(descriptor)
            }
        }
    })

    test('rejects growth after fstat without reading beyond the sentinel', () => {
        const { path } = fixture('abc')
        const descriptor = fs.openSync(path, fs.constants.O_RDONLY)
        const originalStat = fs.fstatSync
        const stat = spyOn(fs, 'fstatSync').mockImplementationOnce((fd) => {
            const metadata = originalStat(fd)
            fs.appendFileSync(path, 'x'.repeat(100_000))
            return metadata
        })
        const originalRead = fs.readSync
        let bytesRead = 0
        const read = spyOn(fs, 'readSync').mockImplementation(
            (fd, buffer, offset, length, position) => {
                const count = originalRead(fd, buffer, offset, length, position)
                bytesRead += count
                return count
            },
        )
        try {
            expect(() => readRegularDescriptor(descriptor)).toThrow(
                'size changed',
            )
            expect(bytesRead).toBe(4)
        } finally {
            stat.mockRestore()
            read.mockRestore()
            fs.closeSync(descriptor)
        }
    })

    test('rejects truncation after fstat', () => {
        const { path } = fixture('abc')
        const descriptor = fs.openSync(path, fs.constants.O_RDONLY)
        const originalStat = fs.fstatSync
        const stat = spyOn(fs, 'fstatSync').mockImplementationOnce((fd) => {
            const metadata = originalStat(fd)
            fs.truncateSync(path, 0)
            return metadata
        })
        try {
            expect(() => readRegularDescriptor(descriptor)).toThrow(
                'size changed',
            )
        } finally {
            stat.mockRestore()
            fs.closeSync(descriptor)
        }
    })

    test('rejects invalid byte limits', () => {
        const { path } = fixture()
        const descriptor = fs.openSync(path, fs.constants.O_RDONLY)
        try {
            for (const limits of [
                { minBytes: -1 },
                { maxBytes: 1.5 },
                { minBytes: 4, maxBytes: 3 },
                { maxBytes: Number.POSITIVE_INFINITY },
            ])
                expect(() => readRegularDescriptor(descriptor, limits)).toThrow(
                    'Invalid regular file size limits',
                )
        } finally {
            fs.closeSync(descriptor)
        }
    })

    ;(supportsNoFollow ? test.skip : test)(
        'fails closed when atomic no-follow opens are unavailable',
        () => {
            const { path } = fixture()
            expect(() => readRegularFile(path)).toThrow('O_NOFOLLOW support')
        },
    )

    posixTest('rejects a symlink and a directory', () => {
        const { path, directory } = fixture()
        const link = join(directory, 'link')
        fs.symlinkSync(path, link)
        expect(() => readRegularFile(link)).toThrow()
        expect(() => readRegularFile(directory)).toThrow()
    })

    posixTest('rejects a FIFO without waiting for a writer', () => {
        const { directory } = fixture()
        const pipe = join(directory, 'pipe')
        execFileSync('mkfifo', [pipe])
        expect(() => readRegularFile(pipe)).toThrow('regular file')
    })

    posixTest('closes its descriptor on successful and rejected reads', () => {
        const { path } = fixture('abc')
        const close = spyOn(fs, 'closeSync')
        try {
            expect(readRegularFile(path).toString()).toBe('abc')
            expect(() => readRegularFile(path, { maxBytes: 2 })).toThrow()
            expect(close).toHaveBeenCalledTimes(2)
            for (const [descriptor] of close.mock.calls)
                expect(() => fs.fstatSync(descriptor)).toThrow()
        } finally {
            close.mockRestore()
        }
    })

    posixTest(
        'preserves UTF8 notes and rejects NUL and managed markers',
        () => {
            const { path } = fixture('Gude – Änderung\n')
            expect(readNotes(path)).toBe('Gude – Änderung\n')
            for (const contents of ['bad\0notes', startMarker]) {
                fs.writeFileSync(path, contents)
                expect(() => readNotes(path)).toThrow(
                    'Invalid release notes contents',
                )
            }
        },
    )
})
