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
import _ from 'lodash'
import {
  AdapterOperations,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  InstanceElement,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  Variable,
  Adapter,
  isObjectType,
  DetailedChange,
} from '@salto-io/adapter-api'
import wu from 'wu'
import * as workspace from '../src/workspace/workspace'
import * as api from '../src/api'

import * as plan from '../src/core/plan'
import * as fetch from '../src/core/fetch'
import adapterCreators from '../src/core/adapters/creators'

import * as mockElements from './common/elements'
import * as mockPlan from './common/plan'
import mockState from './common/state'
import { mockFunction } from './common/helpers'

const mockService = 'salto'

const SERVICES = [mockService]

const configID = new ElemID(mockService)
const mockConfigType = new ObjectType({
  elemID: configID,
  fields: {
    username: { type: BuiltinTypes.STRING },
    password: { type: BuiltinTypes.STRING },
    token: { type: BuiltinTypes.STRING },
    sandbox: { type: BuiltinTypes.BOOLEAN },
  },
})
const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
  username: 'test@test',
  password: 'test',
  token: 'test',
  sandbox: false,
})

const mockWorkspace = (elements: Element[] = [], name?: string): workspace.Workspace => {
  const state = mockState(SERVICES, elements)
  return {
    elements: () => Promise.resolve(elements),
    name,
    envs: () => ['default'],
    currentEnv: 'default',
    services: () => SERVICES,
    state: () => state,
    updateNaclFiles: jest.fn(),
    flush: jest.fn(),
    servicesCredentials: jest.fn().mockResolvedValue({ [mockService]: mockConfigInstance }),
    servicesConfig: jest.fn().mockResolvedValue({}),
    getWorkspaceErrors: jest.fn().mockResolvedValue([]),
    addService: jest.fn(),
    updateServiceCredentials: jest.fn(),
    updateServiceConfig: jest.fn(),
  } as unknown as workspace.Workspace
}

jest.mock('../src/core/fetch')
jest.mock('../src/core/plan')

jest.spyOn(workspace, 'initWorkspace').mockImplementation(
  (
    _baseDir: string,
    _defaultEnvName: string,
    workspaceName?: string
  ):
    Promise<workspace.Workspace> => Promise.resolve(mockWorkspace([], workspaceName))
)

describe('api.ts', () => {
  const mockAdapterOps = {
    fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
    deploy: mockFunction<AdapterOperations['deploy']>().mockImplementation(
      changeGroup => Promise.resolve({ errors: [], appliedChanges: changeGroup.changes })
    ),
  }
  const mockAdapter = {
    operations: mockFunction<Adapter['operations']>().mockReturnValue(mockAdapterOps),
    credentialsType: mockConfigType,
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue(''),
  }
  adapterCreators[mockService] = mockAdapter

  const typeWithHiddenField = new ObjectType({
    elemID: new ElemID(mockService, 'dummyHidden'),
    fields: {
      hidden: {
        type: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
      regField: {
        type: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
      },
    },
  })

  describe('fetch', () => {
    const mockedFetchChanges = fetch.fetchChanges as jest.Mock
    const objType = new ObjectType({ elemID: new ElemID(mockService, 'dummy') })

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

    const stateElements = [{ elemID: new ElemID(mockService, 'test') }]
    const ws = mockWorkspace()
    const mockFlush = ws.flush as jest.Mock
    const mockedState = { ...mockState(), list: jest.fn().mockResolvedValue(stateElements) }
    ws.state = jest.fn().mockReturnValue(mockedState)

    beforeAll(async () => {
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
    mockedGetPlan.mockResolvedValue(mockGetPlanResult)
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
    mockedGetPlan.mockResolvedValue(mockGetPlanResult)

    const mockedGetDetailedChanges = fetch.getDetailedChanges as jest.Mock
    const elem = mockElements.getAllElements()[2]
    const mockedGetDetailedChangesResult: DetailedChange = {
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
        mockAdapterOps.deploy.mockClear()
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
        expect(mockAdapterOps.deploy).toHaveBeenCalledTimes(1)
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
        mockAdapterOps.deploy.mockClear()
        mockShouldDeploy.mockResolvedValueOnce(false)
        result = await api.deploy(ws, mockShouldDeploy, mockReportCurrentAction)
      })
      it('should not deploy', () => {
        expect(mockAdapterOps.deploy).not.toHaveBeenCalled()
      })
      it('should return success', () => {
        expect(result.success).toBeTruthy()
      })
    })
    describe('with field changes', () => {
      let changedElement: ObjectType
      beforeAll(async () => {
        const origElement = mockElements.getAllElements().find(isObjectType) as ObjectType
        const [removedField, origField] = Object.values(origElement.fields)
        changedElement = new ObjectType({
          ...origElement,
          fields: _.omit(origElement.fields, removedField.name),
        })
        const changedField = changedElement.fields[origField.name]
        changedField.annotations.test = 1
        mockedGetPlan.mockResolvedValueOnce(mockPlan.createPlan(
          [[
            { action: 'remove', data: { before: removedField } },
            { action: 'modify', data: { before: origField, after: changedField } },
          ]]
        ))

        result = await api.deploy(ws, mockShouldDeploy, mockReportCurrentAction)
      })
      it('should set updated top level element to state', async () => {
        const stateElement = await ws.state().get(changedElement.elemID)
        expect(stateElement).toEqual(changedElement)
      })
    })
  })

  describe('login', () => {
    const elements: Element[] = [
      new PrimitiveType({
        elemID: new ElemID(mockService, 'prim'),
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

        expect(mockAdapter.validateCredentials).toHaveBeenCalledTimes(1)
      })
    })

    describe('validateCredentials', () => {
      it('should throw if passed unknown adapter name', () => {
        const newConfType = new ObjectType({
          elemID: new ElemID('unknownService'),
          fields: mockConfigType.fields,
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

        expect(mockAdapter.validateCredentials).toHaveBeenCalledTimes(1)
      })
    })

    describe('addAdapter', () => {
      it('should set adapter config', async () => {
        const serviceName = 'test'
        const mockNewService = {
          credentialsType: new ObjectType({ elemID: new ElemID(serviceName) }),
          operations: mockFunction<Adapter['operations']>().mockReturnValue(mockAdapterOps),
          validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue(''),
        }
        adapterCreators[serviceName] = mockNewService
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
