import * as saltoImp from 'salto'
import { Value } from 'adapter-api'
import { getConfigFromUser } from '../../src/callbacks'
import { MockWriteStream, importFromCsvFile as mockImportFromCsv, getWorkspaceErrors } from '../mocks'
import { command } from '../../src/commands/import'
import Prompts from '../../src/prompts'

const workspaceDir = `${__dirname}/../../../test/BP`
let mockExistsReturn = Promise.resolve(true)
jest.mock('async-file', () => ({
  ...(require.requireActual('async-file')),
  exists: jest.fn().mockImplementation(() => mockExistsReturn),
}))


let importFromCsvSpy: jest.Mock<unknown>
const testCsvMockReturnValues: Value[] = []
let readCsvSpy: jest.Mock<unknown>

describe('import command', () => {
  const mockWS = { hasErrors: () => false, errors: {}, getWorkspaceErrors }
  it('should run import successfully if given a correct path to a real CSV file', async () => {
    mockExistsReturn = Promise.resolve(true)

    readCsvSpy = jest.spyOn(saltoImp, 'readCsv').mockImplementation(() => Promise.resolve(testCsvMockReturnValues))
    importFromCsvSpy = jest.spyOn(saltoImp, 'importFromCsvFile').mockImplementation(() => mockImportFromCsv())
    const loadSpy = jest.spyOn(saltoImp.Workspace, 'load').mockImplementation(() => mockWS)
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command(workspaceDir, 'mockName', 'mockPath', cliOutput).execute()
    expect(readCsvSpy.mock.calls[0][0]).toBe('mockPath')
    expect(importFromCsvSpy).toHaveBeenCalledWith('mockName', [], mockWS, getConfigFromUser)
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
    expect(loadSpy).toHaveBeenCalled()
  })

  it('should fail if given a wrong path for a CSV file', async () => {
    mockExistsReturn = Promise.resolve(false)
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command(workspaceDir, '', '', cliOutput).execute()
    expect(cliOutput.stderr.content).toMatch(Prompts.COULD_NOT_FIND_FILE)
  })
  it('should fail of workspace load failed', async () => {
    mockExistsReturn = Promise.resolve(true)
    mockWS.hasErrors = () => true
    mockWS.errors = { strings: () => ['Error'] }
    const loadSpy = jest.spyOn(saltoImp.Workspace, 'load').mockImplementation(() => mockWS)
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command(workspaceDir, '', '', cliOutput).execute()
    expect(loadSpy).toHaveBeenCalled()
    expect(cliOutput.stderr.content).toContain('Error')
  })
})
