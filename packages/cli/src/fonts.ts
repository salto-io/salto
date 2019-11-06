import path from 'path'
import fs from 'fs'
import figlet from 'figlet'

export enum Font {
  Standard = 'Standard'
}

const fontsDir = path.resolve(__dirname, '..', '..', '..', '..', 'node_modules', 'figlet', 'fonts')

Object.entries(Font).forEach(([name, fileName]) => {
  const fontPath = `${path.join(fontsDir, fileName)}.flf`
  const font = fs.readFileSync(fontPath, { encoding: 'utf8' })
  // @ts-ignore
  figlet.parseFont(name, font)
})

export const renderSync = (font: Font, text: string): string => figlet.textSync(text, font)
