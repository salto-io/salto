import path from 'path'
import fs from 'fs'
import figlet from 'figlet'

export enum Font {
  'Standard'
}

console.log('dirname: %o', __dirname)
const fontsDir = path.join(__dirname, '..', 'assets')
console.log('fontsDir: %o', fontsDir)

const fontNames = Object.keys(Font)
  // @ts-ignore
  .map(k => Font[k])
  .filter(k => typeof k === 'string')

export const fontFiles = Object.assign(
  {},
  ...fontNames.map(f => ({ [f]: path.join(fontsDir, `${f}.flf`) }))
)

const parsedFonts = new Set<Font>()

const parseFont = (font: Font): void => {
  if (parsedFonts.has(font)) {
    return
  }

  const fontName = Font[font]
  const fontPath = `${path.join(fontsDir, fontName)}.flf`
  const fontData = fs.readFileSync(fontPath, { encoding: 'utf8' })
  // @ts-ignore
  figlet.parseFont(fontName, fontData)
  parsedFonts.add(font)
}

export const renderSync = (font: Font, text: string): string => {
  parseFont(font)
  return figlet.textSync(text, Font[font] as figlet.Fonts)
}
