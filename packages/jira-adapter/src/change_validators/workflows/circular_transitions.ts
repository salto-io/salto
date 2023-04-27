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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { isWorkflowInstance } from '../../filters/workflow/types'

export const circularTransitionsValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowInstance)
    .flatMap(instance => instance.value.transitions
      .filter(transition => transition.to === '' && transition.from === undefined)
      .map(transition => ({
        elemID: instance.elemID,
        severity: 'Warning' as SeverityLevel,
        message: 'Circular workflow transitions cannot be deployed',
        detailedMessage: `This workflow has a transition ${transition.name} from any status to itself, which cannot be deployed due to Atlassian API limitations.
The workflow will be deployed without this transition.`,
      })))
