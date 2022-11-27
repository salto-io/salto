/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { AdapterOperations, BuiltinTypes, CORE_ANNOTATIONS, Element, ElemID, InstanceElement, ObjectType, PrimitiveType, PrimitiveTypes, Adapter, isObjectType, isEqualElements, isAdditionChange, ChangeDataType, AdditionChange, isInstanceElement, isModificationChange, DetailedChange, ReferenceExpression, Field, CredentialError } from '@salto-io/adapter-api'
import * as workspace from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { mockFunction } from '@salto-io/test-utils'
import * as api from '../src/api'
import * as plan from '../src/core/plan/plan'
import * as fetch from '../src/core/fetch'
import * as adapters from '../src/core/adapters/adapters'
import adapterCreators from '../src/core/adapters/creators'

import * as mockElements from './common/elements'
import * as mockPlan from './common/plan'
import { createElementSource } from './common/helpers'
import { mockConfigType, mockEmptyConfigType, mockWorkspace, mockConfigInstance } from './common/workspace'
import { getAdapterConfigOptionsType, getLoginStatuses } from '../src/api'

const { awu } = collections.asynciterable
const mockService = 'salto'
const emptyMockService = 'salto2'
const mockServiceWithInstall = 'adapterWithInstallMethod'
const mockServiceWithConfigCreator = 'adapterWithConfigCreator'


const ACCOUNTS = [mockService, emptyMockService]

jest.mock('../src/core/fetch', () => ({
  ...jest.requireActual<{}>('../src/core/fetch'),
  fetchChanges: jest.fn(),
  fetchChangesFromWorkspace: jest.fn(),
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
      ({ changeGroup }) => Promise.resolve({ errors: [], appliedChanges: changeGroup.changes })
    ),
  }

  const mockAdapter = {
    operations: mockFunction<Adapter['operations']>().mockReturnValue(mockAdapterOps),
    authenticationMethods: { basic: { credentialsType: mockConfigType } },
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue(''),
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

  const mockConfigOptionsObjectType = new ObjectType({
    elemID: new ElemID('mock'),
  })

  const mockAdapterWithConfigCreator = {
    ...mockAdapter,
    configCreator: {
      getConfig: jest.fn(),
      optionsType: mockConfigOptionsObjectType,
    },
  }

  adapterCreators[mockService] = mockAdapter
  adapterCreators[emptyMockService] = mockEmptyAdapter
  adapterCreators[mockServiceWithInstall] = mockAdapterWithInstall
  adapterCreators[mockServiceWithConfigCreator] = mockAdapterWithConfigCreator

  const typeWithHiddenField = new ObjectType({
    elemID: new ElemID(mockService, 'dummyHidden'),
    fields: {
      hidden: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
      regField: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
      },
    },
  })

  describe('fetch', () => {
    const mockFetchChanges = fetch.fetchChanges as jest.MockedFunction<typeof fetch.fetchChanges>
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
        errors: [],
        configChanges: mockPlan.createPlan([[]]),
        updatedConfig: {},
        unmergedElements: fetchedElements,
        elements: fetchedElements,
        mergeErrors: [],
        accountNameToConfigMessage: {},
      })
    })

    describe('Full fetch', () => {
      let ws: workspace.Workspace
      let stateOverride: jest.SpyInstance
      let mockGetAdaptersCreatorConfigs: jest.SpyInstance

      beforeAll(async () => {
        const workspaceElements = [new InstanceElement('workspace_instance', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {})]
        const stateElements = [new InstanceElement('state_instance', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {})]
        ws = mockWorkspace({ elements: workspaceElements, stateElements })
        stateOverride = jest.spyOn(ws.state(), 'override')
        mockGetAdaptersCreatorConfigs = jest.spyOn(adapters, 'getAdaptersCreatorConfigs')
        mockFetchChanges.mockClear()
        await api.fetch(ws, undefined, ACCOUNTS)
      })

      it('should call fetch changes', () => {
        expect(mockFetchChanges).toHaveBeenCalled()
      })
      // eslint-disable-next-line jest/no-disabled-tests
      it.skip('should override state', async () => {
        const overideParam = (_.first(stateOverride.mock.calls)[0]) as AsyncIterable<Element>
        expect(await awu(overideParam).toArray()).toEqual(fetchedElements)
      })

      it('should not call flush', () => {
        expect(ws.flush).not.toHaveBeenCalled()
      })
      // eslint-disable-next-line jest/no-disabled-tests
      it.skip('should pass the state elements to getAdaptersCreatorConfigs', async () => {
        const elementsSource = mockGetAdaptersCreatorConfigs.mock.calls[0][3]
        expect(await elementsSource.has(new ElemID(mockService, 'test', 'instance', 'state_instance'))).toBeTruthy()
        expect(await elementsSource.has(new ElemID(mockService, 'test', 'instance', 'workspace_instance'))).toBeFalsy()
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
        stateOverride = jest.spyOn(ws.state(), 'override').mockResolvedValue(undefined)
        mockFetchChanges.mockClear()
        await api.fetch(ws, undefined, [mockService])
      })

      it('should call fetch changes with first account only', () => {
        expect(mockFetchChanges).toHaveBeenCalled()
      })
      it('should override state but also include existing elements', async () => {
        const existingElements = [stateElements[1]]
        const overideParam = (_.first(stateOverride.mock.calls)[0]) as AsyncIterable<Element>
        expect(await awu(overideParam).toArray()).toEqual([...fetchedElements, ...existingElements])
      })
      it('should not call flush', () => {
        expect(ws.flush).not.toHaveBeenCalled()
      })
    })
    describe('fetch failed', () => {
      let ws: workspace.Workspace
      beforeAll(() => {
        ws = mockWorkspace({ stateElements: [] })
      })
      it('to return credential error', async () => {
        mockFetchChanges.mockRejectedValueOnce(new CredentialError('test'))
        const result = await api.fetch(ws, undefined, [mockService])
        expect(result).toEqual(expect.objectContaining({ fetchErrors: expect.arrayContaining([{ message: 'test', severity: 'Error' }]) }))
      })
      it('throw unexpected error', async () => {
        mockFetchChanges.mockRejectedValueOnce(new Error('test'))
        await expect(api.fetch(ws, undefined, [mockService])).rejects.toThrow()
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
      result = await api.preview(mockWorkspace({}), ACCOUNTS)
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
        mockAdapterOps.deploy.mockImplementationOnce(async ({ changeGroup }) => ({
          appliedChanges: changeGroup.changes
            .map(change => (isAdditionChange(change) ? cloneAndAddAnnotation(change) : change)),
          errors: [],
        }))
        result = await api.deploy(ws, actionPlan, jest.fn(), ACCOUNTS)
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
      it('should return the applied changes', () => {
        expect(result.appliedChanges).toHaveLength(2)
        const [addedChange, removedChange] = result.appliedChanges ?? []
        expect(addedChange.action).toEqual('add')
        expect(removedChange.action).toEqual('remove')
      })
    })
    describe('with field changes', () => {
      let changedElement: ObjectType
      let expectedRemovedField: Field
      let expectedOriginalField: Field
      let expectedChangedField: Field
      beforeAll(async () => {
        const origElement = mockElements.getAllElements().find(isObjectType) as ObjectType
        const [removedField, origField] = Object.values(origElement.fields)
        expectedRemovedField = removedField
        expectedOriginalField = origField
        changedElement = new ObjectType({
          ...origElement,
          annotationRefsOrTypes: origElement.annotationRefTypes,
          fields: _.omit(origElement.fields, removedField.name),
        })
        const changedField = changedElement.fields[origField.name]
        changedField.annotations.test = 1
        expectedChangedField = changedField
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
      it('should return the applied changes', () => {
        expect(result.appliedChanges).toHaveLength(2)
        const [removeAppliedChange, modifyAppliedChange] = result.appliedChanges ?? []
        expect(removeAppliedChange?.action).toEqual('remove')
        expect(removeAppliedChange?.data).toEqual({ before: expectedRemovedField })
        expect(modifyAppliedChange?.action).toEqual('modify')
        expect(modifyAppliedChange?.data).toEqual(
          { before: expectedOriginalField, after: expectedChangedField }
        )
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
          existingEmployee.refType,
          existingEmployee.value,
        )
        wsElements.push(newEmployee)
        existingEmployee.value.name = 'updated name'
        const stateElements = mockElements.getAllElements()
        ws = mockWorkspace({ elements: wsElements, stateElements })
        stateSet = jest.spyOn(ws.state(), 'set')

        // Create plan where both changes are in the same group
        const actionPlan = await plan.getPlan({
          before: createElementSource(stateElements),
          after: createElementSource(wsElements),
          customGroupIdFunctions: {
            salto: async changes => ({ changeGroupIdMap: new Map([...changes.keys()].map(key => [key, 'group'])) }),
          },
        })

        mockAdapterOps.deploy.mockClear()
        mockAdapterOps.deploy.mockImplementationOnce(async ({ changeGroup }) => ({
          appliedChanges: changeGroup.changes.filter(isModificationChange),
          errors: [new Error('cannot add new employee')],
        }))
        result = await api.deploy(ws, actionPlan, jest.fn(), ACCOUNTS)
      })

      it('should return error for the failed part', () => {
        expect(result.errors).toHaveLength(1)
      })
      it('should return success false for the overall deploy', () => {
        expect(result.success).toBeFalsy()
      })
      it('should return applied changes for the overall deploy', () => {
        expect(result.appliedChanges).toHaveLength(1)
        const appliedChanges = [...(result.appliedChanges ?? [])].filter(isModificationChange)
        expect(appliedChanges).toHaveLength(1)
        const [appliedChange] = appliedChanges
        expect(appliedChange?.action).toEqual('modify')
        expect(appliedChange?.data?.after).toEqual(existingEmployee)
      })
      it('should update state with applied change', () => {
        expect(stateSet).toHaveBeenCalledWith(existingEmployee)
      })
    })
    describe('with checkOnly deployment', () => {
      let executeDeploy: () => Promise<api.DeployResult>
      beforeEach(async () => {
        const workspaceElements = mockElements.getAllElements()
        const stateElements = mockElements.getAllElements()

        const removedElem = stateElements[4]
        const addedElem = workspaceElements[3]

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
        mockAdapterOps.deploy.mockImplementationOnce(async ({ changeGroup }) => ({
          appliedChanges: changeGroup.changes
            .map(change => (isAdditionChange(change) ? cloneAndAddAnnotation(change) : change)),
          errors: [],
        }))
        executeDeploy = () => api.deploy(ws, actionPlan, jest.fn(), ACCOUNTS, true)
      })

      describe('when adapter does not implement the validate method', () => {
        it('should fail with error', async () => {
          await executeDeploy()
          expect(mockAdapterOps.deploy).not.toHaveBeenCalled()
          expect(result.errors).toHaveLength(1)
        })
      })
      describe('when adapter implements the validate method', () => {
        let validateMock: jest.Mock
        beforeEach(async () => {
          validateMock = jest.fn()
          adapterCreators[mockService].operations = mockFunction<Adapter['operations']>().mockReturnValue({
            fetch: jest.fn(),
            deploy: jest.fn(),
            validate: validateMock,
          })
          await executeDeploy()
        })
        it('should call the adapter validate method', async () => {
          expect(mockAdapterOps.deploy).not.toHaveBeenCalled()
          expect(validateMock).toHaveBeenCalledTimes(1)
        })
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
        expect(ws.updateAccountCredentials).toHaveBeenCalledTimes(1)
      })
    })

    describe('verifyCredentials', () => {
      it('should throw if passed unknown account name', () => {
        const newConfType = new ObjectType({
          elemID: new ElemID('unknownAccount'),
          fields: mockConfigType.fields,
        })
        const newConf = new InstanceElement(ElemID.CONFIG_NAME, newConfType,
          mockConfigInstance.value)
        return expect(api.verifyCredentials(newConf)).rejects
          .toThrow('unknown adapter: unknownAccount')
      })
      it('should call validateCredentials of adapterCreator', async () => {
        const newConf = mockConfigInstance.clone()
        newConf.value.password = 'bla'

        await api.verifyCredentials(newConf)

        expect(mockAdapter.validateCredentials).toHaveBeenCalledTimes(1)
      })
    })

    describe('addAdapter', () => {
      const serviceName = 'test'
      beforeAll(() => {
        adapterCreators[serviceName] = {
          authenticationMethods: {
            basic: { credentialsType: new ObjectType({ elemID: new ElemID(serviceName) }) },
          },
          operations: mockFunction<Adapter['operations']>().mockReturnValue(mockAdapterOps),
          validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue(''),
        }
      })

      it('should set adapter config', async () => {
        const wsp = mockWorkspace({})
        await api.addAdapter(wsp, serviceName)
        expect((wsp.addAccount as jest.Mock).call).toHaveLength(1)
      })

      it('should update workspace config if different account name provided', async () => {
        const wsp = mockWorkspace({})
        await api.addAdapter(wsp, serviceName, `${serviceName}account`)
        expect((wsp.addAccount as jest.Mock).call).toHaveLength(1)
        expect((wsp.updateAccountConfig as jest.Mock).call).toHaveLength(1)
      })
    })

    it('should persist a new config', async () => {
      const newConf = mockConfigInstance.clone()
      newConf.value.password = 'bla'
      await api.updateCredentials(ws, newConf)
      expect((ws.updateAccountConfig as jest.Mock).call).toHaveLength(1)
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
      const ws = mockWorkspace({
        elements: [],
        name: 'restore',
        index: [],
        stateElements: [],
      })
      const changes = await api.restore(ws)
      expect(changes).toHaveLength(1)
      expect(_.keys(changes[0])).toEqual(['change', 'serviceChanges'])
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

  describe('fetch from workspace', () => {
    const mockFetchChangesFromWorkspace = fetch.fetchChangesFromWorkspace as jest.MockedFunction<
      typeof fetch.fetchChangesFromWorkspace
    >
    const objType = new ObjectType({ elemID: new ElemID(mockService, 'dummy') })

    const fetchedElements = [
      objType,
      new InstanceElement('instance_1', objType, {}),
      new InstanceElement('instance_2', objType, {}),
      new InstanceElement('instance_3_hidden', typeWithHiddenField, { hidden: 'Hidden', regField: 'regValue' }),
    ]

    beforeAll(() => {
      mockFetchChangesFromWorkspace.mockResolvedValue({
        changes: [],
        errors: [],
        configChanges: mockPlan.createPlan([[]]),
        unmergedElements: fetchedElements,
        elements: fetchedElements,
        mergeErrors: [],
        updatedConfig: {},
        accountNameToConfigMessage: {},
      })
    })

    describe('Full fetch', () => {
      let ws: workspace.Workspace
      let ows: workspace.Workspace

      beforeAll(async () => {
        const workspaceElements = [new InstanceElement('workspace_instance', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {})]
        const stateElements = [new InstanceElement('state_instance', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {})]
        ws = mockWorkspace({ elements: workspaceElements, stateElements })
        ows = mockWorkspace({})
        mockFetchChangesFromWorkspace.mockClear()
        await api.fetchFromWorkspace({
          otherWorkspace: ws,
          workspace: ows,
          accounts: ACCOUNTS,
          env: 'default',
        })
      })

      it('should call fetch changes from workspace', () => {
        expect(mockFetchChangesFromWorkspace).toHaveBeenCalled()
      })
    })

    describe('Fetch one account out of two.', () => {
      let ws: workspace.Workspace
      let ows: workspace.Workspace
      beforeAll(async () => {
        ws = mockWorkspace({})
        ows = mockWorkspace({})
        mockFetchChangesFromWorkspace.mockClear()
        await api.fetchFromWorkspace({
          otherWorkspace: ws,
          workspace: ows,
          accounts: [mockService],
          env: 'default',
        })
      })

      it('should call fetch changes with first account only', () => {
        expect(mockFetchChangesFromWorkspace).toHaveBeenCalled()
      })
    })

    describe('default accounts', () => {
      let ws: workspace.Workspace
      let ows: workspace.Workspace


      beforeAll(async () => {
        ws = mockWorkspace({ accounts: ['salto', 'salesforce'] })
        ows = mockWorkspace({ accounts: ['salto', 'netsuite'] })
        mockFetchChangesFromWorkspace.mockClear()
        await api.fetchFromWorkspace({
          otherWorkspace: ws,
          workspace: ows,
          env: 'default',
        })
      })

      it('should use accounts that are in the current workspace as defaults', () => {
        const accountsUsed = mockFetchChangesFromWorkspace.mock.calls[0][1]
        expect(accountsUsed).toEqual(['salto', 'netsuite'])
      })
    })
  })
  describe('rename', () => {
    let expectedChanges: DetailedChange[]
    let changes: DetailedChange[]
    beforeAll(async () => {
      const workspaceElements = mockElements.getAllElements()
      const ws = mockWorkspace({ elements: workspaceElements })
      const sourceElemId = new ElemID('salto', 'employee', 'instance', 'original')
      const sourceElement = await ws.getValue(sourceElemId)
      const targetElement = new InstanceElement(
        'renamed',
        sourceElement.refType,
        _.merge({}, sourceElement.value, {
          friend: new ReferenceExpression(ElemID.fromFullName('salto.employee.instance.renamed')),
        }),
        sourceElement.path,
        sourceElement.annotations
      )

      const refElemId = new ElemID('salto', 'employee', 'instance', 'anotherInstance', 'friend')
      const beforeRef = new ReferenceExpression(sourceElemId)
      const afterRef = new ReferenceExpression(targetElement.elemID)

      expectedChanges = [
        { id: sourceElemId, action: 'remove', data: { before: sourceElement } },
        { id: targetElement.elemID, action: 'add', data: { after: targetElement } },
        { id: refElemId, action: 'modify', data: { before: beforeRef, after: afterRef } },
      ]
      changes = await api.rename(ws, sourceElemId, targetElement.elemID)
    })

    it('should return changes', () => {
      expect(changes).toEqual(expectedChanges)
    })
  })
  describe('getLoginStatuses', () => {
    it('returns login status for each account', async () => {
      const ws = mockWorkspace({
        accounts: ['salto1', 'salto2'],
        accountToServiceName: {
          salto1: 'salto',
          salto2: 'salto',
        },
      })
      const statuses = await getLoginStatuses(ws)
      expect(Object.keys(statuses).length).toEqual(2)
      expect(Object.keys(statuses)).toContain('salto1')
      expect(Object.keys(statuses)).toContain('salto2')
    })
  })
  describe('getAdapterConfigOptionsType', () => {
    it('should returns adapter configCreator.optionsType when defined', () => {
      expect(getAdapterConfigOptionsType(mockServiceWithConfigCreator)).toEqual(mockConfigOptionsObjectType)
    })
    it('should returns undefined when adapter configCreator is undefined', () => {
      expect(getAdapterConfigOptionsType(mockService)).toBeUndefined()
    })
  })
})
