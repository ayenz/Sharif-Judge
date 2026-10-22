// SharIF Judge isolated runner.
//
// Runs in its own container with no network and no server secrets. The web app drops
// job files into JOBS_DIR; this worker runs tester.sh for each one and writes the
// result next to it. Submitted code is compiled and executed as an unprivileged user
// (RUN_UID) that cannot read the data volume, only its own jail directory.
import { spawn } from 'node:child_process'
import { chmod, chown, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const JOBS_DIR = process.env.SHJ_JOBS_DIR || '/data/jobs'
const TESTER = process.env.SHJ_TESTER || '/app/tester'
const DATA_ROOT = process.env.SHJ_DATA_ROOT || '/data/assignments'
const RUN_UID = process.env.SHJ_RUN_UID || '2000'
// Files the tester creates are handed back to the web app's user.
const WEB_UID = Number(process.env.SHJ_WEB_UID || 1000)
const IDLE_MS = 250

const env = {
  PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  LANG: 'en_US.UTF-8',
  HOME: '/tmp',
  SHJ_RUN_UID: RUN_UID,
  SHJ_RUNAS: `setpriv --reuid=${RUN_UID} --regid=${RUN_UID} --clear-groups --no-new-privs env HOME=/tmp`,
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

function runTester(args) {
  return new Promise((resolve) => {
    const child = spawn('bash', ['./tester.sh', ...args], { cwd: TESTER, env, stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.on('error', () => resolve('Judge Error'))
    child.on('close', () => resolve(out))
  })
}

async function cleanup(args) {
  for (const name of await readdir(TESTER).catch(() => [])) {
    if (name.startsWith('jail'))
      await rm(join(TESTER, name), { recursive: true, force: true })
  }
  // tester.sh writes result.html, log and exec_out.txt in <problem dir>/<username>.
  const dir = join(args[0], args[1])
  for (const name of await readdir(dir).catch(() => []))
    await chown(join(dir, name), WEB_UID, WEB_UID).catch(() => {})
  await chown(args[0], WEB_UID, WEB_UID).catch(() => {})
  for (const name of await readdir(args[0]).catch(() => [])) {
    if (name === 'tester.executable')
      await chown(join(args[0], name), WEB_UID, WEB_UID).catch(() => {})
  }
}

function validJob(job) {
  return job && Array.isArray(job.args) && job.args.length >= 17
    && job.args.every(a => typeof a === 'string')
    && job.args[0].startsWith(`${DATA_ROOT}/`) && !job.args[0].includes('..')
    && /^[A-Za-z0-9]+$/.test(job.args[1])
}

async function processJob(name) {
  const id = name.slice(0, -'.job.json'.length)
  const running = join(JOBS_DIR, `${id}.running`)
  try {
    await rename(join(JOBS_DIR, name), running) // claim it
  }
  catch {
    return
  }
  let output = 'Judge Error'
  let job
  try {
    job = JSON.parse(await readFile(running, 'utf8'))
    if (validJob(job))
      output = await runTester(job.args)
    else
      console.error(`[judge] rejected invalid job ${id}`)
  }
  catch (error) {
    console.error(`[judge] job ${id} failed:`, error.message)
  }
  if (validJob(job))
    await cleanup(job.args)
  const result = join(JOBS_DIR, `${id}.result.json`)
  await writeFile(`${result}.tmp`, JSON.stringify({ output }))
  await chown(`${result}.tmp`, WEB_UID, WEB_UID).catch(() => {})
  await rename(`${result}.tmp`, result)
  await rm(running, { force: true })
}

async function main() {
  console.log(`[judge] watching ${JOBS_DIR}, running submissions as uid ${RUN_UID}`)
  // Volumes created by older images may be world-readable: keep the submission user out.
  await mkdir(JOBS_DIR, { recursive: true })
  await chown(JOBS_DIR, WEB_UID, WEB_UID).catch(() => {})
  await chmod(JOBS_DIR, 0o700).catch(() => {})
  for (const dir of ['/data', DATA_ROOT, TESTER])
    await chmod(dir, 0o711).catch(() => {})
  await chmod('/data/cheat', 0o700).catch(() => {})
  // Jobs claimed by a worker that crashed are run again.
  for (const name of await readdir(JOBS_DIR).catch(() => [])) {
    if (name.endsWith('.running'))
      await rename(join(JOBS_DIR, name), join(JOBS_DIR, name.replace(/\.running$/, '.job.json'))).catch(() => {})
  }
  for (;;) {
    const names = (await readdir(JOBS_DIR).catch(() => [])).filter(n => n.endsWith('.job.json')).sort()
    if (!names.length) {
      await sleep(IDLE_MS)
      continue
    }
    for (const name of names)
      await processJob(name)
  }
}

main()
