import * as saltoImp from 'salto'
import { Value } from 'adapter-api'
import { getConfigFromUser } from '../../src/callbacks'
import { MockWriteStream, deleteFromCsvFile as mockDeleteFromCsv } from '../mocks'
import { command } from '../../src/commands/delete'
import Prompts from '../../src/prompts'

let mockExistsReturn = Promise.resolve(true)
jest.mock('async-file', () => ({
  ...(require.requireActual('async-file')),
  exists: jest.fn().mockImplementation(() => mockExistsReturn),
}))

let deleteFromCsvSpy: jest.Mock<unknown>
const testCsvMockReturnValues: Value[] = []
let readCsvSpy: jest.Mock<unknown>
const workspaceDir = `${__dirname}/../../../test/BP`
describe('delete command', () => {
  const mockWS = { hasErrors: () => false }
  it('should run delete successfully if CSV file is found', async () => {
    mockExistsReturn = Promise.resolve(true)

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
    mockExistsReturn = Promise.resolve(false)
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command(workspaceDir, '', '', cliOutput).execute()
    expect(cliOutput.stderr.content).toMatch(Prompts.COULD_NOT_FIND_FILE)
  })
})
