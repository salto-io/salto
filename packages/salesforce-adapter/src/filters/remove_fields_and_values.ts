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
  isObjectType, Element, isInstanceElement, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { metadataType } from '../transformers/transformer'
import { metadataTypeSync } from './utils'

const { awu } = collections.asynciterable

const TYPE_NAME_TO_FIELD_REMOVALS: Map<string, string[]> = new Map([
  ['Profile', ['tabVisibilities']],
])

const hideFieldsFromTypes = (
  elements: Element[],
  typeNameToFieldRemovals: Map<string, string[]>
): void => {
  elements
    .filter(isObjectType)
    .forEach(type => {
      const fieldsToHide = typeNameToFieldRemovals.get(metadataTypeSync(type)) ?? []
      fieldsToHide.forEach(fieldName => {
        const field = type.fields[fieldName]
        if (field !== undefined) {
          field.annotations[CORE_ANNOTATIONS.HIDDEN] = true
        }
      })
    })
}


const removeValuesFromInstances = async (
  elements: Element[],
  typeNameToFieldRemovals: Map<string, string[]>
): Promise<void> => {
  const removeValuesFunc: TransformFunc = async ({ value, field }) => {
    if (!field) return value
    const fieldParent = field.parent
    const fieldsToRemove = typeNameToFieldRemovals.get(await metadataType(fieldParent)) ?? []
    if (fieldsToRemove.includes(field.name)) {
      return undefined
    }
    return value
  }

  await awu(elements)
    .filter(isInstanceElement)
    // The below filter is temporary optimization to save calling transformValues for all instances
    // since TYPE_NAME_TO_FIELD_REMOVALS contains currently only top level types
    .filter(async inst => typeNameToFieldRemovals.has(await metadataType(inst)))
    .forEach(async inst => {
      inst.value = await transformValues({
        values: inst.value,
        type: await inst.getType(),
        transformFunc: removeValuesFunc,
        strict: false,
        allowEmpty: true,
        pathID: inst.elemID,
      }) || inst.value
    })
}

/**
 * Declare the remove field and values filter, this filter removes fields from ObjectTypes and
 * their corresponding instances upon fetch.
 * */
export const makeFilter = (
  typeNameToFieldRemovals: Map<string, string[]>,
): LocalFilterCreator => () => ({
  name: 'removeFieldsAndValuesFilter',
  onFetch: async (elements: Element[]) => {
    await removeValuesFromInstances(elements, typeNameToFieldRemovals)
    hideFieldsFromTypes(elements, typeNameToFieldRemovals)
  },
})

export default makeFilter(TYPE_NAME_TO_FIELD_REMOVALS)
