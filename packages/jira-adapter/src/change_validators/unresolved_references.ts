/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeValidator, ElemID, isIndexPathPart } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { AUTOMATION_TYPE } from '../constants'

export const automationProjectReferenceDetector = (elemId: ElemID): boolean => {
  if (elemId.typeName === AUTOMATION_TYPE) {
    const nameParts = elemId.getFullNameParts()
    return (
      nameParts.length === 7 &&
      nameParts[4] === 'projects' &&
      isIndexPathPart(nameParts[5]) &&
      nameParts[6] === 'projectId'
    )
  }
  return false
}

export const unresolvedReferenceValidator: ChangeValidator =
  deployment.changeValidators.createOutgoingUnresolvedReferencesValidator(automationProjectReferenceDetector)
