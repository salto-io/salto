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
import {
  isObjectType,
  Element,
  isInstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import { TransformFunc, transformValuesSync } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { apiNameSync } from './utils'

const TYPE_NAME_TO_FIELD_REMOVALS: Map<string, string[]> = new Map([
  ['Profile', ['tabVisibilities']],
  ['blng__RevenueRecognitionTreatment__c', ['blng__UniqueId__c']],
  [
    'blng__FinancePeriod__c',
    ['blng__Family__c', 'blng__NextOpenPeriod__c', 'blng__UniqueId__c'],
  ],
  ['blng__AccountBalanceSnapshot__c', ['blng__UniqueId__c']],
  ['blng__ErrorLog__c', ['blng__UniqueId__c']],
  ['blng__GLTreatment__c', ['blng__UniqueId__c']],
  ['blng__Invoice__c', ['blng__UniqueId__c']],
  ['blng__InvoiceLine__c', ['blng__UniqueId__c']],
  ['blng__SubInvoiceLine__c', ['blng__UniqueId__c']],
  ['blng__UsageSummary__c', ['blng__UniqueId__c']],
  ['OrderItem', ['blng__UniqueId__c']],
])

const fieldRemovalsForType = (
  type: ObjectType,
  typeNameToFieldRemovals: Map<string, string[]>,
): string[] => {
  const typeName = apiNameSync(type) ?? ''
  return typeNameToFieldRemovals.get(typeName) ?? []
}

const removeFieldsFromTypes = (
  elements: Element[],
  typeNameToFieldRemovals: Map<string, string[]>,
): void => {
  elements.filter(isObjectType).forEach((type) => {
    const fieldsToRemove = fieldRemovalsForType(type, typeNameToFieldRemovals)
    fieldsToRemove.forEach((fieldName) => {
      delete type.fields[fieldName]
    })
  })
}

const removeValuesFromInstances = (
  elements: Element[],
  typeNameToFieldRemovals: Map<string, string[]>,
): void => {
  const removeValuesFunc: TransformFunc = ({ value, field }) => {
    if (!field) return value
    const fieldsToRemove = fieldRemovalsForType(
      field.parent,
      typeNameToFieldRemovals,
    )
    if (fieldsToRemove.includes(field.name)) {
      return undefined
    }
    return value
  }

  elements
    .filter(isInstanceElement)
    // The below filter is temporary optimization to save calling transformValues for all instances
    // since TYPE_NAME_TO_FIELD_REMOVALS contains currently only top level types
    .filter(
      (inst) =>
        fieldRemovalsForType(inst.getTypeSync(), typeNameToFieldRemovals)
          .length > 0,
    )
    .forEach((inst) => {
      inst.value =
        transformValuesSync({
          values: inst.value,
          type: inst.getTypeSync(),
          transformFunc: removeValuesFunc,
          strict: true,
          allowEmptyArrays: true,
          allowEmptyObjects: true,
          pathID: inst.elemID,
        }) || inst.value
    })
}

/**
 * Declare the remove field and values filter, this filter removes fields from ObjectTypes and
 * their corresponding instances upon fetch.
 * */
export const makeFilter =
  (typeNameToFieldRemovals: Map<string, string[]>): LocalFilterCreator =>
  () => ({
    name: 'removeFieldsAndValuesFilter',
    onFetch: async (elements: Element[]) => {
      removeValuesFromInstances(elements, typeNameToFieldRemovals)
      removeFieldsFromTypes(elements, typeNameToFieldRemovals)
    },
  })

export default makeFilter(TYPE_NAME_TO_FIELD_REMOVALS)
