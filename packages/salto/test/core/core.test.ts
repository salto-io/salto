
import * as fs from 'async-file'
import path from 'path'
import { TypeID, PrimitiveType, PrimitiveTypes } from 'adapter-api'
import { SaltoCore } from '../../src/core/core'

describe('Test core.ts', () => {
  const core = new SaltoCore()
  core.adapters.salesforce.add = jest.fn(async ap => {
    if (ap.typeID.name === 'fail') {
      return false
    }
    return true
  })
  core.adapters.salesforce.discover = jest.fn(() => [
    new PrimitiveType({
      typeID: new TypeID({ adapter: 'salesforce', name: 'dummy' }),
      primitive: PrimitiveTypes.STRING,
    }),
  ])

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
    const fullNames = elements.map(e => e.typeID.getFullName())
    expect(fullNames).toEqual(
      expect.arrayContaining(['salesforce_test', 'salesforce_test2', 'string']),
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
      const bp = await core.discover()
      expect(bp.buffer.toString()).toMatch(/type "?salesforce_dummy"? "?is"? "?string"?/)
    })
  })
})
