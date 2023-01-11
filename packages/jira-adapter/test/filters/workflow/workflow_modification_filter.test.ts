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
import { ElemID, InstanceElement, ObjectType, toChange, ReferenceExpression, ReadOnlyElementsSource, CORE_ANNOTATIONS, ListType, Field, BuiltinTypes } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { deployWorkflow } from '../../../src/filters/workflow/workflow_deploy_filter'
import { deployWorkflowScheme } from '../../../src/filters/workflow_scheme'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, WORKFLOW_SCHEME_TYPE_NAME, WORKFLOW_STATUS_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import workflowModificationFilter from '../../../src/filters/workflow/workflow_modification_filter'
import { getFilterParams, mockClient } from '../../utils'

jest.mock('../../../src/filters/workflow/workflow_deploy_filter', () => ({
  ...jest.requireActual('../../../src/filters/workflow/workflow_deploy_filter'),
  deployWorkflow: jest.fn(),
}))

jest.mock('../../../src/filters/workflow_scheme', () => ({
  ...jest.requireActual('../../../src/filters/workflow_scheme'),
  deployWorkflowScheme: jest.fn(),
}))

jest.mock('uuid', () => ({
  ...jest.requireActual('uuid'),
  v4: jest.fn().mockReturnValue('uuid'),
}))


describe('workflowModificationFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let paginator: clientUtils.Paginator
  let workflowType: ObjectType
  let workflowStatusType: ObjectType
  let workflowSchemeType: ObjectType
  let workflowInstance: InstanceElement
  let workflowSchemeInstance: InstanceElement
  let client: JiraClient
  let config: JiraConfig

  let elementsSource: ReadOnlyElementsSource
  beforeEach(async () => {
    workflowStatusType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_STATUS_TYPE_NAME) })
    workflowStatusType.fields.status = new Field(workflowStatusType, 'status', workflowStatusType)
    workflowType = new ObjectType({
      elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
      fields: {
        statuses: { refType: new ListType(workflowStatusType) },
        name: { refType: BuiltinTypes.STRING },
      },
    })
    workflowSchemeType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_SCHEME_TYPE_NAME) })

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    const { client: cli, paginator: pagi } = mockClient()
    client = cli
    paginator = pagi


    workflowInstance = new InstanceElement(
      'workflowInstance',
      workflowType,
      {
        name: 'workflowName',
      }
    )

    workflowSchemeInstance = new InstanceElement(
      'workflowSchemeInstance',
      workflowSchemeType,
      {
        id: '1',
        defaultWorkflow: new ReferenceExpression(
          workflowInstance.elemID,
          workflowInstance,
        ),
      }
    )

    const newWorkflowSchemeInstance = new InstanceElement(
      'newWorkflowSchemeInstance',
      workflowSchemeType,
      {
        defaultWorkflow: new ReferenceExpression(
          workflowInstance.elemID,
          workflowInstance,
        ),
      }
    )

    elementsSource = buildElementsSourceFromElements([
      workflowSchemeInstance,
      newWorkflowSchemeInstance,
      workflowInstance,
    ])

    filter = workflowModificationFilter(getFilterParams({
      client,
      paginator,
      config,
      elementsSource,
    })) as typeof filter
  })

  describe('onFetch', () => {
    it('should add updatable annotation', async () => {
      await filter.onFetch([workflowType])
      expect(workflowType.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
      expect(workflowType.fields.name.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
      expect(workflowStatusType.fields.status.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
    })

    it('should not set updatable annotation if usePrivateAPI is false', async () => {
      config.client.usePrivateAPI = false
      await filter.onFetch([workflowType])
      expect(workflowType.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    })
  })

  describe('deploy', () => {
    const deployWorkflowMock = deployWorkflow as jest.MockedFunction<
      typeof deployWorkflow
    >

    const deployWorkflowSchemeMock = deployWorkflowScheme as jest.MockedFunction<
      typeof deployWorkflowScheme
    >

    beforeEach(() => {
      deployWorkflowMock.mockClear()
      deployWorkflowSchemeMock.mockClear()
    })
    it('should deploy the modified workflow', async () => {
      const change = toChange({
        before: workflowInstance,
        after: workflowInstance,
      })

      await filter.deploy([change])

      const tempInstance = workflowInstance.clone()

      tempInstance.value.name = 'workflowName-uuid'
      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        1,
        toChange({ after: tempInstance }),
        client,
        config,
      )

      const tempSchemeInstance = workflowSchemeInstance.clone()
      tempSchemeInstance.value.defaultWorkflow = new ReferenceExpression(
        tempInstance.elemID,
        tempInstance,
      )
      tempSchemeInstance.value.updateDraftIfNeeded = true
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        1,
        toChange({ before: workflowSchemeInstance, after: tempSchemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )

      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        2,
        toChange({ before: workflowInstance }),
        client,
        config,
      )

      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        3,
        toChange({ after: workflowInstance }),
        client,
        config,
      )

      const schemeInstance = workflowSchemeInstance.clone()
      schemeInstance.value.updateDraftIfNeeded = true
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        2,
        toChange({ before: tempSchemeInstance, after: schemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )

      expect(deployWorkflowSchemeMock).toHaveBeenCalledTimes(2)

      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        4,
        toChange({ before: tempInstance }),
        client,
        config,
      )
    })

    it('should throw when change is not backward compatible', async () => {
      const change = toChange({
        before: workflowInstance,
        after: workflowInstance,
      })

      deployWorkflowSchemeMock.mockRejectedValueOnce({
        response: {
          data: {
            errorMessages: ['is missing the mappings required for statuses with'],
          },
        },
      })

      deployWorkflowMock.mockResolvedValueOnce()
      deployWorkflowMock.mockRejectedValueOnce(new Error('error'))

      const res = await filter.deploy([change])

      expect(res.deployResult.errors).toEqual([new Error('Deployment of jira.Workflow.instance.workflowInstance failed: Error: Modification to an active workflow jira.Workflow.instance.workflowInstance is not backward compatible')])

      const tempInstance = workflowInstance.clone()

      tempInstance.value.name = 'workflowName-uuid'
      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        1,
        toChange({ after: tempInstance }),
        client,
        config,
      )

      const tempSchemeInstance = workflowSchemeInstance.clone()
      tempSchemeInstance.value.defaultWorkflow = new ReferenceExpression(
        tempInstance.elemID,
        tempInstance,
      )
      tempSchemeInstance.value.updateDraftIfNeeded = true
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        1,
        toChange({ before: workflowSchemeInstance, after: tempSchemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )

      const schemeInstance = workflowSchemeInstance.clone()
      schemeInstance.value.updateDraftIfNeeded = true
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        2,
        toChange({ before: tempSchemeInstance, after: schemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )

      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        2,
        toChange({ before: tempInstance }),
        client,
        config,
      )
    })

    it('should cleanup when there was an error', async () => {
      const change = toChange({
        before: workflowInstance,
        after: workflowInstance,
      })

      deployWorkflowSchemeMock.mockRejectedValue(new Error('some error'))

      const res = await filter.deploy([change])

      expect(res.deployResult.errors).toHaveLength(1)

      const tempInstance = workflowInstance.clone()

      tempInstance.value.name = 'workflowName-uuid'
      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        1,
        toChange({ after: tempInstance }),
        client,
        config,
      )

      const tempSchemeInstance = workflowSchemeInstance.clone()
      tempSchemeInstance.value.defaultWorkflow = new ReferenceExpression(
        tempInstance.elemID,
        tempInstance,
      )
      tempSchemeInstance.value.updateDraftIfNeeded = true
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        1,
        toChange({ before: workflowSchemeInstance, after: tempSchemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )

      const schemeInstance = workflowSchemeInstance.clone()
      schemeInstance.value.updateDraftIfNeeded = true
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        2,
        toChange({ before: tempSchemeInstance, after: schemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )

      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        2,
        toChange({ before: tempInstance }),
        client,
        config,
      )
    })
  })
})
