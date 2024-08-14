/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isRemovalOrModificationChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../constants'

const { awu } = collections.asynciterable

export const readOnlyWorkflowValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isRemovalOrModificationChange)
    .map(getChangeData)
    .filter(
      instance =>
        instance.elemID.typeName === WORKFLOW_TYPE_NAME || instance.elemID.typeName === WORKFLOW_CONFIGURATION_TYPE,
    )
    .filter(instance => instance.value.operations?.canEdit === false || instance.value.isEditable === false)
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot remove or modify system workflows',
      detailedMessage: 'Cannot remove or modify this system workflow, as it is a read-only one.',
    }))
    .toArray()
