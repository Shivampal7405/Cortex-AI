import { copyFileSync, mkdirSync, existsSync, cpSync } from 'fs'
import { resolve, dirname } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

const target = process.argv[2] ?? 'chrome'
const outDir = resolve(rootDir, `dist/${target}`)

import { build } from 'esbuild'

// Run vite build for UI
console.log(`Building UI for ${target}...`)
execSync('vite build', { stdio: 'inherit' })

// Run esbuild for background and content scripts
console.log(`Building Background and Content scripts for ${target}...`)
const agents = ['claude', 'chatgpt', 'gemini', 'grok']
const agentEntries = agents.flatMap(agent => {
  const contentPath = resolve(rootDir, `src/agents/${agent}/${agent}.content.ts`)
  const injectedPath = resolve(rootDir, `src/agents/${agent}/${agent}.injected.ts`)
  const entries = []
  if (existsSync(contentPath)) entries.push(contentPath)
  if (existsSync(injectedPath)) entries.push(injectedPath)
  return entries
})

await build({
  entryPoints: [
    resolve(rootDir, 'src/background/background.ts'),
    ...agentEntries
  ],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  outdir: resolve(outDir),
  outbase: 'src'
})

// Copy correct manifest

const manifestSrc  = resolve(rootDir, `manifests/manifest.${target}.json`)
const manifestDest = resolve(outDir, 'manifest.json')
copyFileSync(manifestSrc, manifestDest)
console.log(`✓ Copied manifests/manifest.${target}.json → dist/${target}/manifest.json`)

// Copy icons
const iconsSrc = resolve(rootDir, 'icons')
const iconsDest = resolve(outDir, 'icons')
if (existsSync(iconsSrc)) {
  if (!existsSync(iconsDest)) {
    mkdirSync(iconsDest, { recursive: true })
  }
  const icons = ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png', 'icon-warn-48.png', 'icon-error-48.png']
  icons.forEach(icon => {
    const src = resolve(iconsSrc, icon)
    if (existsSync(src)) {
      copyFileSync(src, resolve(iconsDest, icon))
    }
  })
  console.log(`✓ Copied icons to dist/${target}/icons`)
}

// Build Tailwind CSS for Shadow DOM
console.log('Building content.css via Tailwind CLI...')
execSync(`npx tailwindcss -i src/index.css -o "${resolve(outDir, 'content.css')}" --minify`, { stdio: 'inherit' })

