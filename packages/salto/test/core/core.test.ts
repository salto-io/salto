import * as fs from 'async-file'
import path from 'path'
import {
  ElemID, InstanceElement, ObjectType, AdapterCreator, Field, BuiltinTypes,
} from 'adapter-api'
import * as commands from '../../src/core/commands'
import State from '../../src/state/state'
import { Blueprint, getAllElements } from '../../src/core/blueprint'
import adapterCreators from '../../src/core/adapters/creators'
import { Plan } from '../../src/core/plan'

const mockAdd = jest.fn(async ap => {
  if (ap.elemID.name === 'fail') {
    throw new Error('failed')
  }
  return true
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

const mockRemove = jest.fn(_a => true)

const mockUpdate = jest.fn((_b, _a) => true)

const mockDiscover = jest.fn(() => {
  const objType = new ObjectType({ elemID: new ElemID('salesforce', 'dummy') })
  return [
    objType,
    new InstanceElement(new ElemID('salesforce', 'instance_1'), objType, {}, ['records', 'dummy']),
    new InstanceElement(new ElemID('salesforce', 'instance_2'), objType, {}, ['records', 'dummy']),
  ]
})

const mockGetInstancesOfType = jest.fn(() => Promise.resolve([]))
const mockImportInstancesOfType = jest.fn()

const mockAdapterCreator: AdapterCreator = {
  create: () => ({
    discover: mockDiscover,
    add: mockAdd,
    remove: mockRemove,
    update: mockUpdate,
    getInstancesOfType: mockGetInstancesOfType,
    importInstancesOfType: mockImportInstancesOfType,
  }),
  configType: mockConfigType,
}

jest.mock('../../src/core/adapters/creators')
jest.mock('../../src/state/state')

adapterCreators.salesforce = mockAdapterCreator

describe('Test commands.ts and core.ts', () => {
  beforeEach(() => {
    // Mock empty state
    State.prototype.get = jest.fn().mockImplementation(() => Promise.resolve([]))
    State.prototype.flush = jest.fn().mockImplementation(() => Promise.resolve())
    State.prototype.override = jest.fn().mockImplementation(() => Promise.resolve())
    State.prototype.remove = jest.fn().mockImplementation(() => Promise.resolve())
    State.prototype.update = jest.fn().mockImplementation(() => Promise.resolve())
  })

  const blueprintsDirectory = path.join(__dirname, '../../../test', 'blueprints')

  const readBlueprints = (...filenames: string[]): Promise<Blueprint[]> => Promise.all(
    filenames.map(async (filename: string) => ({
      buffer: await fs.readFile(path.join(blueprintsDirectory, filename), 'utf8'),
      filename,
    }))
  )

  const mockShouldApplyYes = async (_plan: Plan): Promise<boolean> => true

  const mockReportCurrentAction = jest.fn()

  const mockGetConfigFromUser = async (
    configType: ObjectType
  ): Promise<InstanceElement> => {
    const value = {
      username: 'test@test',
      password: 'test',
      token: 'test',
      sandbox: false,
    }

    const elemID = new ElemID('salesforce')
    return new InstanceElement(elemID, configType, value)
  }

  it('Should return all elements in the blueprint', async () => {
    const blueprints = await readBlueprints('salto.bp', 'salto2.bp')
    const elements = await getAllElements(blueprints)
    const fullNames = elements.map(e => e.elemID.getFullName())
    expect(fullNames).toEqual(
      expect.arrayContaining(['salesforce', 'salesforce_test', 'salesforce_test2']),
    )
  })

  it('should throw an error if the bp is not valid2', async () => {
    const blueprints = await readBlueprints('error.bp')
    await expect(getAllElements(blueprints)).rejects.toThrow()
  })

  it('should throw error on missing adapter', async () => {
    const blueprints = await readBlueprints('missing.bp')
    await expect(commands.apply(
      blueprints,
      mockGetConfigFromUser,
      mockShouldApplyYes,
      mockReportCurrentAction
    )).rejects.toThrow()
  })

  it('should throw error on adapter fail', async () => {
    const blueprints = await readBlueprints('fail.bp')
    await expect(commands.apply(
      blueprints,
      mockGetConfigFromUser,
      mockShouldApplyYes,
      mockReportCurrentAction
    )).rejects.toThrow()
  })

  describe('given a valid blueprint', () => {
    let blueprints: Blueprint[]
    beforeEach(async () => {
      blueprints = await readBlueprints('salto.bp')
    })

    it('should create an apply plan using the plan method', async () => {
      await commands.plan(
        blueprints,
      )
    })

    it('should apply an apply plan', async () => {
      await commands.apply(
        blueprints,
        mockGetConfigFromUser,
        mockShouldApplyYes,
        mockReportCurrentAction
      )
      expect(mockAdd).toHaveBeenCalled()
    })

    it('should apply plan with remove based on state', async () => {
      State.prototype.get = jest.fn().mockImplementation(() =>
        Promise.resolve([new ObjectType({ elemID: new ElemID('salesforce', 'employee') })]))
      await commands.apply(
        blueprints,
        mockGetConfigFromUser,
        mockShouldApplyYes,
        mockReportCurrentAction
      )
      expect(mockAdd).toHaveBeenCalled()
      expect(mockRemove).toHaveBeenCalled()
    })

    it('should apply plan with modification based on state', async () => {
      const mockStateGet = jest.fn().mockImplementation(() =>
        Promise.resolve([new ObjectType({ elemID: new ElemID('salesforce', 'test') })]))
      State.prototype.get = mockStateGet
      const mockStateUpdate = jest.fn().mockImplementation(() => Promise.resolve())
      State.prototype.update = mockStateUpdate
      await commands.apply(
        blueprints,
        mockGetConfigFromUser,
        mockShouldApplyYes,
        mockReportCurrentAction
      )
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStateGet).toHaveBeenCalled()
      expect(mockStateUpdate).toHaveBeenCalled()
    })
  })

  describe('discover', () => {
    it('should return blueprint', async () => {
      const bps = await commands.discover([], mockGetConfigFromUser)
      expect(bps).toHaveLength(3)
      expect(bps[0].filename).toBe('config')
      expect(bps[1].buffer.toString()).toMatch(/type "?salesforce_dummy"? {/)
      // Both instances should be dumped to the same path
      expect(bps[2].buffer.toString()).toMatch(/instance_1/)
      expect(bps[2].buffer.toString()).toMatch(/instance_2/)
      expect(bps[2].filename).toEqual(path.join('records', 'dummy'))
    })
  })
})
