/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import path from 'path'
import tmp from 'tmp-promise'
import {
  dumpCsv, file, readAllCsvContents, SALTO_HOME_VAR,
  Telemetry, telemetrySender, configFromDisk,
} from '@salto-io/core'
import { Spinner } from '../src/types'
import {
  MockWriteStream, mockSpinnerCreator,
} from '../test/mocks'
import { command as fetch } from '../src/commands/fetch'
import { command as importCommand } from '../src/commands/import'
import { command as exportCommand } from '../src/commands/export'
import { command as deleteCommand } from '../src/commands/delete'
import Prompts from '../src/prompts'
import { getCliTelemetry } from '../src/telemetry'
import { runSalesforceLogin } from './helpers/workspace'

const { copyFile, rm, mkdirp, exists } = file

const sfLeadObjectName = 'salesforce.Lead'

let homePath: string
let fetchOutputDir: string
let exportOutputDir: string
let exportOutputFullPath: string
let localStorageDir: string
let telemetry: Telemetry

const configFile = `${__dirname}/../../e2e_test/BP/salto.config/config.bp`
const localWorkspaceConfigFile = `${__dirname}/../../e2e_test/BP/salto.config/local/config.bp`
const exportFile = 'export_test.csv'
const dataFilePath = `${__dirname}/../../e2e_test/CSV/import.csv`

describe('Data migration operations E2E', () => {
  beforeAll(async () => {
    telemetry = telemetrySender({ ...(await configFromDisk()).telemetry, enabled: true }, { installationID: 'e2e-installationID', app: 'e2e' })
    homePath = tmp.dirSync().name
    fetchOutputDir = `${homePath}/salesforce/BP/test_import`
    exportOutputDir = `${homePath}/salesforce/tmp/export`
    exportOutputFullPath = path.join(exportOutputDir, exportFile)

    process.env[SALTO_HOME_VAR] = homePath
    localStorageDir = `${homePath}/e2e-375e3f65-be66-4fdc-a561-4c4f9735db94`
  })
  afterAll(async () => {
    await telemetry.stop(1000)
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
      await rm(fetchOutputDir)
      await mkdirp(`${fetchOutputDir}/salto.config`)
      await mkdirp(localStorageDir)
      await copyFile(configFile, `${fetchOutputDir}/salto.config/config.bp`)
      await copyFile(localWorkspaceConfigFile, `${localStorageDir}/config.bp`)
      await runSalesforceLogin(fetchOutputDir)
      await fetch(
        fetchOutputDir, true, false,
        telemetry, cliOutput,
        spinnerCreator, false, services,
      ).execute()
    })

    it('should save the data in csv file when running export', async () => {
      await exportCommand(
        fetchOutputDir, sfLeadObjectName,
        exportOutputFullPath, getCliTelemetry(telemetry, 'export'), cliOutput
      ).execute()
      expect(await exists(exportOutputFullPath)).toBe(true)
      const exportObjects = await readAllCsvContents(exportOutputFullPath)
      expect(exportObjects.length).toBeGreaterThan(0)
    })

    it('should succeed when running import from a CSV file', async () => {
      await importCommand(
        fetchOutputDir, sfLeadObjectName,
        dataFilePath, getCliTelemetry(telemetry, 'import'), cliOutput,
      ).execute()
      expect(cliOutput.stdout.content).toContain(Prompts.IMPORT_ENDED_SUMMARY(2, 0))
    })

    it('should succeed When running delete instances read from a CSV file', async () => {
      const dataWithIdFileName = 'importWithIds.csv'
      const updatedDataFilePath = path.join(exportOutputDir, dataWithIdFileName)
      await importCommand(
        fetchOutputDir, sfLeadObjectName,
        dataFilePath, getCliTelemetry(telemetry, 'import'), cliOutput,
      ).execute()

      // Replicate the file with the Ids of the created items
      await exportCommand(
        fetchOutputDir, sfLeadObjectName,
        exportOutputFullPath, getCliTelemetry(telemetry, 'fetch'), cliOutput,
      ).execute()
      const exportObjects = await readAllCsvContents(exportOutputFullPath)
      const clark = exportObjects.find(object => object.FirstName === 'Clark' && object.LastName === 'Kent')
      const bruce = exportObjects.find(object => object.FirstName === 'Bruce' && object.LastName === 'Wayne')

      const deletionObjects = await readAllCsvContents(dataFilePath)
      deletionObjects[0].Id = clark.Id
      deletionObjects[1].Id = bruce.Id

      await dumpCsv(deletionObjects, updatedDataFilePath, false)

      await deleteCommand(fetchOutputDir, sfLeadObjectName,
        updatedDataFilePath, getCliTelemetry(telemetry, 'delete'), cliOutput).execute()
      expect(cliOutput.stdout.content).toContain(Prompts.DELETE_ENDED_SUMMARY(2, 0))
    })
  })

  describe('When fetch is not run beforehand', () => {
    beforeAll(async () => {
      await rm(exportOutputDir)
      await rm(fetchOutputDir)
      await mkdirp(`${fetchOutputDir}/salto.config`)
      await mkdirp(localStorageDir)
      await copyFile(configFile, `${fetchOutputDir}/salto.config/config.bp`)
      await copyFile(localWorkspaceConfigFile, `${localStorageDir}/config.bp`)
    })

    it('should fail when running export', async () => {
      const command = exportCommand(
        fetchOutputDir, sfLeadObjectName,
        exportOutputFullPath, getCliTelemetry(telemetry, 'export'), cliOutput,
      )
      await expect(command.execute()).rejects
        .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto fetch yet?`)
      expect(await exists(exportOutputFullPath)).toBe(false)
    })

    it('should fail when running import from a CSV file', async () => {
      const command = importCommand(
        fetchOutputDir, sfLeadObjectName,
        dataFilePath, getCliTelemetry(telemetry, 'import'), cliOutput,
      )
      await expect(command.execute()).rejects
        .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto fetch yet?`)
    })

    it('should fail when running delete instances read from a CSV file', async () => {
      const command = deleteCommand(fetchOutputDir, sfLeadObjectName,
        dataFilePath, getCliTelemetry(telemetry, 'delete'), cliOutput)
      await expect(command.execute()).rejects
        .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto fetch yet?`)
    })
  })
})
