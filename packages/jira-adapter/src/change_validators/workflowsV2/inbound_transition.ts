/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import {
  ChangeValidator,
  SeverityLevel,
  getChangeData,
  isInstanceChange,
  isAdditionOrModificationChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { isWorkflowV2Instance, WorkflowV2Instance } from '../../filters/workflowV2/types'

const { isDefined } = values
const { awu } = collections.asynciterable

const getStatusesWithoutInboundTransitions = (instance: WorkflowV2Instance): ReferenceExpression[] => {
  const statusesRefsWithInboundTransitions = Object.values(instance.value.transitions)
    .map(transition => transition.to?.statusReference)
    .filter(isDefined)
    .filter(isResolvedReferenceExpression)
  const statusesRefs = instance.value.statuses
    .map(status => status.statusReference)
    .filter(isResolvedReferenceExpression)
  return _.differenceBy(statusesRefs, statusesRefsWithInboundTransitions, statusRef => statusRef.elemID.getFullName())
}

export const inboundTransitionChangeValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowV2Instance)
    .map(instance => {
      const statusesWithoutInboundTransitionNames = getStatusesWithoutInboundTransitions(instance)
        .map(statusRef => statusRef.value.value.name)
        .join(', ')
      return _.isEmpty(statusesWithoutInboundTransitionNames)
        ? undefined
        : {
            elemID: instance.elemID,
            severity: 'Error' as SeverityLevel,
            message: 'Workflow statuses must have at least one inbound transition',
            detailedMessage: `The following statuses of workflow ${instance.value.name} have no inbound transitions: ${statusesWithoutInboundTransitionNames}. To fix this, remove those statuses or add inbound transitions to them.`,
          }
    })
    .filter(isDefined)
    .toArray()
