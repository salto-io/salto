/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource, getParentElemID } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { isGlobalContext } from '../../common/fields'
import { AddOrModifyInstanceChange } from '../../common/general'

const log = logger(module)

const createFieldContextErrorMessage = (elemID: ElemID, field: InstanceElement): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'A field can only have a single global context',
  detailedMessage: `Can't deploy this global context because the deployment will result in more than a single global context for field ${field.annotations[CORE_ANNOTATIONS.ALIAS] ?? field.elemID.name}.`,
})

export const fieldSecondGlobalContextValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run fieldSecondGlobalContextValidator because element source is undefined')
    return []
  }

  const contextChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)

  if (contextChanges.length === 0) {
    return []
  }
  const fieldToGlobalContextCount = _.countBy(
    (await getInstancesFromElementSource(elementSource, [FIELD_CONTEXT_TYPE_NAME])).filter(isGlobalContext),
    instance => getParentElemID(instance).getFullName(),
  )

  const addedGlobalContext = (change: AddOrModifyInstanceChange): boolean =>
    isGlobalContext(change.data.after) && (isAdditionChange(change) || !isGlobalContext(change.data.before))

  return Promise.all(
    contextChanges
      .filter(addedGlobalContext)
      .map(getChangeData)
      .filter(instance => fieldToGlobalContextCount[getParentElemID(instance).getFullName()] > 1)
      .map(async instance =>
        createFieldContextErrorMessage(instance.elemID, await elementSource.get(getParentElemID(instance))),
      ),
  )
}
