/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { WORKFLOW_SCHEME_TYPE_NAME } from '../../constants'

const { awu } = collections.asynciterable

export const workflowSchemeDupsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }

  const nameToInstance = await awu(await elementSource.list())
    .filter(id => id.idType === 'instance' && id.typeName === WORKFLOW_SCHEME_TYPE_NAME)
    .map(id => elementSource.get(id))
    .groupBy(instance => instance.value.name?.toLowerCase())

  return changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === WORKFLOW_SCHEME_TYPE_NAME)
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
