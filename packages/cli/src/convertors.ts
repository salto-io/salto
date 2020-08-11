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
import { ElemID } from '@salto-io/adapter-api'
import { regex } from '@salto-io/lowerdash'
import _ from 'lodash'

export const convertToIDSelectors = (
  selectors: string[]
): {ids: ElemID[]; invalidSelectors: string[]} => {
  const [validSelectors, invalidSelectors] = _.partition(selectors, selector => {
    try {
      return ElemID.fromFullName(selector)
    } catch (e) {
      return false
    }
  })
  const ids = validSelectors.map(id => ElemID.fromFullName(id))
  return { ids, invalidSelectors }
}

export const createRegexFilters = (
  inputFilters: string[]
): {filters: RegExp[]; invalidFilters: string[]} => {
  const [validFilters, invalidFilters] = _.partition(
    inputFilters,
    filter => regex.isValidRegex(filter)
  )
  const filters = validFilters.map(filter => new RegExp(filter))
  return { filters, invalidFilters }
}
