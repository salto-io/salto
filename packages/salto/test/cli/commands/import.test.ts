import { InstanceElement, ObjectType } from 'adapter-api'
import { Blueprint } from 'src/core/blueprint'
import { Stream } from 'stream'
import * as asyncfile from 'async-file'
import path from 'path'
import * as coreMock from '../../core/mocks/core'
import { command } from '../../../src/cli/commands/import'
import { MockWriteStream } from '../mocks'
import Prompts from '../../../src/cli/prompts'

const mockImportFromCsv = coreMock.importFromCsvFile
jest.mock('../../../src/core/commands', () => ({
  importFromCsvFile: jest.fn().mockImplementation((
    typeId: string,
    csvFile: Stream,
    blueprints: Blueprint[],
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  ) => mockImportFromCsv(typeId, csvFile, blueprints, fillConfig)),
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
    await command([], inputPath, '', cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
  })

  it('should fail if given a wring path for a CSV file', async () => {
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], '', '', cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_COULD_NOT_FIND_FILE)
  })
})
