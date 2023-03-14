/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

const TYPE_TO_REFERENCES_TYPES: Record<string, string[]> = {
  Application: ['assignedGroups'],
  Group: ['roles'],
  Feature: ['featureDependencies'],
}

const replaceObjectWithId = (instance: InstanceElement): void => {
  const relevantFields = TYPE_TO_REFERENCES_TYPES[instance.elemID.typeName]
  relevantFields.forEach(fieldName => {
    const currentValues = instance.value[fieldName]
    if (_.isArray(currentValues)) {
      instance.value[fieldName] = currentValues
        .map(value => {
          if (fieldName === 'roles' && value.type !== 'CUSTOM') {
            // adjustment to standard role id
            return value.type !== undefined ? value.type : value
          }
          return value.id !== undefined ? value.id : value
        })
    }
  })
}

/**
 * Some instances have references that contain the entire referenced object
 * the filter replaces the object with its id so we can use fieldReferences filter
 */
const filter: FilterCreator = () => ({
  name: 'replaceObjectWithIdFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => Object.keys(TYPE_TO_REFERENCES_TYPES).includes(instance.elemID.typeName))
      .forEach(instance => replaceObjectWithId(instance))
  },
})

export default filter
