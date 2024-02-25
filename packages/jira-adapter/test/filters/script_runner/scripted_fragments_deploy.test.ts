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
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  Value,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import scriptedFragmentsDeploy from '../../../src/filters/script_runner/scripted_fragments_deploy'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA, PROJECT_TYPE, SCRIPT_FRAGMENT_TYPE } from '../../../src/constants'
import ScriptRunnerClient from '../../../src/client/script_runner_client'

type FilterType = filterUtils.FilterWith<'deploy'>
describe('scripted_fragments_deploy', () => {
  let filter: FilterType
  let type: ObjectType
  let scriptInstanceAdd: InstanceElement
  let scriptInstanceModify: InstanceElement
  let instance3: InstanceElement
  let project: InstanceElement
  let mockPut: jest.Mock
  let mockGetSinglePage: jest.Mock
  let baseValues: Value[]
  let clientConnection: MockInterface<clientUtils.APIConnection>
  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID(JIRA, SCRIPT_FRAGMENT_TYPE),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        entities: { refType: new ListType(BuiltinTypes.STRING) },
      },
    })

    baseValues = [
      {
        id: '1',
        name: 'n1',
        entities: ['COM'],
        panelLocation: 'panelLocation1',
      },
      {
        id: '2',
        name: 'n2',
        entities: ['COM'],
        panelLocation: 'panelLocation2',
      },
      {
        id: '3',
        name: 'n3',
        entities: ['COM'],
        panelLocation: 'panelLocation3',
      },
      {
        id: '4',
        name: 'n4',
        entities: ['COM'],
        panelLocation: 'panelLocation4',
      },
    ]
    scriptInstanceAdd = new InstanceElement('instance', type, {
      id: '5',
      name: 'n5',
      entities: ['COM'],
      panelLocation: 'panelLocation5',
    })
    scriptInstanceModify = new InstanceElement('instance2', type, {
      id: '2',
      name: 'n55',
      entities: ['COM'],
      panelLocation: 'panelLocation2',
    })
    instance3 = new InstanceElement('instance3', createEmptyType('type'))
    project = new InstanceElement('project', createEmptyType(PROJECT_TYPE), {
      key: 'COM',
    })
    const project2 = new InstanceElement('project2', createEmptyType(PROJECT_TYPE), {
      key: 'COM2',
    })
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    const { connection, client } = mockClient()
    const elementsSource = buildElementsSourceFromElements([project, project2])
    clientConnection = connection
    config.fetch.enableScriptRunnerAddon = true
    filter = scriptedFragmentsDeploy(getFilterParams({ config, client, elementsSource })) as FilterType
    mockGetSinglePage = jest.fn()
    mockPut = jest.fn()
    ScriptRunnerClient.prototype.get = mockGetSinglePage
    ScriptRunnerClient.prototype.put = mockPut
    mockGetSinglePage.mockResolvedValue({
      status: 200,
      data: _.cloneDeep(baseValues),
    })
    mockPut.mockResolvedValue({
      status: 200,
    })
    clientConnection.put.mockResolvedValue({
      status: 200,
      data: {},
    })
    const now = 10000
    jest.spyOn(Date, 'now').mockReturnValue(now)
  })
  it('should properly add a scripted fragment', async () => {
    const res = await filter.deploy([toChange({ after: scriptInstanceAdd })])
    expect(res).toEqual({
      deployResult: {
        appliedChanges: [toChange({ after: scriptInstanceAdd })],
        errors: [],
      },
      leftoverChanges: [],
    })
    baseValues.push({
      id: '5',
      name: 'n5',
      entities: ['COM'],
      panelLocation: 'panelLocation5',
    })
    expect(mockPut).toHaveBeenCalledWith({
      url: '/sr-dispatcher/jira/admin/token/script-fragments',
      data: baseValues,
    })
    expect(clientConnection.put).toHaveBeenCalledTimes(2)
    expect(clientConnection.put).toHaveBeenCalledWith(
      '/rest/api/2/project/COM/properties/enabled-script-fragments?_r=10000',
      {
        fragments: ['1', '2', '3', '4', '5'],
        itemLocations: [],
        panelLocations: ['panelLocation10', 'panelLocation20', 'panelLocation30', 'panelLocation40', 'panelLocation50'],
      },
      undefined,
    )
    expect(clientConnection.put).toHaveBeenCalledWith(
      '/rest/api/2/project/COM2/properties/enabled-script-fragments?_r=10000',
      {
        fragments: [],
        itemLocations: [],
        panelLocations: [],
      },
      undefined,
    )
  })
  it('should properly modify a script listener', async () => {
    const res = await filter.deploy([toChange({ before: scriptInstanceAdd, after: scriptInstanceModify })])
    expect(res).toEqual({
      deployResult: {
        appliedChanges: [toChange({ before: scriptInstanceAdd, after: scriptInstanceModify })],
        errors: [],
      },
      leftoverChanges: [],
    })
    expect(mockPut).toHaveBeenCalledWith({
      url: '/sr-dispatcher/jira/admin/token/script-fragments',
      data: [
        {
          id: '1',
          name: 'n1',
          entities: ['COM'],
          panelLocation: 'panelLocation1',
        },
        {
          id: '2',
          name: 'n55',
          entities: ['COM'],
          panelLocation: 'panelLocation2',
        },
        {
          id: '3',
          name: 'n3',
          entities: ['COM'],
          panelLocation: 'panelLocation3',
        },
        {
          id: '4',
          name: 'n4',
          entities: ['COM'],
          panelLocation: 'panelLocation4',
        },
      ],
    })
    expect(clientConnection.put).toHaveBeenCalledTimes(2)
    expect(clientConnection.put).toHaveBeenCalledWith(
      '/rest/api/2/project/COM/properties/enabled-script-fragments?_r=10000',
      {
        fragments: ['1', '2', '3', '4'],
        itemLocations: [],
        panelLocations: ['panelLocation10', 'panelLocation20', 'panelLocation30', 'panelLocation40'],
      },
      undefined,
    )
  })
  it('should properly remove a script listener', async () => {
    const res = await filter.deploy([toChange({ before: scriptInstanceModify })])
    expect(res).toEqual({
      deployResult: {
        appliedChanges: [toChange({ before: scriptInstanceModify })],
        errors: [],
      },
      leftoverChanges: [],
    })
    expect(mockPut).toHaveBeenCalledWith({
      url: '/sr-dispatcher/jira/admin/token/script-fragments',
      data: [
        {
          id: '1',
          name: 'n1',
          entities: ['COM'],
          panelLocation: 'panelLocation1',
        },
        {
          id: '3',
          name: 'n3',
          entities: ['COM'],
          panelLocation: 'panelLocation3',
        },
        {
          id: '4',
          name: 'n4',
          entities: ['COM'],
          panelLocation: 'panelLocation4',
        },
      ],
    })
    expect(clientConnection.put).toHaveBeenCalledTimes(2)
    expect(clientConnection.put).toHaveBeenCalledWith(
      '/rest/api/2/project/COM/properties/enabled-script-fragments?_r=10000',
      {
        fragments: ['1', '3', '4'],
        itemLocations: [],
        panelLocations: ['panelLocation10', 'panelLocation30', 'panelLocation40'],
      },
      undefined,
    )
  })
  it('should properly deploy many script listeners', async () => {
    const scriptInstanceRemove1 = new InstanceElement('instanceR1', type, {
      id: '1',
      name: 'n1',
      entities: ['COM'],
      panelLocation: 'panelLocation1',
    })
    const scriptInstanceRemove2 = new InstanceElement('instanceR2', type, {
      id: '4',
      name: 'n4',
      entities: ['COM'],
      panelLocation: 'panelLocation4',
    })
    const scriptInstanceModify2 = new InstanceElement('instanceM2', type, {
      id: '3',
      name: 'n33',
      entities: ['COM', 'COM2'],
      panelLocation: 'panelLocation3',
    })
    const scriptInstanceAdd2 = new InstanceElement('instanceA2', type, {
      id: '6',
      name: 'n6',
      entities: ['COM2'],
      panelLocation: 'panelLocation6',
    })
    const changes = [
      toChange({ before: scriptInstanceRemove1 }),
      toChange({ before: scriptInstanceRemove2 }),
      toChange({ before: scriptInstanceRemove1, after: scriptInstanceModify }),
      toChange({ before: scriptInstanceRemove1, after: scriptInstanceModify2 }),
      toChange({ after: scriptInstanceAdd }),
      toChange({ after: scriptInstanceAdd2 }),
    ]
    const res = await filter.deploy(changes)
    expect(res.deployResult.appliedChanges).toEqual(expect.arrayContaining(changes))
    expect(res.deployResult.errors).toEqual([])
    expect(res.leftoverChanges).toEqual([])
    expect(mockPut).toHaveBeenCalledWith({
      url: '/sr-dispatcher/jira/admin/token/script-fragments',
      data: [
        {
          id: '2',
          name: 'n55',
          entities: ['COM'],
          panelLocation: 'panelLocation2',
        },
        {
          id: '3',
          name: 'n33',
          entities: ['COM', 'COM2'],
          panelLocation: 'panelLocation3',
        },
        {
          id: '5',
          name: 'n5',
          entities: ['COM'],
          panelLocation: 'panelLocation5',
        },
        {
          id: '6',
          name: 'n6',
          entities: ['COM2'],
          panelLocation: 'panelLocation6',
        },
      ],
    })
    expect(clientConnection.put).toHaveBeenCalledTimes(2)
    expect(clientConnection.put).toHaveBeenCalledWith(
      '/rest/api/2/project/COM/properties/enabled-script-fragments?_r=10000',
      {
        fragments: ['2', '3', '5'],
        itemLocations: [],
        panelLocations: ['panelLocation20', 'panelLocation30', 'panelLocation50'],
      },
      undefined,
    )
    expect(clientConnection.put).toHaveBeenCalledWith(
      '/rest/api/2/project/COM2/properties/enabled-script-fragments?_r=10000',
      {
        fragments: ['3', '6'],
        itemLocations: [],
        panelLocations: ['panelLocation30', 'panelLocation60'],
      },
      undefined,
    )
  })
  it('should return empty if no relevant changes', async () => {
    const res = await filter.deploy([toChange({ after: instance3 })])
    expect(res.deployResult.appliedChanges).toEqual([])
    expect(res.deployResult.errors).toEqual([])
    expect(res.leftoverChanges).toEqual([toChange({ after: instance3 })])
  })
  it('should return the proper error if get fails', async () => {
    mockGetSinglePage.mockReset()
    mockGetSinglePage.mockResolvedValueOnce({
      status: 200,
      data: {},
    })
    const res = await filter.deploy([toChange({ after: scriptInstanceAdd })])
    expect(res).toEqual({
      deployResult: {
        appliedChanges: [],
        errors: [
          {
            severity: 'Error',
            message: 'Error getting other scripted fragments information from the service',
            elemID: scriptInstanceAdd.elemID,
          },
        ],
      },
      leftoverChanges: [],
    })
  })
  it('should handle references correctly', async () => {
    const removedInstance = new InstanceElement('instance', type, {
      id: '1',
      name: 'n1',
      entities: [new ReferenceExpression(project.elemID, project)],
    })
    scriptInstanceAdd.value.entities = [new ReferenceExpression(project.elemID, project)]
    scriptInstanceModify.value.entities = [new ReferenceExpression(project.elemID, project)]
    const res = await filter.deploy([
      toChange({ after: scriptInstanceAdd }),
      toChange({ before: scriptInstanceAdd, after: scriptInstanceModify }),
      toChange({ before: removedInstance }),
    ])
    expect(res.deployResult.appliedChanges).toEqual([
      toChange({ after: scriptInstanceAdd }),
      toChange({ before: scriptInstanceAdd, after: scriptInstanceModify }),
      toChange({ before: removedInstance }),
    ])
    expect(mockPut).toHaveBeenCalledWith({
      url: '/sr-dispatcher/jira/admin/token/script-fragments',
      data: [
        {
          id: '2',
          name: 'n55',
          entities: ['COM'],
          panelLocation: 'panelLocation2',
        },
        {
          id: '3',
          name: 'n3',
          entities: ['COM'],
          panelLocation: 'panelLocation3',
        },
        {
          id: '4',
          name: 'n4',
          entities: ['COM'],
          panelLocation: 'panelLocation4',
        },
        {
          id: '5',
          name: 'n5',
          entities: ['COM'],
          panelLocation: 'panelLocation5',
        },
      ],
    })
  })
  it('should return the proper error if put fails', async () => {
    mockPut.mockReset()
    mockPut.mockRejectedValueOnce(new Error('error'))
    const res = await filter.deploy([
      toChange({ after: scriptInstanceAdd }),
      toChange({ before: scriptInstanceAdd, after: scriptInstanceModify }),
    ])
    expect(res).toEqual({
      deployResult: {
        appliedChanges: [],
        errors: [
          {
            severity: 'Error',
            message: 'error',
            elemID: scriptInstanceAdd.elemID,
          },
          {
            severity: 'Error',
            message: 'error',
            elemID: scriptInstanceModify.elemID,
          },
        ],
      },
      leftoverChanges: [],
    })
  })
  it('should return the proper error if put fails with weird error', async () => {
    mockPut.mockReset()
    mockPut.mockRejectedValueOnce(1)
    const res = await filter.deploy([
      toChange({ after: scriptInstanceAdd }),
      toChange({ before: scriptInstanceAdd, after: scriptInstanceModify }),
    ])
    expect(res).toEqual({
      deployResult: {
        appliedChanges: [],
        errors: [
          {
            severity: 'Error',
            message: '1',
            elemID: scriptInstanceAdd.elemID,
          },
          {
            severity: 'Error',
            message: '1',
            elemID: scriptInstanceModify.elemID,
          },
        ],
      },
      leftoverChanges: [],
    })
  })
  it('should return the proper errors if there are mismatches with the service', async () => {
    const removalInstance = new InstanceElement('instanceR1', type, {
      id: '6',
      name: 'n6',
    })
    const removalInstance2 = new InstanceElement('instanceR2', type, {
      id: '3',
      name: 'n3',
    })
    const res = await filter.deploy([
      toChange({ after: scriptInstanceModify }),
      toChange({ before: scriptInstanceModify, after: scriptInstanceAdd }),
      toChange({ before: removalInstance }),
      toChange({ before: removalInstance2 }),
    ])
    expect(res.deployResult.appliedChanges).toEqual([toChange({ before: removalInstance2 })])
    expect(res.leftoverChanges).toEqual([])
    expect(res.deployResult.errors[0]).toEqual({
      severity: 'Error',
      message: 'Instance already exists in the service',
      elemID: scriptInstanceModify.elemID,
    })
    expect(res.deployResult.errors[1]).toEqual({
      severity: 'Error',
      message: 'Instance does not exist in the service',
      elemID: scriptInstanceAdd.elemID,
    })
    expect(res.deployResult.errors[2]).toEqual({
      severity: 'Error',
      message: 'Instance does not exist in the service',
      elemID: removalInstance.elemID,
    })
  })
  it('should not deploy if script runner is disabled', async () => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableScriptRunnerAddon = false
    filter = scriptedFragmentsDeploy(getFilterParams({ config })) as FilterType
    const res = await filter.deploy([
      toChange({ after: scriptInstanceAdd }),
      toChange({ after: scriptInstanceModify }),
      toChange({ after: instance3 }),
    ])
    expect(res.deployResult.appliedChanges).toEqual([])
    expect(res.deployResult.errors).toEqual([])
    expect(res.leftoverChanges).toEqual([
      toChange({ after: scriptInstanceAdd }),
      toChange({ after: scriptInstanceModify }),
      toChange({ after: instance3 }),
    ])
  })
})
