/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { types } from '@salto-io/lowerdash'

import {
  ElemID,
  SaltoElementError,
  SaltoErrorSeverity,
} from '@salto-io/adapter-api'


export abstract class MergeError extends types.Bean<Readonly<{
  elemID: ElemID
  error: string
}>> implements SaltoElementError {
  get message(): string {
    return `Error merging ${this.elemID.getFullName()}: ${this.error}`
  }

  public severity: SaltoErrorSeverity = 'Error'

  toString(): string {
    return this.message
  }
}

export class DuplicateAnnotationError extends MergeError {
  readonly key: string

  constructor({ elemID, key }: { elemID: ElemID; key: string }) {
    super({ elemID, error: `duplicate annotation '${key}'` })
    this.key = key
  }
}

export type MergeResult<T> = {
  merged: T
  errors: MergeError[]
}

export const mergeNoDuplicates = <T>(
  sources: T[], 
  errorCreator: (key: string) => MergeError,
  duplicateDetectionCustomiser?: (existingValue: unknown, newValue: unknown, key:string) => boolean
): MergeResult<T> => {
  const defaultDuplicateDetector = (existingValue: unknown, _v: unknown, _k:string): boolean => (
    existingValue !== undefined
  )
  const duplicatesDetector = duplicateDetectionCustomiser || defaultDuplicateDetector
  const errors: MergeError[] = []
  const merged: unknown = _.mergeWith(
    {},
    ...sources,
    (existingValue: unknown, newValue: unknown, key: string): unknown => {
      if (duplicatesDetector(existingValue, newValue, key)) {
        errors.push(errorCreator(key))
        return existingValue
      }
      return undefined
    }
  )
  return { merged: merged as T, errors }
}
