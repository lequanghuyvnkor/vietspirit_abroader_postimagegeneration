import { spawn, spawnSync } from 'node:child_process'

// WEB_PORT / API_PORT let this run beside another copy of the app (defaults: 5173 and 3001).
const webPort = process.env.WEB_PORT || '5173'
// --prod (npm run start) builds the app once and serves the built files. React's development build is several times
// slower on a big plan (it compares every prop on each keystroke), and a built copy has no file watcher to go stale.
const prod = process.argv.includes('--prod') || process.env.STUDIO_MODE === 'prod'
if (prod) {
  console.log('Building the app…')
  const built = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit', env: process.env })
  if (built.status !== 0) process.exit(built.status ?? 1)
}
const web = prod ? ['preview', '--host', '127.0.0.1', '--port', webPort, '--strictPort'] : ['--host', '127.0.0.1', '--port', webPort, '--strictPort']
const children = [
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...web], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, ['server.mjs'], { stdio: 'inherit', env: process.env }),
]
let stopping = false
function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill(signal)
}
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
for (const child of children) {
  child.on('error', (error) => { console.error(error); stop() })
  child.on('exit', (code) => {
    if (!stopping) {
      stop()
      process.exitCode = code || 0
    }
  })
}
