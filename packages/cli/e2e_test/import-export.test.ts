import path from 'path'
import * as fs from 'async-file'
import { loadBlueprints, STATEPATH } from 'salto'
import { InstanceElement } from 'adapter-api'
import { command as discover } from '../src/commands/discover'
import { command as exportCommand } from '../src/commands/export'
import adapterConfigs from './adapter_configs'

const sfLeadObjectName = 'salesforce_lead'

const mockGetConfigType = (): InstanceElement => adapterConfigs.salesforce()

// Attempting to access the functions on run time without the mock implementation, or
// omitting the mock prefix in their names (YES I KNOW) will result in a runtime exception
// to be thrown
jest.mock('../src/callbacks', () => ({
  getConfigFromUser: jest.fn().mockImplementation(() => mockGetConfigType()),
}))

describe('Test import-export commands e2e', () => {
  const pathExists = async (p: string): Promise<boolean> => fs.exists(p)
  const homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  const discoverOutputDir = `${homePath}/BP/test_discover`
  const exportOutputDir = `${homePath}/tmp/export`
  const exportFile = 'export_test.csv'

  beforeEach(async () => {
    await fs.delete(discoverOutputDir)
    await fs.delete(exportOutputDir)
    await fs.delete(STATEPATH)
  })

  jest.setTimeout(5 * 60 * 1000)

  it('should run export and save the data in csv file after discover', async () => {
    await discover(await loadBlueprints([]), discoverOutputDir).execute()
    const exportOutputFullPath = path.join(exportOutputDir, exportFile)
    await exportCommand(await loadBlueprints([], discoverOutputDir), sfLeadObjectName,
      exportOutputFullPath).execute()
    expect(await pathExists(exportOutputFullPath)).toBe(true)
  })

  it('should fail export if discover was not run beforehand', async () => {
    const exportOutputFullPath = path.join(exportOutputDir, exportFile)
    const command = exportCommand(await loadBlueprints([], discoverOutputDir), sfLeadObjectName,
      exportOutputFullPath)
    await expect(command.execute()).rejects
      .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto discover yet?`)
    expect(await pathExists(exportOutputFullPath)).toBe(false)
  })
})
