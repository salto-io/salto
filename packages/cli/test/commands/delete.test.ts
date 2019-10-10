import * as saltoImp from 'salto'
import { Value } from 'adapter-api'
import { getConfigFromUser } from '../../src/callbacks'
import { MockWriteStream, deleteFromCsvFile as mockDeleteFromCsv } from '../mocks'
import { command } from '../../src/commands/delete'
import Prompts from '../../src/prompts'

let mockExistsReturn = Promise.resolve(true)
jest.mock('async-file', () => ({
  exists: jest.fn().mockImplementation(() => mockExistsReturn),
}))

let deleteFromCsvSpy: jest.Mock<unknown>
const testCsvMockReturnValues: Value[] = []
let readCsvSpy: jest.Mock<unknown>

describe('delete command', () => {
  it('should run delete successfully if CSV file is found', async () => {
    mockExistsReturn = Promise.resolve(true)
    readCsvSpy = jest.spyOn(saltoImp.csv, 'readCsv').mockImplementation(() => Promise.resolve(testCsvMockReturnValues))
    deleteFromCsvSpy = jest.spyOn(saltoImp.api, 'deleteFromCsvFile').mockImplementation(() => mockDeleteFromCsv())
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], 'mockPath', 'mockName', cliOutput).execute()
    expect(readCsvSpy.mock.calls[0][0]).toBe('mockPath')
    expect(deleteFromCsvSpy).toHaveBeenCalledWith('mockName', [], [], getConfigFromUser)
    expect(cliOutput.stdout.content).toMatch(Prompts.DELETE_FINISHED_SUCCESSFULLY)
  })

  it('should fail if CSV file is not found', async () => {
    mockExistsReturn = Promise.resolve(false)
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], '', '', cliOutput).execute()
    expect(cliOutput.stderr.content).toMatch(Prompts.COULD_NOT_FIND_FILE)
  })
})
