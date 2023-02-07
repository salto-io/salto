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
import wu from 'wu'
import {
  Element, ElemID, ObjectType, InstanceElement, getRestriction,
} from '@salto-io/adapter-api'
import {
  findObjectType, findInstances,
} from '@salto-io/adapter-utils'
import { FilterWith } from '../filter'
import { SALESFORCE } from '../constants'

export const ANIMATION_RULE_TYPE_ID = new ElemID(SALESFORCE, 'AnimationRule')
export const ANIMATION_FREQUENCY = 'animationFrequency'
export const RECORD_TYPE_CONTEXT = 'recordTypeContext'

/**
 * Declare the animation rules filter, this filter transforms ANIMATION_FREQUENCY &
 * RECORD_TYPE_CONTEXT values of animation rule instances to have their full name since SF API
 * returns only the first letter of the picklist value
 *
 */
const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'animationRulesFilter',
  /**
   * Upon fetch, transforms ANIMATION_FREQUENCY & RECORD_TYPE_CONTEXT values of animation rule
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    const transformShortValues = (animationRule: InstanceElement, fieldName: string,
      fieldFullValueNames: ReadonlyArray<string>): void => {
      const isShortValueName = (val: string): boolean => (val !== undefined && val.length === 1)

      const fullValueName = (fullNameValues: ReadonlyArray<string>, shortValue: string): string =>
        fullNameValues.find(v => v.toLowerCase().startsWith(shortValue.toLowerCase())) ?? shortValue

      const fieldValue = animationRule.value[fieldName]
      if (isShortValueName(fieldValue)) {
        animationRule.value[fieldName] = fullValueName(fieldFullValueNames, fieldValue)
      }
    }

    const animationRuleType = findObjectType(elements, ANIMATION_RULE_TYPE_ID) as ObjectType
    const getValues = (fieldName: string): ReadonlyArray<string> => {
      const field = animationRuleType?.fields[fieldName]
      return field === undefined
        ? []
        : (getRestriction(field).values ?? []) as ReadonlyArray<string>
    }
    const animationFrequencyValues = getValues(ANIMATION_FREQUENCY)
    const recordTypeContextValues = getValues(RECORD_TYPE_CONTEXT)

    wu(findInstances(elements, ANIMATION_RULE_TYPE_ID))
      .forEach(animationRule => {
        transformShortValues(animationRule, ANIMATION_FREQUENCY, animationFrequencyValues)
        transformShortValues(animationRule, RECORD_TYPE_CONTEXT, recordTypeContextValues)
      })
  },
})

export default filterCreator
