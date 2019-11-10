import path from 'path'
import fs from 'fs'
import figlet from 'figlet'

export enum Font {
  'Standard'
}

const fontsDir = path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'figlet', 'fonts')

const fontValues = Object.keys(Font)
  // @ts-ignore
  .map(k => Font[k])
  .filter(k => typeof k === 'number')

export const fontFiles = new Map<Font, string>(
  fontValues.map(f => [f, path.join(fontsDir, `${Font[f]}.flf`)])
)

const parsedFonts = new Set<Font>()

const parseFont = (font: Font): void => {
  if (parsedFonts.has(font)) {
    return
  }

  const fontName = Font[font]
  const fontPath = fontFiles.get(font) as string
  const fontData = fs.readFileSync(fontPath, { encoding: 'utf8' })
  // @ts-ignore
  figlet.parseFont(fontName, fontData)
  parsedFonts.add(font)
}

export const renderSync = (font: Font, text: string): string => {
  parseFont(font)
  return figlet.textSync(text, Font[font] as figlet.Fonts)
}
