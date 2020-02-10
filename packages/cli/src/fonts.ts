/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
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
