import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4178'

export default defineConfig({
    testDir: './src/tests',
    testMatch: '**/*.browser.spec.ts',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 2,
    reporter: 'list',
    use: { baseURL, trace: 'retain-on-failure' },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
    webServer: {
        command: 'bun --cwd playground dev -- --host 127.0.0.1 --port 4178',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
})
