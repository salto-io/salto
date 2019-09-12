import { ObjectType, InstanceElement } from 'adapter-api'
import * as fs from 'async-file'
import path from 'path'
import * as coreMock from '../../core/mocks/core'
import { Blueprint } from '../../../src/core/blueprint'
import { command } from '../../../src/cli/commands/discover'

const mockDiscover = coreMock.discover
jest.mock('../../../src/core/commands', () => ({
  discover: jest.fn().mockImplementation((
    blueprints: Blueprint[],
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>
  ) => mockDiscover(blueprints, fillConfig)),
}))

describe('discover command', () => {
  it('should run discover', async () => {
    const outputDir = path.join(__dirname, '__test_discover')
    try {
      // Cleanup before running discover
      await fs.delete(outputDir)

      await command([], outputDir).execute()
      const outputPath = path.join(outputDir, 'none.bp')
      expect(await fs.exists(outputDir)).toBeTruthy()
      expect((await fs.readFile(outputPath)).toString()).toMatch('asd')
    } finally {
      await fs.delete(outputDir)
    }
  })
})
