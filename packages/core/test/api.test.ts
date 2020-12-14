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
  Adapter,
  isObjectType,
  isEqualElements,
  isAdditionChange,
  ChangeDataType,
  AdditionChange,
  isInstanceElement,
  isModificationChange,
  ElementResolver,
} from '@salto-io/adapter-api'
import * as workspace from '@salto-io/workspace'
import * as api from '../src/api'
import * as plan from '../src/core/plan/plan'
import * as fetch from '../src/core/fetch'
import adapterCreators from '../src/core/adapters/creators'

import * as mockElements from './common/elements'
import * as mockPlan from './common/plan'
import { mockFunction, MockFunction } from './common/helpers'
import { mockConfigType, mockEmptyConfigType, mockWorkspace, mockConfigInstance } from './common/workspace'

const mockService = 'salto'
const emptyMockService = 'salto2'
const mockServiceWithInstall = 'adapterWithInstallMethod'

const SERVICES = [mockService, emptyMockService]

jest.mock('../src/core/fetch', () => ({
  ...jest.requireActual('../src/core/fetch'),
  fetchChanges: jest.fn(),
}))
jest.mock('../src/core/restore', () => ({
  createRestoreChanges: jest.fn().mockResolvedValue([{
    action: 'add',
    data: { after: 'value' },
    path: ['path'],
  }]),
}))

jest.mock('../src/core/diff', () => ({
  createDiffChanges: jest.fn().mockResolvedValue([{
    action: 'add',
    data: { after: 'value' },
  }]),
}))

describe('api.ts', () => {
  const mockAdapterOps = {
    fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
    deploy: mockFunction<AdapterOperations['deploy']>().mockImplementation(
      changeGroup => Promise.resolve({ errors: [], appliedChanges: changeGroup.changes })
    ),
  }

  const mockURL = new URL('https://google.com')

  const mockAdapter = {
    operations: mockFunction<Adapter['operations']>().mockReturnValue(mockAdapterOps),
    authenticationMethods: { basic: { credentialsType: mockConfigType } },
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue(''),
    getElementUrl: mockFunction<(id: ElemID, elementResolver: ElementResolver)
      => Promise<URL | undefined>>().mockResolvedValue(mockURL),
  }

  const mockEmptyAdapter = {
    operations: mockFunction<Adapter['operations']>().mockReturnValue(mockAdapterOps),
    authenticationMethods: { basic: { credentialsType: mockEmptyConfigType } },
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue(''),
  }
  const mockAdapterWithInstall = {
    authenticationMethods: { basic: {
      credentialsType: new ObjectType({ elemID: new ElemID(mockServiceWithInstall) }),
    } },
    operations: mockFunction<Adapter['operations']>().mockReturnValue(mockAdapterOps),
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue(''),
    install: jest.fn().mockResolvedValue({ success: true, installedVersion: '123' }),
  }

  adapterCreators[mockService] = mockAdapter
  adapterCreators[emptyMockService] = mockEmptyAdapter
  adapterCreators[mockServiceWithInstall] = mockAdapterWithInstall

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
    const mockFetchChanges = fetch.fetchChanges as MockFunction<typeof fetch.fetchChanges>
    const objType = new ObjectType({ elemID: new ElemID(mockService, 'dummy') })

    const fetchedElements = [
      objType,
      new InstanceElement('instance_1', objType, {}),
      new InstanceElement('instance_2', objType, {}),
      new InstanceElement('instance_3_hidden', typeWithHiddenField, { hidden: 'Hidden', regField: 'regValue' }),
    ]

    beforeAll(() => {
      mockFetchChanges.mockResolvedValue({
        changes: [],
        configChanges: mockPlan.createPlan([[]]),
        unmergedElements: fetchedElements,
        elements: fetchedElements,
        mergeErrors: [],
        adapterNameToConfigMessage: {},
      })
    })

    describe('Full fetch', () => {
      let ws: workspace.Workspace
      let stateOverride: jest.SpyInstance

      beforeAll(async () => {
        const stateElements = [new InstanceElement('old_instance', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {})]
        ws = mockWorkspace({ stateElements })
        stateOverride = jest.spyOn(ws.state(), 'override')
        mockFetchChanges.mockClear()
        await api.fetch(ws, undefined, SERVICES)
      })

      it('should call fetch changes', () => {
        expect(mockFetchChanges).toHaveBeenCalled()
      })
      it('should override state', () => {
        expect(stateOverride).toHaveBeenCalledWith(fetchedElements)
      })

      it('should not call flush', () => {
        expect(ws.flush).not.toHaveBeenCalled()
      })
    })

    describe('Fetch one service out of two.', () => {
      let ws: workspace.Workspace
      let stateElements: InstanceElement[]
      let stateOverride: jest.SpyInstance
      beforeAll(async () => {
        stateElements = [
          new InstanceElement('old_instance1', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {}),
          new InstanceElement('old_instance2', new ObjectType({ elemID: new ElemID(emptyMockService, 'test') }), {}),
        ]
        ws = mockWorkspace({ stateElements })
        stateOverride = jest.spyOn(ws.state(), 'override')
        mockFetchChanges.mockClear()
        await api.fetch(ws, undefined, [mockService])
      })

      it('should call fetch changes with first service only', () => {
        expect(mockFetchChanges).toHaveBeenCalled()
      })
      it('should override state but also include existing elements', () => {
        const existingElements = [stateElements[1]]
        expect(stateOverride).toHaveBeenCalledWith(
          expect.arrayContaining([...fetchedElements, ...existingElements])
        )
      })
      it('should not call flush', () => {
        expect(ws.flush).not.toHaveBeenCalled()
      })
    })
  })

  describe('plan', () => {
    let mockedGetPlan: jest.SpyInstance<Promise<plan.Plan>, Parameters<typeof plan.getPlan>>
    let mockGetPlanResult: plan.Plan
    let result: plan.Plan

    beforeAll(async () => {
      mockedGetPlan = jest.spyOn(plan, 'getPlan')
      mockGetPlanResult = mockPlan.getPlan()
      mockedGetPlan.mockResolvedValue(mockGetPlanResult)
      result = await api.preview(mockWorkspace({}), SERVICES)
    })

    afterAll(() => {
      mockedGetPlan.mockRestore()
    })

    it('should return getPlan response', async () => {
      expect(result).toEqual(mockGetPlanResult)
    })
  })

  describe('deploy', () => {
    let ws: workspace.Workspace
    let result: api.DeployResult

    describe('with element changes', () => {
      let addedElem: ObjectType
      beforeAll(async () => {
        const workspaceElements = mockElements.getAllElements()
        const stateElements = mockElements.getAllElements()

        const removedElem = stateElements[4]
        // eslint-disable-next-line prefer-destructuring
        addedElem = workspaceElements[3]

        ws = mockWorkspace({
          elements: workspaceElements.filter(elem => !isEqualElements(elem, removedElem)),
          stateElements: stateElements.filter(elem => !isEqualElements(elem, addedElem)),
        })

        const actionPlan = mockPlan.createPlan([[
          { action: 'add', data: { after: addedElem.clone() } },
          { action: 'remove', data: { before: removedElem.clone() } },
        ]])

        // Add annotation to the new element
        const cloneAndAddAnnotation = <T extends ChangeDataType>(
          change: AdditionChange<T>
        ): AdditionChange<T> => {
          const cloned = change.data.after.clone() as T
          cloned.annotations.test = 1
          return { action: 'add', data: { after: cloned } }
        }
        mockAdapterOps.deploy.mockClear()
        mockAdapterOps.deploy.mockImplementationOnce(async changeGroup => ({
          appliedChanges: changeGroup.changes
            .map(change => (isAdditionChange(change) ? cloneAndAddAnnotation(change) : change)),
          errors: [],
        }))
        result = await api.deploy(ws, actionPlan, jest.fn(), SERVICES)
      })

      it('should call adapter deploy function', async () => {
        expect(mockAdapterOps.deploy).toHaveBeenCalledTimes(1)
      })

      it('should return updates to existing elements', async () => {
        expect(result.changes).toBeDefined()
        const changes = [...result.changes ?? []]
        expect(changes).toHaveLength(1)
        expect(changes[0].change.action).toEqual('add')
        expect(changes[0].change.id).toEqual(addedElem.elemID.createNestedID('attr', 'test'))
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
        const actionPlan = mockPlan.createPlan(
          [[
            { action: 'remove', data: { before: removedField } },
            { action: 'modify', data: { before: origField, after: changedField } },
          ]]
        )

        ws = mockWorkspace({ elements: [changedElement], stateElements: [origElement] })
        result = await api.deploy(ws, actionPlan, jest.fn())
      })
      it('should set updated top level element to state', async () => {
        const stateElement = await ws.state().get(changedElement.elemID)
        expect(stateElement).toEqual(changedElement)
      })
    })
    describe('with partial success from the adapter', () => {
      let newEmployee: InstanceElement
      let existingEmployee: InstanceElement
      let stateSet: jest.SpyInstance
      beforeAll(async () => {
        const wsElements = mockElements.getAllElements()
        existingEmployee = wsElements.find(isInstanceElement) as InstanceElement
        newEmployee = new InstanceElement(
          'new',
          existingEmployee.type,
          existingEmployee.value,
        )
        wsElements.push(newEmployee)
        existingEmployee.value.name = 'updated name'
        const stateElements = mockElements.getAllElements()
        ws = mockWorkspace({ elements: wsElements, stateElements })
        stateSet = jest.spyOn(ws.state(), 'set')

        // Create plan where both changes are in the same group
        const actionPlan = await plan.getPlan({
          before: stateElements,
          after: wsElements,
          customGroupIdFunctions: {
            salto: async changes => new Map([...changes.keys()].map(key => [key, 'group'])),
          },
        })

        mockAdapterOps.deploy.mockClear()
        mockAdapterOps.deploy.mockImplementationOnce(async changeGroup => ({
          appliedChanges: changeGroup.changes.filter(isModificationChange),
          errors: [new Error('cannot add new employee')],
        }))
        result = await api.deploy(ws, actionPlan, jest.fn(), SERVICES)
      })

      it('should return error for the failed part', () => {
        expect(result.errors).toHaveLength(1)
      })
      it('should return success false for the overall deploy', () => {
        expect(result.success).toBeFalsy()
      })
      it('should update state with applied change', () => {
        expect(stateSet).toHaveBeenCalledWith(existingEmployee)
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
    const ws = mockWorkspace({
      elements,
    })
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
        adapterCreators[serviceName] = {
          authenticationMethods: {
            basic: { credentialsType: new ObjectType({ elemID: new ElemID(serviceName) }) },
          },
          operations: mockFunction<Adapter['operations']>().mockReturnValue(mockAdapterOps),
          validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue(''),
        }
        const wsp = mockWorkspace({})
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

  describe('installAdapter', () => {
    it('should return the installed version', async () => {
      const result = await api.installAdapter(mockServiceWithInstall)
      expect(result).toEqual({ success: true, installedVersion: '123' })
    })

    it('should throw an error if the adapter failed to install', async () => {
      mockAdapterWithInstall.install.mockResolvedValueOnce({ success: false, errors: ['ERROR'] })
      return expect(api.installAdapter(mockServiceWithInstall)).rejects.toThrow()
    })

    it('should return undefined in case the adapter has no install method', async () => {
      const result = await api.installAdapter(mockService)
      expect(result).toBeUndefined()
    })
  })

  describe('restore', () => {
    it('should return all changes as fetch changes', async () => {
      const index = workspace.pathIndex.createPathIndex([])
      const ws = mockWorkspace({
        elements: [],
        name: 'restore',
        index,
        stateElements: [],
      })
      const changes = await api.restore(ws)
      expect(changes).toHaveLength(1)
      expect(_.keys(changes[0])).toEqual(['change', 'serviceChange'])
    })
  })

  describe('diff', () => {
    const ws = mockWorkspace({ name: 'diff' })
    it('should return changes', async () => {
      const changes = await api.diff(ws, 'active', 'other', false, false)
      expect(changes).toHaveLength(1)
      expect(ws.elements).toHaveBeenCalledWith(false, 'active')
      expect(ws.elements).toHaveBeenCalledWith(false, 'other')
    })
    it('should get the data from state when the state flag is true', async () => {
      const changes = await api.diff(ws, 'active', 'other', false, true)
      expect(changes).toHaveLength(1)
      expect(ws.state).toHaveBeenCalledWith('active')
      expect(ws.state).toHaveBeenCalledWith('other')
    })
    it('should get hidden types when flag is true', async () => {
      const changes = await api.diff(ws, 'active', 'other', false, true)
      expect(changes).toHaveLength(1)
      expect(ws.elements).toHaveBeenCalledWith(false, 'active')
      expect(ws.elements).toHaveBeenCalledWith(false, 'other')
    })
  })

  describe('getElementUrl', () => {
    const ws = mockWorkspace({})

    it('when adapter exists should get the url from the adater', async () => {
      expect(await api.getElementUrl(ws, new ElemID(mockService))).toBe(mockURL)
    })

    it('when adapter does not exist should return undefined', async () => {
      expect(await api.getElementUrl(ws, new ElemID('notExists'))).toBeUndefined()
    })
  })
})
