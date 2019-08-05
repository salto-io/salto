import * as fs from 'async-file'
import _ from 'lodash'
import SalesforceClient from 'salesforce-adapter/dist/src/client/client'
import {
  InstanceElement, ElemID, ObjectType, Plan,
} from 'adapter-api'
import {
  SALESFORCE,
  CUSTOM_OBJECT as CUSTOM_OBJECT_METATYPE,
} from 'salesforce-adapter/dist/src/constants'
import { CustomObject } from 'salesforce-adapter/dist/src/client/types'
import { discover, plan, apply } from '../src/cli/commands'
import State from '../src/state/state'

const configType = new ObjectType({ elemID: new ElemID(SALESFORCE) })
const configValues = {
  username: process.env.SF_USER || '',
  password: process.env.SF_PASSWORD || '',
  token: process.env.SF_TOKEN || '',
  sandbox: false,
}
const mockGetConfigType = (_c: ObjectType): InstanceElement => new InstanceElement(
  new ElemID(configType.elemID.adapter, ElemID.CONFIG_INSTANCE_NAME),
  configType,
  configValues
)
let lastPlan: Plan = []
const mockShouldApply = (p: Plan): boolean => {
  lastPlan = p
  return true
}

// Attempting to access the functions on run time without the mock implementation, or
// omitting the mock prefix in their names (YES I KNOW) will result in a runtime exception
// to be thrown
jest.mock('../src/cli/callbacks', () => ({
  getConfigFromUser: jest.fn().mockImplementation((c: ObjectType) => mockGetConfigType(c)),
  shouldApply: jest.fn().mockImplementation((p: Plan) => mockShouldApply(p)),
}))

describe('Test commands e2e', () => {
  const fileExists = async (path: string): Promise<boolean> => fs.exists(path)
  const homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  const { statePath } = new State()
  const discoverOutputBP = `${homePath}/.salto/test_discover.bp`
  const addModelBP = `${__dirname}/../../e2e_test//BP/add.bp`
  const modifyModelBP = `${__dirname}/../../e2e_test/BP/modify.bp`
  const client = new SalesforceClient(
    configValues.username,
    configValues.password + configValues.token,
    configValues.sandbox
  )

  const objectExists = async (
    name: string, fields: string[] = [], missingFields: string[] = []
  ): Promise<boolean> => {
    const result = (await client.readMetadata(CUSTOM_OBJECT_METATYPE, name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as CustomObject
    if (!result || !result.fullName) {
      return false
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldNames = _.isArray(result.fields) ? result.fields.map((rf: any) => rf.fullName)
      : [result.fields.fullName]
    if (fields && !fields.every(f => fieldNames.includes(f))) {
      return false
    }
    return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
  }

  beforeEach(() => {
    lastPlan = []
  })

  beforeAll(async done => {
    jest.setTimeout(5 * 60 * 1000)
    if (await objectExists('e2etest__c')) {
      await client.delete('CustomObject', 'e2etest__c')
    }
    done()
  })

  it('should run discover and create the state bp file', async done => {
    await discover(discoverOutputBP, [])
    expect(await fileExists(discoverOutputBP)).toBe(true)
    expect(await fileExists(statePath)).toBe(true)
    done()
  })

  it('should run plan on discover output and detect no changes', async done => {
    await plan([discoverOutputBP])
    expect(lastPlan.length).toBe(0)
    done()
  })

  it('should apply the new change', async done => {
    await apply([
      discoverOutputBP,
      addModelBP,
    ])
    expect(lastPlan.length).toBe(1)
    const step = lastPlan[0]
    expect(step.action).toBe('add')
    expect(step.data.before).toBeUndefined()
    expect(step.data.after).toBeDefined()
    const after = step.data.after as ObjectType
    expect(await objectExists(
      `${after.elemID.name}__c`,
      ['Name__c', 'Test__c']
    )).toBe(true)
    done()
  })

  it('should apply changes in the new model', async done => {
    await apply([
      discoverOutputBP,
      modifyModelBP,
    ])
    expect(lastPlan.length).toBe(1)
    const step = lastPlan[0]
    expect(step.action).toBe('modify')
    expect(step.data.before).toBeDefined()
    expect(step.data.after).toBeDefined()
    const after = step.data.after as ObjectType
    expect(await objectExists(
      `${after.elemID.name}__c`,
      ['Name__c', 'Test2__c'],
      ['Test__c']
    )).toBe(true)
    done()
  })

  it('should apply a delete for the model', async done => {
    await apply([discoverOutputBP])
    expect(lastPlan.length).toBe(1)
    const step = lastPlan[0]
    expect(step.action).toBe('remove')
    expect(step.data.before).toBeDefined()
    expect(step.data.after).toBeUndefined()
    const before = step.data.before as ObjectType
    expect(await objectExists(`${before.elemID.name}__c`)).toBe(false)
    done()
  })
})
