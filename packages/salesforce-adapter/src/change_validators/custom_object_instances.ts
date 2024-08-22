/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isModificationChange,
  InstanceElement,
  ChangeError,
  isAdditionChange,
} from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-components'

import { FIELD_ANNOTATIONS } from '../constants'
import { getLookUpName } from '../transformers/reference_mapping'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'

const { awu } = collections.asynciterable

const getUpdateErrorsForNonUpdateableFields = async (
  before: InstanceElement,
  after: InstanceElement,
): Promise<ReadonlyArray<ChangeError>> => {
  const beforeResolved = await resolveValues(before, getLookUpName)
  const afterResolved = await resolveValues(after, getLookUpName)
  return Object.values((await afterResolved.getType()).fields)
    .filter(field => !field.annotations[FIELD_ANNOTATIONS.UPDATEABLE])
    .map(field => {
      if (afterResolved.value[field.name] !== beforeResolved.value[field.name]) {
        return {
          elemID: beforeResolved.elemID,
          severity: 'Warning',
          message: 'Cannot modify the value of a non-updatable field',
          detailedMessage: `Cannot modify ${field.name}’s value of ${beforeResolved.elemID.getFullName()} because its field is defined as non-updateable.`,
        } as ChangeError
      }
      return undefined
    })
    .filter(values.isDefined)
}

const getCreateErrorsForNonCreatableFields = async (after: InstanceElement): Promise<ReadonlyArray<ChangeError>> => {
  const afterResolved = await resolveValues(after, getLookUpName)
  return awu(Object.values((await afterResolved.getType()).fields))
    .filter(field => !field.annotations[FIELD_ANNOTATIONS.CREATABLE])
    .map(field => {
      if (!_.isUndefined(afterResolved.value[field.name])) {
        return {
          elemID: afterResolved.elemID,
          severity: 'Warning',
          message: 'Cannot set a value to a non-creatable field',
          detailedMessage: `Cannot set a value for ${field.name} of ${afterResolved.elemID.getFullName()} because its field is defined as non-creatable.`,
        } as ChangeError
      }
      return undefined
    })
    .filter(values.isDefined)
    .toArray()
}

const changeValidator: ChangeValidator = async changes => {
  const updateChangeErrors = await awu(changes)
    .filter(isInstanceOfCustomObjectChange)
    .filter(isModificationChange)
    .flatMap(change =>
      getUpdateErrorsForNonUpdateableFields(
        change.data.before as InstanceElement,
        change.data.after as InstanceElement,
      ),
    )
    .toArray()

  const createChangeErrors = await awu(changes)
    .filter(isInstanceOfCustomObjectChange)
    .filter(isAdditionChange)
    .flatMap(change => getCreateErrorsForNonCreatableFields(getChangeData(change) as InstanceElement))
    .toArray()

  return [...updateChangeErrors, ...createChangeErrors]
}

export default changeValidator
