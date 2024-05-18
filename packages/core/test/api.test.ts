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
import {
  Adapter,
  AdapterOperations,
  AdditionChange,
  BuiltinTypes,
  Change,
  ChangeDataType,
  ChangeValidator,
  CORE_ANNOTATIONS,
  DetailedChange,
  Element,
  ElemID,
  Field,
  FixElementsFunc,
  GetAdditionalReferencesFunc,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isEqualElements,
  isInstanceElement,
  isModificationChange,
  isObjectType,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  ReferenceExpression,
  SeverityLevel,
  toChange,
} from '@salto-io/adapter-api'
import * as workspace from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { adapter as salesforceAdapter, loadElementsFromFolder } from '@salto-io/salesforce-adapter'
import * as api from '../src/api'
import { getAdapterConfigOptionsType, getAdditionalReferences, getLoginStatuses } from '../src/api'
import * as plan from '../src/core/plan/plan'
import * as fetch from '../src/core/fetch'
import * as adapters from '../src/core/adapters/adapters'
import adapterCreators from '../src/core/adapters/creators'

import * as mockElements from './common/elements'
import * as mockPlan from './common/plan'
import { createElementSource } from './common/helpers'
import { mockConfigInstance, mockConfigType, mockEmptyConfigType, mockWorkspace } from './common/workspace'
import { DeployResult, FetchChange } from '../src/types'

const { awu } = collections.asynciterable
const mockService = 'salto'
const emptyMockService = 'salto2'
const mockServiceWithInstall = 'adapterWithInstallMethod'
const mockServiceWithConfigCreator = 'adapterWithConfigCreator'

const { makeArray } = collections.array

const ACCOUNTS = [mockService, emptyMockService]

jest.mock('../src/core/fetch', () => ({
  ...jest.requireActual<{}>('../src/core/fetch'),
  fetchChanges: jest.fn(),
  fetchChangesFromWorkspace: jest.fn(),
}))
jest.mock('../src/core/restore', () => ({
  createRestoreChanges: jest.fn((...args) => {
    const detailedChanges = [
      {
        action: 'add',
        data: { after: 'value' },
        path: ['path'],
      },
    ]
    return args[6] === 'changes'
      ? [
          {
            action: 'add',
            data: { after: 'value' },
            detailedChanges: () => detailedChanges,
          },
        ]
      : detailedChanges
  }),
  createRestorePathChanges: jest.fn().mockResolvedValue([
    {
      action: 'add',
      data: { after: 'value' },
      detailedChanges: () => [
        {
          action: 'add',
          data: { after: 'value' },
          path: ['path'],
        },
      ],
    },
  ]),
}))

jest.mock('../src/core/diff', () => ({
  createDiffChanges: jest.fn((...args) => {
    const detailedChanges = [
      {
        action: 'add',
        data: { after: 'value' },
      },
    ]
    return args[5] === 'changes'
      ? [
          {
            action: 'add',
            data: { after: 'value' },
            detailedChanges: () => detailedChanges,
          },
        ]
      : detailedChanges
  }),
}))

jest.mock('@salto-io/salesforce-adapter', () => {
  const actual = jest.requireActual('@salto-io/salesforce-adapter')
  return {
    ...actual,
    adapter: {
      ...actual.adapter,
      loadElementsFromFolder: jest.fn().mockImplementation(actual.adapter.loadElementsFromFolder),
    },
  }
})

const mockLoadElementsFromFolder = salesforceAdapter.loadElementsFromFolder as jest.MockedFunction<
  typeof loadElementsFromFolder
>

describe('api.ts', () => {
  const mockAdapterOps = {
    fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
    deploy: mockFunction<AdapterOperations['deploy']>().mockImplementation(({ changeGroup }) =>
      Promise.resolve({ errors: [], appliedChanges: changeGroup.changes }),
    ),
    fixElements: mockFunction<FixElementsFunc>().mockResolvedValue({ fixedElements: [], errors: [] }),
  }

  const mockAdapter = {
    operations: mockFunction<Adapter['operations']>().mockReturnValue({
      ...mockAdapterOps,
      deployModifiers: { changeValidator: mockFunction<ChangeValidator>().mockResolvedValue([]) },
    }),
    authenticationMethods: { basic: { credentialsType: mockConfigType } },
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({
      accountId: '',
      accountType: 'Sandbox',
      isProduction: false,
    }),
    getAdditionalReferences: mockFunction<GetAdditionalReferencesFunc>().mockResolvedValue([]),
  }

  const mockEmptyAdapter = {
    operations: mockFunction<Adapter['operations']>().mockReturnValue({
      ...mockAdapterOps,
      validationModifiers: { changeValidator: mockFunction<ChangeValidator>().mockResolvedValue([]) },
    }),
    authenticationMethods: { basic: { credentialsType: mockEmptyConfigType } },
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({
      accountId: '',
      accountType: 'Sandbox',
      isProduction: false,
    }),
  }
  const mockAdapterWithInstall = {
    authenticationMethods: {
      basic: {
        credentialsType: new ObjectType({ elemID: new ElemID(mockServiceWithInstall) }),
      },
    },
    operations: mockFunction<Adapter['operations']>().mockReturnValue(mockAdapterOps),
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({
      accountId: '',
      accountType: 'Sandbox',
      isProduction: false,
    }),
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
    const mockPartiallyFetchedAccounts = jest.fn()

    const fetchedElements = [
      objType,
      new InstanceElement('instance_1', objType, {}),
      new InstanceElement('instance_2', objType, {}),
      new InstanceElement('instance_3_hidden', typeWithHiddenField, { hidden: 'Hidden', regField: 'regValue' }),
    ]

    beforeAll(() => {
      mockPartiallyFetchedAccounts.mockReturnValue(new Set())
    })

    describe('Full fetch', () => {
      let ws: workspace.Workspace
      let stateUpdateElements: jest.SpyInstance
      let mockGetAdaptersCreatorConfigs: jest.SpyInstance

      beforeAll(async () => {
        const workspaceElements = [
          new InstanceElement('workspace_instance', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {}),
        ]
        const stateElements = [
          new InstanceElement('state_instance', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {}),
        ]
        ws = mockWorkspace({ elements: workspaceElements, stateElements })
        stateUpdateElements = jest.spyOn(ws.state(), 'updateStateFromChanges')
        mockGetAdaptersCreatorConfigs = jest.spyOn(adapters, 'getAdaptersCreatorConfigs')
        mockFetchChanges.mockImplementationOnce(async () => ({
          changes: [],
          serviceToStateChanges: [],
          errors: [],
          configChanges: mockPlan.createPlan([[]]),
          updatedConfig: {},
          unmergedElements: fetchedElements,
          elements: fetchedElements,
          mergeErrors: [],
          accountNameToConfigMessage: {},
          partiallyFetchedAccounts: mockPartiallyFetchedAccounts(),
        }))
        mockFetchChanges.mockClear()
        await api.fetch(ws, undefined, ACCOUNTS)
      })

      it('should call fetch changes', () => {
        expect(mockFetchChanges).toHaveBeenCalled()
      })
      it('should update the state', async () => {
        const updateParams = _.first(stateUpdateElements.mock.calls)[0] as AsyncIterable<Element>
        expect(updateParams).toEqual({
          changes: [],
          unmergedElements: fetchedElements,
          fetchAccounts: ACCOUNTS,
        })
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
      beforeAll(async () => {
        stateElements = [
          new InstanceElement('old_instance1', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {}),
          new InstanceElement('old_instance2', new ObjectType({ elemID: new ElemID(emptyMockService, 'test') }), {}),
        ]
        ws = mockWorkspace({ stateElements })
        mockFetchChanges.mockImplementationOnce(async () => ({
          changes: [],
          // This is the field that is used to determine which elements to update in the state
          serviceToStateChanges: fetchedElements.map(e => ({ action: 'add', data: { after: e }, id: e.elemID })),
          errors: [],
          configChanges: mockPlan.createPlan([[]]),
          updatedConfig: {},
          unmergedElements: fetchedElements,
          elements: fetchedElements,
          mergeErrors: [],
          accountNameToConfigMessage: {},
          partiallyFetchedAccounts: mockPartiallyFetchedAccounts(),
        }))
        mockFetchChanges.mockClear()
        await api.fetch(ws, undefined, [mockService])
      })

      it('should call fetch changes with first account only', () => {
        expect(mockFetchChanges).toHaveBeenCalled()
      })
      it('should update state with the new elements and keep the old ones', async () => {
        const elements = await awu(await ws.state().getAll()).toArray()
        expect(elements).toEqual(expect.arrayContaining([...fetchedElements, ...stateElements]))
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
      it('should throw an error upon failure', async () => {
        mockFetchChanges.mockRejectedValueOnce(new Error('test'))
        await expect(api.fetch(ws, undefined, [mockService])).rejects.toThrow(new Error('test'))
      })
    })
  })

  describe('plan', () => {
    let mockedGetPlan: jest.SpyInstance<Promise<plan.Plan>, Parameters<typeof plan.getPlan>>
    let mockGetPlanResult: plan.Plan

    beforeEach(async () => {
      mockedGetPlan = jest.spyOn(plan, 'getPlan')
      mockGetPlanResult = mockPlan.getPlan()
      mockedGetPlan.mockResolvedValue(mockGetPlanResult)
    })

    afterEach(() => {
      mockedGetPlan.mockRestore()
    })

    it('should return getPlan response', async () => {
      const result = await api.preview(mockWorkspace({}), ACCOUNTS)
      expect(result).toEqual(mockGetPlanResult)
    })
    it('should call getPlan with deploy change validators', async () => {
      await api.preview(mockWorkspace({}), ACCOUNTS)
      expect(mockedGetPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          changeValidators: {
            [mockService]: expect.any(Function),
          },
        }),
      )
    })
    it('should call getPlan with validation change validators', async () => {
      await api.preview(mockWorkspace({}), ACCOUNTS, true)
      expect(mockedGetPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          changeValidators: {
            [emptyMockService]: expect.any(Function),
          },
        }),
      )
    })
    it('should call getPlan with given topLevelFilters', async () => {
      const topLevelFilters = [() => true]
      await api.preview(mockWorkspace({}), ACCOUNTS, true, false, topLevelFilters)
      expect(mockedGetPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          topLevelFilters: expect.arrayContaining(topLevelFilters),
          changeValidators: {
            [emptyMockService]: expect.any(Function),
          },
        }),
      )
    })
    it('should call getPlan without change validators', async () => {
      await api.preview(mockWorkspace({}), ACCOUNTS, false, true)
      expect(mockedGetPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          changeValidators: {},
        }),
      )
    })
  })

  describe('deploy', () => {
    let ws: workspace.Workspace
    let result: DeployResult

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

        const actionPlan = mockPlan.createPlan([
          [
            { action: 'add', data: { after: addedElem.clone() } },
            { action: 'remove', data: { before: removedElem.clone() } },
          ],
        ])

        // Add annotation to the new element
        const cloneAndAddAnnotation = <T extends ChangeDataType>(change: AdditionChange<T>): AdditionChange<T> => {
          const cloned = change.data.after.clone() as T
          cloned.annotations.test = 1
          return { action: 'add', data: { after: cloned } }
        }
        mockAdapterOps.deploy.mockClear()
        mockAdapterOps.deploy.mockImplementationOnce(async ({ changeGroup }) => ({
          appliedChanges: changeGroup.changes.map(change =>
            isAdditionChange(change) ? cloneAndAddAnnotation(change) : change,
          ),
          errors: [],
          extraProperties: {
            groups: [
              {
                artifacts: [{ name: 'test', content: Buffer.from('test') }],
                url: 'https://test.deploymentUrl.com/123343',
              },
            ],
          },
        }))
        result = await api.deploy(ws, actionPlan, jest.fn(), ACCOUNTS)
      })

      it('should call adapter deploy function', async () => {
        expect(mockAdapterOps.deploy).toHaveBeenCalledTimes(1)
      })

      it('should return updates to existing elements', async () => {
        expect(result.changes).toBeDefined()
        const changes = [...(result.changes ?? [])]
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
      it('should return correct group extra properties', () => {
        const groups = makeArray(result.extraProperties?.groups)
        expect(groups).toHaveLength(1)
        expect(groups[0]).toEqual({
          url: 'https://test.deploymentUrl.com/123343',
          artifacts: [{ name: 'test', content: Buffer.from('test') }],
          id: `${mockService}.employee`,
          accountName: mockService,
        })
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
        const actionPlan = mockPlan.createPlan([
          [
            { action: 'remove', data: { before: removedField } },
            { action: 'modify', data: { before: origField, after: changedField } },
          ],
        ])

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
        expect(modifyAppliedChange?.data).toEqual({ before: expectedOriginalField, after: expectedChangedField })
      })
    })
    describe('with partial success from the adapter', () => {
      let newEmployee: InstanceElement
      let existingEmployee: InstanceElement
      let updateStateFromChangesSpy: jest.SpyInstance
      beforeAll(async () => {
        const wsElements = mockElements.getAllElements()
        existingEmployee = wsElements.find(isInstanceElement) as InstanceElement
        newEmployee = new InstanceElement('new', existingEmployee.refType, existingEmployee.value)
        wsElements.push(newEmployee)
        existingEmployee.value.name = 'updated name'
        const stateElements = mockElements.getAllElements()
        ws = mockWorkspace({ elements: wsElements, stateElements })
        updateStateFromChangesSpy = jest.spyOn(ws.state(), 'updateStateFromChanges')

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
          errors: [
            { message: 'cannot add new employee', severity: 'Error' as SeverityLevel, elemID: newEmployee.elemID },
            { message: 'cannot add new employee', severity: 'Error' as SeverityLevel },
          ],
        }))
        result = await api.deploy(ws, actionPlan, jest.fn(), ACCOUNTS)
      })

      it('should return errors for the failed part', () => {
        expect(result.errors).toHaveLength(2)
        expect(result.errors[0]).toMatchObject(
          expect.objectContaining({
            elemID: newEmployee.elemID,
          }),
        )
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
        expect(updateStateFromChangesSpy).toHaveBeenCalledWith({
          changes: [
            expect.objectContaining({
              data: {
                before: 'FirstEmployee',
                after: 'updated name',
              },
            }),
          ],
        })
      })
    })
    describe('with checkOnly deployment', () => {
      let executeDeploy: () => Promise<DeployResult>
      beforeEach(async () => {
        const workspaceElements = mockElements.getAllElements()
        const stateElements = mockElements.getAllElements()

        const removedElem = stateElements[4]
        const addedElem = workspaceElements[3]

        ws = mockWorkspace({
          elements: workspaceElements.filter(elem => !isEqualElements(elem, removedElem)),
          stateElements: stateElements.filter(elem => !isEqualElements(elem, addedElem)),
        })

        const actionPlan = mockPlan.createPlan([
          [
            { action: 'add', data: { after: addedElem.clone() } },
            { action: 'remove', data: { before: removedElem.clone() } },
          ],
        ])

        // Add annotation to the new element
        const cloneAndAddAnnotation = <T extends ChangeDataType>(change: AdditionChange<T>): AdditionChange<T> => {
          const cloned = change.data.after.clone() as T
          cloned.annotations.test = 1
          return { action: 'add', data: { after: cloned } }
        }
        mockAdapterOps.deploy.mockClear()
        mockAdapterOps.deploy.mockImplementationOnce(async ({ changeGroup }) => ({
          appliedChanges: changeGroup.changes.map(change =>
            isAdditionChange(change) ? cloneAndAddAnnotation(change) : change,
          ),
          errors: [],
        }))
        executeDeploy = () => api.deploy(ws, actionPlan, jest.fn(), ACCOUNTS, true)
      })

      describe('when adapter does not implement the validate method', () => {
        it('should fail with error', async () => {
          await executeDeploy()
          expect(mockAdapterOps.deploy).not.toHaveBeenCalled()
          expect(result.errors).toHaveLength(2)
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

    describe('with element updates during deploy', () => {
      let instance: InstanceElement
      let adapterOps: MockInterface<AdapterOperations>
      let adapter: Adapter
      beforeAll(async () => {
        adapterOps = {
          fetch: mockFunction<AdapterOperations['fetch']>(),
          deploy: mockFunction<AdapterOperations['deploy']>(),
        }
        adapter = {
          operations: mockFunction<Adapter['operations']>().mockReturnValue(adapterOps as AdapterOperations),
          authenticationMethods: { basic: { credentialsType: mockConfigType } },
          validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({
            accountId: '',
            accountType: 'Sandbox',
            isProduction: false,
          }),
        }
        adapterCreators.test = adapter

        instance = new InstanceElement('inst', new ObjectType({ elemID: new ElemID('test', 'type') }), { name: 'test' })

        const mockWs = mockWorkspace({
          elements: [instance],
          stateElements: [],
          accounts: ['test'],
        })

        mockWs.accountCredentials = mockFunction<workspace.Workspace['accountCredentials']>().mockResolvedValue({
          test: new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
            username: 'test@test',
            password: 'test',
            token: 'test',
            sandbox: false,
          }),
        })

        const actionPlan = mockPlan.createPlan([[{ action: 'add', data: { after: instance.clone() } }]])

        adapterOps.deploy.mockImplementationOnce(async ({ changeGroup }) => {
          const changeInstance = getChangeData(changeGroup.changes[0]).clone() as InstanceElement
          changeInstance.value.id = 1
          return {
            appliedChanges: [toChange({ after: changeInstance })],
            errors: [],
          }
        })

        result = await api.deploy(mockWs, actionPlan, jest.fn(), ['test'])
      })

      it('should call adapter deploy function', () => {
        expect(adapterOps.deploy).toHaveBeenCalledTimes(1)
      })

      it('should return the applied changes', () => {
        expect(result.appliedChanges).toHaveLength(1)
        const [addedChange] = result.appliedChanges ?? []
        expect((getChangeData(addedChange) as InstanceElement).value.id).toBe(1)
      })

      it('should update element source', async () => {
        const elementSource = (adapter.operations as jest.Mock).mock.calls[0][0].elementsSource
        const instanceFromSource = (await elementSource.get(instance.elemID)) as InstanceElement
        expect(instanceFromSource.value.id).toBe(1)
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
        const newConf = new InstanceElement(ElemID.CONFIG_NAME, newConfType, mockConfigInstance.value)
        return expect(api.verifyCredentials(newConf)).rejects.toThrow('unknown adapter: unknownAccount')
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
          validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({
            accountId: '',
            accountType: 'Sandbox',
            isProduction: false,
          }),
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
    it('should return all changes as changesWithDetails', async () => {
      const ws = mockWorkspace({
        elements: [],
        name: 'restore',
        index: [],
        stateElements: [],
      })
      const changes = await api.restore(ws, undefined, undefined, 'changes')
      expect(changes).toHaveLength(1)
      expect(_.keys(changes[0])).toEqual(['action', 'data', 'detailedChanges'])
    })
  })

  describe('restorePaths', () => {
    it('should return all changes as local changes', async () => {
      const ws = mockWorkspace({
        elements: [],
        name: 'restore',
        index: [],
        stateElements: [],
      })
      const changes = await api.restorePaths(ws)
      expect(changes).toHaveLength(1)
      expect(_.keys(changes[0])).toEqual(['change', 'serviceChanges'])
    })
  })

  describe('diff', () => {
    const ws = mockWorkspace({ name: 'diff' })
    it('should return detailedChanges', async () => {
      const changes = await api.diff(ws, 'active', 'other', false, false)
      expect(changes).toHaveLength(1)
      expect(ws.elements).toHaveBeenCalledWith(false, 'active')
      expect(ws.elements).toHaveBeenCalledWith(false, 'other')
    })
    it('should return changesWithDetails', async () => {
      const changes = await api.diff(ws, 'active', 'other', false, false, undefined, undefined, 'changes')
      expect(changes).toHaveLength(1)
      expect(changes[0].detailedChanges()).toHaveLength(1)
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
        serviceToStateChanges: [],
        errors: [],
        configChanges: mockPlan.createPlan([[]]),
        unmergedElements: fetchedElements,
        elements: fetchedElements,
        mergeErrors: [],
        updatedConfig: {},
        accountNameToConfigMessage: {},
        partiallyFetchedAccounts: new Set(),
      })
    })

    describe('Full fetch', () => {
      let ws: workspace.Workspace
      let ows: workspace.Workspace

      beforeAll(async () => {
        const workspaceElements = [
          new InstanceElement('workspace_instance', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {}),
        ]
        const stateElements = [
          new InstanceElement('state_instance', new ObjectType({ elemID: new ElemID(mockService, 'test') }), {}),
        ]
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

  describe('calculatePatchFromChanges', () => {
    const type = new ObjectType({ elemID: new ElemID('salto', 'type') })
    const modifiedInstance = toChange({
      before: new InstanceElement('modified', type, { name: 'before', label: 'before' }),
      after: new InstanceElement('modified', type, { name: 'after', label: 'after' }),
    })
    const nonExistModifiedInstance = toChange({
      before: new InstanceElement('nonExistModified', type, { name: 'before' }),
      after: new InstanceElement('nonExistModified', type, { name: 'after' }),
    })
    const addedInstance = toChange({
      after: new InstanceElement('added', type, { name: 'after' }),
    })
    const existingAddedInstance = toChange({
      after: new InstanceElement('existingAdded', type, { name: 'after' }),
    })
    const deletedInstance = toChange({
      before: new InstanceElement('deleted', type, { name: 'before' }),
    })
    const nonExistDeletedInstance = toChange({
      before: new InstanceElement('nonExistDeleted', type, { name: 'before' }),
    })
    const changes = [
      modifiedInstance,
      nonExistModifiedInstance,
      addedInstance,
      existingAddedInstance,
      deletedInstance,
      nonExistDeletedInstance,
    ]
    const pathIndex = new workspace.remoteMap.InMemoryRemoteMap<workspace.pathIndex.Path[]>(
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .map(element => ({ key: element.elemID.getFullName(), value: [['test']] })),
    )

    let patchChanges: FetchChange[]
    beforeEach(async () => {
      const elements = [
        new InstanceElement('modified', type, { name: 'other', label: 'before', _service_id: 123 }),
        new InstanceElement('existingAdded', type, { name: 'other', _service_id: 456 }),
        new InstanceElement('deleted', type, { name: 'other', _service_id: 789 }),
      ]
      const elementsWithoutHidden = [
        new InstanceElement('modified', type, { name: 'other', label: 'before' }),
        new InstanceElement('existingAdded', type, { name: 'other' }),
        new InstanceElement('deleted', type, { name: 'other' }),
      ]
      const ws = mockWorkspace({
        elements,
        elementsWithoutHidden,
        name: 'workspace',
        accounts: ['salto'],
        accountToServiceName: { salto: 'salto' },
      })

      patchChanges = await api.calculatePatchFromChanges({
        workspace: ws,
        changes,
        pathIndex,
      })
    })

    it('should calculate changes', () => {
      expect(patchChanges).toHaveLength(6)
    })
    it('should calculate instance modification (conflict)', () => {
      expect(patchChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            change: expect.objectContaining({
              id: new ElemID('salto', 'type', 'instance', 'modified', 'name'),
              data: { before: 'other', after: 'after' },
            }),
            serviceChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'modified', 'name'),
                data: { before: 'before', after: 'after' },
              }),
            ],
            pendingChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'modified', 'name'),
                data: { before: 'before', after: 'other' },
              }),
            ],
          }),
        ]),
      )
    })
    it('should calculate instance modification', () => {
      expect(patchChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            change: expect.objectContaining({
              id: new ElemID('salto', 'type', 'instance', 'modified', 'label'),
              data: { before: 'before', after: 'after' },
            }),
            serviceChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'modified', 'label'),
                data: { before: 'before', after: 'after' },
              }),
            ],
            pendingChanges: [],
          }),
        ]),
      )
    })
    it('should calculate non existed instance modification (conflict)', () => {
      expect(patchChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            change: expect.objectContaining({
              id: new ElemID('salto', 'type', 'instance', 'nonExistModified'),
              data: { after: expect.objectContaining({ path: ['test'] }) },
            }),
            serviceChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'nonExistModified', 'name'),
                data: { before: 'before', after: 'after' },
              }),
            ],
            pendingChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'nonExistModified'),
                data: { before: expect.any(InstanceElement) },
              }),
            ],
          }),
        ]),
      )
    })
    it('should calculate existing instance addition (conflict)', () => {
      expect(patchChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            change: expect.objectContaining({
              id: new ElemID('salto', 'type', 'instance', 'existingAdded', 'name'),
              data: { before: 'other', after: 'after' },
            }),
            serviceChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'existingAdded'),
                data: { after: expect.any(InstanceElement) },
              }),
            ],
            pendingChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'existingAdded'),
                data: { after: expect.any(InstanceElement) },
              }),
            ],
          }),
        ]),
      )
    })
    it('should calculate instance addition', () => {
      expect(patchChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            change: expect.objectContaining({
              id: new ElemID('salto', 'type', 'instance', 'added'),
              data: { after: expect.objectContaining({ path: ['test'] }) },
            }),
            serviceChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'added'),
                data: { after: expect.any(InstanceElement) },
              }),
            ],
            pendingChanges: [],
          }),
        ]),
      )
    })
    it('should calculate instance deletion (conflict)', () => {
      expect(patchChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            change: expect.objectContaining({
              id: new ElemID('salto', 'type', 'instance', 'deleted'),
              data: { before: expect.any(InstanceElement) },
            }),
            serviceChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'deleted'),
                data: { before: expect.any(InstanceElement) },
              }),
            ],
            pendingChanges: [
              expect.objectContaining({
                id: new ElemID('salto', 'type', 'instance', 'deleted', 'name'),
                data: { before: 'before', after: 'other' },
              }),
            ],
          }),
        ]),
      )
    })
  })

  describe('calculatePatch', () => {
    const type = new ObjectType({
      elemID: new ElemID('salesforce', 'type'),
      fields: {
        f: { refType: BuiltinTypes.STRING },
      },
    })

    const instance = new InstanceElement('instance', type, { f: 'v' })
    const instanceWithHidden = new InstanceElement('instance', type, { f: 'v', _service_id: 123 })
    const instanceState = new InstanceElement('instanceState', type, { f: 'v' })
    const instanceNacl = instanceState.clone()
    instanceNacl.value.f = 'v2'

    const ws = mockWorkspace({
      elements: [type, instanceWithHidden, instanceNacl],
      elementsWithoutHidden: [type, instance, instanceNacl],
      stateElements: [type, instanceWithHidden, instanceState],
      name: 'workspace',
      accounts: ['salesforce'],
      accountToServiceName: { salesforce: 'salesforce' },
    })

    adapterCreators.salesforce = salesforceAdapter

    beforeEach(() => {
      mockLoadElementsFromFolder.mockClear()
    })

    describe('when there is a difference between the folders', () => {
      it('should return the changes with no errors', async () => {
        const afterModifyInstance = instance.clone()
        afterModifyInstance.value.f = 'v3'
        const afterNewInstance = new InstanceElement('instance2', type, { f: 'v' })
        const beforeElements = [instance]
        const afterElements = [afterModifyInstance, afterNewInstance]
        mockLoadElementsFromFolder
          .mockResolvedValueOnce({ elements: beforeElements })
          .mockResolvedValueOnce({ elements: afterElements })
        const res = await api.calculatePatch({
          workspace: ws,
          fromDir: 'before',
          toDir: 'after',
          accountName: 'salesforce',
        })
        expect(res.success).toBeTruthy()
        expect(res.fetchErrors).toHaveLength(0)
        expect(res.mergeErrors).toHaveLength(0)
        expect(res.changes).toHaveLength(2)
      })
    })

    describe('when an element is added and also exists in ws', () => {
      it('should not return changes for hidden values', async () => {
        const afterModifyInstance = instance.clone()
        afterModifyInstance.value.f = 'v3'
        const beforeElements: Element[] = []
        const afterElements = [afterModifyInstance]
        mockLoadElementsFromFolder
          .mockResolvedValueOnce({ elements: beforeElements })
          .mockResolvedValueOnce({ elements: afterElements })
        const res = await api.calculatePatch({
          workspace: ws,
          fromDir: 'before',
          toDir: 'after',
          accountName: 'salesforce',
        })
        expect(res.success).toBeTruthy()
        expect(res.fetchErrors).toHaveLength(0)
        expect(res.mergeErrors).toHaveLength(0)
        expect(res.changes).toHaveLength(1)
        expect(res.changes[0].change.id.name).toEqual('f')
      })
    })

    describe('when there is no difference between the folders', () => {
      it('should return with no changes and no errors', async () => {
        const beforeElements = [instance]
        const afterElements = [instance]
        mockLoadElementsFromFolder
          .mockResolvedValueOnce({ elements: beforeElements })
          .mockResolvedValueOnce({ elements: afterElements })
        const res = await api.calculatePatch({
          workspace: ws,
          fromDir: 'before',
          toDir: 'after',
          accountName: 'salesforce',
        })
        expect(res.success).toBeTruthy()
        expect(res.fetchErrors).toHaveLength(0)
        expect(res.mergeErrors).toHaveLength(0)
        expect(res.changes).toHaveLength(0)
      })
    })

    describe('when there is a merge error', () => {
      it('should return with merge error and success false', async () => {
        const beforeElements = [instance, instance]
        mockLoadElementsFromFolder.mockResolvedValueOnce({ elements: beforeElements })
        const res = await api.calculatePatch({
          workspace: ws,
          fromDir: 'before',
          toDir: 'after',
          accountName: 'salesforce',
        })
        expect(res.success).toBeFalsy()
        expect(res.fetchErrors).toHaveLength(0)
        expect(res.changes).toHaveLength(0)
        expect(res.mergeErrors).toHaveLength(1)
      })
    })

    describe('when there is a fetch error', () => {
      it('should return with changes and fetch errors', async () => {
        const afterModifyInstance = instance.clone()
        afterModifyInstance.value.f = 'v3'
        const beforeElements = [instance]
        const afterElements = [afterModifyInstance]
        mockLoadElementsFromFolder
          .mockResolvedValueOnce({ elements: beforeElements })
          .mockResolvedValueOnce({ elements: afterElements, errors: [{ message: 'err', severity: 'Warning' }] })
        const res = await api.calculatePatch({
          workspace: ws,
          fromDir: 'before',
          toDir: 'after',
          accountName: 'salesforce',
        })
        expect(res.success).toBeTruthy()
        expect(res.changes).toHaveLength(1)
        expect(res.mergeErrors).toHaveLength(0)
        expect(res.fetchErrors).toHaveLength(1)
      })
    })

    describe('when there are conflicts', () => {
      it('should return the changes with pendingChanges', async () => {
        const beforeConflictInstance = instanceState.clone()
        beforeConflictInstance.value.f = 'v5'
        const afterConflictInstance = instanceState.clone()
        afterConflictInstance.value.f = 'v4'
        const beforeElements = [beforeConflictInstance]
        const afterElements = [afterConflictInstance]
        mockLoadElementsFromFolder
          .mockResolvedValueOnce({ elements: beforeElements })
          .mockResolvedValueOnce({ elements: afterElements })
        const res = await api.calculatePatch({
          workspace: ws,
          fromDir: 'before',
          toDir: 'after',
          accountName: 'salesforce',
        })
        expect(res.success).toBeTruthy()
        expect(res.fetchErrors).toHaveLength(0)
        expect(res.mergeErrors).toHaveLength(0)
        expect(res.changes).toHaveLength(1)
        const firstChange = (await awu(res.changes).toArray())[0]
        expect(firstChange.pendingChanges).toHaveLength(1)
      })
    })

    describe('when used with an account that does not support loadElementsFromFolder', () => {
      it('Should throw an error', async () => {
        await expect(
          api.calculatePatch({ workspace: ws, fromDir: 'before', toDir: 'after', accountName: 'notSalesforce' }),
        ).rejects.toThrow()
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
        sourceElement.annotations,
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

  describe('getAdditionalReferences', () => {
    let ws: workspace.Workspace
    let change: Change<ObjectType>

    beforeEach(() => {
      ws = mockWorkspace({
        accounts: ['salto1'],
        accountToServiceName: {
          salto1: 'salto',
        },
      })

      change = toChange({ after: new ObjectType({ elemID: new ElemID('salto1', 'test') }) })
    })
    it('should return additional references', async () => {
      mockAdapter.getAdditionalReferences.mockResolvedValue([
        {
          source: ElemID.fromFullName('salto1.test'),
          target: ElemID.fromFullName('salto1.test2'),
        },
      ])
      const res = await getAdditionalReferences(ws, [change])

      expect(res).toEqual([
        {
          source: ElemID.fromFullName('salto1.test'),
          target: ElemID.fromFullName('salto1.test2'),
        },
      ])

      expect(mockAdapter.getAdditionalReferences).toHaveBeenCalledWith([change])
    })
  })

  describe('fixElements', () => {
    let ws: workspace.Workspace
    let type: ObjectType
    let mockFixElements: jest.MockedFunction<FixElementsFunc>

    beforeEach(() => {
      type = new ObjectType({
        elemID: new ElemID('test1', 'test'),
      })

      ws = mockWorkspace({
        accounts: ['test1'],
        accountToServiceName: {
          test1: 'test',
        },
        elements: [type],
      })
      ;(ws.accountCredentials as jest.MockedFunction<workspace.Workspace['accountCredentials']>).mockResolvedValue({
        test1: mockConfigInstance,
      })

      mockFixElements = mockFunction<FixElementsFunc>().mockResolvedValue({ errors: [], fixedElements: [] })

      const mockTestAdapterOps = {
        fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
        deploy: mockFunction<AdapterOperations['deploy']>().mockImplementation(({ changeGroup }) =>
          Promise.resolve({ errors: [], appliedChanges: changeGroup.changes }),
        ),
        fixElements: mockFixElements,
      }

      const mockTestAdapter = {
        operations: mockFunction<Adapter['operations']>().mockReturnValue(mockTestAdapterOps),
        authenticationMethods: { basic: { credentialsType: mockConfigType } },
        validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({
          accountId: '',
          accountType: 'Sandbox',
          isProduction: false,
        }),
        getAdditionalReferences: mockFunction<GetAdditionalReferencesFunc>().mockResolvedValue([]),
      }
      adapterCreators.test = mockTestAdapter
    })
    it('should return all the fixes', async () => {
      mockFixElements.mockImplementationOnce(async elements => {
        const clonedElement = elements[0].clone()
        clonedElement.annotations.a = 1
        return {
          fixedElements: [clonedElement],
          errors: [
            {
              elemID: type.elemID,
              message: 'message1',
              detailedMessage: 'detailedMessage1',
              severity: 'Info',
            },
          ],
        }
      })

      mockFixElements.mockImplementationOnce(async elements => {
        const clonedElement = elements[0].clone()
        clonedElement.annotations.b = 2
        return {
          fixedElements: [clonedElement],
          errors: [
            {
              elemID: type.elemID,
              message: 'message2',
              detailedMessage: 'detailedMessage2',
              severity: 'Info',
            },
          ],
        }
      })

      mockFixElements.mockImplementationOnce(async () => ({ fixedElements: [], errors: [] }))
      const res = await api.fixElements(ws, [workspace.createElementSelector(type.elemID.getFullName())])
      const typeBefore = type.clone()
      const typeAfter = type.clone()
      typeAfter.annotate({ a: 1, b: 2 })
      const baseChange = toChange({ before: typeBefore, after: typeAfter })
      expect(res).toEqual({
        changes: [
          {
            action: 'add',
            data: {
              after: 1,
            },
            id: new ElemID('test1', 'test', 'attr', 'a'),
            elemIDs: {
              before: new ElemID('test1', 'test', 'attr', 'a'),
              after: new ElemID('test1', 'test', 'attr', 'a'),
            },
            baseChange,
          },
          {
            action: 'add',
            data: {
              after: 2,
            },
            id: new ElemID('test1', 'test', 'attr', 'b'),
            elemIDs: {
              before: new ElemID('test1', 'test', 'attr', 'b'),
              after: new ElemID('test1', 'test', 'attr', 'b'),
            },
            baseChange,
          },
        ],
        errors: [
          {
            elemID: type.elemID,
            message: 'message1',
            detailedMessage: 'detailedMessage1',
            severity: 'Info',
          },
          {
            elemID: type.elemID,
            message: 'message2',
            detailedMessage: 'detailedMessage2',
            severity: 'Info',
          },
        ],
      })

      expect(mockFixElements).toHaveBeenCalledWith([
        new ObjectType({
          elemID: new ElemID('test1', 'test'),
          annotations: {
            a: 1,
            b: 2,
          },
        }),
      ])
      expect(mockFixElements).toHaveBeenCalledWith([
        new ObjectType({
          elemID: new ElemID('test1', 'test'),
          annotations: {
            a: 1,
            b: 2,
          },
        }),
      ])
    })

    it('should stop after max 11 times', async () => {
      mockFixElements.mockImplementation(async elements => ({
        fixedElements: [elements[0]],
        errors: [
          {
            elemID: type.elemID,
            message: 'message1',
            detailedMessage: 'detailedMessage1',
            severity: 'Info',
          },
        ],
      }))

      const res = await api.fixElements(ws, [workspace.createElementSelector(type.elemID.getFullName())])

      expect(res).toEqual({
        errors: _.range(11).map(() => ({
          elemID: type.elemID,
          message: 'message1',
          detailedMessage: 'detailedMessage1',
          severity: 'Info',
        })),
        changes: [],
      })

      expect(mockFixElements).toHaveBeenCalledTimes(11)
    })

    it('should return an empty array when failed', async () => {
      mockFixElements.mockRejectedValue(new Error())

      const res = await api.fixElements(ws, [workspace.createElementSelector(type.elemID.getFullName())])

      expect(res).toEqual({ changes: [], errors: [] })
      expect(mockFixElements).toHaveBeenCalledTimes(1)
    })

    it('should return an empty array when there is not a fixElements function', async () => {
      delete (adapterCreators.test as { fixElements?: (typeof mockAdapterOps)['fixElements'] }).fixElements

      const res = await api.fixElements(ws, [workspace.createElementSelector(type.elemID.getFullName())])

      expect(res).toEqual({ changes: [], errors: [] })
    })

    it('should throw an error when the selector is not a top level', async () => {
      delete (adapterCreators.test as { fixElements?: (typeof mockAdapterOps)['fixElements'] }).fixElements

      await expect(
        api.fixElements(ws, [workspace.createElementSelector(type.elemID.createNestedID('attr', 'a').getFullName())]),
      ).rejects.toThrow()
    })
    it('should return empty results when there are no elements to fix', async () => {
      const res = await api.fixElements(
        ws,
        [workspace.createElementSelector('test1.test2')], // this selector doesn't match any element in workspace
      )

      expect(res).toEqual({ changes: [], errors: [] })
      expect(mockFixElements).toHaveBeenCalledTimes(0)
    })
  })
})
