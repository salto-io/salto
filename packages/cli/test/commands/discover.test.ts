import { ObjectType, InstanceElement } from 'adapter-api'
import { Blueprint, dumpBlueprints as dumpBlueprintsMock } from 'salto'
import path from 'path'
import { discover } from '../mocks'
import { command } from '../../src/commands/discover'


const mockDiscover = discover
jest.mock('salto', () => ({
  discover: jest.fn().mockImplementation((
    blueprints: Blueprint[],
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>
  ) => mockDiscover(blueprints, fillConfig)),
  dumpBlueprints: jest.fn().mockImplementation((_blueprints: Blueprint[]) => { }),
}))

describe('discover command', () => {
  it('should run discover', async () => {
    const outputDir = path.join(__dirname, '__test_discover')
    await command([], outputDir).execute()

    const dump = (dumpBlueprintsMock as jest.Mock).mock.calls[0][0]
    expect(dump).toHaveLength(1)
    expect(dump[0].filename).toBe(`${outputDir}/none.bp`)
    expect(dump[0].buffer.toString()).toMatch('asd')
  })
})
