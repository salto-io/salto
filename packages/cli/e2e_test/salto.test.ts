import { testHelpers as salesforceTestHelpers, SalesforceClient } from 'salesforce-adapter'
import { InstanceElement } from 'adapter-api'
import { Plan, file } from 'salto'
import wu from 'wu'
import {
  API_NAME, CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, SALESFORCE_CUSTOM_SUFFIX,
} from 'salesforce-adapter/dist/src/constants'
import { logger } from '@salto/logging'
import adapterConfigs from './adapter_configs'
import * as formatterImpl from '../src/formatter'
import * as callbacksImpl from '../src/callbacks'
import {
  editBlueprint, instanceExists, loadValidWorkspace, objectExists, runDeploy, runEmptyPreview,
  runFetch, verifyChanges, verifyNewInstanceBP, verifyNewObjectBP,
} from './helpers'

const log = logger('cli/e2e/salto')

const { copyFile, rm, mkdirp } = file

const credentials = salesforceTestHelpers.credentials()
let lastPlan: Plan
const mockShouldDeploy = (p: Plan): boolean => {
  lastPlan = p
  return wu(p.itemsByEvalOrder()).toArray().length < 100 // Safty to avoid breaking the SF instance
}
const mockGetConfigType = (): InstanceElement => adapterConfigs.salesforce()
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
  const NEW_INSTANCE_BASE_ELEM_NAME = 'new_instance_name'
  const NEW_OBJECT_BASE_ELEM_NAME = 'new_object_name'
  const randomString = String(Date.now()).substring(6)
  const NEW_INSTANCE_ELEM_NAME = NEW_INSTANCE_BASE_ELEM_NAME + randomString
  const NEW_INSTANCE_FULL_NAME = `NewInstanceName${randomString}`
  const NEW_OBJECT_ELEM_NAME = NEW_OBJECT_BASE_ELEM_NAME + randomString
  const NEW_OBJECT_API_NAME = `NewObjectName${randomString}${SALESFORCE_CUSTOM_SUFFIX}`
  const PROFILE = 'Profile'

  beforeAll(async () => {
    await mkdirp(`${fetchOutputDir}/salto.config`)
    await mkdirp(localStorageDir)
    await copyFile(configFile, `${fetchOutputDir}/salto.config/config.bp`)
    await rm(tmpBP)
    if (await objectExists(client, NEW_OBJECT_API_NAME)) {
      await client.delete(CUSTOM_OBJECT, NEW_OBJECT_API_NAME)
    }
    if (await instanceExists(client, PROFILE, NEW_INSTANCE_FULL_NAME)) {
      await client.delete(PROFILE, NEW_INSTANCE_FULL_NAME)
    }
  })

  afterAll(async () => {
    await rm(fetchOutputDir)
    await rm(localStorageDir)
    if (await objectExists(client, NEW_OBJECT_API_NAME)) {
      await client.delete(CUSTOM_OBJECT, NEW_OBJECT_API_NAME)
    }
    if (await instanceExists(client, PROFILE, NEW_INSTANCE_FULL_NAME)) {
      await client.delete(PROFILE, NEW_INSTANCE_FULL_NAME)
    }
  })

  const deployNewElementsAndVerify = async (): Promise<void> => {
    await copyFile(addModelBP, tmpBP)
    await editBlueprint(tmpBP, [
      [NEW_OBJECT_BASE_ELEM_NAME, NEW_OBJECT_ELEM_NAME],
      [NEW_INSTANCE_BASE_ELEM_NAME, NEW_INSTANCE_ELEM_NAME],
    ])
    await runDeploy(lastPlan, fetchOutputDir)
    verifyChanges(lastPlan, 'add', [NEW_OBJECT_ELEM_NAME, NEW_INSTANCE_ELEM_NAME])
    expect(await objectExists(client, NEW_OBJECT_API_NAME, ['Alpha__c', 'Beta__c']))
      .toBe(true)
    expect(await instanceExists(client, PROFILE, NEW_INSTANCE_FULL_NAME,
      [['description', 'To Be Modified Description']])).toBe(true)
    const workspace = await loadValidWorkspace(fetchOutputDir)
    verifyNewObjectBP(workspace, NEW_OBJECT_ELEM_NAME, [[API_NAME, NEW_OBJECT_API_NAME]], {
      alpha: [API_NAME, 'Alpha__c'],
      beta: [API_NAME, 'Beta__c'],
    })
    verifyNewInstanceBP(workspace, NEW_INSTANCE_ELEM_NAME,
      [['description', 'To Be Modified Description'],
        [INSTANCE_FULL_NAME_FIELD, NEW_INSTANCE_FULL_NAME]])
  }

  const deployModifiedElements = async (): Promise<void> => {
    await editBlueprint(tmpBP, [
      ['beta', 'modified'],
      ['Beta__c', 'Modified__c'],
      ['To Be Modified Description', 'I Am Modified'],
    ])
    await runDeploy(lastPlan, fetchOutputDir)
    verifyChanges(lastPlan, 'modify', [NEW_OBJECT_ELEM_NAME, NEW_INSTANCE_ELEM_NAME])
    expect(await objectExists(client, NEW_OBJECT_API_NAME, ['Alpha__c', 'Modified__c']))
      .toBe(true)
    expect(await instanceExists(client, PROFILE, NEW_INSTANCE_FULL_NAME,
      [['description', 'I Am Modified']])).toBe(true)
  }

  const runFetchAndExpectNoChanges = async (): Promise<void> => {
    await runFetch(statePath, fetchOutputDir)
    const workspace = await loadValidWorkspace(fetchOutputDir)
    verifyNewObjectBP(workspace, NEW_OBJECT_ELEM_NAME, [[API_NAME, NEW_OBJECT_API_NAME]], {
      alpha: [API_NAME, 'Alpha__c'],
      modified: [API_NAME, 'Modified__c'],
    })
    verifyNewInstanceBP(workspace, NEW_INSTANCE_ELEM_NAME, [['description', 'I Am Modified'],
      [INSTANCE_FULL_NAME_FIELD, NEW_INSTANCE_FULL_NAME]])
  }

  const deleteCreatedElementsAndVerify = async (): Promise<void> => {
    await rm(tmpBP)
    await runDeploy(lastPlan, fetchOutputDir)
    verifyChanges(lastPlan, 'remove', [NEW_OBJECT_ELEM_NAME, NEW_INSTANCE_ELEM_NAME])
    expect(await objectExists(client, NEW_OBJECT_API_NAME)).toBe(false)
    expect(await instanceExists(client, PROFILE, NEW_INSTANCE_FULL_NAME)).toBe(false)
  }

  it('should run full flow', async () => {
    log.info('Running initial fetch')
    await runFetch(statePath, fetchOutputDir)
    log.info('Running preview and expecting no changes')
    await runEmptyPreview(lastPlan, fetchOutputDir)
    log.info('Running deploy with a new object and instance')
    await deployNewElementsAndVerify()
    log.info('Running preview and expecting no changes')
    await runEmptyPreview(lastPlan, fetchOutputDir)
    log.info('Running deploy after modifying the object and the instance')
    await deployModifiedElements()
    log.info('Running preview and expecting no changes')
    await runEmptyPreview(lastPlan, fetchOutputDir)
    log.info('Running fetch and expecting no changes')
    await runFetchAndExpectNoChanges()
    log.info('Running deploy after deleting the object and the instance')
    await deleteCreatedElementsAndVerify()
    log.info('Running preview and expecting no changes')
    await runEmptyPreview(lastPlan, fetchOutputDir)
  })
})
