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
import _ from 'lodash'
import { forEachAsync, awu } from './collections/asynciterable'
import { TypeGuard, Predicate, AsyncPredicate } from './types'

// The '0' key is used to "nudge" typescript to infer a tuple type instead of an array
type TupleType<T> = T[] & { '0': T }
type KeyType = TupleType<string>

export type Index<Key extends KeyType, T> = {
  get: (...key: Key) => T | undefined
}

type IndexFunction<
  InputType = unknown,
  FilteredType extends InputType = InputType,
  ResultType = FilteredType,
  Key extends KeyType = KeyType,
  IndexName extends string = string,
> = {
  name: IndexName
  filter?: TypeGuard<InputType, FilteredType> | Predicate<InputType> | AsyncPredicate<InputType>
  key: (item: FilteredType) => Key | Promise<Key>
  map?: (item: FilteredType) => ResultType | Promise<ResultType>
}

type MultiIndexBuilder<InputType, Result extends object = {}> = {
  addIndex: <
    IndexName extends string,
    Key extends KeyType,
    FilteredType extends InputType = InputType,
    ResultType = FilteredType,
  >(
    f: IndexFunction<InputType, FilteredType, ResultType, Key, IndexName>,
  ) => MultiIndexBuilder<InputType, Result & { [name in IndexName]: Index<Key, ResultType> }>

  process: (iter: AsyncIterable<InputType>) => Promise<Result>
}

/**
 * Index the specified items by one or more index definitions with a single iteration over the input
 *
 * Usage example:
 *   const { even, odd } = await buildMultiIndex<number>()
 *     .addIndex({
 *       name: 'even',
 *       filter: item => item % 2 === 0,
 *       key: item => [item.toString()],
 *     })
 *     .addIndex({
 *       name: 'odd',
 *       filter: item => item % 2 === 1,
 *       key: item => [item.toString()],
 *     })
 *     .process(items)
 */
export const buildMultiIndex = <InputType, Result extends object = {}>(): MultiIndexBuilder<InputType, Result> => {
  const indexDefinitions: IndexFunction[] = []

  const processItem = async (item: InputType, index: Record<string, unknown>): Promise<void> => {
    await awu(indexDefinitions)
      .filter(async indexDef => indexDef.filter === undefined || indexDef.filter(item))
      .forEach(async indexDef => {
        const keyParts = await indexDef.key(item)
        if (keyParts.some(part => part === undefined)) {
          // If key function type is correct this will never happen but just in case it does...
          return
        }
        const value = indexDef.map === undefined ? item : await indexDef.map(item)
        _.set(index, [indexDef.name, ...keyParts], value)
      })
  }
  const toMultiIndex = (index: Record<string, unknown>): Result =>
    Object.fromEntries(
      indexDefinitions.map(indexDef => [
        indexDef.name,
        { get: (...keyParts: string[]): unknown => _.get(index, [indexDef.name, ...keyParts]) },
      ]),
    ) as Result
  const indexBuilder: MultiIndexBuilder<InputType, Result> = {
    addIndex: <FilteredType extends InputType, ResultType, Key extends KeyType, IndexName extends string>(
      func: IndexFunction<InputType, FilteredType, ResultType, Key, IndexName>,
    ) => {
      // Note - the cast to unknown is needed because we store all index definition in one array.
      // The type of that array has to be more general than the type of each index.
      // This is not fully safe, but with the current implementation it works because we make sure
      // to put the result of each function in the correct key as it is defined in the result type.
      // The assumption made by both "processItem" and "toMultiIndex" is that the values in
      // indexDefinitions match the result type - this is not guaranteed by typescript because we
      // lose the type information here, but it is correct because at this point we make sure that
      // the type added to Result matches the type of the index function we add here.
      indexDefinitions.push(func as unknown as IndexFunction)
      // Add the new index to the result type
      return indexBuilder as MultiIndexBuilder<InputType, Result & { [name in IndexName]: Index<Key, ResultType> }>
    },
    process: async iter => {
      const index = {}
      await forEachAsync(iter, item => processItem(item, index))
      return toMultiIndex(index)
    },
  }
  return indexBuilder
}

type KeyByAsyncParams<Key extends KeyType, InputType, FilteredType extends InputType, ResultType> = {
  iter: AsyncIterable<InputType>
} & Omit<IndexFunction<InputType, FilteredType, ResultType, Key>, 'name'>

export const keyByAsync = async <
  Key extends KeyType,
  InputType,
  FilteredType extends InputType = InputType,
  ResultType = FilteredType,
>({
  iter,
  key,
  map,
  filter,
}: KeyByAsyncParams<Key, InputType, FilteredType, ResultType>): Promise<Index<Key, ResultType>> => {
  const { idx } = await buildMultiIndex<InputType>().addIndex({ name: 'idx', filter, map, key }).process(iter)
  return idx
}
