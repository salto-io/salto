import path from 'path'
import * as asyncfile from 'async-file'
import {
  dumpCsv, readCsv,
} from 'salto'
import { InstanceElement } from 'adapter-api'
import { MockWriteStream } from '../test/mocks'
import { command as discover } from '../src/commands/discover'
import { command as importCommand } from '../src/commands/import'
import { command as exportCommand } from '../src/commands/export'
import { command as deleteCommand } from '../src/commands/delete'
import adapterConfigs from './adapter_configs'
import Prompts from '../src/prompts'

const sfLeadObjectName = 'salesforce_lead'

const mockGetConfigType = (): InstanceElement => adapterConfigs.salesforce()
const homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
const discoverOutputDir = `${homePath}/BP/test_import`
const configFile = `${__dirname}/../../e2e_test/BP/salto.config/config.json`

const exportOutputDir = `${homePath}/tmp/export`
const exportFile = 'export_test.csv'
const exportOutputFullPath = path.join(exportOutputDir, exportFile)

const copyFile = async (src: string, dest: string): Promise<void> => (
  asyncfile.writeFile(dest, await asyncfile.readFile(src))
)
// Attempting to access the functions on run time without the mock implementation, or
// omitting the mock prefix in their names (YES I KNOW) will result in a runtime exception
// to be thrown
jest.mock('../src/callbacks', () => ({
  getConfigFromUser: jest.fn().mockImplementation(() => mockGetConfigType()),
}))

describe('When running export', () => {
  const pathExists = async (p: string): Promise<boolean> => asyncfile.exists(p)
  const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }


  beforeEach(async () => {
    await asyncfile.delete(discoverOutputDir)
    await asyncfile.delete(exportOutputDir)
    await asyncfile.mkdirp(`${discoverOutputDir}/salto.config`)
    await copyFile(configFile, `${discoverOutputDir}/salto.config/config.json`)
  })

  jest.setTimeout(5 * 60 * 1000)

  it('should save the data in csv file after discover', async () => {
    await discover(discoverOutputDir, cliOutput).execute()

    await exportCommand(discoverOutputDir, sfLeadObjectName,
      exportOutputFullPath, cliOutput).execute()
    expect(await pathExists(exportOutputFullPath)).toBe(true)
  })

  it('should fail if discover was not run beforehand', async () => {
    const command = exportCommand(discoverOutputDir, sfLeadObjectName,
      exportOutputFullPath, cliOutput)
    await expect(command.execute()).rejects
      .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto discover yet?`)
    expect(await pathExists(exportOutputFullPath)).toBe(false)
  })
})

describe('When running data modifying commands', () => {
  const dataFilePath = `${__dirname}/../../e2e_test/CSV/import.csv`

  beforeEach(async () => {
    await asyncfile.delete(discoverOutputDir)
    await asyncfile.mkdirp(`${discoverOutputDir}/salto.config`)
    await copyFile(configFile, `${discoverOutputDir}/salto.config/config.json`)
  })

  describe('When running import from a CSV file', () => {
    jest.setTimeout(5 * 60 * 1000)

    it('should succeed after discover', async () => {
      const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
      await discover(discoverOutputDir, cliOutput).execute()
      await importCommand(discoverOutputDir, dataFilePath,
        sfLeadObjectName, cliOutput).execute()
      expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
    })

    it('should fail if discover was not run beforehand', async () => {
      const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
      const command = importCommand(discoverOutputDir, dataFilePath,
        sfLeadObjectName, cliOutput)
      await expect(command.execute()).rejects
        .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto discover yet?`)
    })
  })

  describe('When running delete instances read from a CSV file', () => {
    jest.setTimeout(10 * 60 * 1000)

    it('should succeed after discover', async () => {
      const dataWithIdFileName = 'importWithIds.csv'
      const updatedDataFilePath = path.join(exportOutputDir, dataWithIdFileName)
      const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
      await discover(discoverOutputDir, cliOutput).execute()
      await importCommand(discoverOutputDir, dataFilePath,
        sfLeadObjectName, cliOutput).execute()

      // Replicate the file with the Ids of the created items
      await exportCommand(discoverOutputDir, sfLeadObjectName,
        exportOutputFullPath, cliOutput).execute()
      const exportObjects = await readCsv(exportOutputFullPath)
      const clark = exportObjects.find(object => object.FirstName === 'Clark' && object.LastName === 'Kent')
      const bruce = exportObjects.find(object => object.FirstName === 'Bruce' && object.LastName === 'Wayne')

      const deletionObjects = await readCsv(dataFilePath)
      deletionObjects[0].Id = clark.Id
      deletionObjects[1].Id = bruce.Id

      await dumpCsv(deletionObjects, updatedDataFilePath, false)

      await deleteCommand(discoverOutputDir, updatedDataFilePath,
        sfLeadObjectName, cliOutput).execute()
      expect(cliOutput.stdout.content).toMatch(Prompts.DELETE_FINISHED_SUCCESSFULLY)
    })

    it('should fail if discover was not run beforehand', async () => {
      const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
      const command = deleteCommand(discoverOutputDir, dataFilePath,
        sfLeadObjectName, cliOutput)
      await expect(command.execute()).rejects
        .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto discover yet?`)
    })
  })
})
