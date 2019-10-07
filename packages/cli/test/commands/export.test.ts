import path from 'path'
import { ObjectType, InstanceElement } from 'adapter-api'
import { Workspace, dumpCsv as dumpCsvMock } from 'salto'
import { exportToCsv } from '../mocks'
import { command } from '../../src/commands/export'


const mockExportToCsv = exportToCsv
jest.mock('salto', () => ({
  exportToCsv: jest.fn().mockImplementation((
    workspace: Workspace,
    typeId: string,
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>
  ) => mockExportToCsv(typeId, workspace, fillConfig)),
  Workspace: {
    load: jest.fn(),
  },

  dumpCsv: jest.fn().mockImplementation(() => { }),
}))

describe('export command', () => {
  it('should run export', async () => {
    const outputPath = path.join(__dirname, '__test_export.csv')
    await command('', [], 'Test', outputPath).execute()

    const [objects, output] = (dumpCsvMock as jest.Mock).mock.calls[0]
    expect(objects).toHaveLength(3)
    expect(objects[0].Id).toBe(1)
    expect(objects[0].FirstName).toBe('Daile')
    expect(objects[0].LastName).toBe('Limeburn')
    expect(objects[0].Email).toBe('dlimeburn0@blogs.com')
    expect(objects[0].Gender).toBe('Female')
    expect(output).toBe(outputPath)
    expect(Workspace.load).toHaveBeenCalled()
  })
})
