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
/* eslint-disable no-underscore-dangle */

import { InstanceElement, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { SAVED_SEARCH } from '../constants'
import { FilterCreator, FilterWith } from '../filter'
import { savedsearch, savedsearchInnerTypes } from '../types/custom_types/parsedSavedSearch'
import { parseDefinition } from '../saved_search_parser'

const assignValuesToInstance = async (instance:InstanceElement,
  oldInstance: InstanceElement):Promise<void> => {
  Object.assign(instance.value, parseDefinition(instance.value.definition))
  if (oldInstance !== undefined) {
    if (await _.isEqual(parseDefinition(oldInstance.value.definition),
      parseDefinition(instance.value.definition))) {
      instance.value.definition = oldInstance.value.definition
    }
  }
}

const filterCreator: FilterCreator = ({ elementsSource }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    _.remove(elements, e => isObjectType(e) && e.elemID.name === SAVED_SEARCH)
    elements.push(savedsearch)
    elements.push(...savedsearchInnerTypes)
    await Promise.all(
      elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === SAVED_SEARCH)
        .map(async (instance: InstanceElement) => {
          await assignValuesToInstance(instance, await elementsSource.get(instance.elemID))
        })
    )
    elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === SAVED_SEARCH)
  },
})

export default filterCreator
