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
import { collections } from '@salto-io/lowerdash'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import {
  ChangeValidator,
  SeverityLevel,
  getChangeData,
  isInstanceChange,
  isRemovalChange,
  ReadOnlyElementsSource,
  ElemID,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getWorkflowsFromWorkflowScheme } from '../../filters/workflowV2/workflow_filter'
import { isWorkflowV2Instance } from '../../filters/workflowV2/types'
import { WORKFLOW_SCHEME_TYPE_NAME } from '../../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const mapWorkflowsToReferencingSchemes = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<Record<string, Set<ElemID>>> => {
  const workflowNameToWorkflowScheme: Record<string, Set<ElemID>> = {}

  await awu(await getInstancesFromElementSource(elementsSource, [WORKFLOW_SCHEME_TYPE_NAME])).forEach(scheme => {
    getWorkflowsFromWorkflowScheme(scheme).forEach(workflow => {
      const key = workflow.elemID.getFullName()
      if (workflowNameToWorkflowScheme[key] === undefined) {
        workflowNameToWorkflowScheme[key] = new Set<ElemID>()
      }
      workflowNameToWorkflowScheme[key].add(scheme.elemID)
    })
  })
  return workflowNameToWorkflowScheme
}

export const referencedWorkflowDeletionChangeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.warn('Elements source was not passed to referencedWorkflowDeletionChangeValidator. Skipping validator.')
    return []
  }
  const workflowNameToReferencingWorkflowSchemes = await mapWorkflowsToReferencingSchemes(elementsSource)
  return awu(changes)
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isWorkflowV2Instance)
    .filter(
      workflow =>
        workflowNameToReferencingWorkflowSchemes[workflow.elemID.getFullName()] !== undefined &&
        workflowNameToReferencingWorkflowSchemes[workflow.elemID.getFullName()].size > 0,
    )
    .map(workflow => ({
      elemID: workflow.elemID,
      severity: 'Error' as SeverityLevel,
      message: "Can't delete a referenced workflow.",
      detailedMessage: `Workflow is referenced by the following workflow schemes: ${[...workflowNameToReferencingWorkflowSchemes[workflow.elemID.getFullName()]].map(elemID => elemID.name).join(', ')}.`,
    }))
    .toArray()
}
