/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import wu from 'wu'
import { Element, ElemID, ObjectType, InstanceElement, getRestriction } from '@salto-io/adapter-api'
import { findObjectType, findInstances } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
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
const filterCreator: LocalFilterCreator = () => ({
  name: 'animationRulesFilter',
  /**
   * Upon fetch, transforms ANIMATION_FREQUENCY & RECORD_TYPE_CONTEXT values of animation rule
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    const transformShortValues = (
      animationRule: InstanceElement,
      fieldName: string,
      fieldFullValueNames: ReadonlyArray<string>,
    ): void => {
      const isShortValueName = (val: string): boolean => val !== undefined && val.length === 1

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
      return field === undefined ? [] : ((getRestriction(field).values ?? []) as ReadonlyArray<string>)
    }
    const animationFrequencyValues = getValues(ANIMATION_FREQUENCY)
    const recordTypeContextValues = getValues(RECORD_TYPE_CONTEXT)

    wu(findInstances(elements, ANIMATION_RULE_TYPE_ID)).forEach(animationRule => {
      transformShortValues(animationRule, ANIMATION_FREQUENCY, animationFrequencyValues)
      transformShortValues(animationRule, RECORD_TYPE_CONTEXT, recordTypeContextValues)
    })
  },
})

export default filterCreator
