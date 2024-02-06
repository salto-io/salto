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
import { Values, isPrimitiveValue } from '@salto-io/adapter-api'
import { ContextParams } from '../../definitions'

export const ARG_PLACEHOLDER_MATCHER = /\{([\w_]+)\}/g

export const findUnresolvedArgs = (value: string, definedParams: Set<string> = new Set()): string[] => {
  const urlParams = value.match(ARG_PLACEHOLDER_MATCHER)?.map(m => m.slice(1, -1)) ?? []
  return urlParams.filter(p => !definedParams.has(p))
}

export const findAllUnresolvedArgs = (value: unknown, definedParams: Set<string> = new Set()): string[] => {
  const allParams: string[] = []
  _.cloneDeepWith(value, (v: unknown) => {
    if (_.isString(v)) {
      allParams.push(...findUnresolvedArgs(v, definedParams))
    }
    return undefined
  })
  return _.uniq(allParams)
}

export const replaceArgs = (valueToReplace: string, args: Record<string, unknown>): string => (
  valueToReplace.replace(
    ARG_PLACEHOLDER_MATCHER,
    val => {
      const replacement = args[val.slice(1, -1)] ?? val
      if (!isPrimitiveValue(replacement)) {
        throw new Error(`Cannot replace param ${val} in ${valueToReplace} with non-primitive value ${replacement}`)
      }
      return replacement.toString()
    }
  )
)

// replace all placeholder args recursively
export const replaceAllArgs = <T extends Values = Values>({ context, value }: {
  context: ContextParams
  value: T
}): T => (_.cloneDeepWith(
    value,
    val => (_.isString(val) ? replaceArgs(val, context) : undefined),
  ))
