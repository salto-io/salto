/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, InstanceElement, Change } from '@salto-io/adapter-api'
import { ROLE_TYPE_NAME } from '../constants'
import { ROLE_TYPE_TO_LABEL } from '../filters/standard_roles'

const STANDARD_ROLE_TYPES = new Set(Object.keys(ROLE_TYPE_TO_LABEL))
const isStandardRoleChange = (change: Change<InstanceElement>): boolean =>
  getChangeData(change).value.type !== undefined && STANDARD_ROLE_TYPES.has(getChangeData(change).value.type)

/**
 * Block deployments of standard Okta roles
 */
export const standardRoleDeployments: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === ROLE_TYPE_NAME)
    .filter(isStandardRoleChange)
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as const,
      message: 'Standard roles cannot be deployed',
      detailedMessage: 'Okta does not support deployments of standard roles.',
    }))
