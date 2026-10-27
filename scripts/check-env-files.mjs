import { execFileSync } from 'node:child_process'

const tracked = execFileSync('git', ['ls-files', '-z', '--', '.env', '.env.*'], { encoding: 'utf8' })
  .split('\0').filter((file) => file && file !== '.env.example')
if (tracked.length) {
  console.error('Environment files must not be tracked by Git:')
  for (const file of tracked) console.error(file)
  process.exitCode = 1
}
