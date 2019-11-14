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
  Plan, file, Workspace,
} from 'salto'
import wu from 'wu'
import {
  API_NAME, CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, SALESFORCE_CUSTOM_SUFFIX,
} from 'salesforce-adapter/dist/src/constants'
import { logger } from '@salto/logging'
import { ActionName } from '@salto/dag'
import { CliOutput, SpinnerCreator, Spinner } from '../src/types'

import { MockWriteStream, mockSpinnerCreator } from '../test/mocks'
import { command as fetch } from '../src/commands/fetch'
import { command as preview } from '../src/commands/preview'
import { DeployCommand } from '../src/commands/deploy'
import adapterConfigs from './adapter_configs'
import { loadWorkspace } from '../src/workspace'
import * as formatterImpl from '../src/formatter'
import * as callbacksImpl from '../src/callbacks'

const log = logger('cli/e2e/salto')

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
const mockFormatExecutionPlan = (p: Plan): string => {
  lastPlan = p
  return 'plan'
}
jest.spyOn(formatterImpl, 'formatExecutionPlan').mockImplementation(() => mockFormatExecutionPlan)
jest.spyOn(callbacksImpl, 'getConfigFromUser').mockImplementation(() => mockGetConfigType())
jest.spyOn(callbacksImpl, 'shouldDeploy').mockImplementation(() => mockShouldDeploy)

describe('commands e2e', () => {
  jest.setTimeout(10 * 60 * 1000)
  const homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  const fetchOutputDir = `${homePath}/BP/test_fetch`
  const localStorageDir = `${homePath}/.salto/test_fetch`
  const addModelBP = `${__dirname}/../../e2e_test/BP/add.bp`
  const configFile = `${__dirname}/../../e2e_test/BP/salto.config/config.bp`
  const statePath = `${fetchOutputDir}/salto.config/state.bpc`
  const tmpBP = `${fetchOutputDir}/tmp.bp`
  const client = new SalesforceClient({ credentials })
  const spinners: Spinner[] = []
  cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  spinnerCreator = mockSpinnerCreator(spinners)
  const NEW_INSTANCE_BASE_ELEM_NAME = 'new_instance_name'
  const NEW_OBJECT_BASE_ELEM_NAME = 'new_object_name'
  const randomString = String(Date.now()).substring(6)
  const NEW_INSTANCE_ELEM_NAME = NEW_INSTANCE_BASE_ELEM_NAME + randomString
  const NEW_INSTANCE_FULL_NAME = `NewInstanceName${randomString}`
  const NEW_OBJECT_ELEM_NAME = NEW_OBJECT_BASE_ELEM_NAME + randomString
  const NEW_OBJECT_API_NAME = `NewObjectName${randomString}${SALESFORCE_CUSTOM_SUFFIX}`
  const PROFILE = 'Profile'

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

  const instanceExists = async (name: string, description?: string): Promise<boolean> => {
    const result = (await client.readMetadata(PROFILE, name))[0]
    if (!result || !result.fullName) {
      return false
    }
    if (description) {
      return _.get(result, 'description') === description
    }
    return true
  }

  beforeAll(async () => {
    await mkdirp(`${fetchOutputDir}/salto.config`)
    await mkdirp(localStorageDir)
    await copyFile(configFile, `${fetchOutputDir}/salto.config/config.bp`)
    await rm(tmpBP)
    if (await objectExists(NEW_OBJECT_API_NAME)) {
      await client.delete(CUSTOM_OBJECT, NEW_OBJECT_API_NAME)
    }
    if (await instanceExists(NEW_INSTANCE_FULL_NAME)) {
      await client.delete(PROFILE, NEW_INSTANCE_FULL_NAME)
    }
  })

  afterAll(async () => {
    await rm(fetchOutputDir)
    await rm(localStorageDir)
    if (await objectExists(NEW_OBJECT_API_NAME)) {
      await client.delete(CUSTOM_OBJECT, NEW_OBJECT_API_NAME)
    }
    if (await instanceExists(NEW_INSTANCE_FULL_NAME)) {
      await client.delete(PROFILE, NEW_INSTANCE_FULL_NAME)
    }
  })

  const loadValidWorkspace = async (): Promise<Workspace> => {
    const { workspace, errored } = await loadWorkspace(fetchOutputDir, cliOutput)
    expect(errored).toBeFalsy()
    return workspace
  }

  type Pair = [string, string]

  const editBlueprint = async (replacements: Pair[]): Promise<void> => {
    let fileAsString = await file.readTextFile(tmpBP)
    replacements.forEach(pair => {
      fileAsString = fileAsString.replace(pair[0], pair[1])
    })
    await file.writeTextFile(tmpBP, fileAsString)
  }

  const findTestObject = (workspace: Workspace): ObjectType =>
    wu(workspace.elements)
      .find(elem => elem.elemID.name === NEW_OBJECT_ELEM_NAME) as ObjectType

  const findTestInstance = (workspace: Workspace): InstanceElement =>
    wu(workspace.elements)
      .find(elem => elem.elemID.name === NEW_INSTANCE_ELEM_NAME) as InstanceElement

  const getChangedElementName = (change: Change): string => getChangeElement(change).elemID.name

  const verifyChanges = (plan: Plan, changesAction: ActionName, expectedSize = 2,
    expectedElementNames = [NEW_OBJECT_ELEM_NAME, NEW_INSTANCE_ELEM_NAME]): void => {
    expect(plan.size).toBe(expectedSize)
    const changes = wu(plan.itemsByEvalOrder()).map(item => item.parent() as Change).toArray()
    changes.forEach(change => expect(change.action).toBe(changesAction))
    expect(changes.map(change => getChangedElementName(change)).sort())
      .toEqual(expectedElementNames.sort())
  }

  const verifyNewInstanceBP = (workspace: Workspace, expectedDescription: string): void => {
    const newInstance = findTestInstance(workspace)
    expect(newInstance.value[INSTANCE_FULL_NAME_FIELD]).toEqual(NEW_INSTANCE_FULL_NAME)
    expect(newInstance.value.description).toEqual(expectedDescription)
  }

  const runFetch = async (): Promise<void> => {
    await fetch(fetchOutputDir, true, false, cliOutput, mockSpinnerCreator([])).execute()
    expect(await exists(fetchOutputDir)).toBe(true)
    expect(await exists(statePath)).toBe(true)
  }

  const runDeploy = async (): Promise<void> => {
    if (lastPlan) {
      lastPlan.clear()
    }
    await new DeployCommand(fetchOutputDir, false, cliOutput, spinnerCreator).execute()
  }

  const runEmptyPreview = async (): Promise<void> => {
    if (lastPlan) {
      lastPlan.clear()
    }
    await preview(fetchOutputDir, cliOutput, spinnerCreator).execute()
    expect(_.isEmpty(lastPlan)).toBeTruthy()
  }

  const verifyNewObjectBP = (workspace: Workspace, modifiedFieldName: string,
    expectedModifiedFieldApiName: string): void => {
    const newObject = findTestObject(workspace)
    expect(newObject.annotations[API_NAME]).toEqual(NEW_OBJECT_API_NAME)
    expect(newObject.fields.my_name.annotations[API_NAME]).toEqual('MyName__c')
    expect(newObject.fields[modifiedFieldName].annotations[API_NAME])
      .toEqual(expectedModifiedFieldApiName)
  }

  const deployNewElementsAndVerify = async (): Promise<void> => {
    await copyFile(addModelBP, tmpBP)
    await editBlueprint([
      [NEW_OBJECT_BASE_ELEM_NAME, NEW_OBJECT_ELEM_NAME],
      [NEW_INSTANCE_BASE_ELEM_NAME, NEW_INSTANCE_ELEM_NAME],
    ])
    await runDeploy()
    verifyChanges(lastPlan, 'add')
    expect(await objectExists(NEW_OBJECT_API_NAME, ['MyName__c', 'ToBeModified__c']))
      .toBe(true)
    expect(await instanceExists(NEW_INSTANCE_FULL_NAME, 'To Be Modified Description'))
      .toBe(true)
    const workspace = await loadValidWorkspace()
    verifyNewObjectBP(workspace, 'to_be_modified', 'ToBeModified__c')
    verifyNewInstanceBP(workspace, 'To Be Modified Description')
  }

  const deployModifiedElements = async (): Promise<void> => {
    await editBlueprint([
      ['to_be_modified', 'i_am_modified'],
      ['ToBeModified__c', 'IAmModified__c'],
      ['To Be Modified Description', 'I Am Modified'],
    ])
    await runDeploy()
    verifyChanges(lastPlan, 'modify')
    expect(await objectExists(NEW_OBJECT_API_NAME, ['MyName__c', 'IAmModified__c']))
      .toBe(true)
    expect(await instanceExists(NEW_INSTANCE_FULL_NAME, 'I Am Modified'))
      .toBe(true)
  }

  const runFetchAndExpectNoChanges = async (): Promise<void> => {
    await runFetch()
    const workspace = await loadValidWorkspace()
    verifyNewObjectBP(workspace, 'i_am_modified', 'IAmModified__c')
    verifyNewInstanceBP(workspace, 'I Am Modified')
  }

  const deleteCreatedElementsAndVerify = async (): Promise<void> => {
    await rm(tmpBP)
    await runDeploy()
    verifyChanges(lastPlan, 'remove')
    expect(await objectExists(NEW_OBJECT_API_NAME)).toBe(false)
    expect(await instanceExists(NEW_INSTANCE_FULL_NAME)).toBe(false)
  }

  it('should run full flow', async () => {
    log.info('Running initial fetch')
    await runFetch()
    log.info('Running preview and expecting no changes')
    await runEmptyPreview()
    log.info('Running deploy with a new object and instance')
    await deployNewElementsAndVerify()
    log.info('Running preview and expecting no changes')
    await runEmptyPreview()
    log.info('Running deploy after modifying the object and the instance')
    await deployModifiedElements()
    log.info('Running preview and expecting no changes')
    await runEmptyPreview()
    log.info('Running fetch and expecting no changes')
    await runFetchAndExpectNoChanges()
    log.info('Running deploy after deleting the object and the instance')
    await deleteCreatedElementsAndVerify()
    log.info('Running preview and expecting no changes')
    await runEmptyPreview()
  })
})
