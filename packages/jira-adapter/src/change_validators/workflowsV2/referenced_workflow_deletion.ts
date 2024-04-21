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
  ReadOnlyElementsSource,
  ElemID,
} from '@salto-io/adapter-api'
import { getWorkflowsFromWorkflowScheme } from '../../filters/workflowV2/workflow_filter'
import { isWorkflowV2Instance } from '../../filters/workflowV2/types'
import { WORKFLOW_SCHEME_TYPE_NAME } from '../../constants'

const { awu } = collections.asynciterable

const mapWorkflowsToReferencingSchemes = async (
  elementSource: ReadOnlyElementsSource,
): Promise<Record<string, Set<ElemID>>> => {
  const res: Record<string, Set<ElemID>> = {}

  await awu(await getInstancesFromElementSource(elementSource, [WORKFLOW_SCHEME_TYPE_NAME])).forEach(async scheme => {
    await awu(await getWorkflowsFromWorkflowScheme(scheme)).forEach(workflow => {
      const key = workflow.elemID.getFullName()
      if (!(key in res)) {
        res[key] = new Set<ElemID>()
      }
      res[key].add(scheme.elemID)
    })
  })
  return res
}

export const referencedWorkflowDeletionChangeValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }
  const workflowsToReferencingSchemes = await mapWorkflowsToReferencingSchemes(elementSource)
  return awu(changes)
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isWorkflowV2Instance)
    .filter(
      workflow =>
        workflow.elemID.getFullName() in workflowsToReferencingSchemes &&
        workflowsToReferencingSchemes[workflow.elemID.getFullName()].size > 0,
    )
    .map(async workflow => ({
      elemID: workflow.elemID,
      severity: 'Error' as SeverityLevel,
      message: "Can't delete a referenced workflow.",
      detailedMessage: `Workflow is referenced by the following workflow schemes: ${[...workflowsToReferencingSchemes[workflow.elemID.getFullName()]].map(elemID => elemID.name)}.`,
    }))
    .toArray()
}
