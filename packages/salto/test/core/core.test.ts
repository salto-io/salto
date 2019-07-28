import * as fs from 'async-file'
import path from 'path'
import {
  ElemID, BuiltinTypes, InstanceElement, ObjectType, Field,
  Plan,
} from 'adapter-api'
import * as commands from '../../src/core/commands'
import State from '../../src/state/state'
import Blueprint from '../../src/core/blueprint'
import { getAllElements } from '../../src/parser/merger'

const mockAdd = jest.fn(async ap => {
  if (ap.elemID.name === 'fail') {
    throw new Error('failed')
  }
  return true
})

const mockGetConfigType = jest.fn(() => {
  const configID = new ElemID('salesforce')
  const config = new ObjectType({
    elemID: configID,
    fields: {
      username: new Field(configID, 'username', BuiltinTypes.STRING),
      password: new Field(configID, 'password', BuiltinTypes.STRING),
      token: new Field(configID, 'token', BuiltinTypes.STRING),
      sandbox: new Field(configID, 'sandbox', BuiltinTypes.BOOLEAN),
    },
    annotations: {},
    annotationsValues: {},
  })

  return config
})

const mockRemove = jest.fn(_a => true)

const mockUpdate = jest.fn((_b, _a) => true)

const mockInit = jest.fn(_a => true)

const mockDiscover = jest.fn(() => [
  new ObjectType({ elemID: new ElemID('salesforce', 'dummy') }),
])

const mockAdapter = {
  getConfigType: mockGetConfigType,
  init: mockInit,
  discover: mockDiscover,
  add: mockAdd,
  remove: mockRemove,
  update: mockUpdate,
}

jest.mock('../../src/core/adapters', () => ({
  init: jest.fn().mockImplementation((_e, _c) => [{ salesforce: mockAdapter }, []]),
}))

describe('Test commands.ts and core.ts', () => {
  // Mock empty state
  jest.mock('../../src/state/state')
  State.prototype.getLastState = jest.fn().mockImplementation(() => Promise.resolve([]))
  State.prototype.saveState = jest.fn().mockImplementation(() => Promise.resolve())

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
      State.prototype.getLastState = jest.fn().mockImplementationOnce(() =>
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
      State.prototype.getLastState = jest.fn().mockImplementationOnce(() =>
        Promise.resolve([new ObjectType({ elemID: new ElemID('salesforce', 'test') })]))
      await commands.apply(
        blueprints,
        mockGetConfigFromUser,
        mockShouldApplyYes,
        mockReportCurrentAction
      )
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe('discover', () => {
    it('should return blueprint', async () => {
      const bp = await commands.discover([], mockGetConfigFromUser)
      expect(bp.buffer.toString()).toMatch(/model "?salesforce_dummy"? {/)
    })
  })
})
