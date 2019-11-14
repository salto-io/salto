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
  Plan, file,
} from 'salto'
import wu from 'wu'
import { CliOutput, SpinnerCreator, Spinner } from '../src/types'

import { MockWriteStream, mockSpinnerCreator } from '../test/mocks'
import { command as fetch } from '../src/commands/fetch'
import { command as preview } from '../src/commands/preview'
import { DeployCommand } from '../src/commands/deploy'
import adapterConfigs from './adapter_configs'

const { copyFile, rm, mkdirp, exists } = file

const credentials = salesforceTestHelpers.credentials()
const mockGetConfigType = (): InstanceElement => adapterConfigs.salesforce()

let cliOutput: CliOutput
let spinnerCreator: SpinnerCreator

let lastPlan: Plan
const mockShouldDeploy = (p: Plan): boolean => {
  lastPlan = p
  return wu(p.itemsByEvalOrder()).toArray().length < 100 // Safty to avoid breaking the SF instance
}

// Attempting to access the functions on run time without the mock implementation, or
// omitting the mock prefix in their names (YES I KNOW) will result in a runtime exception
// to be thrown
jest.mock('../src/callbacks', () => ({
  getConfigFromUser: jest.fn().mockImplementation(() => mockGetConfigType()),
  shouldDeploy: jest.fn().mockImplementation(() => mockShouldDeploy),
}))

describe('commands e2e', () => {
  const homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  const fetchOutputDir = `${homePath}/BP/test_fetch`
  const localStorageDir = `${homePath}/.salto/test_fetch`
  const addModelBP = `${__dirname}/../../e2e_test/BP/add.bp`
  const modifyModelBP = `${__dirname}/../../e2e_test/BP/modify.bp`
  const configFile = `${__dirname}/../../e2e_test/BP/salto.config/config.bp`
  const statePath = `${fetchOutputDir}/salto.config/state.bpc`
  const tmpBP = `${fetchOutputDir}/tmp.bp`
  const client = new SalesforceClient({ credentials })
  const spinners: Spinner[] = []

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
    spinnerCreator = mockSpinnerCreator(spinners)
  })

  jest.setTimeout(5 * 60 * 1000)
  beforeAll(async () => {
    await mkdirp(`${fetchOutputDir}/salto.config`)
    await mkdirp(localStorageDir)
    await copyFile(configFile, `${fetchOutputDir}/salto.config/config.bp`)
    await rm(tmpBP)
    if (await objectExists('e2etest__c')) {
      // TODO 'CustomObject' is a magic string
      await client.delete('CustomObject', 'e2etest__c')
    }
  })

  afterAll(async () => {
    await rm(fetchOutputDir)
    await rm(localStorageDir)
  })

  it('should run fetch and create the state bp file', async () => {
    await fetch(fetchOutputDir, true, false, cliOutput, mockSpinnerCreator([])).execute()
    expect(await exists(fetchOutputDir)).toBe(true)
    expect(await exists(statePath)).toBe(true)
  })

  it('should run plan on discover output and detect no changes', async () => {
    await preview(fetchOutputDir, cliOutput, spinnerCreator).execute()
    expect(lastPlan).toBeUndefined()
  })

  it('should deploy the new change', async () => {
    await copyFile(addModelBP, tmpBP)
    await new DeployCommand(fetchOutputDir, false, cliOutput, spinnerCreator)
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

  it('should deploy changes in the new model', async () => {
    await copyFile(modifyModelBP, tmpBP)
    await new DeployCommand(fetchOutputDir, false,
      cliOutput, spinnerCreator).execute()
    expect(lastPlan.size).toBe(1)
    // const step = wu(lastPlan.itemsByEvalOrder()).next().value
    // expect(step.parent().action).toBe('modify')
    // expect(await objectExists(
    //   `${getChangeElement(step.parent() as Change).elemID.name}__c`,
    //   ['Name__c', 'Test2__c'],
    //   ['Test__c']
    // )).toBe(true)
  })

  // it('should deploy a delete for the model', async () => {
  //   await rm(tmpBP)
  //   await new DeployCommand(fetchOutputDir, false, cliOutput, spinnerCreator).execute()
  //   expect(lastPlan.size).toBe(1)
  //   const step = wu(lastPlan.itemsByEvalOrder()).next().value
  //   expect(step.parent().action).toBe('remove')
  //   expect(await objectExists(`${getChangeElement(step.parent() as Change).elemID.name}__c`))
  //     .toBe(false)
  // })
})
