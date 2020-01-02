import path from 'path'
import tmp from 'tmp-promise'
import {
  dumpCsv, file, readAllCsvContents, SALTO_HOME_VAR,
} from 'salto'
import { Spinner } from '../src/types'
import { MockWriteStream, mockSpinnerCreator } from '../test/mocks'
import { command as fetch } from '../src/commands/fetch'
import { command as importCommand } from '../src/commands/import'
import { command as exportCommand } from '../src/commands/export'
import { command as deleteCommand } from '../src/commands/delete'
import adapterConfigs from './adapter_configs'
import Prompts from '../src/prompts'
import * as callbacksImpl from '../src/callbacks'

const { copyFile, rm, mkdirp, exists } = file

const sfLeadObjectName = 'salesforce.lead'

let homePath: string
let fetchOutputDir: string
let exportOutputDir: string
let exportOutputFullPath: string

const configFile = `${__dirname}/../../e2e_test/BP/salto.config/config.bp`
const exportFile = 'export_test.csv'
const dataFilePath = `${__dirname}/../../e2e_test/CSV/import.csv`

jest.spyOn(callbacksImpl, 'getConfigFromUser').mockImplementation(
  () => Promise.resolve(adapterConfigs.salesforce())
)

describe('Data migration operations E2E', () => {
  beforeAll(() => {
    homePath = tmp.dirSync().name
    fetchOutputDir = `${homePath}/salesforce/BP/test_import`
    exportOutputDir = `${homePath}/salesforce/tmp/export`
    exportOutputFullPath = path.join(exportOutputDir, exportFile)

    process.env[SALTO_HOME_VAR] = homePath
  })
  afterAll(async () => {
    await rm(homePath)
  })

  jest.setTimeout(15 * 60 * 1000)
  const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  const spinners = [] as Spinner[]
  const spinnerCreator = mockSpinnerCreator(spinners)
  const services = ['salesforce']
  describe('When running fetch beforehand', () => {
    beforeAll(async () => {
      await rm(exportOutputDir)
      await rm(exportOutputDir)
      await rm(fetchOutputDir)
      await mkdirp(`${fetchOutputDir}/salto.config`)
      await copyFile(configFile, `${fetchOutputDir}/salto.config/config.bp`)
      await fetch(fetchOutputDir, true, false, cliOutput, spinnerCreator, services).execute()
    })

    it('should save the data in csv file when running export', async () => {
      await exportCommand(fetchOutputDir, sfLeadObjectName,
        exportOutputFullPath, cliOutput).execute()
      expect(await exists(exportOutputFullPath)).toBe(true)
      const exportObjects = await readAllCsvContents(exportOutputFullPath)
      expect(exportObjects.length).toBeGreaterThan(0)
    })

    it('should succeed when running import from a CSV file', async () => {
      await importCommand(fetchOutputDir, sfLeadObjectName, dataFilePath, cliOutput).execute()
      expect(cliOutput.stdout.content).toContain(Prompts.IMPORT_ENDED_SUMMARY(2, 0))
    })

    it('should succeed When running delete instances read from a CSV file', async () => {
      const dataWithIdFileName = 'importWithIds.csv'
      const updatedDataFilePath = path.join(exportOutputDir, dataWithIdFileName)
      await importCommand(fetchOutputDir, sfLeadObjectName, dataFilePath, cliOutput).execute()

      // Replicate the file with the Ids of the created items
      await exportCommand(fetchOutputDir, sfLeadObjectName,
        exportOutputFullPath, cliOutput).execute()
      const exportObjects = await readAllCsvContents(exportOutputFullPath)
      const clark = exportObjects.find(object => object.FirstName === 'Clark' && object.LastName === 'Kent')
      const bruce = exportObjects.find(object => object.FirstName === 'Bruce' && object.LastName === 'Wayne')

      const deletionObjects = await readAllCsvContents(dataFilePath)
      deletionObjects[0].Id = clark.Id
      deletionObjects[1].Id = bruce.Id

      await dumpCsv(deletionObjects, updatedDataFilePath, false)

      await deleteCommand(fetchOutputDir, sfLeadObjectName,
        updatedDataFilePath, cliOutput).execute()
      expect(cliOutput.stdout.content).toContain(Prompts.DELETE_ENDED_SUMMARY(2, 0))
    })
  })

  describe('When fetch is not run beforehand', () => {
    beforeAll(async () => {
      await rm(exportOutputDir)
      await rm(fetchOutputDir)
      await mkdirp(`${fetchOutputDir}/salto.config`)
      await copyFile(configFile, `${fetchOutputDir}/salto.config/config.bp`)
    })

    it('should fail when running export', async () => {
      const command = exportCommand(fetchOutputDir, sfLeadObjectName,
        exportOutputFullPath, cliOutput)
      await expect(command.execute()).rejects
        .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto fetch yet?`)
      expect(await exists(exportOutputFullPath)).toBe(false)
    })

    it('should fail when running import from a CSV file', async () => {
      const command = importCommand(fetchOutputDir, sfLeadObjectName,
        dataFilePath, cliOutput)
      await expect(command.execute()).rejects
        .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto fetch yet?`)
    })

    it('should fail when running delete instances read from a CSV file', async () => {
      const command = deleteCommand(fetchOutputDir, sfLeadObjectName,
        dataFilePath, cliOutput)
      await expect(command.execute()).rejects
        .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto fetch yet?`)
    })
  })
})
