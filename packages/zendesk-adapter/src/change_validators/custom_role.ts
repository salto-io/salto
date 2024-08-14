/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { CUSTOM_ROLE_TYPE_NAME } from '../constants'

const log = logger(module)
const SYSTEM_ROLE_NAMES = ['agen', 'agent', 'administrator', 'admin', 'billing admin', 'light agent']

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  getChangeData(change).elemID.typeName === CUSTOM_ROLE_TYPE_NAME &&
  (isAdditionChange(change) ||
    (isModificationChange(change) && change.data.before.value.name !== change.data.after.value.name))

export const customRoleNameValidator: ChangeValidator = async (changes, elementSource) => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(isRelevantChange)
    .map(getChangeData)
  if (elementSource === undefined) {
    log.error('Failed to run customRoleNameValidator because no element source was provided')
    return []
  }
  if (_.isEmpty(relevantInstances)) {
    return []
  }
  const allCustomRoles = await getInstancesFromElementSource(elementSource, [CUSTOM_ROLE_TYPE_NAME])
  return relevantInstances.flatMap(instance => {
    if (SYSTEM_ROLE_NAMES.includes(instance.value.name?.toLowerCase())) {
      return [
        {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Cannot change this custom_role since its name is reserved for a system role',
          detailedMessage: `The name (${instance.value.name}) is reserved for a system role, please use another name`,
        },
      ]
    }
    const otherCustomRoleWithTheSameName = allCustomRoles
      .filter(customRole => customRole.value.name?.toLowerCase() === instance.value.name?.toLowerCase())
      .filter(customRole => !customRole.elemID.isEqual(instance.elemID))
    if (_.isEmpty(otherCustomRoleWithTheSameName)) {
      return []
    }
    return [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot change this custom_role since its name is already in use',
        detailedMessage: `This name is already in use by ${otherCustomRoleWithTheSameName.map(customRole => customRole.elemID.getFullName()).join(', ')}.
Please use another name`,
      },
    ]
  })
}
