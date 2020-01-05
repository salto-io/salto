import wu from 'wu'
import tmp from 'tmp-promise'
import { strings } from '@salto/lowerdash'
import { testHelpers as salesforceTestHelpers, SalesforceClient } from 'salesforce-adapter'
import { Plan, file, Workspace, SALTO_HOME_VAR } from 'salto'
import {
  API_NAME, CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, SALESFORCE, SALESFORCE_CUSTOM_SUFFIX,
} from 'salesforce-adapter/dist/src/constants'
import * as formatterImpl from '../src/formatter'
import * as callbacksImpl from '../src/callbacks'
import {
  editBlueprint, loadValidWorkspace, runDeploy,
  runFetch, verifyChanges, verifyInstance, verifyObject, runEmptyPreview, runSalesforceLogin,
} from './helpers/workspace'
import { instanceExists, objectExists } from './helpers/salesforce'

const { copyFile, rm, mkdirp, exists } = file

let lastPlan: Plan

describe('commands e2e', () => {
  jest.setTimeout(15 * 60 * 1000)

  beforeAll(() => {
    jest.spyOn(formatterImpl, 'formatExecutionPlan').mockImplementation((p: Plan, _planErrors): string => {
      lastPlan = p
      return 'plan'
    })
    jest.spyOn(callbacksImpl, 'shouldDeploy').mockImplementation(
      () => async (p: Plan): Promise<boolean> => {
        lastPlan = p
        const { length } = [...wu(p.itemsByEvalOrder())]
        return length < 100 // Safety to avoid breaking the SF instance
      }
    )
  })

  const addModelBP = `${__dirname}/../../e2e_test/BP/add.bp`
  const configFile = `${__dirname}/../../e2e_test/BP/salto.config/config.bp`
  const NEW_INSTANCE_BASE_ELEM_NAME = 'new_instance_name'
  const NEW_OBJECT_BASE_ELEM_NAME = 'new_object_name'

  let homePath: string
  let fetchOutputDir: string
  let localStorageDir: string
  let statePath: string
  let randomString: string
  let tmpBP: string
  let newInstanceElemName: string
  let newInstanceFullName: string
  let newObjectElemName: string
  let newObjectApiName: string

  const PROFILE = 'Profile'
  let client: SalesforceClient

  beforeAll(async () => {
    homePath = tmp.dirSync().name
    fetchOutputDir = `${homePath}/BP/test_fetch`
    localStorageDir = `${homePath}/.salto/test_fetch`
    statePath = `${fetchOutputDir}/salto.config/state.bpc`
    randomString = strings.insecureRandomString({ alphabet: strings.LOWERCASE, length: 12 })
    newInstanceElemName = NEW_INSTANCE_BASE_ELEM_NAME + randomString
    newInstanceFullName = `NewInstanceName${randomString}`
    newObjectElemName = NEW_OBJECT_BASE_ELEM_NAME + randomString
    newObjectApiName = `NewObjectName${randomString}${SALESFORCE_CUSTOM_SUFFIX}`
    tmpBP = `${fetchOutputDir}/salesforce/objects/custom/${newObjectElemName}.bp`

    process.env[SALTO_HOME_VAR] = homePath
    client = new SalesforceClient({ credentials: salesforceTestHelpers().credentials })
    await mkdirp(`${fetchOutputDir}/salto.config`)
    await mkdirp(localStorageDir)
    await copyFile(configFile, `${fetchOutputDir}/salto.config/config.bp`)
    await rm(tmpBP)
    if (await objectExists(client, newObjectApiName)) {
      await client.delete(CUSTOM_OBJECT, newObjectApiName)
    }
    if (await instanceExists(client, PROFILE, newInstanceFullName)) {
      await client.delete(PROFILE, newInstanceFullName)
    }
    await runSalesforceLogin(fetchOutputDir)
    await runFetch(fetchOutputDir)
  })

  afterAll(async () => {
    if (await objectExists(client, newObjectApiName)) {
      await client.delete(CUSTOM_OBJECT, newObjectApiName)
    }
    if (await instanceExists(client, PROFILE, newInstanceFullName)) {
      await client.delete(PROFILE, newInstanceFullName)
    }
    await rm(homePath)
  })

  describe('initial fetch', () => {
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

  describe('deploy with a new object and instance', () => {
    let workspace: Workspace
    beforeAll(async () => {
      await copyFile(addModelBP, tmpBP)
      await editBlueprint(tmpBP, [
        [NEW_OBJECT_BASE_ELEM_NAME, newObjectElemName],
        [NEW_INSTANCE_BASE_ELEM_NAME, newInstanceElemName],
      ])
      await runDeploy(lastPlan, fetchOutputDir)
      workspace = await loadValidWorkspace(fetchOutputDir)
    })
    it('should have "add" changes', async () => {
      verifyChanges(lastPlan, [{ action: 'add', element: newObjectElemName },
        { action: 'add', element: newInstanceElemName }])
    })
    it('should create the object in salesforce', async () => {
      expect(await objectExists(client, newObjectApiName, ['Alpha__c', 'Beta__c'])).toBe(true)
    })
    it('should create the instance in salesforce', async () => {
      expect(await instanceExists(client, PROFILE, newInstanceFullName,
        { description: 'To Be Modified' })).toBe(true)
    })
    it('should update the object in the BP', async () => {
      verifyObject(workspace, SALESFORCE, newObjectElemName, { [API_NAME]: newObjectApiName },
        { alpha: { [API_NAME]: 'Alpha__c' }, beta: { [API_NAME]: 'Beta__c' } })
    })
    it('should update the instance in the BP', async () => {
      verifyInstance(workspace, SALESFORCE, PROFILE.toLowerCase(), newInstanceElemName,
        { description: 'To Be Modified', [INSTANCE_FULL_NAME_FIELD]: newInstanceFullName })
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('deploy after modifying the object and the instance', () => {
    beforeAll(async () => {
      await editBlueprint(tmpBP, [
        ['beta', 'modified'],
        ['Beta__c', 'Modified__c'],
        ['To Be Modified', 'I Am Modified'],
      ])
      await runDeploy(lastPlan, fetchOutputDir)
    })
    it('should have "modify" changes', async () => {
      verifyChanges(lastPlan, [{ action: 'modify', element: newObjectElemName },
        { action: 'modify', element: newInstanceElemName }])
    })
    it('should update the object in salesforce', async () => {
      expect(await objectExists(client, newObjectApiName, ['Alpha__c', 'Modified__c']))
        .toBe(true)
    })
    it('should update the instance in salesforce', async () => {
      expect(await instanceExists(client, PROFILE, newInstanceFullName,
        { description: 'I Am Modified' })).toBe(true)
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('fetch expecting no changes', () => {
    let workspace: Workspace
    beforeAll(async () => {
      await runFetch(fetchOutputDir)
      workspace = await loadValidWorkspace(fetchOutputDir)
    })
    it('should have no change in the object', async () => {
      verifyObject(workspace, SALESFORCE, newObjectElemName, { [API_NAME]: newObjectApiName },
        { alpha: { [API_NAME]: 'Alpha__c' }, modified: { [API_NAME]: 'Modified__c' } })
    })
    it('should have no change in the instance', async () => {
      verifyInstance(workspace, SALESFORCE, PROFILE.toLowerCase(), newInstanceElemName,
        { description: 'I Am Modified', [INSTANCE_FULL_NAME_FIELD]: newInstanceFullName })
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })
  describe('deploy after deleting the object and the instance', () => {
    beforeAll(async () => {
      await rm(tmpBP)
      await runDeploy(lastPlan, fetchOutputDir)
    })
    it('should have "remove" changes', async () => {
      verifyChanges(lastPlan, [{ action: 'remove', element: newObjectElemName },
        { action: 'remove', element: newInstanceElemName }])
    })
    it('should remove the object in salesforce', async () => {
      expect(await objectExists(client, newObjectApiName)).toBe(false)
    })
    it('should remove the instance in salesforce', async () => {
      expect(await instanceExists(client, PROFILE, newInstanceFullName)).toBe(false)
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })
})
