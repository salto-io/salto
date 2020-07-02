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
import {
  CORE_ANNOTATIONS,
  Element,
  isType,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import {
  ENABLE_HIDE_TYPES_IN_NACLS,
} from '../types'
import {
  isCustomObject,
} from '../transformers/transformer'

const filterCreator: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    //  Skipping on the filter it hide is not enabled
    if (!config[ENABLE_HIDE_TYPES_IN_NACLS]) {
      return
    }

    elements
      .filter(isType)
      .filter(e => !isCustomObject(e))
      .forEach(type => {
        Object.assign(type.annotations,
          {
            // Object type will be hidden if it's not custom object
            [CORE_ANNOTATIONS.HIDDEN]: true,
          })
      })
  },
})

export default filterCreator
