/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  InstanceElement,
  ModificationChange,
  isAdditionOrModificationChange,
  AdditionChange,
  isAdditionChange,
  ChangeError,
  ElemID,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { APP_USER_SCHEMA_TYPE_NAME, BASE_FIELD, DEFINITIONS_FIELD, SCHEMA_TYPES } from '../constants'

export const BASE_PATH = [DEFINITIONS_FIELD, BASE_FIELD]

const getErrorWithSeverity = (elemID: ElemID, severity: SeverityLevel): ChangeError => ({
  elemID,
  severity,
  message: "Base attributes cannot be deployed via Okta's APIs",
  detailedMessage: `Salto cannot deploy changes to base attributes, as they are automatically determined by the associated ${elemID.typeName === APP_USER_SCHEMA_TYPE_NAME ? 'application' : 'schema'}.`,
})

const getModificationError = (change: ModificationChange<InstanceElement>): ChangeError | undefined => {
  const { before, after } = change.data
  const beforeBase = _.get(before.value, BASE_PATH)
  const afterBase = _.get(after.value, BASE_PATH)

  if (_.isEqual(beforeBase, afterBase)) {
    return undefined
  }
  const beforeValueWithoutBase = _.omit(before.value, BASE_PATH.join('.'))
  const afterValueWithoutBase = _.omit(after.value, BASE_PATH.join('.'))
  // If the base field is the only change, we will not deploy it
  if (_.isEqual(beforeValueWithoutBase, afterValueWithoutBase)) {
    return getErrorWithSeverity(change.data.after.elemID, 'Error')
  }

  // If the base field is not the only change, we will deploy the other changes
  return getErrorWithSeverity(change.data.after.elemID, 'Warning')
}

const getErrorFromChange = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
): ChangeError | undefined => {
  if (isAdditionChange(change)) {
    return getErrorWithSeverity(change.data.after.elemID, 'Info')
  }
  return getModificationError(change)
}

/**
 * Verifies that schema instances are not modified within the base field.
 */
// TODO: change the file name to schema_base_changes.ts
export const schemaBaseChangesValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => SCHEMA_TYPES.includes(getChangeData(change).elemID.typeName))
    .map(getErrorFromChange)
    .filter(values.isDefined)
