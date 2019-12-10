import _ from 'lodash'
import path from 'path'
import tmp from 'tmp-promise'
import {
  ElemID, InstanceElement, ObjectType, AdapterCreator, Field, BuiltinTypes, Element,
  PrimitiveType, PrimitiveTypes,
} from 'adapter-api'
import { creator } from 'salesforce-adapter'
import { Config } from '../../src/workspace/config'
import { DeployError } from '../../src/core/deploy'
import * as commands from '../../src/api'
import State from '../../src/state/state'
import adapterCreators from '../../src/core/adapters/creators'

import * as plan from '../../src/core/plan'
import { Workspace } from '../../src/workspace/workspace'
import { SearchResult, FoundSearchResult } from '../../src/core/search'

const mockAdd = jest.fn(async ap => {
  if (ap.elemID.name === 'fail') {
    throw new Error('failed')
  }
  return new ObjectType({ elemID: new ElemID('salesforce', ap.elemID.name) })
})

const configID = new ElemID('salesforce')
const mockConfigType = new ObjectType({
  elemID: configID,
  fields: {
    username: new Field(configID, 'username', BuiltinTypes.STRING),
    password: new Field(configID, 'password', BuiltinTypes.STRING),
    token: new Field(configID, 'token', BuiltinTypes.STRING),
    sandbox: new Field(configID, 'sandbox', BuiltinTypes.BOOLEAN),
  },
  annotationTypes: {},
  annotations: {},
})

const mockRemove = jest.fn(() => Promise.resolve())

const mockUpdate = jest.fn(b => Promise.resolve(
  new ObjectType({ elemID: new ElemID('salesforce', b.elemID.name) })
))

const objType = new ObjectType({ elemID: new ElemID('salesforce', 'dummy') })
const fetchedElements = [
  objType,
  new InstanceElement('instance_1', objType, {}),
  new InstanceElement('instance_2', objType, {}),
]
const mockFetch = jest.fn(() => Promise.resolve(fetchedElements))

const instancesIterator = async function *instancesIterator(): AsyncIterable<InstanceElement[]> {
  const testType = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
  })
  const values = [
    {
      Id: '1',
      FirstName: 'Daile',
      LastName: 'Limeburn',
      Email: 'dlimeburn0@blogs.com',
      Gender: 'Female',
    },
  ]
  yield values.map(value => new InstanceElement(value.Id, testType, value))
}

const mockGetInstancesOfType = jest.fn(() => instancesIterator())
const mockImportInstancesOfType = jest.fn()
const mockUpdateInstancesOfType = jest.fn()

const mockAdapterCreator: AdapterCreator = {
  create: () => ({
    fetch: mockFetch,
    add: mockAdd,
    remove: mockRemove,
    update: mockUpdate,
    getInstancesOfType: mockGetInstancesOfType,
    importInstancesOfType: mockImportInstancesOfType,
    deleteInstancesOfType: mockUpdateInstancesOfType,
  }),
  configType: mockConfigType,
}

const createMockWorkspace = (elements: Element[]): Workspace => ({
  elements,
  config: { stateLocation: '.' },
  resolvePath: _.identity,
  updateBlueprints: jest.fn(),
  flush: jest.fn(),
  getWorkspaceErrors: async () => [],
} as unknown as Workspace
)

jest.mock('../../src/core/adapters/creators')
jest.mock('../../src/state/state')
jest.mock('../../src/core/csv')
adapterCreators.salesforce = mockAdapterCreator

describe('api functions', () => {
  let baseDir: tmp.DirectoryResult
  let localDir: tmp.DirectoryResult

  beforeEach(async () => {
    baseDir = await tmp.dir({ unsafeCleanup: true })
    localDir = await tmp.dir({ unsafeCleanup: true })
  })

  afterEach(async () => {
    await baseDir.cleanup()
    await localDir.cleanup()
  })
  beforeEach(() => {
    // Mock empty state
    State.prototype.get = jest.fn().mockImplementation(() => Promise.resolve([]))
    State.prototype.flush = jest.fn().mockImplementation(() => Promise.resolve())
    State.prototype.override = jest.fn().mockImplementation(() => Promise.resolve())
    State.prototype.remove = jest.fn().mockImplementation(() => Promise.resolve())
    State.prototype.update = jest.fn().mockImplementation(() => Promise.resolve())
  })

  const mockGetConfigFromUser = async (
    configType: ObjectType
  ): Promise<InstanceElement> => {
    const value = {
      username: 'test@test',
      password: 'test',
      token: 'test',
      sandbox: false,
    }

    return new InstanceElement(ElemID.CONFIG_NAME, configType, value)
  }

  describe('Test commands.ts and core.ts', () => {
    const blueprintsDirectory = path.join(__dirname, '../../../test', 'blueprints')

    const filePath = (filename: string): string => path.join(blueprintsDirectory, filename)

    const mockShouldDeployYes = async (): Promise<boolean> => Promise.resolve(true)

    const mockReportCurrentAction = jest.fn()

    it('Should return all elements in the blueprint', async () => {
      const config: Config = {
        uid: '',
        name: 'test',
        localStorage: localDir.path,
        baseDir: baseDir.path,
        stateLocation: './latest_state.bpc',
        services: ['salesforce'],
        additionalBlueprints: [filePath('salto.bp'), filePath('salto2.bp')],
      }
      const workspace = await Workspace.load(config)
      const fullNames = workspace.elements.map(e => e.elemID.getFullName())
      expect(fullNames).toEqual(
        expect.arrayContaining([
          'salesforce._config.instance',
          'salesforce.test',
          'salesforce.test2',
          'salesforce.settings',
        ]),
      )
    })

    it('should add errors to workspace an error if the bp is not valid', async () => {
      const config: Config = {
        uid: '',
        name: 'test',
        localStorage: localDir.path,
        baseDir: baseDir.path,
        stateLocation: './latest_state.bpc',
        services: ['salesforce'],
        additionalBlueprints: [filePath('error.bp')],
      }
      const workspace = await Workspace.load(config)
      await expect(workspace.errors.hasErrors()).toBe(true)
    })

    it('should throw error on missing adapter', async () => {
      const config: Config = {
        uid: '',
        name: 'test',
        localStorage: localDir.path,
        baseDir: baseDir.path,
        stateLocation: './latest_state.bpc',
        services: ['salesforce'],
        additionalBlueprints: [filePath('missing.bp')],
      }
      const ws: Workspace = await Workspace.load(config)
      const deployResult = await commands.deploy(
        ws,
        mockGetConfigFromUser,
        mockShouldDeployYes,
        mockReportCurrentAction,
        ['salesforce']
      )
      expect(deployResult.success).toBeFalsy()
      expect(deployResult.errors.length).toBeGreaterThan(0)
      const missingAdapterErrors = deployResult.errors.filter((error: DeployError) => error.message.includes('Missing adapter for'))
      expect(missingAdapterErrors.length).toBeGreaterThan(0)
    })

    it('should error on failure', async () => {
      const config: Config = {
        uid: '1',
        name: 'test',
        localStorage: localDir.path,
        baseDir: baseDir.path,
        stateLocation: './latest_state.bpc',
        services: ['salesforce'],
        additionalBlueprints: [filePath('fail.bp')],
      }
      const ws: Workspace = await Workspace.load(config)
      const deployResult = await commands.deploy(
        ws,
        mockGetConfigFromUser,
        mockShouldDeployYes,
        mockReportCurrentAction,
        ['salesforce']
      )
      expect(deployResult.success).toBeFalsy()
      expect(deployResult.errors.length).toBeGreaterThan(0)
    })

    describe('given a valid blueprint', () => {
      let ws: Workspace

      beforeEach(async () => {
        const config: Config = {
          uid: '',
          name: 'test',
          localStorage: localDir.path,
          baseDir: baseDir.path,
          stateLocation: './latest_state.bpc',
          services: ['salesforce'],
          additionalBlueprints: [filePath('salto.bp')],
        }
        ws = await Workspace.load(config)
      })

      it('should create an deploy plan using the plan method', async () => {
        const spy = jest.spyOn(plan, 'getPlan')
        await commands.preview(
          ws,
          ['salesforce']
        )
        expect(spy).toHaveBeenCalled()
      })

      it('should deploy an deploy plan', async () => {
        await commands.deploy(
          ws,
          mockGetConfigFromUser,
          mockShouldDeployYes,
          mockReportCurrentAction,
          ['salesforce']
        )
        expect(mockAdd).toHaveBeenCalled()
      })

      it('should deploy plan with remove based on state', async () => {
        State.prototype.get = jest.fn().mockImplementation(() =>
          Promise.resolve([new ObjectType({ elemID: new ElemID('salesforce', 'employee') })]))
        await commands.deploy(
          ws,
          mockGetConfigFromUser,
          mockShouldDeployYes,
          mockReportCurrentAction,
          ['salesforce']
        )
        expect(mockAdd).toHaveBeenCalled()
        expect(mockRemove).toHaveBeenCalled()
      })

      it('should deploy plan with modification based on state', async () => {
        const mockStateGet = jest.fn().mockImplementation(() =>
          Promise.resolve([new ObjectType({ elemID: new ElemID('salesforce', 'test') })]))
        State.prototype.get = mockStateGet
        const mockStateUpdate = jest.fn().mockImplementation(() => Promise.resolve())
        State.prototype.update = mockStateUpdate
        await commands.deploy(
          ws,
          mockGetConfigFromUser,
          mockShouldDeployYes,
          mockReportCurrentAction,
          ['salesforce']
        )
        expect(mockUpdate).toHaveBeenCalled()
        expect(mockStateGet).toHaveBeenCalled()
        expect(mockStateUpdate).toHaveBeenCalled()
      })

      it('should describe an element', async () => {
        const res: SearchResult = await commands.describeElement(ws, ['salesforce_settings'])
        expect(res).not.toBe(null)
        expect((res as FoundSearchResult).element.elemID.name).toBe('settings')
      })
    })
    describe('data migration', () => {
      let ws: Workspace
      let mockStateGet: jest.Mock
      const elemID = new ElemID('salesforce', 'test')
      const testType = new ObjectType({ elemID })
      const instanceElement = new InstanceElement(
        'test',
        testType,
        {}
      )
      beforeEach(async () => {
        const config: Config = {
          uid: '',
          name: 'test',
          localStorage: localDir.path,
          baseDir: baseDir.path,
          stateLocation: './latest_state.bpc',
          services: ['salesforce'],
          additionalBlueprints: [filePath('salto.bp')],
        }
        ws = await Workspace.load(config)
        mockStateGet = jest.fn().mockImplementation(() =>
          Promise.resolve([testType, instanceElement]))
        State.prototype.get = mockStateGet
      })

      describe('export', () => {
        it('should complete successfully', async () => {
          await commands.exportToCsv(
            testType.elemID.getFullName(),
            'test',
            ws,
            mockGetConfigFromUser
          )
          expect(mockStateGet).toHaveBeenCalled()
          expect(mockGetInstancesOfType).toHaveBeenCalled()
        })
      })

      describe('import', () => {
        it('should complete import successfully', async () => {
          await commands.importFromCsvFile(
            testType.elemID.getFullName(),
            'test',
            ws,
            mockGetConfigFromUser
          )
          expect(mockStateGet).toHaveBeenCalled()
        })
      })

      describe('delete', () => {
        it('should complete delete successfully', async () => {
          await commands.deleteFromCsvFile(
            testType.elemID.getFullName(),
            'test',
            ws,
            mockGetConfigFromUser
          )
          expect(mockStateGet).toHaveBeenCalled()
        })
      })
    })
  })
  describe('fetch', () => {
    let mockWorkspace: Workspace
    let changes: plan.DetailedChange[]
    beforeEach(async () => {
      mockWorkspace = createMockWorkspace([])
      changes = [...(await commands.fetch(mockWorkspace, mockGetConfigFromUser)).changes]
        .map(change => change.change)
    })

    it('should return newly fetched elements', () => {
      expect(changes.map(change => change.action)).toEqual(['add', 'add', 'add'])
    })
    it('should add newly fetched elements to state', () => {
      expect(State.prototype.override).toHaveBeenCalledWith(fetchedElements)
    })
  })
  describe('login', () => {
    const elements: Element[] = [
      new PrimitiveType({
        elemID: new ElemID('salesforce', 'prim'),
        primitive: PrimitiveTypes.STRING,
      }),
    ]
    const { configType } = creator

    it('should persist a new config', async () => {
      const ws = createMockWorkspace(elements)
      const adapters = await commands.login(ws, mockGetConfigFromUser, ['salesforce'])
      expect(adapters.salesforce).toBeDefined()
      expect(ws.flush as jest.FunctionLike).toHaveBeenCalled()
    })

    it('should not persist an existing config', async () => {
      const configInst = await mockGetConfigFromUser(configType)
      const ws = createMockWorkspace([configInst, ...elements])
      const adapters = await commands.login(ws, mockGetConfigFromUser, ['salesforce'])
      expect(adapters.salesforce).toBeDefined()
      expect(ws.flush as jest.FunctionLike).not.toHaveBeenCalled()
    })
  })
})
