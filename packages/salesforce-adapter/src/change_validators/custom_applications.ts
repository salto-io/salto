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
  ReferenceExpression,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isInstanceOfTypeSync } from '../filters/utils'
import { CUSTOM_APPLICATION_METADATA_TYPE } from '../constants'

const { DefaultMap } = collections.map

type ActionOverride = {
  formFactor: string
  pageOrSobjectType: string
}

type ProfileActionOverride = {
  formFactor: string
  pageOrSobjectType: string
  profile: string | ReferenceExpression
  recordType?: string | ReferenceExpression
}

type CustomApplicationWithOverrides = {
  actionOverrides: ActionOverride[]
  profileActionOverrides: ProfileActionOverride[]
}

const isValidActionOverride = (action: unknown): boolean =>
  _.isObject(action) && _.isString(_.get(action, 'formFactor')) && _.isString(_.get(action, 'pageOrSobjectType'))

const isValidProfileActionOverride = (action: unknown): boolean =>
  isValidActionOverride(action) &&
  (_.isString(_.get(action, 'profile')) || isReferenceExpression(_.get(action, 'profile')))

const hasActionOverrides = (value: unknown): value is CustomApplicationWithOverrides =>
  _.isObject(value) &&
  _.isArray(_.get(value, 'actionOverrides')) &&
  _.every(_.get(value, 'actionOverrides'), isValidActionOverride)

const hasProfileActionOverrides = (value: unknown): value is CustomApplicationWithOverrides =>
  _.isObject(value) &&
  _.isArray(_.get(value, 'profileActionOverrides')) &&
  _.every(_.get(value, 'profileActionOverrides'), isValidProfileActionOverride)

const generateActionOverrideKey = (action: ProfileActionOverride | ActionOverride): string => {
  const key: string[] = [action.formFactor, action.pageOrSobjectType]
  if ('profile' in action) {
    key.push(isReferenceExpression(action.profile) ? action.profile.elemID.name : action.profile)
  }
  if ('recordType' in action && action.recordType !== undefined) {
    key.push(isReferenceExpression(action.recordType) ? action.recordType.elemID.name : action.recordType)
  }
  return key.join(':')
}

const collectDuplicates = (
  actions: Array<ActionOverride | ProfileActionOverride>,
  fieldName: string,
  instance: InstanceElement,
): ElemID[] => {
  const duplicates = new DefaultMap<string, ElemID[]>(() => [])
  actions.forEach((action, index) => {
    const key = generateActionOverrideKey(action)
    duplicates.get(key).push(instance.elemID.createNestedID(fieldName, index.toString()))
  })
  return Array.from(duplicates.entries()).flatMap(([_key, elemIds]) => (elemIds.length > 1 ? elemIds : []))
}

const createChangeError = (elemIds: ElemID[]): ChangeError[] =>
  elemIds.map(elemId => ({
    elemID: elemId,
    severity: 'Warning',
    message: 'Duplicate action override',
    detailedMessage: 'This action override has multiple definitions',
  }))

const findActionOverridesDuplications = (instance: InstanceElement): ChangeError[] => {
  const values: unknown = instance.value
  const actionOverridesErrors = hasActionOverrides(values)
    ? createChangeError(collectDuplicates(values.actionOverrides, 'actionOverrides', instance))
    : []
  const profileActionOverridesErrors = hasProfileActionOverrides(values)
    ? createChangeError(collectDuplicates(values.profileActionOverrides, 'profileActionOverrides', instance))
    : []
  return actionOverridesErrors.concat(profileActionOverridesErrors)
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(CUSTOM_APPLICATION_METADATA_TYPE))
    .flatMap(findActionOverridesDuplications)

export default changeValidator
