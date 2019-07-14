import * as fs from 'async-file'
import path from 'path'
import {
  ElemID, PrimitiveType, PrimitiveTypes, InstanceElement, ObjectType,
} from 'adapter-api'
import SalesforceAdapter from 'salesforce-adapter'
import { SaltoCore, Blueprint } from '../../src/core/core'

async function getConfigFromUser(configType: ObjectType): Promise<InstanceElement> {
  const value = {
    username: 'test@test',
    password: 'test',
    token: 'test',
    sandbox: false,
  }

  const elemID = new ElemID({ adapter: 'salesforce' })
  return new InstanceElement(elemID, configType, value)
}

const mockAdd = jest.fn(async ap => {
  if (ap.elemID.name === 'fail') {
    throw new Error('failed')
  }
  return true
})

const mockDiscover = jest.fn(() => [
  new PrimitiveType({
    elemID: new ElemID({ adapter: 'salesforce', name: 'dummy' }),
    primitive: PrimitiveTypes.STRING,
  }),
])

jest.mock('salesforce-adapter', () => jest.fn().mockImplementation(() => ({
  add: mockAdd,
  discover: mockDiscover,
})))

const mockGetConfigType = jest.fn(() => {
  const simpleString = new PrimitiveType({
    elemID: new ElemID({ adapter: '', name: 'string' }),
    primitive: PrimitiveTypes.STRING,
  })

  const simpleBoolean = new PrimitiveType({
    elemID: new ElemID({ adapter: '', name: 'boolean' }),
    primitive: PrimitiveTypes.BOOLEAN,
  })

  const config = new ObjectType({
    elemID: new ElemID({ adapter: 'salesforce' }),
    fields: {
      username: simpleString,
      password: simpleString,
      token: simpleString,
      sandbox: simpleBoolean,
    },
    annotations: {},
    annotationsValues: {},
  })

  return config
})

SalesforceAdapter.getConfigType = mockGetConfigType.bind(SalesforceAdapter)


describe('Test core.ts', () => {
  const core = new SaltoCore({
    getConfigFromUser,
  })

  const blueprintsDirectory = path.join(__dirname, '../../test', 'blueprints')

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
      expect.arrayContaining(['salesforce_test', 'salesforce_test2']),
    )
  })

  it('should throw an error if the bp is not valid2', async () => {
    const blueprints = await readBlueprints('error.bp')
    await expect(core.getAllElements(blueprints)).rejects.toThrow()
  })

  it('should throw error on missing adapter', async () => {
    const blueprints = await readBlueprints('missing.bp')
    await expect(core.apply(blueprints, false)).rejects.toThrow()
  })

  it('should throw error on adapter fail', async () => {
    const blueprints = await readBlueprints('fail.bp')
    await expect(core.apply(blueprints, false)).rejects.toThrow()
  })

  describe('given a valid blueprint', () => {
    let blueprints: Blueprint[]
    beforeEach(async () => {
      blueprints = await readBlueprints('salto.bp')
    })

    it('should create an apply plan', async () => {
      await core.apply(blueprints, true)
    })

    it('should apply an apply plan', async () => {
      await core.apply(blueprints)
      expect(core.adapters.salesforce.add).toHaveBeenCalled()
    })
  })

  describe('discover', () => {
    it('should return blueprint', async () => {
      const bp = await core.discover([])
      expect(bp.buffer.toString()).toMatch(/type "?salesforce_dummy"? "?is"? "?string"?/)
    })
  })
})
