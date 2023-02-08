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
import { ChangeError, ChangeValidator, ElemID, getChangeData, isRemovalChange, SeverityLevel } from '@salto-io/adapter-api'
import { WORKFLOW_SCHEME_TYPE_NAME } from '../constants'

const getActiveWorkflowSchemeRemovalError = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'Cannot remove active workflow scheme',
  detailedMessage: 'Cannot remove active workflow scheme',
})

export const activeWorkflowSchemeChangeValidator: ChangeValidator = async (changes, elementSource) => {
  const relevantChanges = changes
    .filter(isRemovalChange)
    .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE_NAME)
    .filter(change => getChangeData(change).elemID.idType === 'instance')
  return relevantChanges.map(change => getActiveWorkflowSchemeRemovalError(getChangeData(change).elemID))
}
