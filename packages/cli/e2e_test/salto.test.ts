import * as fs from 'async-file'
import _ from 'lodash'
import {
  testHelpers as salesforceTestHelpers,
  testTypes as salesforceTestTypes,
  SalesforceClient,
} from 'salesforce-adapter'
import {
  InstanceElement, ObjectType, getChangeElement, Change,
} from 'adapter-api'
import {
  Plan,
} from 'salto'
import wu from 'wu'
import { CliOutput } from '../src/types'

import { MockWriteStream, MockSpinner, mockSpinnerCreator } from '../test/mocks'
import { command as discover } from '../src/commands/discover'
import { command as plan } from '../src/commands/plan'
import { ApplyCommand } from '../src/commands/apply'
import adapterConfigs from './adapter_configs'

const credentials = salesforceTestHelpers.credentials()
const mockGetConfigType = (): InstanceElement => adapterConfigs.salesforce()

let cliOutput: CliOutput
let spinner: MockSpinner

let lastPlan: Plan
const mockShouldApply = (p: Plan): boolean => {
  lastPlan = p
  return wu(p.itemsByEvalOrder()).toArray().length < 100 // Safty to avoid breaking the SF instance
}

// Attempting to access the functions on run time without the mock implementation, or
// omitting the mock prefix in their names (YES I KNOW) will result in a runtime exception
// to be thrown
jest.mock('../src/callbacks', () => ({
  getConfigFromUser: jest.fn().mockImplementation(() => mockGetConfigType()),
  shouldApply: jest.fn().mockImplementation(() => mockShouldApply),
}))

describe('commands e2e', () => {
  const pathExists = async (p: string): Promise<boolean> => fs.exists(p)
  const homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  const discoverOutputDir = `${homePath}/BP/test_discover`
  const localStorageDir = `${homePath}/.salto/test_discover`
  const addModelBP = `${__dirname}/../../e2e_test/BP/add.bp`
  const modifyModelBP = `${__dirname}/../../e2e_test/BP/modify.bp`
  const configFile = `${__dirname}/../../e2e_test/BP/salto.config/config.bp`
  const statePath = `${discoverOutputDir}/salto.config/state.bpc`
  const tmpBP = `${discoverOutputDir}/tmp.bp`
  const client = new SalesforceClient({ credentials })

  const copyFile = async (src: string, dest: string): Promise<void> => (
    fs.writeFile(dest, await fs.readFile(src))
  )

  const objectExists = async (
    name: string, fields: string[] = [], missingFields: string[] = []
  ): Promise<boolean> => {
    const result = (
      await client.readMetadata(salesforceTestHelpers.CUSTOM_OBJECT, name)
    )[0] as salesforceTestTypes.CustomObject
    if (!result || !result.fullName) {
      return false
    }
    let fieldNames: string[] = []
    if (result.fields) {
      fieldNames = _.isArray(result.fields) ? result.fields.map(rf => rf.fullName)
        : [result.fields.fullName]
    }
    if (fields && !fields.every(f => fieldNames.includes(f))) {
      return false
    }
    return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
  }

  beforeEach(() => {
    if (lastPlan) {
      lastPlan.clear()
    }
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    spinner = mockSpinnerCreator()({}) as MockSpinner
  })

  jest.setTimeout(5 * 60 * 1000)
  beforeAll(async () => {
    await fs.mkdirp(`${discoverOutputDir}/salto.config`)
    await fs.mkdirp(localStorageDir)
    await copyFile(configFile, `${discoverOutputDir}/salto.config/config.bp`)
    if (await fs.exists(tmpBP)) {
      await fs.delete(tmpBP)
    }
    if (await objectExists('e2etest__c')) {
      // TODO 'CustomObject' is a magic string
      await client.delete('CustomObject', 'e2etest__c')
    }
  })

  afterAll(async () => {
    await fs.delete(discoverOutputDir)
    await fs.delete(localStorageDir)
  })

  it('should run discover and create the state bp file', async () => {
    await discover(discoverOutputDir, true, cliOutput).execute()
    expect(await pathExists(discoverOutputDir)).toBe(true)
    expect(await pathExists(statePath)).toBe(true)
  })

  it('should run plan on discover output and detect no changes', async () => {
    await plan(discoverOutputDir, cliOutput, spinner).execute()
    expect(lastPlan).toBeUndefined()
  })

  it('should apply the new change', async () => {
    await copyFile(addModelBP, tmpBP)
    await new ApplyCommand(discoverOutputDir, false, cliOutput)
      .execute()
    expect(lastPlan.size).toBe(1)
    const step = wu(lastPlan.itemsByEvalOrder()).next().value
    const parent = step.parent() as Change
    expect(parent.action).toBe('add')
    expect(getChangeElement(parent)).toBeInstanceOf(ObjectType)
    expect(await objectExists(
      `${getChangeElement(parent).elemID.name}__c`,
      ['Name__c', 'Test__c']
    )).toBe(true)
  })

  it('should apply changes in the new model', async () => {
    await copyFile(modifyModelBP, tmpBP)
    await new ApplyCommand(discoverOutputDir, false,
      cliOutput).execute()
    expect(lastPlan.size).toBe(1)
    const step = wu(lastPlan.itemsByEvalOrder()).next().value
    expect(step.parent().action).toBe('modify')
    expect(await objectExists(
      `${getChangeElement(step.parent() as Change).elemID.name}__c`,
      ['Name__c', 'Test2__c'],
      ['Test__c']
    )).toBe(true)
  })

  it('should apply a delete for the model', async () => {
    await fs.delete(tmpBP)
    await new ApplyCommand(discoverOutputDir, false, cliOutput).execute()
    expect(lastPlan.size).toBe(1)
    const step = wu(lastPlan.itemsByEvalOrder()).next().value
    expect(step.parent().action).toBe('remove')
    expect(await objectExists(`${getChangeElement(step.parent() as Change).elemID.name}__c`))
      .toBe(false)
  })
})
