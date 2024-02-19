/*
 *                      Copyright 2024 Salto Labs Ltd.
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
