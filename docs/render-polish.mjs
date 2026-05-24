import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.join(__dirname, 'edicao-polish-vision.html')
const fileUrl = 'file://' + filePath

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()
await page.goto(fileUrl, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

// Full page screenshot
await page.screenshot({
  path: path.join(__dirname, 'edicao-polish-vision.png'),
  fullPage: true,
})

// Per-phone screenshots (zoom 1.5x for premium clarity)
const phones = await page.$$('.phone-card')
for (let i = 0; i < phones.length; i++) {
  const box = await phones[i].boundingBox()
  if (!box) continue
  await page.screenshot({
    path: path.join(__dirname, `edicao-phone-${i + 1}.png`),
    clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 },
  })
}

await browser.close()
console.log('OK · screenshots saved to docs/edicao-polish-vision.png + per-phone PNGs')
