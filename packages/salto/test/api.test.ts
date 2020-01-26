import _ from 'lodash'
import {
  Adapter,
  BuiltinTypes,
  DataModificationResult,
  Element,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
} from 'adapter-api'
import wu from 'wu'
import { Config } from '../src/workspace/config'
import { Workspace } from '../src/workspace/workspace'
import * as api from '../src/api'

import * as plan from '../src/core/plan'
import * as fetch from '../src/core/fetch'
import * as deploy from '../src/core/deploy'
import * as records from '../src/core/records'
import * as adapters from '../src/core/adapters/adapters'
import adapterCreators from '../src/core/adapters/creators'

import * as mockElements from './common/elements'
import * as mockPlan from './common/plan'
import mockState from './common/state'

const SERVICES = ['salesforce']

const configID = new ElemID(SERVICES[0])
const mockConfigType = new ObjectType({
  elemID: configID,
  fields: {
    username: new Field(configID, 'username', BuiltinTypes.STRING),
    password: new Field(configID, 'password', BuiltinTypes.STRING),
    token: new Field(configID, 'token', BuiltinTypes.STRING),
    sandbox: new Field(configID, 'sandbox', BuiltinTypes.BOOLEAN),
  },
})
const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
  username: 'test@test',
  password: 'test',
  token: 'test',
  sandbox: false,
})
const mockWorkspace = (elements: Element[] = [], config?: Partial<Config>): Workspace => ({
  elements,
  config: config || { stateLocation: '.', services: SERVICES },
  state: mockState(),
  resolvePath: _.identity,
  updateBlueprints: jest.fn(),
  flush: jest.fn(),
  credentials: {
    get: () => jest.fn().mockImplementation(() => Promise.resolve(mockConfigInstance)),
    set: () => jest.fn().mockImplementation(() => Promise.resolve()),
  },
  getWorkspaceErrors: async () => [],
} as unknown as Workspace)

jest.mock('../src/core/adapters/adapters')
jest.mock('../src/core/fetch')
jest.mock('../src/core/plan')
jest.mock('../src/core/deploy')
jest.mock('../src/core/records')
jest.mock('../src/core/adapters/creators')

describe('api.ts', () => {
  const initAdapters = adapters.initAdapters as jest.Mock
  initAdapters.mockReturnValue({
    [SERVICES[0]]: {} as unknown as Adapter,
  })

  describe('fetch', () => {
    const mockedFetchChanges = fetch.fetchChanges as jest.Mock
    const objType = new ObjectType({ elemID: new ElemID(SERVICES[0], 'dummy') })
    const fetchedElements = [
      objType,
      new InstanceElement('instance_1', objType, {}),
      new InstanceElement('instance_2', objType, {}),
    ]
    mockedFetchChanges.mockReturnValue({
      changes: [],
      elements: fetchedElements,
      mergeErrors: [],
    })

    const stateElements = [{ elemID: new ElemID(SERVICES[0], 'test') }]
    const ws = mockWorkspace()
    ws.state.list = jest.fn().mockImplementation(() => Promise.resolve(stateElements))

    beforeAll(async () => {
      await api.fetch(ws, SERVICES)
    })

    it('should call fetch changes', () => {
      expect(mockedFetchChanges).toHaveBeenCalled()
    })
    it('should override state', () => {
      expect(ws.state.remove).toHaveBeenCalledWith(stateElements)
      expect(ws.state.set).toHaveBeenCalledWith(fetchedElements)
    })
  })

  describe('plan', () => {
    const mockedGetPlan = plan.getPlan as jest.Mock
    const mockGetPlanResult = mockPlan.getPlan()
    mockedGetPlan.mockReturnValueOnce(mockGetPlanResult)
    let result: plan.Plan

    beforeAll(async () => {
      result = await api.preview(mockWorkspace(), SERVICES)
    })
    it('should call getPlan', async () => {
      expect(mockedGetPlan).toHaveBeenCalledTimes(1)
    })

    it('should return getPlan response', async () => {
      expect(result).toEqual(mockGetPlanResult)
    })
  })

  describe('deploy', () => {
    const mockShouldDeployYes = jest.fn().mockImplementation(() => Promise.resolve(true))
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
    let result: api.DeployResult

    beforeAll(async () => {
      result = await api.deploy(
        ws,
        mockShouldDeployYes,
        mockReportCurrentAction,
        SERVICES
      )
    })

    it('should getPlan', async () => {
      expect(mockedGetPlan).toHaveBeenCalledTimes(2)
    })

    it('should ask for approval', async () => {
      expect(mockShouldDeployYes).toHaveBeenCalledTimes(1)
    })

    it('should deploy changes', async () => {
      expect(mockedDeployActions).toHaveBeenCalledTimes(1)
    })
    it('should get detailed changes', async () => {
      expect(mockedGetDetailedChanges).toHaveBeenCalledTimes(1)
    })

    it('should return fetch changes', async () => {
      expect(wu(result.changes || []).toArray()).toHaveLength(1)
    })
  })

  describe('data migration', () => {
    const ws = mockWorkspace()
    const testType = new ObjectType({ elemID: new ElemID(SERVICES[0], 'test') })
    const mockStateGet = jest.fn().mockImplementation(() => Promise.resolve(testType))
    ws.state.get = mockStateGet

    const mockResult = {
      successfulRows: 2,
      failedRows: 1,
      errors: new Set<string>(['ERR']),
    }

    const verify = (result: DataModificationResult): void => {
      expect(mockStateGet).toHaveBeenCalledTimes(1)
      expect(result.successfulRows).toBe(2)
      expect(result.failedRows).toBe(1)
      expect(wu(result.errors).toArray()).toHaveLength(1)
    }

    beforeEach(() => {
      mockStateGet.mockClear()
    })

    describe('export', () => {
      const mockGetInstancesOfType = records.getInstancesOfType as jest.Mock
      mockGetInstancesOfType.mockReturnValue(mockResult)

      it('should complete successfully', async () => {
        const result = await api.exportToCsv(
          testType.elemID.getFullName(),
          'test',
          ws,
        )
        expect(mockGetInstancesOfType).toHaveBeenCalledTimes(1)
        verify(result)
      })
    })

    describe('import', () => {
      const mockedImport = records.importInstancesOfType as jest.Mock
      mockedImport.mockReturnValue(mockResult)
      it('should complete import successfully', async () => {
        const result = await api.importFromCsvFile(
          testType.elemID.getFullName(),
          'test',
          ws,
        )
        expect(mockedImport).toHaveBeenCalledTimes(1)
        verify(result)
      })
    })

    describe('delete', () => {
      const mockedDelete = records.deleteInstancesOfType as jest.Mock
      mockedDelete.mockReturnValue(mockResult)
      it('should complete delete successfully', async () => {
        const result = await api.deleteFromCsvFile(
          testType.elemID.getFullName(),
          'test',
          ws,
        )
        expect(mockedDelete).toHaveBeenCalledTimes(1)
        verify(result)
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

    it('should call validateConfig', async () => {
      const newConf = mockConfigInstance.clone()
      newConf.value.password = 'bla'

      await api.updateLoginConfig(ws, newConf)

      const adapterCreator = adapterCreators.salesforce
      expect(adapterCreator.validateConfig).toHaveBeenCalledTimes(1)
    })

    describe('validateConfig', () => {
      it('should throw if passed unknown adapter name', () => {
        const newConf = mockConfigInstance.clone()
        newConf.value.password = 'bla'
        _.set(newConf, 'elemID', new ElemID('unknownService'))

        return expect(api.updateLoginConfig(ws, newConf)).rejects.toThrow('unknown adapter: unknownService')
      })
    })


    it('should persist a new config', async () => {
      const newConf = mockConfigInstance.clone()
      newConf.value.password = 'bla'
      await api.updateLoginConfig(ws, newConf)
      expect((ws.credentials.set as jest.Mock).call).toHaveLength(1)
    })
  })
})
