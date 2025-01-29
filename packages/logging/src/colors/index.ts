/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import colorData from './colors.json'

export type ColorName = string
export type HexString = string

export type Color = {
  name: ColorName
  hexString: HexString
}

export const all = colorData as Color[]

export const safe = Object.freeze(colorData.filter(c => c.colorId >= 17 && c.colorId <= 51)) as ReadonlyArray<Color>

// I know ColorName is an alias for string, it's here as doc
export const byName: { [name in ColorName]: HexString } = Object.freeze(
  Object.assign({}, ...all.map(c => ({ [c.name]: c.hexString }))),
)
