import * as asyncfile from 'async-file'
import path from 'path'
import { MockWriteStream, importFromCsvFile as mockImportFromCsv } from '../mocks'
import { command } from '../../src/commands/import'
import Prompts from '../../src/prompts'

jest.mock('salto', () => ({
  importFromCsvFile: jest.fn().mockImplementation((
  ) => mockImportFromCsv()),
  readCsv: jest.fn().mockImplementation(() => { }),
}))

const inputDir = path.join(__dirname, 'temp')
const inputPath = path.join(inputDir, 'import_test.csv')

describe('import command', () => {
  afterEach(async () => {
    await asyncfile.delete(inputDir)
  })
  it('should run import successfully if given a correct path to a real CSV file', async () => {
    await asyncfile.createDirectory(inputDir)
    await asyncfile.writeTextFile(inputPath, '\n')
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], '', inputPath, cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
  })

  it('should fail if given a wrong path for a CSV file', async () => {
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], '', '', cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_COULD_NOT_FIND_FILE)
  })
})
