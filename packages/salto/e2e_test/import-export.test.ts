import path from 'path'
import * as fs from 'async-file'
import { InstanceElement } from 'adapter-api'
import {
  discover, exportBase,
} from '../src/cli/commands'
import State from '../src/state/state'
import adapterConfigs from './adapter_configs'

const sfLeadObjectName = 'salesforce_lead'

const mockGetConfigType = (): InstanceElement => adapterConfigs.salesforce()

// Attempting to access the functions on run time without the mock implementation, or
// omitting the mock prefix in their names (YES I KNOW) will result in a runtime exception
// to be thrown
jest.mock('../src/cli/callbacks', () => ({
  getConfigFromUser: jest.fn().mockImplementation(() => mockGetConfigType()),
}))

describe('Test import-export commands e2e', () => {
  const pathExists = async (p: string): Promise<boolean> => fs.exists(p)
  const homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  const { statePath } = new State()
  const discoverOutputDir = `${homePath}/BP/test_discover`
  const exportOutputDir = `${homePath}/tmp/export`
  const exportFile = 'export_test.csv'

  beforeEach(async () => {
    await fs.delete(discoverOutputDir)
    await fs.delete(exportOutputDir)
    await fs.delete(statePath)
  })

  jest.setTimeout(5 * 60 * 1000)

  it('should run export and save the data in csv file after discover', async () => {
    await discover(discoverOutputDir, [])
    const exportOutputFullPath = path.join(exportOutputDir, exportFile)
    await exportBase(sfLeadObjectName, exportOutputFullPath, [])
    expect(await pathExists(exportOutputFullPath)).toBe(true)
  })

  it('should fail export if discover was not run beforehand', async () => {
    const exportOutputFullPath = path.join(exportOutputDir, exportFile)
    await expect(exportBase(sfLeadObjectName, exportOutputFullPath, [])).rejects
      .toThrow(`Couldn't find the type you are looking for: ${sfLeadObjectName}. Have you run salto discover yet?`)
    expect(await pathExists(exportOutputFullPath)).toBe(false)
  })
})
