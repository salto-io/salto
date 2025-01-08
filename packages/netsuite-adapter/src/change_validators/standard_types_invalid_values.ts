/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import {
  Change,
  ChangeError,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
  SeverityLevel,
  Value,
} from '@salto-io/adapter-api'
import { isStandardType } from '../types'
import { NetsuiteChangeValidator } from './types'

const { isDefined } = values

type InvalidValue = {
  typeName: string
  path: string[]
  value: Value
  error: {
    severity: SeverityLevel
    message: string
    detailedMessage: string
  }
}

const invalidValues: InvalidValue[] = [
  {
    typeName: 'role',
    path: ['subsidiaryoption'],
    value: 'SELECTED',
    error: {
      severity: 'Error',
      message: "Can't deploy a role with a 'subsidiary option' value set to 'SELECTED'ֿ",
      detailedMessage:
        "Can't deploy a role with a 'subsidiary option' value set to 'SELECTED', due to NetSuite's SDF restrictions.\n" +
        "To continue with this deployment, you can edit this change in Salto and remove the whole row or replace 'SELECTED' with a valid value.\n" +
        'After the Salto deployment succeeds, change the value back directly in the NetSuite UI.\n' +
        'To learn how to edit NACL files, go to https://help.salto.io/en/articles/8553792-editing-files-during-deployments',
    },
  },
]

const getInvalidValuesChangeErrors = (
  { typeName, path, value, error }: InvalidValue,
  instanceChanges: Record<string, Change<InstanceElement>[]>,
): ChangeError[] => {
  if (!(typeName in instanceChanges)) {
    return []
  }

  return instanceChanges[typeName]
    .map(change => {
      const instance = getChangeData(change)
      if (
        _.get(instance.value, path) !== value ||
        (isModificationChange(change) && _.get(change.data.before.value, path) === value)
      ) {
        return undefined
      }

      const elemID = instance.elemID.createNestedID(...path)
      return {
        ...error,
        elemID,
      }
    })
    .filter(isDefined)
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const instanceChanges = _.groupBy(
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => isStandardType(getChangeData(change).refType)),
    change => getChangeData(change).elemID.typeName,
  )

  return invalidValues.flatMap(invalidValue => getInvalidValuesChangeErrors(invalidValue, instanceChanges))
}

export default changeValidator
