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
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { removeMissingContextProjects } from '../../weak_references/context_projects'
import { PROJECT_IDS } from '../../constants'

const log = logger(module)

export const emptyProjectScopedContextValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.error('Failed to run emptyProjectScopedContextValidator because element source is undefined')
    return []
  }

  const contextInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .map(getChangeData)
    .filter(isInstanceElement)

  const { fixedElements } = await removeMissingContextProjects()({ elementsSource })(contextInstances)
  return fixedElements
    .filter(isInstanceElement)
    .filter(fixedInstance => fixedInstance.value[PROJECT_IDS].length === 0)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Project-scoped context must have at least one project in the target environment',
      detailedMessage:
        'This context is attached to projects that do not exist in the target environment. It cannot be deployed without referencing at least one project in the target environment.',
    }))
}
