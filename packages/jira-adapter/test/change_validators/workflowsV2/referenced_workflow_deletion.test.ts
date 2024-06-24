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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { toChange, InstanceElement, ReferenceExpression, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { referencedWorkflowDeletionChangeValidator } from '../../../src/change_validators/workflowsV2/referenced_workflow_deletion'
import { ISSUE_TYPE_NAME, WORKFLOW_SCHEME_TYPE_NAME } from '../../../src/constants'
import { createEmptyType, createSkeletonWorkflowV2Instance } from '../../utils'

describe('referencedWorkflowDeletionChangeValidator', () => {
  const workflowSchemeObjectType = createEmptyType(WORKFLOW_SCHEME_TYPE_NAME)
  const issueTypeInstance = new InstanceElement('issueType', createEmptyType(ISSUE_TYPE_NAME))
  let defaultSchemeInstance: InstanceElement
  let referencingSchemeInstance: InstanceElement
  let referencedWorkflowInstance: InstanceElement
  let unreferencedWorkflowInstance: InstanceElement
  let defaultWorkflowInstance: InstanceElement
  let elementSource: ReadOnlyElementsSource
  let config: JiraConfig

  beforeEach(() => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableNewWorkflowAPI = true
    defaultWorkflowInstance = createSkeletonWorkflowV2Instance('defaultWorkflowInstance')
    referencedWorkflowInstance = createSkeletonWorkflowV2Instance('referencedWorkflowInstance')
    unreferencedWorkflowInstance = createSkeletonWorkflowV2Instance('unreferencedWorkflowInstance')

    defaultSchemeInstance = new InstanceElement('defaultSchemeInstance', workflowSchemeObjectType, {
      name: 'defaultSchemeInstance',
      defaultWorkflow: new ReferenceExpression(defaultWorkflowInstance.elemID),
      items: [],
    })
    referencingSchemeInstance = new InstanceElement('referencingSchemeInstance', workflowSchemeObjectType, {
      defaultWorkflow: new ReferenceExpression(defaultWorkflowInstance.elemID),
      name: 'referencingSchemeInstance',
      items: [
        {
          workflow: new ReferenceExpression(referencedWorkflowInstance.elemID),
          issueType: new ReferenceExpression(issueTypeInstance.elemID),
        },
      ],
    })
  })

  it("shouldn't raise an error when the deleted workflow is unreferenced.", async () => {
    elementSource = buildElementsSourceFromElements([
      defaultWorkflowInstance,
      referencedWorkflowInstance,
      referencingSchemeInstance,
    ])
    const result = await referencedWorkflowDeletionChangeValidator(config)(
      [toChange({ before: unreferencedWorkflowInstance })],
      elementSource,
    )
    expect(result).toEqual([])
  })

  it("shouldn't raise an error when the deleted workflow is unreferenced after changing the referencing workflow scheme.", async () => {
    const afterScheme = referencingSchemeInstance.clone()
    afterScheme.value.items[0].workflow = new ReferenceExpression(defaultWorkflowInstance.elemID)
    elementSource = buildElementsSourceFromElements([defaultWorkflowInstance, afterScheme])
    const result = await referencedWorkflowDeletionChangeValidator(config)(
      [
        toChange({ before: referencingSchemeInstance, after: afterScheme }),
        toChange({ before: referencedWorkflowInstance }),
      ],
      elementSource,
    )
    expect(result).toEqual([])
  })

  it("shouldn't raise an error when enableNewWorkflowAPI is false, as the validator is skipped.", async () => {
    config.fetch.enableNewWorkflowAPI = false
    elementSource = buildElementsSourceFromElements([defaultWorkflowInstance, referencingSchemeInstance])
    const result = await referencedWorkflowDeletionChangeValidator(config)(
      [toChange({ before: referencedWorkflowInstance })],
      elementSource,
    )
    expect(result).toEqual([])
  })

  it('should raise an error when the deleted workflow is referenced.', async () => {
    elementSource = buildElementsSourceFromElements([defaultWorkflowInstance, referencingSchemeInstance])
    const result = await referencedWorkflowDeletionChangeValidator(config)(
      [toChange({ before: referencedWorkflowInstance })],
      elementSource,
    )
    expect(result).toEqual([
      {
        elemID: referencedWorkflowInstance.elemID,
        severity: 'Error',
        message: "Can't delete a referenced workflow.",
        detailedMessage: 'Workflow is referenced by the following workflow schemes: referencingSchemeInstance.',
      },
    ])
  })

  it('should raise an error when the deleted workflow is referenced as a default workflow in a workflow scheme.', async () => {
    elementSource = buildElementsSourceFromElements([defaultSchemeInstance, referencingSchemeInstance])
    const result = await referencedWorkflowDeletionChangeValidator(config)(
      [toChange({ before: defaultWorkflowInstance })],
      elementSource,
    )
    expect(result).toEqual([
      {
        elemID: defaultWorkflowInstance.elemID,
        severity: 'Error',
        message: "Can't delete a referenced workflow.",
        detailedMessage:
          'Workflow is referenced by the following workflow schemes: defaultSchemeInstance, referencingSchemeInstance.',
      },
    ])
  })
})
