/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import { forEachAsync } from './collections/asynciterable'
import { TypeGuard, Predicate } from './types'


// The '0' key is used to "nudge" typescript to infer a tuple type instead of an array
type TupleType<T> = T[] & { '0': T }
type KeyType = TupleType<string>

export type Index<Key extends KeyType, T> = {
  get: (...key: Key) => T | undefined
}

type IndexFunction<
  InputType = unknown,
  FilteredType extends InputType = InputType,
  ResultValueType = InputType,
  Key extends KeyType = KeyType,
  IndexName extends string = string,
> = {
  name: IndexName
  filter?: TypeGuard<InputType, FilteredType> | Predicate<InputType>
  key: (item: FilteredType) => Key
  map?: (item: FilteredType) => ResultValueType
}

type MultiIndexBuilder<T, Result extends object = never> = {
  addIndex: <Name extends string, Key extends KeyType, U extends T = T, V = T>(
    f: IndexFunction<T, U, V, Key, Name>
  ) => MultiIndexBuilder<T, Result & { [k in Name]: Index<Key, V> }>

  process: (iter: AsyncIterable<T>) => Promise<Result>
}

export const buildMultiIndex = <T, Result extends object = {}>(): MultiIndexBuilder<T, Result> => {
  const indexDefinitions: IndexFunction[] = []

  const processItem = (item: T, index: Record<string, unknown>): void => {
    indexDefinitions
      .filter(indexDef => indexDef.filter === undefined || indexDef.filter(item))
      .forEach(indexDef => {
        const keyParts = indexDef.key(item)
        if (keyParts.some(part => part === undefined)) {
          // If key function type is correct this will never happen but just in case it does...
          return
        }
        const value = indexDef.map === undefined ? item : indexDef.map(item)
        _.set(index, [indexDef.name, ...keyParts], value)
      })
  }
  const toMultiIndex = (index: Record<string, unknown>): Result => (
    Object.fromEntries(
      indexDefinitions.map(indexDef => ([
        indexDef.name,
        { get: (...key: string[]): unknown => _.get(index, [indexDef.name, ...key]) },
      ]))
    ) as Result
  )
  const indexBuilder: MultiIndexBuilder<T, Result> = {
    addIndex: <U extends T, V, Key extends KeyType, Name extends string>(
      func: IndexFunction<T, U, V, Key, Name>
    ) => {
      // Note - the cast to unknown is needed because we cannot maintain a consistent type
      // for all index functions (we treat each one separately).
      // This is not fully safe, but with the current implementation in "processItem" it works
      // because we make sure to put the result of each function in the correct key as it is
      // defined in the new result type
      indexDefinitions.push(func as unknown as IndexFunction)
      // Add the new index to the result type
      return indexBuilder as MultiIndexBuilder<T, Result & { [k in Name]: Index<Key, V> }>
    },
    process: async iter => {
      const index = {}
      await forEachAsync(iter, item => processItem(item, index))
      return toMultiIndex(index)
    },
  }
  return indexBuilder
}

type KeyByAsyncParams<Key extends KeyType, T, U extends T, V> = {
  iter: AsyncIterable<T>
} & Omit<IndexFunction<T, U, V, Key>, 'name'>

export const keyByAsync = async <Key extends KeyType, T, U extends T, V>(
  { iter, key, map, filter }: KeyByAsyncParams<Key, T, U, V>
): Promise<Index<Key, V>> => {
  const { idx } = await buildMultiIndex<T>()
    .addIndex({ name: 'idx', filter, map, key })
    .process(iter)
  return idx
}
