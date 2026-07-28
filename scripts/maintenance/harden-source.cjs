const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')

const cssPath = path.join(root, 'src', 'styles.css')
const css = fs.readFileSync(cssPath, 'utf8').replace(/^@import url\([^\n]+\);\r?\n\r?\n/, '')
fs.writeFileSync(cssPath, css, 'utf8')

const htmlPath = path.join(root, 'index.html')
const html = fs.readFileSync(htmlPath, 'utf8').replace(
  '    <meta name="theme-color" content="#0d1117" />',
  '    <meta name="theme-color" content="#0d1117" />\n    <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; connect-src \'none\'; img-src \'self\' data:; font-src \'self\';" />',
)
fs.writeFileSync(htmlPath, html, 'utf8')

const mainPath = path.join(root, 'electron', 'main.cjs')
const main = fs.readFileSync(mainPath, 'utf8').replace(
  "app.on('window-all-closed', (event) => event.preventDefault())",
  "app.on('window-all-closed', () => {})",
)
fs.writeFileSync(mainPath, main, 'utf8')
