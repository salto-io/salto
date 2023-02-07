/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import { ChangeValidator, ElemID, isIndexPathPart } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { AUTOMATION_TYPE } from '../constants'


export const automationProjectReferenceDetector = (elemId: ElemID): boolean => {
  if (elemId.typeName === AUTOMATION_TYPE) {
    const nameParts = elemId.getFullNameParts()
    return nameParts.length === 7
      && nameParts[4] === 'projects'
      && isIndexPathPart(nameParts[5])
      && nameParts[6] === 'projectId'
  }
  return false
}

export const unresolvedReferenceValidator: ChangeValidator = deployment.changeValidators
  .createUnresolvedReferencesValidator(automationProjectReferenceDetector)
