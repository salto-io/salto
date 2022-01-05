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

import { getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { SAVED_SEARCH } from '../constants'
import { FilterCreator } from '../filter'
import { savedsearch, savedsearchInnerTypes, savedSearchDependenciesElemID } from '../saved_search_parsing/parsed_saved_search'
import { savedsearch as oldSavedSearch } from '../autogen/types/custom_types/savedsearch'
import { parseDefinition } from '../saved_search_parsing/saved_search_parser'


const cloneSavedSearch = (instance: InstanceElement): InstanceElement =>
// We create another element not using element.clone because
// we need the new element to have a parsed save search type.
  new InstanceElement(instance.elemID.name, savedsearch, instance.value,
    instance.path, instance.annotations)

const assignSavedSearchValues = async (instance:InstanceElement,
  oldInstance: InstanceElement | undefined): Promise<void> => {
  Object.assign(instance.value, await parseDefinition(instance.value.definition))
  if (oldInstance?.value.definition !== undefined) {
    if (_.isEqual(await parseDefinition(oldInstance.value.definition),
      await parseDefinition(instance.value.definition))) {
      // In case the parsed definitions are equal that mean there is no reason
      // to change the definition string and create a change in the file.
      instance.value.definition = oldInstance.value.definition
    }
  }
}

const removeValuesFromInstance = (instance:InstanceElement): void => {
  instance.value = _.pickBy(instance.value, (_val, key) => key in oldSavedSearch.fields)
}

const filterCreator: FilterCreator = ({ elementsSource }) => ({
  onFetch: async elements => {
    _.remove(elements, e => isObjectType(e) && e.elemID.name === SAVED_SEARCH)
    _.remove(elements, e => isObjectType(e) && e.elemID.isEqual(savedSearchDependenciesElemID))
    const instances = _.remove(elements, e => isInstanceElement(e)
     && e.elemID.typeName === SAVED_SEARCH)
    elements.push(savedsearch)
    elements.push(...savedsearchInnerTypes)
    const parsedInstances = await Promise.all(
      instances
        .filter(isInstanceElement)
        .map(cloneSavedSearch)
        .map(async (instance: InstanceElement) => {
          await assignSavedSearchValues(instance, await elementsSource.get(instance.elemID))
          return instance
        })
    )
    elements.push(...parsedInstances)
  },
  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SAVED_SEARCH)
      .forEach(instance => removeValuesFromInstance(instance))
  },
})

export default filterCreator
