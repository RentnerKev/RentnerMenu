import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = resolve(root, 'dist')
if (dirname(output) !== resolve(root)) {
    throw new Error('Build output must be the package-local dist directory')
}
rmSync(output, { recursive: true, force: true })
