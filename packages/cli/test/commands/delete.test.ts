import * as asyncfile from 'async-file'
import path from 'path'
import { MockWriteStream, deleteFromCsvFile as mockDeleteFromCsv } from '../mocks'
import { command } from '../../src/commands/delete'
import Prompts from '../../src/prompts'

jest.mock('salto', () => ({
  deleteFromCsvFile: jest.fn().mockImplementation((
  ) => mockDeleteFromCsv()),
  readCsv: jest.fn().mockImplementation(() => { }),
}))

const inputDir = path.join(__dirname, 'temp')
const inputPath = path.join(inputDir, 'import_test.csv')

describe('delete command', () => {
  afterEach(async () => {
    await asyncfile.delete(inputDir)
  })
  
  it('should run import successfully if given a correct path to a real CSV file', async () => {
    await asyncfile.createDirectory(inputDir)
    await asyncfile.writeTextFile(inputPath, '\n')
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], inputPath, '', cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.DELETE_FINISHED_SUCCESSFULLY)
  })

  it('should fail if given a wrong path for a CSV file', async () => {
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], '', '', cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.COULD_NOT_FIND_FILE)
  })
})
