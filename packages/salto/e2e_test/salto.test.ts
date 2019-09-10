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
import wu from 'wu'
import {
  discover, plan, apply,
} from '../src/cli/commands'
import { Plan } from '../src/core/plan'
import State from '../src/state/state'
import adapterConfigs from './adapter_configs'

const credentials = salesforceTestHelpers.credentials()
const mockGetConfigType = (): InstanceElement => adapterConfigs.salesforce()

let lastPlan: Plan
const mockShouldApply = (p: Plan): boolean => {
  lastPlan = p
  return true
}

// Attempting to access the functions on run time without the mock implementation, or
// omitting the mock prefix in their names (YES I KNOW) will result in a runtime exception
// to be thrown
jest.mock('../src/cli/callbacks', () => ({
  getConfigFromUser: jest.fn().mockImplementation(() => mockGetConfigType()),
  shouldApply: jest.fn().mockImplementation((p: Plan) => mockShouldApply(p)),
}))

describe('commands e2e', () => {
  const pathExists = async (p: string): Promise<boolean> => fs.exists(p)
  const homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  const { statePath } = new State()
  const discoverOutputDir = `${homePath}/BP/test_discover`
  const addModelBP = `${__dirname}/../../e2e_test//BP/add.bp`
  const modifyModelBP = `${__dirname}/../../e2e_test/BP/modify.bp`
  const client = new SalesforceClient({ credentials })

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
  })

  jest.setTimeout(5 * 60 * 1000)
  beforeAll(async () => {
    if (await objectExists('e2etest__c')) {
      // TODO 'CustomObject' is a magic string
      await client.delete('CustomObject', 'e2etest__c')
    }
  })

  afterAll(() => fs.delete(discoverOutputDir))

  it('should run discover and create the state bp file', async () => {
    await discover(discoverOutputDir, [])
    expect(await pathExists(discoverOutputDir)).toBe(true)
    expect(await pathExists(statePath)).toBe(true)
  })

  it('should run plan on discover output and detect no changes', async () => {
    await plan([], discoverOutputDir)
    expect(lastPlan).toBeUndefined()
  })

  it('should apply the new change', async () => {
    await apply([addModelBP], discoverOutputDir)
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
    await apply([modifyModelBP], discoverOutputDir)
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
    await apply([], discoverOutputDir)
    expect(lastPlan.size).toBe(1)
    const step = wu(lastPlan.itemsByEvalOrder()).next().value
    expect(step.parent().action).toBe('remove')
    expect(await objectExists(`${getChangeElement(step.parent() as Change).elemID.name}__c`))
      .toBe(false)
  })
})
