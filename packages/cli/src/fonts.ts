/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'

export enum Font {
  'Standard',
}

const fontsDir = path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'figlet', 'fonts')

const fontValues = Object.keys(Font)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  .map(k => Font[k])
  .filter(k => typeof k === 'number')

export const fontFiles = new Map<Font, string>(fontValues.map(f => [f, path.join(fontsDir, `${Font[f]}.flf`)]))
