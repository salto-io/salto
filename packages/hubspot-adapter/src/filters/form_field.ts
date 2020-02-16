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
import { isInstanceElement, InstanceElement, Element, ElemID, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { formElemID, contactPropertyElemID } from '../constants'

const { makeArray } = collections.array

export const isFormInstance = (instance: InstanceElement): boolean =>
  instance.type.elemID.isEqual(formElemID)

const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const findContactPropertyElemID = (contactPropertyName: string): ElemID | undefined => {
      const isContactPropertyInstance = (instance: InstanceElement): boolean =>
        instance.type.elemID.isEqual(contactPropertyElemID)
      const contactProperty = elements
        .filter(isInstanceElement)
        .filter(isContactPropertyInstance)
        .find(property => property.value.name === contactPropertyName)
      return contactProperty ? contactProperty.elemID : undefined
    }
    const addContactPropertyRef = (formInstance: InstanceElement): void => {
      const { formFieldGroups } = formInstance.value
      makeArray(formFieldGroups).forEach(formFieldGroup => {
        const { fields } = formFieldGroup
        makeArray(fields).forEach(field => {
          const contactPropertyName = field.name
          const propertyElemID = findContactPropertyElemID(contactPropertyName)
          if (propertyElemID) {
            field.contactProperty = new ReferenceExpression(propertyElemID)
          }
          const { dependentFieldFilters } = field
          if (dependentFieldFilters && dependentFieldFilters.length > 0) {
            makeArray(dependentFieldFilters).forEach(dependentFieldFilter => {
              const { dependentFormField } = dependentFieldFilter
              const dependentPropName = dependentFormField.name
              const dependentPropElemID = findContactPropertyElemID(dependentPropName)
              if (dependentPropElemID) {
                dependentFormField.contactProperty = new ReferenceExpression(dependentPropElemID)
              }
            })
          }
        })
      })
    }

    elements
      .filter(isInstanceElement)
      .filter(isFormInstance)
      .forEach(formInstance => {
        addContactPropertyRef(formInstance)
      })
  },
})

export default filterCreator
