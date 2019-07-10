import * as fs from 'async-file'
import path from 'path'
import {
  ElemID, PrimitiveType, PrimitiveTypes, InstanceElement, ObjectType,
} from 'adapter-api'
import SalesforceAdapter from 'salesforce-adapter'
import { SaltoCore } from '../../src/core/core'

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

  it('Should return all elements in the blueprint', async () => {
    const blueprints = [{
      buffer: await fs.readFile(path.join(__dirname, '..', 'blueprints', 'salto.bp'), 'utf8'),
      filename: 'salto.bp',
    },
    {
      buffer: await fs.readFile(path.join(__dirname, '..', 'blueprints', 'salto2.bp'), 'utf8'),
      filename: 'salto2.bp',
    },
    ]
    const elements = await core.getAllElements(blueprints)
    const fullNames = elements.map(e => e.elemID.getFullName())
    expect(fullNames).toEqual(
      expect.arrayContaining(['salesforce_test', 'salesforce_test2']),
    )
  })

  it('should throw an error if the bp is not valid', async () => {
    const blueprint = {
      buffer: await fs.readFile(path.join(__dirname, '..', 'blueprints', 'error.bp'), 'utf8'),
      filename: 'error.bp',
    }
    await expect(core.getAllElements([blueprint])).rejects.toThrow()
  })

  it('should create an apply plan', async () => {
    const blueprint = {
      buffer: await fs.readFile(path.join(__dirname, '..', 'blueprints', 'salto.bp'), 'utf8'),
      filename: 'salto.bp',
    }
    await core.apply([blueprint], true)
  })

  it('should apply an apply plan', async () => {
    const blueprint = {
      buffer: await fs.readFile(path.join(__dirname, '..', 'blueprints', 'salto.bp'), 'utf8'),
      filename: 'salto.bp',
    }
    await core.apply([blueprint])
    expect(core.adapters.salesforce.add).toHaveBeenCalled()
  })

  it('should throw error on missing adapter', async () => {
    const blueprint = {
      buffer: await fs.readFile(path.join(__dirname, '..', 'blueprints', 'missing.bp'), 'utf8'),
      filename: 'salto.bp',
    }
    await expect(core.apply([blueprint], false)).rejects.toThrow()
  })

  it('should throw error on adapter fail', async () => {
    const blueprint = {
      buffer: await fs.readFile(path.join(__dirname, '..', 'blueprints', 'fail.bp'), 'utf8'),
      filename: 'salto.bp',
    }
    await expect(core.apply([blueprint], false)).rejects.toThrow()
  })

  describe('discover', () => {
    it('should return blueprint', async () => {
      const bp = await core.discover([])
      expect(bp.buffer.toString()).toMatch(/type "?salesforce_dummy"? "?is"? "?string"?/)
    })
  })
})
