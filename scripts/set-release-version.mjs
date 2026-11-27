// Sets package.json to <major>.<minor>.<build number> so every release from
// main gets a higher version, which the auto-updater needs to see it as new.
import { readFileSync, writeFileSync } from 'node:fs'

const build = process.argv[2]
if (!/^\d+$/.test(build ?? '')) {
  console.error('Usage: node scripts/set-release-version.mjs <build number>')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const [major, minor] = pkg.version.split('.')
pkg.version = `${major}.${minor}.${build}`
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log(`Version set to ${pkg.version}`)
