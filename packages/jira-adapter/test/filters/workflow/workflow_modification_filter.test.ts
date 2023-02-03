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
import { ElemID, InstanceElement, ObjectType, toChange, ReferenceExpression, ReadOnlyElementsSource, CORE_ANNOTATIONS, ListType, Field, BuiltinTypes, Change } from '@salto-io/adapter-api'
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
  let workflowBeforeInstance: InstanceElement
  let workflowSchemeInstance: InstanceElement
  let newWorkflowSchemeInstance: InstanceElement
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
    workflowBeforeInstance = new InstanceElement(
      'workflowInstance',
      workflowType,
      {
        name: 'workflowName2',
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

    newWorkflowSchemeInstance = new InstanceElement(
      'newWorkflowSchemeInstance',
      workflowSchemeType,
      {
        id: '2',
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
    let change: Change<InstanceElement>
    let tempInstance: InstanceElement
    let tempSchemeInstance: InstanceElement
    let tempNewSchemeInstance: InstanceElement
    let schemeInstance: InstanceElement
    let newSchemeInstance: InstanceElement

    const expectSchemeChangeToTemp = (callNum: number): void => {
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        callNum,
        toChange({ before: workflowSchemeInstance, after: tempSchemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )
    }

    const expectNewSchemeChangeToTemp = (callNum: number): void => {
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        callNum,
        toChange({ before: newWorkflowSchemeInstance, after: tempNewSchemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )
    }

    const expectSchemeChangeBack = (callNum: number): void => {
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        callNum,
        toChange({ before: tempSchemeInstance, after: schemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )
    }

    const expectNewSchemeChangeBack = (callNum: number): void => {
      expect(deployWorkflowSchemeMock).toHaveBeenNthCalledWith(
        callNum,
        toChange({ before: tempNewSchemeInstance, after: newSchemeInstance }),
        client,
        paginator,
        config,
        elementsSource,
      )
    }

    const expectCreateOfTempWorkflow = (callNum: number): void => {
      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        callNum,
        toChange({ after: tempInstance }),
        client,
        config,
      )
    }

    const expectDeleteOfBeforeWorkflow = (callNum: number): void => {
      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        callNum,
        toChange({ before: workflowBeforeInstance }),
        client,
        config,
      )
    }

    const expectCreateOfNewWorkflow = (callNum: number): void => {
      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        callNum,
        toChange({ after: workflowInstance }),
        client,
        config,
      )
    }

    const expectDeleteOfTempWorkflow = (callNum: number): void => {
      expect(deployWorkflowMock).toHaveBeenNthCalledWith(
        callNum,
        toChange({ before: tempInstance }),
        client,
        config,
      )
    }

    beforeEach(() => {
      deployWorkflowMock.mockClear()
      deployWorkflowSchemeMock.mockClear()
      change = toChange({
        before: workflowBeforeInstance,
        after: workflowInstance,
      })
      tempInstance = workflowInstance.clone()
      tempInstance.value.name = 'workflowName-uuid'

      schemeInstance = workflowSchemeInstance.clone()
      schemeInstance.value.updateDraftIfNeeded = true
      schemeInstance.value.issueTypeMappings = {}

      newSchemeInstance = newWorkflowSchemeInstance.clone()
      newSchemeInstance.value.updateDraftIfNeeded = true
      newSchemeInstance.value.issueTypeMappings = {}

      tempSchemeInstance = workflowSchemeInstance.clone()
      tempSchemeInstance.value.defaultWorkflow = new ReferenceExpression(
        tempInstance.elemID,
        tempInstance,
      )
      tempSchemeInstance.value.updateDraftIfNeeded = true
      tempSchemeInstance.value.issueTypeMappings = {}

      tempNewSchemeInstance = newWorkflowSchemeInstance.clone()
      tempNewSchemeInstance.value.defaultWorkflow = new ReferenceExpression(
        tempInstance.elemID,
        tempInstance,
      )
      tempNewSchemeInstance.value.updateDraftIfNeeded = true
      tempNewSchemeInstance.value.issueTypeMappings = {}
    })
    it('should deploy the modified workflow', async () => {
      await filter.deploy([change])
      expectCreateOfTempWorkflow(1)
      expectDeleteOfBeforeWorkflow(2)
      expectCreateOfNewWorkflow(3)
      expectDeleteOfTempWorkflow(4)
      expectSchemeChangeToTemp(1)
      expectNewSchemeChangeToTemp(2)
      expectSchemeChangeBack(3)
      expectNewSchemeChangeBack(4)

      expect(deployWorkflowSchemeMock).toHaveBeenCalledTimes(4)
      expect(deployWorkflowMock).toHaveBeenCalledTimes(4)
    })

    it('should throw when change is not backward compatible', async () => {
      deployWorkflowSchemeMock.mockRejectedValueOnce(new clientUtils.HTTPError('message', {
        status: 400,
        data: {
          errorMessages: ['is missing the mappings required for statuses with'],
        },
      }))

      deployWorkflowMock.mockResolvedValueOnce()
      deployWorkflowMock.mockRejectedValueOnce(new Error('error'))

      const res = await filter.deploy([change])

      expect(res.deployResult.errors).toEqual([new Error('Deployment of jira.Workflow.instance.workflowInstance failed: Error: Modification to an active workflow jira.Workflow.instance.workflowInstance is not backward compatible')])

      expectCreateOfTempWorkflow(1)
      expectDeleteOfTempWorkflow(2)
      expectSchemeChangeToTemp(1)
      expectSchemeChangeBack(2)
    })

    it('should clean when failure in deploy of temp instance', async () => {
      deployWorkflowMock.mockRejectedValueOnce(new clientUtils.HTTPError('message', {
        status: 400,
        data: {
          errorMessages: ['some error'],
        },
      }))
      await filter.deploy([change])

      expectCreateOfTempWorkflow(1)
      expectDeleteOfTempWorkflow(2)
      expect(deployWorkflowMock).toHaveBeenCalledTimes(2)
      expect(deployWorkflowSchemeMock).toHaveBeenCalledTimes(0)
    })
    it('should clean when failure in deploy of the actual instance not related to sync', async () => {
      deployWorkflowMock.mockResolvedValueOnce()
      deployWorkflowMock.mockRejectedValueOnce({
        response: {
          data: {
            errorMessages: ['Other error'],
          },
        },
      })
      await filter.deploy([change])
      expectDeleteOfTempWorkflow(3)
      expectSchemeChangeBack(3)
      expectNewSchemeChangeBack(4)

      expect(deployWorkflowMock).toHaveBeenCalledTimes(3)
      expect(deployWorkflowSchemeMock).toHaveBeenCalledTimes(4)
    })

    it('should clean when failure in deploy of the actual instance', async () => {
      deployWorkflowMock.mockResolvedValueOnce()
      deployWorkflowMock.mockRejectedValueOnce(new clientUtils.HTTPError('message', {
        status: 400,
        data: {
          errorMessages: ['Cannot delete an active workflow'],
        },
      }))
      const res = await filter.deploy([change])

      expect(res.deployResult.errors).toEqual([new Error('Deployment of jira.Workflow.instance.workflowInstance failed: Error: The environment is not synced to the Jira Service for jira.Workflow.instance.workflowInstance, run fetch and try again')])

      expectCreateOfTempWorkflow(1)
      expectDeleteOfBeforeWorkflow(2)
      expectDeleteOfTempWorkflow(3)
      expectSchemeChangeToTemp(1)
      expectNewSchemeChangeToTemp(2)
      expectSchemeChangeBack(3)
      expectNewSchemeChangeBack(4)

      expect(deployWorkflowMock).toHaveBeenCalledTimes(3)
      expect(deployWorkflowSchemeMock).toHaveBeenCalledTimes(4)
    })

    it('should cleanup when there was an error', async () => {
      deployWorkflowSchemeMock.mockRejectedValue(new Error('some error'))

      const res = await filter.deploy([change])

      expect(res.deployResult.errors).toHaveLength(1)

      expectCreateOfTempWorkflow(1)
      expectDeleteOfTempWorkflow(2)
      expectSchemeChangeToTemp(1)
      expectSchemeChangeBack(2)
    })
  })
})
