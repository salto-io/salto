/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U]

export type RequiredMember<T, M extends keyof T> = {
  [P in M]-?: T[P]
}

export type HasMember<T, M extends keyof T> = T & RequiredMember<T, M>

export type ReverseRecord<T extends Record<keyof T, keyof never>> = {
  [P in T[keyof T]]: {
    [K in keyof T]: T[K] extends P ? K : never
  }[keyof T]
}

export type NonEmptyArray<T> = [T, ...T[]]

export const hasMember = <T, M extends keyof T>(m: M, o: T): o is HasMember<T, M> => !!o[m]

// filters an array of T and returns only the items that have the specified member M
export const filterHasMember = <T, M extends keyof T>(m: M, objs: T[]): HasMember<T, M>[] =>
  objs.filter(f => hasMember(m, f)) as HasMember<T, M>[]

// Ensures an object contains a specific key K of type T
export type HasKeyOfType<K extends string, T> = { [P in K]: T }
// Extracts keys from type T whose values are assignable to type U.
export type KeysOfType<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T]
// Extracts keys from type T whose values extend type U.
export type KeysOfExtendingType<T, U> = { [K in keyof T]: U extends T[K] ? K : never }[keyof T]
// Converts the keys of type T into an enum-like type where each key is a required property.
export type TypeKeysEnum<T> = Required<{ [k in keyof T]: k }>

// Extracts the union of all possible values of the properties of type `T`.
export type ValueOf<T> = T[keyof T]

// makes specific fields required
export type PickyRequired<T, K extends keyof T> = T & Required<Pick<T, K>>

export type TypeGuard<T, S extends T> = (item: T) => item is S
export type Predicate<T> = (item: T) => boolean
export type AsyncPredicate<T> = (item: T) => Promise<boolean>

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type PickDataFields<T> = Omit<T, KeysOfType<T, Function>>

/*

--- Bean ---

Allows defining a class with an object as constructor arg (aka keyword args)
with less boilerplate.

Example, boilerplate version:

class MyBean {
  prop1: string
  prop2: number | undefined
  constructor({ prop1, prop2 }: { prop1: string, prop2?: number }) {
    this.prop1 = prop1
    this.prop2 = prop2
  }
}

Less boilerplate version with Bean:

class MyBean extends Bean<{ prop1: string, prop2?: number }> {}

*/

export class _Bean<T> {
  constructor(props: T) {
    Object.assign(this, props)
  }
}

export type Bean<T> = _Bean<T> & T
// eslint-disable-next-line no-use-before-define
export const Bean = _Bean as new <T>(props: T) => Bean<T>

export const isArrayOfType = <T>(array: unknown[], typeGuard: TypeGuard<unknown, T>): array is T[] =>
  array.every(typeGuard)

export const isNonEmptyArray = <T>(array: T[]): array is NonEmptyArray<T> => array.length > 0

export const isTypeOfOrUndefined = <T, S extends T>(
  value: T | undefined,
  typeGuard: TypeGuard<T, S>,
): value is S | undefined => value === undefined || typeGuard(value)

export type AllowOnly<T, K extends keyof T> = Pick<T, K> & { [P in keyof Omit<T, K>]?: never }
export type OneOf<T, K = keyof T> = K extends keyof T ? AllowOnly<T, K> : never
export type XOR<A, B> = AllowOnly<A & B, keyof A> | AllowOnly<A & B, keyof B>
export type NonPromise<T> = T extends Promise<unknown> ? never : T

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[] | RecursivePartial<U>
    : T[P] extends object | undefined
      ? RecursivePartial<T[P]>
      : T[P]
}
