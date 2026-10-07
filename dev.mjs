import { spawn } from 'node:child_process'

// WEB_PORT / API_PORT let this run beside another copy of the app (defaults: 5173 and 3001).
const webPort = process.env.WEB_PORT || '5173'
const children = [
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', webPort, '--strictPort'], { stdio: 'inherit', env: process.env }),
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
