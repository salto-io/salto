/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { ASSIGNEE_TYPE_FIELD, PROJECT_TYPE } from '../../constants'

const VALID_ASSIGNEE_TYPES = ['PROJECT_LEAD', 'UNASSIGNED']

// this validator checks that the assignee type of a project as a valid value
export const projectAssigneeTypeValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
    .filter(project => project.value[ASSIGNEE_TYPE_FIELD] !== undefined)
    .filter(project => !VALID_ASSIGNEE_TYPES.includes(project.value[ASSIGNEE_TYPE_FIELD]))
    .map(project => ({
      elemID: project.elemID,
      severity: 'Error',
      message: 'Invalid assignee type',
      detailedMessage: `Project assignee type must be one of [${VALID_ASSIGNEE_TYPES.map(str => `'${str}'`).join(', ')}], got ${project.value[ASSIGNEE_TYPE_FIELD]}`,
    }))
