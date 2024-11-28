/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _, { isUndefined } from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  ChangeError,
  isInstanceChange,
  isAdditionOrModificationChange,
  ElemID,
  InstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isInstanceOfTypeSync } from '../filters/utils'
import { CUSTOM_APPLICATION_METADATA_TYPE } from '../constants'

const { awu } = collections.asynciterable

type ActionOverride = {
  formFactor: string
  pageOrSobjectType: string
}

type ProfileActionOverride = {
  formFactor: string
  pageOrSobjectType: string
  profile: string
}

type CustomApplicationValue = {
  actionOverrides: ActionOverride[]
  profileActionsOverrides: ProfileActionOverride[]
}

const isCustomApplicationValues = (value: unknown): value is CustomApplicationValue =>
  _.isObject(value) &&
  _.isArray(_.get(value, 'actionOverrides')) &&
  _.every(
    _.get(value, 'actionOverrides'),
    action =>
      _.isObject(action) && _.isString(_.get(action, 'formFactor')) && _.isString(_.get(action, 'pageOrSobject')),
  ) &&
  _.isArray(_.get(value, 'profileActionOverrides')) &&
  _.every(
    _.get(value, 'profileActionOverrides'),
    action =>
      _.isObject(action) &&
      _.isString(_.get(action, 'formFactor')) &&
      _.isString(_.get(action, 'pageOrSobject')) &&
      _.isString(_.get(action, 'profile')),
  )

const createChangeError = (duplicates: string[], elemId: ElemID): ChangeError => {
  const duplicateList = duplicates.map(dup => `- ${dup}`).join('\n')
  return {
    elemID: elemId,
    severity: 'Error',
    message: 'Duplicate Overrides Detected',
    detailedMessage: `The following overrides are duplicated:\n${duplicateList}`,
  }
}

const instanceValidator = (instance: InstanceElement): ChangeError | undefined => {
  const values: unknown = instance.value
  if (!isCustomApplicationValues(values)) {
    return undefined // Add error incase of wrong instance
  }
  const duplicates: string[] = []
  const seen = new Set<string>()

  values.actionOverrides.forEach(action => {
    const key = action.formFactor.concat(action.pageOrSobjectType)
    seen.has(key) ? duplicates.push(key) : seen.add(key)
  })

  values.profileActionsOverrides.forEach(action => {
    const key = action.formFactor.concat(action.pageOrSobjectType).concat(action.profile)
    seen.has(key) ? duplicates.push(key) : seen.add(key)
  })

  return _.isEmpty(duplicates) ? undefined : createChangeError(duplicates, instance.elemID)
}

const isDefined = (instance: ChangeError | undefined): instance is ChangeError => !isUndefined(instance)

const changeValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(CUSTOM_APPLICATION_METADATA_TYPE))
    .map(instanceValidator)
    .filter(isDefined)
    .toArray()

export default changeValidator
