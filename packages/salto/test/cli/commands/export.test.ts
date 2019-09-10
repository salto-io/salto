import { ObjectType, InstanceElement } from 'adapter-api'
import * as fs from 'async-file'
import path from 'path'
import * as coreMock from '../../core/mocks/core'
import { Blueprint } from '../../../src/core/blueprint'
import { command } from '../../../src/cli/commands/export'

const mockExportToCsv = coreMock.exportToCsv
jest.mock('../../../src/core/commands', () => ({
  exportToCsv: jest.fn().mockImplementation((
    typeId: string,
    blueprints: Blueprint[],
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>
  ) => mockExportToCsv(typeId, blueprints, fillConfig)),
}))

describe('cli/commands/export.ts', () => {
  it('should run export', async () => {
    const outputPath = path.join(__dirname, '__test_export.csv')
    try {
      // Cleanup before running export
      await fs.delete(outputPath)

      await command([], 'Test', outputPath).execute()
      expect(await fs.exists(outputPath)).toBe(true)
      expect((await fs.readFile(outputPath)).toString()).toMatch(/Id,FirstName,LastName,Email,Gender/s)
      expect((await fs.readFile(outputPath)).toString()).toMatch(/1,"Daile","Limeburn","dlimeburn0@blogs.com","Female"/s)
      expect((await fs.readFile(outputPath)).toString()).toMatch(/2,"Murial","Morson","mmorson1@google.nl","Female"/s)
      expect((await fs.readFile(outputPath)).toString()).toMatch(/3,"Minna","Noe","mnoe2@wikimedia.org","Female"/s)
    } finally {
      await fs.delete(outputPath)
    }
  })
})
