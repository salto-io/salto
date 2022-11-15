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
import { Values } from '@salto-io/adapter-api'
import _ from 'lodash'

export const MERGE_CONFIG_DELETE_VALUE = null

export type RecursiveDeletable<T> = {
  [P in keyof T]: RecursiveDeletable<T[P]> | typeof MERGE_CONFIG_DELETE_VALUE
}

const removeEmptyValues = (values: Values): Values => {
  Object.keys(values).forEach(key => {
    if (values[key] === MERGE_CONFIG_DELETE_VALUE) {
      delete values[key]
    } else if (_.isObject(values[key])) {
      removeEmptyValues(values[key])
    }
  })
  return values
}

export const mergeWithDefaultConfig = (
  defaultConfig: Values,
  config: Values | undefined
): Values => (
  removeEmptyValues(_.mergeWith(
    _.cloneDeep(defaultConfig),
    config,
    (_firstVal, secondValue) => (Array.isArray(secondValue) ? secondValue : undefined)
  ))
)
