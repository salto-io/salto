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

import { getChangeElement, InstanceElement, isInstanceChange, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { SAVED_SEARCH } from '../constants'
import { FilterCreator } from '../filter'
import { savedsearch, savedsearchInnerTypes } from '../types/custom_types/parsedSavedSearch'
import { savedsearch as oldSavedSearch } from '../types/custom_types/savedsearch'
import { parseDefinition } from '../saved_search_parser'

const assignSavedSearchValues = async (instance:InstanceElement,
  oldInstance: InstanceElement | undefined): Promise<void> => {
  Object.assign(instance.value, await parseDefinition(instance.value.definition))
  if (oldInstance?.value.definition !== undefined) {
    if (_.isEqual(await parseDefinition(oldInstance.value.definition),
      await parseDefinition(instance.value.definition))) {
      instance.value.definition = oldInstance.value.definition
    }
  }
}

const removeValuesFromInstance = (instance:InstanceElement): void => {
  Object.keys(instance.value)
    .filter(key => !Object.keys(oldSavedSearch.fields).includes(key))
    .forEach(key => delete instance.value[key])
}

const filterCreator: FilterCreator = ({ elementsSource }) => ({
  onFetch: async elements => {
    _.remove(elements, e => isObjectType(e) && e.elemID.name === SAVED_SEARCH)
    elements.push(savedsearch)
    elements.push(...savedsearchInnerTypes)
    await Promise.all(
      elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === SAVED_SEARCH)
        .map(async (instance: InstanceElement) => {
          await assignSavedSearchValues(instance, await elementsSource.get(instance.elemID))
        })
    )
  },
  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(getChangeElement)
      .filter(instance => instance.elemID.typeName === SAVED_SEARCH)
      .forEach(instance => removeValuesFromInstance(instance))
  },
})

export default filterCreator
