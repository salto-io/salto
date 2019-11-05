import * as saltoImp from 'salto'
import { Value } from 'adapter-api'
import { getConfigFromUser } from '../../src/callbacks'
import { MockWriteStream, deleteFromCsvFile as mockDeleteFromCsv, getWorkspaceErrors } from '../mocks'
import { command } from '../../src/commands/delete'
import Prompts from '../../src/prompts'

const { file } = saltoImp
let deleteFromCsvSpy: jest.Mock<unknown>
const testCsvMockReturnValues: Value[] = []
let readCsvSpy: jest.Mock<unknown>
const workspaceDir = `${__dirname}/../../../test/BP`
describe('delete command', () => {
  let existsReturn = true

  beforeEach(() => {
    jest.spyOn(file, 'exists').mockImplementation(() => Promise.resolve(existsReturn))
  })

  const mockWS = { hasErrors: () => false, errors: {}, getWorkspaceErrors }
  it('should run delete successfully if CSV file is found', async () => {
    existsReturn = true

    readCsvSpy = jest.spyOn(saltoImp, 'readCsv').mockImplementation(() => Promise.resolve(testCsvMockReturnValues))
    deleteFromCsvSpy = jest.spyOn(saltoImp, 'deleteFromCsvFile').mockImplementation(() => mockDeleteFromCsv())
    const loadSpy = jest.spyOn(saltoImp.Workspace, 'load').mockImplementation(() => mockWS)
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command(workspaceDir, 'mockName', 'mockPath', cliOutput).execute()
    expect(readCsvSpy.mock.calls[0][0]).toBe('mockPath')
    expect(deleteFromCsvSpy).toHaveBeenCalledWith('mockName', [], mockWS, getConfigFromUser)
    expect(cliOutput.stdout.content).toMatch(Prompts.DELETE_FINISHED_SUCCESSFULLY)
    expect(loadSpy).toHaveBeenCalled()
  })

  it('should fail if CSV file is not found', async () => {
    existsReturn = false
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command(workspaceDir, '', '', cliOutput).execute()
    expect(cliOutput.stderr.content).toMatch(Prompts.COULD_NOT_FIND_FILE)
  })
  it('should fail of workspace load failed', async () => {
    mockWS.hasErrors = () => true
    mockWS.errors = { strings: () => ['Error'] }
    mockWS.getWorkspaceErrors = getWorkspaceErrors
    existsReturn = true
    readCsvSpy = jest.spyOn(saltoImp, 'readCsv').mockImplementation(() => Promise.resolve(testCsvMockReturnValues))
    deleteFromCsvSpy = jest.spyOn(saltoImp, 'deleteFromCsvFile').mockImplementation(() => mockDeleteFromCsv())
    const loadSpy = jest.spyOn(saltoImp.Workspace, 'load').mockImplementation(() => mockWS)
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command(workspaceDir, 'mockName', 'mockPath', cliOutput).execute()
    expect(loadSpy).toHaveBeenCalled()
    expect(cliOutput.stderr.content).toContain('Error')
  })
})
