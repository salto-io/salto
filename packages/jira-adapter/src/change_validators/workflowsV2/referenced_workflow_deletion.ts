/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { logger } from '@salto-io/logging'
import { JiraConfig } from '../../config/config'
import { getWorkflowsFromWorkflowScheme } from '../../filters/workflowV2/workflow_filter'
import { isWorkflowV2Instance } from '../../filters/workflowV2/types'
import { WORKFLOW_SCHEME_TYPE_NAME } from '../../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const mapWorkflowNameToReferencingWorkflowSchemesIDs = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<Record<string, Set<ElemID>>> => {
  const workflowNameToReferencingWorkflowSchemesIDs: Record<string, Set<ElemID>> = {}

  await awu(await getInstancesFromElementSource(elementsSource, [WORKFLOW_SCHEME_TYPE_NAME])).forEach(scheme => {
    getWorkflowsFromWorkflowScheme(scheme).forEach(workflowReference => {
      const key = workflowReference.elemID.getFullName()
      if (workflowNameToReferencingWorkflowSchemesIDs[key] === undefined) {
        workflowNameToReferencingWorkflowSchemesIDs[key] = new Set<ElemID>()
      }
      workflowNameToReferencingWorkflowSchemesIDs[key].add(scheme.elemID)
    })
  })
  return workflowNameToReferencingWorkflowSchemesIDs
}

/*
 * This change validator checks whether a deleted workflow has a workflow-scheme referencing it, if so then emit an error.
 * This is the behaviour by Jira, which returns an error when trying to delete a referenced workflow.
 *
 * Note, this validator only works for WorkflowV2.
 *  */
export const referencedWorkflowDeletionChangeValidator =
  (config: JiraConfig): ChangeValidator =>
  async (changes, elementsSource) => {
    if (!config.fetch.enableNewWorkflowAPI) {
      log.warn('New workflow api not enabled, skipping validator.')
      return []
    }
    if (elementsSource === undefined) {
      log.warn('Skipping referencedWorkflowDeletionChangeValidator due to missing elements source')
      return []
    }
    const workflowChangesData = changes
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .map(getChangeData)
      .filter(isWorkflowV2Instance)

    if (workflowChangesData.length === 0) {
      return []
    }
    const workflowNameToReferencingWorkflowSchemes =
      await mapWorkflowNameToReferencingWorkflowSchemesIDs(elementsSource)
    return workflowChangesData
      .filter(workflow => !_.isEmpty(workflowNameToReferencingWorkflowSchemes[workflow.elemID.getFullName()]))
      .map(workflow => ({
        elemID: workflow.elemID,
        severity: 'Error' as SeverityLevel,
        message: "Can't delete a referenced workflow.",
        detailedMessage: `Workflow is referenced by the following workflow schemes: ${[...workflowNameToReferencingWorkflowSchemes[workflow.elemID.getFullName()]].map(elemID => elemID.name).join(', ')}.`,
      }))
  }
