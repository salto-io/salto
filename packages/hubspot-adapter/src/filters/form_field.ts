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
import _ from 'lodash'
import {
  isInstanceElement, InstanceElement, Element, ReferenceExpression, Values, Value,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { formElemID, contactPropertyElemID, CONTACT_PROPERTY_OVERRIDES_FIELDS } from '../constants'

const { makeArray } = collections.array

export const isFormInstance = async (instance: Readonly<InstanceElement>): Promise<boolean> =>
  (await instance.getType()).elemID.isEqual(formElemID)

const contactPropertyOverrideFields = Object.values(CONTACT_PROPERTY_OVERRIDES_FIELDS)

const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const findContactProperty = (contactPropertyName: string): InstanceElement | undefined => {
      const isContactPropertyInstance = async (instance: InstanceElement): Promise<boolean> =>
        (await instance.getType()).elemID.isEqual(contactPropertyElemID)
      return elements
        .filter(isInstanceElement)
        .filter(isContactPropertyInstance)
        .find(property => property.value.name === contactPropertyName)
    }

    const createPropertyOverrides = (fieldValues: Values, contactPropValues: Values): Values =>
      // Includes only certain fields and ones with different value from origin contactProperty
      _.pickBy(fieldValues, (val, fieldName): boolean => {
        if (!contactPropertyOverrideFields.includes(fieldName)) {
          return false
        }
        return !(contactPropValues && val === contactPropValues[fieldName])
      })

    const transformField = (field: Value, fieldsToRemove: Set<string>): void => {
      // Special case of description. Differs in meanings between form field and contact property
      if (!_.isUndefined(field.description)) {
        field.helpText = field.description
      }
      const property = findContactProperty(field.name)
      if (_.isUndefined(property)) {
        fieldsToRemove.add(field.name)
      } else {
        field.contactProperty = new ReferenceExpression(property.elemID)
        field.contactPropertyOverrides = createPropertyOverrides(field, property.value)
        const { dependentFieldFilters } = field
        // Only available at top level so there's no endless recursion
        if (dependentFieldFilters && dependentFieldFilters.length > 0) {
          makeArray(dependentFieldFilters).forEach(dependentFieldFilter => {
            const { dependentFormField } = dependentFieldFilter
            transformField(dependentFormField, fieldsToRemove)
          })
        }
      }
    }

    const addContactPropertyRef = (formInstance: InstanceElement): void => {
      const { formFieldGroups } = formInstance.value
      makeArray(formFieldGroups).forEach(formFieldGroup => {
        const { fields } = formFieldGroup
        const fieldsToRemove = new Set<string>()
        makeArray(fields).forEach(field => {
          transformField(field, fieldsToRemove)
        })
        fieldsToRemove.forEach(name => { delete fields[name] })
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
