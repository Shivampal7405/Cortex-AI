import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const rootDir    = resolve(__dirname, '..')

const arg = process.argv[2] ?? 'chrome'

// Handle build:all by delegating to two sequential builds
if (arg === 'all') {
  execSync('tsx scripts/build.ts chrome',  { stdio: 'inherit', cwd: rootDir })
  execSync('tsx scripts/build.ts firefox', { stdio: 'inherit', cwd: rootDir })
  process.exit(0)
}

const target = arg
const outDir = resolve(rootDir, `dist/${target}`)

import { build } from 'esbuild'

// Run vite build for UI
console.log(`Building UI for ${target}...`)
execSync('vite build', { stdio: 'inherit' })

// Run esbuild for background and content scripts
console.log(`Building background + content scripts for ${target}...`)
const agents       = ['claude', 'chatgpt', 'gemini', 'grok']
const agentEntries = agents.flatMap(agent => {
  const entries = []
  for (const kind of ['content', 'injected', 'tracker']) {
    const p = resolve(rootDir, `src/agents/${agent}/${agent}.${kind}.ts`)
    if (existsSync(p)) entries.push(p)
  }
  return entries
})

await build({
  entryPoints: [
    resolve(rootDir, 'src/background/background.ts'),
    ...agentEntries,
  ],
  bundle:  true,
  minify:  true,
  format:  'iife',
  target:  'es2022',
  outdir:  outDir,
  outbase: 'src',
})

// Copy correct manifest
const manifestSrc  = resolve(rootDir, `manifests/manifest.${target}.json`)
const manifestDest = resolve(outDir, 'manifest.json')
copyFileSync(manifestSrc, manifestDest)
console.log(`✓ Copied manifest.${target}.json → dist/${target}/manifest.json`)

// Copy icons
const iconsSrc  = resolve(rootDir, 'icons')
const iconsDest = resolve(outDir, 'icons')
if (existsSync(iconsSrc)) {
  mkdirSync(iconsDest, { recursive: true })
  const icons = [
    'icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png',
    'icon-warn-48.png', 'icon-error-48.png',
  ]
  for (const icon of icons) {
    const src = resolve(iconsSrc, icon)
    if (existsSync(src)) copyFileSync(src, resolve(iconsDest, icon))
  }
  console.log(`✓ Copied icons to dist/${target}/icons`)
}

// Build Tailwind CSS for Shadow DOM
console.log('Building content.css via Tailwind CLI...')
execSync(
  `npx tailwindcss -i src/index.css -o "${resolve(outDir, 'content.css')}" --minify`,
  { stdio: 'inherit' }
)

// Create store-ready zip
const version = '1.0.0'
const zipPath = resolve(rootDir, `cortex-${target}-v${version}.zip`)
console.log(`Creating ${zipPath}...`)

if (process.platform === 'win32') {
  execSync(
    `powershell -Command "Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  )
} else {
  execSync(`cd "${outDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit', shell: '/bin/bash' })
}

console.log(`✓ Created cortex-${target}-v${version}.zip`)
