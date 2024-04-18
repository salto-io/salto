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
import { collections } from '@salto-io/lowerdash'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import {
  ChangeValidator,
  SeverityLevel,
  getChangeData,
  isInstanceChange,
  isRemovalChange,
  InstanceElement,
  ReadOnlyElementsSource,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { WorkflowV2Instance, isWorkflowV2Instance } from '../../filters/workflowV2/types'
import { WORKFLOW_SCHEME_TYPE_NAME } from '../../constants'

const { awu } = collections.asynciterable

const isWorkflowInScheme = (scheme: InstanceElement, workflowInst: WorkflowV2Instance): boolean => {
  if (
    isReferenceExpression(scheme.value.defaultWorkflow) &&
    workflowInst.elemID.isEqual(scheme.value.defaultWorkflow.elemID)
  ) {
    return true
  }
  const items = _.get(scheme.value, 'items')
  if (Array.isArray(items)) {
    return items
      .map(obj => obj?.workflow)
      .filter(isReferenceExpression)
      .some(workflowRef => workflowRef.elemID.isEqual(workflowInst.elemID))
  }
  return false
}

const getReferencingWorkflowSchemes = async (
  workflow: WorkflowV2Instance,
  elementSource?: ReadOnlyElementsSource,
): Promise<InstanceElement[]> => {
  if (elementSource === undefined) {
    return awu([]).toArray()
  }
  const schemes = awu(await getInstancesFromElementSource(elementSource, [WORKFLOW_SCHEME_TYPE_NAME]))
  return schemes.filter(scheme => isWorkflowInScheme(scheme, workflow)).toArray()
}

export const referencedWorkflowDeletionChangeValidator: ChangeValidator = async (changes, elementSource) =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isWorkflowV2Instance)
    .filter(async workflow => (await getReferencingWorkflowSchemes(workflow, elementSource)).length > 0)
    .map(async workflow => {
      const schemes = (await getReferencingWorkflowSchemes(workflow, elementSource))
      return {
      elemID: workflow.elemID,
      severity: 'Error' as SeverityLevel,
      message: "Can't delete a referenced workflow.",
      detailedMessage: `Workflow is referenced by the following workflow schemes: ${schemes.map(scheme => scheme.elemID.name)}.`,
    }})
    .toArray()
