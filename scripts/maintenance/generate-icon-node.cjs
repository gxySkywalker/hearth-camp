const sharp = require('sharp')
const fs = require('node:fs')
const path = require('node:path')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#202844"/><stop offset="1" stop-color="#0c101a"/></linearGradient><linearGradient id="p" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#8b9cff"/><stop offset="1" stop-color="#79d8b5"/></linearGradient></defs>
<rect x="20" y="20" width="472" height="472" rx="126" fill="url(#b)"/><rect x="28" y="28" width="456" height="456" rx="118" fill="none" stroke="#9eacff" stroke-opacity=".2" stroke-width="3"/>
<path d="M118 352c48-22 71-76 112-99 34-19 62-10 91-41 21-23 38-54 65-91" fill="none" stroke="#303a58" stroke-width="35" stroke-linecap="round"/><path d="M118 352c48-22 71-76 112-99 34-19 62-10 91-41 21-23 38-54 65-91" fill="none" stroke="url(#p)" stroke-width="19" stroke-linecap="round"/>
<circle cx="118" cy="352" r="27" fill="#111726" stroke="#8b9cff" stroke-width="12"/><path d="m386 78 12 31 31 12-31 12-12 31-12-31-31-12 31-12Z" fill="#d8ddff"/><circle cx="386" cy="121" r="7" fill="#79d8b5"/>
</svg>`

const outputDir = path.join(__dirname, '..', '..', 'assets')
fs.mkdirSync(outputDir, { recursive: true })
sharp(Buffer.from(svg)).png().toFile(path.join(outputDir, 'branding', 'generated-icon-draft.png')).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
