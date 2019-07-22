import * as fs from 'async-file'
import path from 'path'
import {
  ElemID, PrimitiveType, PrimitiveTypes, InstanceElement, ObjectType, Field,
  Plan,
} from 'adapter-api'
import * as core from '../../src/core/core'
import State from '../../src/state/state'
import Blueprint from '../../src/core/blueprint'

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

const mockShouldApplyYes = async (_plan: Plan): Promise<boolean> => true

// const mockShouldApplyNo = async (_plan: Plan): Promise<boolean> => false

const mockReportCurrentAction = jest.fn()

const mockAdd = jest.fn(async ap => {
  if (ap.elemID.name === 'fail') {
    throw new Error('failed')
  }
  return true
})

const mockGetConfigType = jest.fn(() => {
  const simpleString = new PrimitiveType({
    elemID: new ElemID('', 'string'),
    primitive: PrimitiveTypes.STRING,
  })

  const simpleBoolean = new PrimitiveType({
    elemID: new ElemID('', 'boolean'),
    primitive: PrimitiveTypes.BOOLEAN,
  })

  const configID = new ElemID('salesforce')
  const config = new ObjectType({
    elemID: configID,
    fields: {
      username: new Field(configID, 'username', simpleString),
      password: new Field(configID, 'password', simpleString),
      token: new Field(configID, 'token', simpleString),
      sandbox: new Field(configID, 'sandbox', simpleBoolean),
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
  new PrimitiveType({
    elemID: new ElemID('salesforce', 'dummy'),
    primitive: PrimitiveTypes.STRING,
  }),
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

describe('Test core.ts', () => {
  // Mock empty state
  jest.mock('../../src/state/state')
  State.prototype.getLastState = jest.fn().mockImplementation(() => Promise.resolve([]))
  State.prototype.saveState = jest.fn().mockImplementation(() => Promise.resolve())

  // Mock get config from user

  const blueprintsDirectory = path.join(__dirname, '../../../test', 'blueprints')

  const readBlueprints = (...filenames: string[]): Promise<Blueprint[]> => Promise.all(
    filenames.map(async (filename: string) => ({
      buffer: await fs.readFile(path.join(blueprintsDirectory, filename), 'utf8'),
      filename,
    }))
  )

  it('Should return all elements in the blueprint', async () => {
    const blueprints = await readBlueprints('salto.bp', 'salto2.bp')
    const elements = await core.getAllElements(blueprints)
    const fullNames = elements.map(e => e.elemID.getFullName())
    expect(fullNames).toEqual(
      expect.arrayContaining(['salesforce', 'salesforce_test', 'salesforce_test2']),
    )
  })

  it('should throw an error if the bp is not valid2', async () => {
    const blueprints = await readBlueprints('error.bp')
    await expect(core.getAllElements(blueprints)).rejects.toThrow()
  })

  it('should throw error on missing adapter', async () => {
    const blueprints = await readBlueprints('missing.bp')
    await expect(core.apply(
      blueprints,
      mockGetConfigFromUser,
      mockShouldApplyYes,
      mockReportCurrentAction
    )).rejects.toThrow()
  })

  it('should throw error on adapter fail', async () => {
    const blueprints = await readBlueprints('fail.bp')
    await expect(core.apply(
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
      await core.plan(
        blueprints,
      )
    })

    it('should apply an apply plan', async () => {
      await core.apply(
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
      await core.apply(
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
      await core.apply(
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
      const bp = await core.discover([], mockGetConfigFromUser)
      expect(bp.buffer.toString()).toMatch(/type "?salesforce_dummy"? "?is"? "?string"?/)
    })
  })
})
