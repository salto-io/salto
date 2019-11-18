import { testHelpers as salesforceTestHelpers, SalesforceClient } from 'salesforce-adapter'
import { InstanceElement } from 'adapter-api'
import { Plan, file, Workspace } from 'salto'
import wu from 'wu'
import {
  API_NAME, CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, SALESFORCE, SALESFORCE_CUSTOM_SUFFIX,
} from 'salesforce-adapter/dist/src/constants'
import { exists } from 'salto/dist/src/file'
import adapterConfigs from './adapter_configs'
import * as formatterImpl from '../src/formatter'
import * as callbacksImpl from '../src/callbacks'
import {
  editBlueprint, loadValidWorkspace, runDeploy,
  runFetch, verifyChanges, verifyInstance, verifyObject, runEmptyPreview,
} from './helpers/workspace'
import { instanceExists, objectExists } from './helpers/salesforce'

const { copyFile, rm, mkdirp } = file

const credentials = salesforceTestHelpers.credentials()
let lastPlan: Plan
const mockShouldDeploy = (p: Plan): boolean => {
  lastPlan = p
  return wu(p.itemsByEvalOrder()).toArray().length < 100 // Safety to avoid breaking the SF instance
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

  describe('Running initial fetch', () => {
    beforeAll(async () => {
      await runFetch(fetchOutputDir)
    })
    it('should create fetchOutputDir', async () => {
      expect(await exists(fetchOutputDir)).toBe(true)
    })
    it('should create statePath', async () => {
      expect(await exists(statePath)).toBe(true)
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('Running deploy with a new object and instance', () => {
    let workspace: Workspace
    beforeAll(async () => {
      await copyFile(addModelBP, tmpBP)
      await editBlueprint(tmpBP, [
        [NEW_OBJECT_BASE_ELEM_NAME, NEW_OBJECT_ELEM_NAME],
        [NEW_INSTANCE_BASE_ELEM_NAME, NEW_INSTANCE_ELEM_NAME],
      ])
      await runDeploy(lastPlan, fetchOutputDir)
      workspace = await loadValidWorkspace(fetchOutputDir)
    })
    it('should have "add" changes', async () => {
      verifyChanges(lastPlan, [{ action: 'add', element: NEW_OBJECT_ELEM_NAME },
        { action: 'add', element: NEW_INSTANCE_ELEM_NAME }])
    })
    it('should create the object in salesforce', async () => {
      expect(await objectExists(client, NEW_OBJECT_API_NAME, ['Alpha__c', 'Beta__c'])).toBe(true)
    })
    it('should create the instance in salesforce', async () => {
      expect(await instanceExists(client, PROFILE, NEW_INSTANCE_FULL_NAME,
        { description: 'To Be Modified' })).toBe(true)
    })
    it('should update the object in the BP', async () => {
      verifyObject(workspace, SALESFORCE, NEW_OBJECT_ELEM_NAME, { [API_NAME]: NEW_OBJECT_API_NAME },
        { alpha: { [API_NAME]: 'Alpha__c' }, beta: { [API_NAME]: 'Beta__c' } })
    })
    it('should update the instance in the BP', async () => {
      verifyInstance(workspace, SALESFORCE, PROFILE.toLowerCase(), NEW_INSTANCE_ELEM_NAME,
        { description: 'To Be Modified', [INSTANCE_FULL_NAME_FIELD]: NEW_INSTANCE_FULL_NAME })
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('Running deploy after modifying the object and the instance', () => {
    beforeAll(async () => {
      await editBlueprint(tmpBP, [
        ['beta', 'modified'],
        ['Beta__c', 'Modified__c'],
        ['To Be Modified', 'I Am Modified'],
      ])
      await runDeploy(lastPlan, fetchOutputDir)
    })
    it('should have "modify" changes', async () => {
      verifyChanges(lastPlan, [{ action: 'modify', element: NEW_OBJECT_ELEM_NAME },
        { action: 'modify', element: NEW_INSTANCE_ELEM_NAME }])
    })
    it('should update the object in salesforce', async () => {
      expect(await objectExists(client, NEW_OBJECT_API_NAME, ['Alpha__c', 'Modified__c']))
        .toBe(true)
    })
    it('should update the instance in salesforce', async () => {
      expect(await instanceExists(client, PROFILE, NEW_INSTANCE_FULL_NAME,
        { description: 'I Am Modified' })).toBe(true)
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('Running fetch and expecting no changes', () => {
    let workspace: Workspace
    beforeAll(async () => {
      await runFetch(fetchOutputDir)
      workspace = await loadValidWorkspace(fetchOutputDir)
    })
    it('should have no change in the object', async () => {
      verifyObject(workspace, SALESFORCE, NEW_OBJECT_ELEM_NAME, { [API_NAME]: NEW_OBJECT_API_NAME },
        { alpha: { [API_NAME]: 'Alpha__c' }, modified: { [API_NAME]: 'Modified__c' } })
    })
    it('should have no change in the instance', async () => {
      verifyInstance(workspace, SALESFORCE, PROFILE.toLowerCase(), NEW_INSTANCE_ELEM_NAME,
        { description: 'I Am Modified', [INSTANCE_FULL_NAME_FIELD]: NEW_INSTANCE_FULL_NAME })
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('Running deploy after deleting the object and the instance', () => {
    beforeAll(async () => {
      await rm(tmpBP)
      await runDeploy(lastPlan, fetchOutputDir)
    })
    it('should have "remove" changes', async () => {
      verifyChanges(lastPlan, [{ action: 'remove', element: NEW_OBJECT_ELEM_NAME },
        { action: 'remove', element: NEW_INSTANCE_ELEM_NAME }])
    })
    it('should remove the object in salesforce', async () => {
      expect(await objectExists(client, NEW_OBJECT_API_NAME)).toBe(false)
    })
    it('should remove the instance in salesforce', async () => {
      expect(await instanceExists(client, PROFILE, NEW_INSTANCE_FULL_NAME)).toBe(false)
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })
})
