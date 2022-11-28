/*
*                      Copyright 2022 Salto Labs Ltd.
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
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U]

export type RequiredMember<T, M extends keyof T> = {
  [P in M]-?: T[P];
}

export type HasMember<T, M extends keyof T> = T & RequiredMember<T, M>

export const hasMember = <T, M extends keyof T>(
  m: M,
  o: T,
): o is HasMember<T, M> => !!o[m]

// filters an array of T and returns only the items that have the specified member M
export const filterHasMember = <T, M extends keyof T>(
  m: M, objs: T[]
): HasMember<T, M>[] => objs.filter(f => hasMember(m, f)) as HasMember<T, M>[]

export type KeysOfType<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T]
export type KeysOfExtendingType<T, U> = { [K in keyof T]: U extends T[K] ? K : never }[keyof T]
export type TypeKeysEnum<T> = Required<{ [k in keyof T]: k }>

export type ValueOf<T> = T[keyof T]

// makes specific fields required
export type PickyRequired<T, K extends keyof T> = T & Required<Pick<T, K>>

export type TypeGuard<T, S extends T> = (item: T) => item is S
export type Predicate<T> = (item: T) => boolean
export type AsyncPredicate<T> = (item: T) => Promise<boolean>

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

export const isArrayOfType = <T>(
  array: unknown[],
  typeGuard: TypeGuard<unknown, T>,
): array is T[] => (
    array.every(typeGuard)
  )

export type AllowOnly<T, K extends keyof T> = Pick<T, K> & { [P in keyof Omit<T, K>]?: never };
export type OneOf<T, K = keyof T> = K extends keyof T ? AllowOnly<T, K> : never
