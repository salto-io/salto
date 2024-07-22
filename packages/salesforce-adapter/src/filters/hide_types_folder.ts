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
import { Element, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { SALESFORCE, TYPES_PATH } from '../constants'
import { LocalFilterCreator } from '../filter'
import { ensureSafeFilterFetch } from './utils'

const isElementWithinTypesFolder = ({ path = [] }: Element): boolean =>
  path?.[0] === SALESFORCE && path?.[1] === TYPES_PATH

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'hideTypesFolder',
  onFetch: ensureSafeFilterFetch({
    config,
    filterName: 'hideTypesFolder',
    warningMessage: 'Error occurred when attempting to hide the Types Folder',
    fetchFilterFunc: async (elements) => {
      elements.filter(isElementWithinTypesFolder).forEach((element) => {
        element.annotations[CORE_ANNOTATIONS.HIDDEN] = true
      })
    },
  }),
})

export default filterCreator
