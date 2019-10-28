import colorData from './colors.json'

export type ColorName = string
export type HexString = string

export type Color = {
  name: ColorName
  hexString: HexString
}

export const all = colorData as Color[]

export const safe = Object.freeze(
  colorData.filter(c => c.colorId >= 17 && c.colorId <= 51)
) as ReadonlyArray<Color>

// I know ColorName is an alias for string, it's here as doc
export const byName: { [name in ColorName]: HexString } = Object.freeze(
  Object.assign(
    {},
    ...all.map(c => ({ [c.name]: c.hexString })),
  ),
)
