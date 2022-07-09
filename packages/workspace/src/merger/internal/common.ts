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
import _ from 'lodash'
import { inspect } from 'util'
import { collections, types } from '@salto-io/lowerdash'
import { ElemID, SaltoElementError, SeverityLevel } from '@salto-io/adapter-api'
import wu from 'wu'


export abstract class MergeError extends types.Bean<Readonly<{
  elemID: ElemID
  error: string
}>> implements SaltoElementError {
  get message(): string {
    return `Error merging ${this.elemID.getFullName()}: ${this.error}`
  }

  public severity: SeverityLevel = 'Error'

  toString(): string {
    return this.message
  }
}

export class DuplicateAnnotationError extends MergeError {
  readonly key: string
  readonly existingValue: unknown
  readonly newValue: unknown

  constructor({ elemID, key, existingValue, newValue }:
    { elemID: ElemID; key: string; existingValue: unknown; newValue: unknown}) {
    super({
      elemID,
      error: `duplicate annotation key ${key} (values - ${inspect(existingValue)} & ${inspect(newValue)})`,
    })
    this.key = key
    this.existingValue = existingValue
    this.newValue = newValue
  }
}

export type MergeResult<T> = {
  merged: T
  errors: MergeError[]
  pathIndex?: collections.treeMap.TreeMap<string>
}

type MergeSource<T> = {
  source: T
  pathIndex?: collections.treeMap.TreeMap<string>
}

export const mergeNoDuplicates = <T>({
  sources, errorCreator, baseId,
}: {
  sources: MergeSource<T>[]
  errorCreator: (key: string, existingValue?: unknown, newValue?: unknown) => MergeError
  baseId: ElemID
}): MergeResult<T> => {
  const errors: MergeError[] = []
  const pathIndex = new collections.treeMap.TreeMap<string>()
  const merged: unknown = {}
  sources.forEach(source => {
    const pathParts: string[] = []
    let depth = 0
    _.mergeWith(
      merged,
      source.source,
      (existingValue: unknown, newValue: unknown, key: string,
        _object: unknown, _source: unknown, stack: { size: number }): unknown => {
        if (stack.size < depth) {
          pathParts.splice(stack.size - depth)
        }
        pathParts.push(key)
        depth = stack.size + 1
        if (!_.isUndefined(existingValue)
          && !_.isUndefined(newValue)
          && !(_.isPlainObject(existingValue) && _.isPlainObject(newValue))) {
          errors.push(errorCreator(key, existingValue, newValue))
          return existingValue
        }
        if (_.isUndefined(existingValue) && !_.isUndefined(newValue) && source.pathIndex) {
          const id = baseId.createNestedID(...pathParts).getFullName()
          const prefixPathIndex = collections.treeMap.TreeMap
            .getTreeMapOfId(source.pathIndex, id)
          wu(prefixPathIndex.entries()).forEach(entry => { pathIndex.set(entry[0], entry[1]) })
        }
        return undefined
      }
    )
  })
  return { merged: merged as T, errors, pathIndex }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isMergeError = (error: any): error is MergeError =>
  error instanceof MergeError
