export type MyType = {
  intVal: number
  arrayOfStrings?: string[]
}

export const myTypeName = 'myType'

export const myVal: MyType = Object.freeze({
  intVal: 12,
  arrayOfStrings: ['hello', 'world'],
})
