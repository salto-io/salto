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
import { isObjectType, Element, ObjectType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { metadataType } from '../transformers/transformer'

const { awu } = collections.asynciterable

const FIELDS_TO_REMOVE_RESTRICTION_FROM_BY_TYPE: Record<string, string[]> = {
  AccessControlPolicy: ['targetEntity'],
  AnimationRule: ['sobjectType', 'targetField'],
  AppProfileActionOverride: ['pageOrSobjectType'],
  PlatformEventChannelMember: ['selectedEntity'],
  ProfileActionOverride: ['pageOrSobjectType'],
  QueueSobject: ['sobjectType'],
  RestrictionRule: ['targetEntity'],
  Territory2RuleItem: ['field'],
}

/**
 * Remove _restriction annotation values from types that are impacted by custom objects.
 * Note: This is a short-term solution - once SALTO-1381 is implemented, we should
 * convert the builtin _restriction annotation to hidden (with _hidden_value=true),
 * and hide all the values on upgrade.
 */
export const makeFilter = (
  typeNameToFieldMapping: Record<string, string[]>,
): LocalFilterCreator => () => ({
  name: 'removeRestrictionAnnotationsFilter',
  onFetch: async (elements: Element[]) => {
    const removeRestrictionsFromTypeFields = async (type: ObjectType): Promise<void> => {
      const relevantFields = typeNameToFieldMapping[await metadataType(type)]
      relevantFields.forEach(fieldName => {
        const field = type.fields[fieldName]
        if (field !== undefined && field.annotations[CORE_ANNOTATIONS.RESTRICTION] !== undefined) {
          delete field.annotations[CORE_ANNOTATIONS.RESTRICTION]
        }
      })
    }

    await awu(elements)
      .filter(isObjectType)
      .filter(async type => typeNameToFieldMapping[await metadataType(type)] !== undefined)
      .forEach(removeRestrictionsFromTypeFields)
  },
})

export default makeFilter(FIELDS_TO_REMOVE_RESTRICTION_FROM_BY_TYPE)
