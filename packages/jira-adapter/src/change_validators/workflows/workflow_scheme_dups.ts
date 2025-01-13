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
  isAdditionOrModificationChange,
  isInstanceElement,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { WORKFLOW_SCHEME_TYPE_NAME } from '../../constants'

const log = logger(module)
const { awu } = collections.asynciterable

export const workflowSchemeDupsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.warn('Skipping workflowSchemeDupsValidator due to missing elements source')
    return []
  }

  const workflowSchemeNameChangesData = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === WORKFLOW_SCHEME_TYPE_NAME)

  if (workflowSchemeNameChangesData.length === 0) {
    return []
  }
  const nameToInstance = await awu(await elementSource.list())
    .filter(id => id.idType === 'instance' && id.typeName === WORKFLOW_SCHEME_TYPE_NAME)
    .map(id => elementSource.get(id))
    .groupBy(instance => instance.value.name?.toLowerCase())

  return workflowSchemeNameChangesData
    .filter(
      instance =>
        Object.prototype.hasOwnProperty.call(nameToInstance, instance.value.name?.toLowerCase()) &&
        nameToInstance[instance.value.name?.toLowerCase()].some(
          dupInstance => !instance.elemID.isEqual(dupInstance.elemID),
        ),
    )
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Workflow scheme names must be unique',
      detailedMessage: `A workflow scheme with the name "${instance.value.name}" already exists (the name is case insensitive)`,
    }))
}
