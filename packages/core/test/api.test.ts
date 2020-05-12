/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  Adapter,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  InstanceElement,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  Variable,
} from '@salto-io/adapter-api'
import wu from 'wu'
import * as workspace from '../src/workspace/workspace'
import * as api from '../src/api'

import * as plan from '../src/core/plan'
import * as fetch from '../src/core/fetch'
import * as deploy from '../src/core/deploy'
import * as adapters from '../src/core/adapters/adapters'
import adapterCreators from '../src/core/adapters/creators'

import * as mockElements from './common/elements'
import * as mockPlan from './common/plan'
import mockState from './common/state'

const SERVICES = ['salesforce']

const configID = new ElemID(SERVICES[0])
const mockConfigType = new ObjectType({
  elemID: configID,
  fields: [
    { name: 'username', type: BuiltinTypes.STRING },
    { name: 'password', type: BuiltinTypes.STRING },
    { name: 'token', type: BuiltinTypes.STRING },
    { name: 'sandbox', type: BuiltinTypes.BOOLEAN },
  ],
})
const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
  username: 'test@test',
  password: 'test',
  token: 'test',
  sandbox: false,
})

const mockWorkspace = (elements: Element[] = [], name?: string): workspace.Workspace => ({
  elements: () => Promise.resolve(elements),
  name,
  envs: () => ['default'],
  currentEnv: 'default',
  services: () => SERVICES,
  state: () => mockState(),
  updateNaclFiles: jest.fn(),
  flush: jest.fn(),
  servicesCredentials: jest.fn().mockResolvedValue({ [SERVICES[0]]: mockConfigInstance }),
  servicesConfig: jest.fn().mockResolvedValue({}),
  getWorkspaceErrors: jest.fn().mockResolvedValue([]),
  addService: jest.fn(),
  updateServiceCredentials: jest.fn(),
  updateServiceConfig: jest.fn(),
} as unknown as workspace.Workspace)

jest.mock('../src/core/adapters/adapters')
jest.mock('../src/core/fetch')
jest.mock('../src/core/plan')
jest.mock('../src/core/deploy')
jest.mock('../src/core/adapters/creators')

jest.spyOn(workspace, 'initWorkspace').mockImplementation(
  (
    _baseDir: string,
    _defaultEnvName: string,
    workspaceName?: string
  ):
    Promise<workspace.Workspace> => Promise.resolve(mockWorkspace([], workspaceName))
)

describe('api.ts', () => {
  const initAdapters = adapters.initAdapters as jest.Mock
  initAdapters.mockReturnValue({
    [SERVICES[0]]: {} as unknown as Adapter,
  })

  const typeWithHiddenField = new ObjectType({
    elemID: new ElemID(SERVICES[0], 'dummyHidden'),
    fields: [
      {
        name: 'hidden',
        type: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
      {
        name: 'regField',
        type: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
      },
    ],
  })

  describe('fetch', () => {
    const mockedFetchChanges = fetch.fetchChanges as jest.Mock
    const objType = new ObjectType({ elemID: new ElemID(SERVICES[0], 'dummy') })

    const fetchedElements = [
      objType,
      new InstanceElement('instance_1', objType, {}),
      new InstanceElement('instance_2', objType, {}),
      new InstanceElement('instance_3_hidden', typeWithHiddenField, { hidden: 'Hidden', regField: 'regValue' }),
    ]
    mockedFetchChanges.mockReturnValue({
      elements: fetchedElements,
      mergeErrors: [],
      configs: [],
    })

    const stateElements = [{ elemID: new ElemID(SERVICES[0], 'test') }]
    const ws = mockWorkspace()
    const mockFlush = ws.flush as jest.Mock
    const mockedState = { ...mockState(), list: jest.fn().mockResolvedValue(stateElements) }
    ws.state = jest.fn().mockReturnValue(mockedState)

    beforeAll(async () => {
      const mockGetAdaptersCreatorConfigs = adapters.getAdaptersCreatorConfigs as jest.Mock
      mockGetAdaptersCreatorConfigs.mockReturnValue({
        [SERVICES[0]]: {
          config: mockConfigInstance.clone(),
          credentials: mockConfigInstance.clone(),
        },
      })
      await api.fetch(ws, undefined, SERVICES)
    })

    it('should call fetch changes', () => {
      expect(mockedFetchChanges).toHaveBeenCalled()
    })
    it('should override state', () => {
      expect(mockedState.override).toHaveBeenCalledWith(fetchedElements)
    })

    it('should not call flush', () => {
      expect(mockFlush).not.toHaveBeenCalled()
    })
  })

  describe('plan', () => {
    const mockedGetPlan = plan.getPlan as jest.Mock
    const mockGetPlanResult = mockPlan.getPlan()
    mockedGetPlan.mockReturnValueOnce(mockGetPlanResult)
    let result: plan.Plan

    const stateInstance = new InstanceElement(
      'hidden_inst',
      typeWithHiddenField,
      {
        hidden: 'Hidden',
        regField: 'regValue',
      }
    )
    const variable = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'name'), 8)
    const stateElements = [stateInstance, typeWithHiddenField, variable]

    // workspace elements should not contains hidden values
    const workspaceInstance = stateInstance.clone()
    workspaceInstance.value = { regField: 'regValue' }

    const workspaceElements = [workspaceInstance, typeWithHiddenField, variable]
    const ws = mockWorkspace(workspaceElements)
    const mockFlush = ws.flush as jest.Mock
    const mockedState = { ...mockState(), getAll: jest.fn().mockResolvedValue(stateElements) }
    ws.state = jest.fn().mockReturnValue(mockedState)

    beforeAll(async () => {
      result = await api.preview(ws, SERVICES)
    })
    it('should call getPlan with the correct elements', async () => {
      expect(mockedGetPlan).toHaveBeenCalledTimes(1)

      // check that we call get plan after adding hidden values and variables to workspace elements
      expect(mockedGetPlan).toHaveBeenCalledWith(
        stateElements,
        stateElements,
        expect.anything(),
        expect.anything()
      )
    })

    it('should not call flush', async () => {
      expect(mockFlush).not.toHaveBeenCalled()
    })

    it('should return getPlan response', async () => {
      expect(result).toEqual(mockGetPlanResult)
    })
  })

  describe('deploy', () => {
    const mockShouldDeploy = jest.fn().mockResolvedValue(true)
    const mockReportCurrentAction = jest.fn()

    const mockedGetPlan = plan.getPlan as jest.Mock
    const mockGetPlanResult = mockPlan.getPlan()
    mockedGetPlan.mockReturnValue(mockGetPlanResult)

    const mockedDeployActions = deploy.deployActions as jest.Mock
    mockedDeployActions.mockReturnValue(Promise.resolve([]))

    const mockedGetDetailedChanges = fetch.getDetailedChanges as jest.Mock
    const elem = mockElements.getAllElements()[2]
    const mockedGetDetailedChangesResult: plan.DetailedChange = {
      action: 'add',
      data: { after: elem },
      id: elem.elemID,
    }
    mockedGetDetailedChanges.mockReturnValue(Promise.resolve([mockedGetDetailedChangesResult]))

    const mockedToChangesWithPath = fetch.toChangesWithPath as jest.Mock
    mockedToChangesWithPath.mockImplementation(() => (change: fetch.FetchChange) => [change])

    const ws = mockWorkspace(mockElements.getAllElements())
    const mockFlush = ws.flush as jest.Mock
    let result: api.DeployResult

    describe('when approved', () => {
      beforeAll(async () => {
        result = await api.deploy(
          ws,
          mockShouldDeploy,
          mockReportCurrentAction,
          SERVICES
        )
      })

      it('should getPlan', async () => {
        expect(mockedGetPlan).toHaveBeenCalledTimes(2)
      })

      it('should not call flush', async () => {
        expect(mockFlush).not.toHaveBeenCalled()
      })

      it('should ask for approval', async () => {
        expect(mockShouldDeploy).toHaveBeenCalledTimes(1)
      })

      it('should deploy changes', async () => {
        expect(mockedDeployActions).toHaveBeenCalledTimes(1)
      })
      it('should get detailed changes with resolve context', async () => {
        expect(mockedGetDetailedChanges).toHaveBeenCalledTimes(1)
        expect(mockedGetDetailedChanges.mock.calls[0].length).toBe(3)
      })

      it('should return fetch changes', async () => {
        expect(wu(result.changes || []).toArray()).toHaveLength(1)
      })
    })
    describe('when aborted', () => {
      beforeAll(async () => {
        mockShouldDeploy.mockResolvedValueOnce(false)
        result = await api.deploy(ws, mockShouldDeploy, mockReportCurrentAction)
      })
      it('should not deploy', () => {
        expect(mockedDeployActions).not.toHaveBeenCalledWith()
      })
      it('should return success', () => {
        expect(result.success).toBeTruthy()
      })
    })
  })

  describe('login', () => {
    const elements: Element[] = [
      new PrimitiveType({
        elemID: new ElemID(SERVICES[0], 'prim'),
        primitive: PrimitiveTypes.STRING,
      }),
    ]
    const ws = mockWorkspace(elements)
    beforeEach(() => {
      jest.clearAllMocks()
    })
    describe('updateCredentials', () => {
      it('Should update workspace credentials', async () => {
        const newConf = mockConfigInstance.clone()
        newConf.value.password = 'bla'
        await api.updateCredentials(ws, newConf)
        expect(ws.updateServiceCredentials).toHaveBeenCalledTimes(1)
      })
      it('should call validateCredentials', async () => {
        const newConf = mockConfigInstance.clone()
        newConf.value.password = 'bla'

        await api.updateCredentials(ws, newConf)

        const adapterCreator = adapterCreators.salesforce
        expect(adapterCreator.validateCredentials).toHaveBeenCalledTimes(1)
      })
    })

    describe('validateCredentials', () => {
      it('should throw if passed unknown adapter name', () => {
        const newConfType = new ObjectType({
          elemID: new ElemID('unknownService'),
          fields: Object.values(mockConfigType.fields),
        })
        const newConf = new InstanceElement(ElemID.CONFIG_NAME, newConfType,
          mockConfigInstance.value)
        return expect(api.verifyCredentials(newConf)).rejects
          .toThrow('unknown adapter: unknownService')
      })
      it('should call validateConfig of adapterCreator', async () => {
        const newConf = mockConfigInstance.clone()
        newConf.value.password = 'bla'

        await api.verifyCredentials(newConf)

        const adapterCreator = adapterCreators.salesforce
        expect(adapterCreator.validateCredentials).toHaveBeenCalledTimes(1)
      })
    })

    describe('addAdapter', () => {
      it('should set adapter config', async () => {
        const serviceName = 'test'
        const getAdaptersCredentialsTypes = adapters.getAdaptersCredentialsTypes as jest.Mock
        getAdaptersCredentialsTypes.mockReturnValue({
          [serviceName]: new ObjectType({ elemID: new ElemID(serviceName) }),
        })
        const wsp = mockWorkspace()
        await api.addAdapter(wsp, serviceName)
        expect((wsp.addService as jest.Mock).call).toHaveLength(1)
      })
    })

    it('should persist a new config', async () => {
      const newConf = mockConfigInstance.clone()
      newConf.value.password = 'bla'
      await api.updateCredentials(ws, newConf)
      expect((ws.updateServiceConfig as jest.Mock).call).toHaveLength(1)
    })
  })
})
