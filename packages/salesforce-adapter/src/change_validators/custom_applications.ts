/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  ChangeError,
  isInstanceChange,
  isAdditionOrModificationChange,
  ElemID,
  InstanceElement,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { isInstanceOfTypeSync } from '../filters/utils'
import { CUSTOM_APPLICATION_METADATA_TYPE } from '../constants'

const { isDefined } = lowerDashValues

type ActionOverride = {
  formFactor: string
  pageOrSobjectType: string
}

type ProfileActionOverride = {
  formFactor: string
  pageOrSobjectType: string
  profile: string
}

type CustomApplicationWithOverrides = {
  actionOverrides: ActionOverride[]
  profileActionOverrides: ProfileActionOverride[]
}

const isValidActionOverride = (action: unknown): boolean =>
  _.isObject(action) && _.isString(_.get(action, 'formFactor')) && _.isString(_.get(action, 'pageOrSobjectType'))

const isValidProfileActionOverride = (action: unknown): boolean =>
  isValidActionOverride(action) && _.isString(_.get(action, 'profile'))

const hasActionOverrides = (value: unknown): boolean =>
  _.isArray(_.get(value, 'actionOverrides')) && _.every(_.get(value, 'actionOverrides'), isValidActionOverride)

const hasProfileActionOverrides = (value: unknown): boolean =>
  _.isArray(_.get(value, 'profileActionOverrides')) &&
  _.every(_.get(value, 'profileActionOverrides'), isValidProfileActionOverride)

const isCustomApplicationWithOverrides = (value: unknown): value is CustomApplicationWithOverrides =>
  _.isObject(value) && (hasActionOverrides(value) || hasProfileActionOverrides(value))

const generateActionOverrideKey = (action: ProfileActionOverride | ActionOverride): string => {
  const profilePart = 'profile' in action ? `, Profile: ${action.profile}` : ''
  return `Form Factor: ${action.formFactor}, Page/SObject: ${action.pageOrSobjectType}${profilePart}`
}

const collectDuplicates = (actions: Array<ActionOverride | ProfileActionOverride>): Set<string> => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  actions.forEach(action => {
    const key = generateActionOverrideKey(action)
    if (seen.has(key)) {
      duplicates.add(key)
    } else {
      seen.add(key)
    }
  })
  return duplicates
}

const createChangeError = (duplicates: Set<string>, elemId: ElemID): ChangeError => {
  const duplicateList = Array.from(duplicates)
    .map(dup => `- ${dup}`)
    .join('\n')
  return {
    elemID: elemId,
    severity: 'Error',
    message: 'Custom Application has conflicting action overrides',
    detailedMessage: `The following action overrides have multiple definitions:\n${duplicateList}`,
  }
}

const findActionOverridesDuplications = (instance: InstanceElement): ChangeError | undefined => {
  const values: unknown = instance.value
  if (!isCustomApplicationWithOverrides(values)) {
    return undefined
  }
  const actionOverridesArray = values.actionOverrides ?? []
  const profileActionOverridesArray = values.profileActionOverrides ?? []
  const allActions = actionOverridesArray.concat(profileActionOverridesArray)
  const duplicates = collectDuplicates(allActions)
  return duplicates.size > 0 ? createChangeError(duplicates, instance.elemID) : undefined
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(CUSTOM_APPLICATION_METADATA_TYPE))
    .map(findActionOverridesDuplications)
    .filter(isDefined)

export default changeValidator
