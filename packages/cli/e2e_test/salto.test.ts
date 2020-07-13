/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import path from 'path'
import wu from 'wu'
import tmp from 'tmp-promise'
import { logger } from '@salto-io/logging'
import { strings } from '@salto-io/lowerdash'
import { copyFile, rm, mkdirp, exists } from '@salto-io/file'
import { testHelpers as salesforceTestHelpers, SalesforceClient, Credentials } from '@salto-io/salesforce-adapter'
import { Plan, SALTO_HOME_VAR } from '@salto-io/core'
import { Workspace, parser } from '@salto-io/workspace'
// eslint-disable-next-line no-restricted-imports
import {
  API_NAME, CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, SALESFORCE, SALESFORCE_CUSTOM_SUFFIX,
  API_NAME_SEPARATOR, OBJECTS_PATH, METADATA_TYPE,
} from '@salto-io/salesforce-adapter/dist/src/constants'
import {
  BuiltinTypes, ObjectType,
} from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import * as formatterImpl from '../src/formatter'
import * as callbacksImpl from '../src/callbacks'
import * as DeployCommandImpl from '../src/commands/deploy'
import {
  editNaclFile, loadValidWorkspace, runDeploy, runFetch, verifyChanges, verifyInstance,
  verifyObject, runEmptyPreview, runSalesforceLogin,
  runPreview,
  cleanup as workspaceHelpersCleanup,
} from './helpers/workspace'
import { instanceExists, objectExists, getSalesforceCredsInstance } from './helpers/salesforce'


const log = logger(module)

let lastPlan: Plan
let credsLease: CredsLease<Credentials>

const apiNameAnno = (
  obj: string,
  field: string
): Record<string, string> => ({ [API_NAME]: [obj, field].join(API_NAME_SEPARATOR) })

describe('cli e2e', () => {
  jest.setTimeout(15 * 60 * 1000)

  beforeAll(() => {
    jest.spyOn(formatterImpl, 'formatExecutionPlan').mockImplementation((p: Plan, _planErrors): string => {
      lastPlan = p
      return 'plan'
    })
    jest.spyOn(DeployCommandImpl, 'shouldDeploy').mockImplementation(
      (p: Plan): Promise<boolean> => {
        lastPlan = p
        const { length } = [...wu(p.itemsByEvalOrder())]
        return Promise.resolve(length < 100) // Safety to avoid breaking the SF instance
      }
    )
    jest.spyOn(callbacksImpl, 'getEnvName').mockImplementation(
      () => Promise.resolve('default')
    )
  })

  afterAll(workspaceHelpersCleanup)

  const addModelNaclFile = `${__dirname}/../../e2e_test/NACL/add.nacl`
  const workspaceConfigFile = `${__dirname}/../../e2e_test/NACL/salto.config/workspace.nacl`
  const envsConfigFile = `${__dirname}/../../e2e_test/NACL/salto.config/envs.nacl`
  const salesforceConfigFile = `${__dirname}/../../e2e_test/NACL/salto.config/salesforce.nacl`
  const localWorkspaceConfigFile = `${__dirname}/../../e2e_test/NACL/salto.config/local/workspaceUser.nacl`
  const NEW_INSTANCE_BASE_ELEM_NAME = 'NewInstanceName'
  const NEW_INSTANCE2_BASE_ELEM_NAME = 'NewInstance2Name'
  const NEW_OBJECT_BASE_ELEM_NAME = 'NewObjectName'

  let homePath: string
  let fetchOutputDir: string
  let localStorageDir: string
  let localWorkspaceDir: string
  let statePath: string
  let randomString: string
  let tmpNaclFileRelativePath: string
  let newInstanceElemName: string
  let newInstance2ElemName: string
  let newInstanceFullName: string
  let newInstance2FullName: string
  let newObjectElemName: string
  let newObjectApiName: string
  let newObjectStandardFieldRelativePath: string
  let newObjectAnnotationsRelativePath: string

  const ROLE = 'Role'
  let client: SalesforceClient

  const fullPath = (partialPath: string): string =>
    path.join(fetchOutputDir, partialPath)

  beforeAll(async () => {
    homePath = tmp.dirSync().name
    log.info('home directory for this test is "%s"', homePath)
    fetchOutputDir = `${homePath}/NACL/test_fetch`
    localStorageDir = `${homePath}/.salto/test_fetch`
    localWorkspaceDir = `${homePath}/e2e-375e3f65-be66-4fdc-a561-4c4f9735db94`
    statePath = `${fetchOutputDir}/salto.config/states/default.jsonl`
    randomString = strings.insecureRandomString({ alphabet: strings.LOWERCASE, length: 12 })
    log.info('unique suffix for elements in this test is "%s"', randomString)
    newInstanceElemName = NEW_INSTANCE_BASE_ELEM_NAME + randomString
    newInstance2ElemName = NEW_INSTANCE2_BASE_ELEM_NAME + randomString
    newInstanceFullName = `${NEW_INSTANCE_BASE_ELEM_NAME}${randomString}`
    newInstance2FullName = `${NEW_INSTANCE2_BASE_ELEM_NAME}${randomString}`
    newObjectElemName = NEW_OBJECT_BASE_ELEM_NAME + randomString
    newObjectApiName = `${newObjectElemName}${SALESFORCE_CUSTOM_SUFFIX}`
    newObjectStandardFieldRelativePath = `${SALESFORCE}/${OBJECTS_PATH}/${newObjectElemName}/${newObjectElemName}StandardFields.nacl`
    newObjectAnnotationsRelativePath = `${SALESFORCE}/${OBJECTS_PATH}/${newObjectElemName}/${newObjectElemName}Annotations.nacl`
    tmpNaclFileRelativePath = `${SALESFORCE}/${OBJECTS_PATH}/${newObjectElemName}.nacl`

    process.env[SALTO_HOME_VAR] = homePath
    credsLease = await salesforceTestHelpers().credentials()
    client = new SalesforceClient({ credentials: credsLease.value })
    await mkdirp(`${fetchOutputDir}/salto.config`)
    await mkdirp(`${fetchOutputDir}/salto.config/adapters`)
    await mkdirp(localStorageDir)
    await mkdirp(localWorkspaceDir)
    await copyFile(workspaceConfigFile, `${fetchOutputDir}/salto.config/workspace.nacl`)
    await copyFile(envsConfigFile, `${fetchOutputDir}/salto.config/envs.nacl`)
    await copyFile(localWorkspaceConfigFile, `${localWorkspaceDir}/workspaceUser.nacl`)
    await rm(fullPath(tmpNaclFileRelativePath))
    if (await objectExists(client, newObjectApiName)) {
      await client.delete(CUSTOM_OBJECT, newObjectApiName)
    }
    if (await instanceExists(client, ROLE, newInstanceFullName)) {
      await client.delete(ROLE, newInstanceFullName)
    }
    if (await instanceExists(client, ROLE, newInstance2FullName)) {
      await client.delete(ROLE, newInstance2FullName)
    }
    await runSalesforceLogin(fetchOutputDir, getSalesforceCredsInstance(credsLease.value))
    await runFetch(fetchOutputDir)
  })

  afterAll(async () => {
    if (await objectExists(client, newObjectApiName)) {
      await client.delete(CUSTOM_OBJECT, newObjectApiName)
    }
    if (await instanceExists(client, ROLE, newInstanceFullName)) {
      await client.delete(ROLE, newInstanceFullName)
    }
    if (await instanceExists(client, ROLE, newInstance2FullName)) {
      await client.delete(ROLE, newInstance2FullName)
    }
    await rm(homePath)
    if (credsLease.return) {
      await credsLease.return()
    }
  })

  const verifyTmpNaclFileObjectSourceMap = (sourceMap: parser.SourceMap, object: ObjectType,
    fieldNames: string[], annotations: string[] = [API_NAME, METADATA_TYPE],
    annotationTypes: string[] = [API_NAME, METADATA_TYPE]): void => {
    expect(sourceMap.has(object.elemID.getFullName())).toBeTruthy()
    expect(sourceMap.has(object.elemID.createNestedID('annotation').getFullName())).toBeTruthy()
    fieldNames.forEach(fieldName =>
      expect(sourceMap.has(object.fields[fieldName].elemID.getFullName())).toBeTruthy())
    annotations.forEach(annotation =>
      expect(sourceMap.has(object.elemID.createNestedID('attr', annotation).getFullName()))
        .toBeTruthy())
    annotationTypes.forEach(annotationType =>
      expect(sourceMap.has(object.elemID.createNestedID('annotation', annotationType).getFullName()))
        .toBeTruthy())
  }

  describe('initial fetch', () => {
    it('should create fetchOutputDir', async () => {
      expect(await exists(fetchOutputDir)).toBe(true)
    })
    it('should create statePath', async () => {
      expect(await exists(statePath)).toBe(true)
    })
    it('should hide Types folder', async () => {
      expect(await exists(`${fetchOutputDir}/salesforce/Types`))
        .toBe(false)
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('deploy with a new object, instance, and instance with variable expressions', () => {
    let workspace: Workspace
    beforeAll(async () => {
      await copyFile(addModelNaclFile, fullPath(tmpNaclFileRelativePath))
      await editNaclFile(fullPath(tmpNaclFileRelativePath), [
        // Replace all occurrences
        [new RegExp(NEW_OBJECT_BASE_ELEM_NAME, 'g'), newObjectElemName],
        [new RegExp(NEW_INSTANCE_BASE_ELEM_NAME, 'g'), newInstanceElemName],
        [new RegExp(NEW_INSTANCE2_BASE_ELEM_NAME, 'g'), newInstance2ElemName],
      ])
      await runDeploy({ lastPlan, fetchOutputDir })
      workspace = await loadValidWorkspace(fetchOutputDir)
    })
    it('should have "add" changes', async () => {
      verifyChanges(lastPlan, [{ action: 'add', element: newObjectElemName },
        { action: 'add', element: newInstanceElemName },
        { action: 'add', element: newInstance2ElemName }])
    })
    it('should create the object in salesforce', async () => {
      expect(await objectExists(client, newObjectApiName, ['Alpha__c', 'Beta__c'])).toBe(true)
    })
    it('should create the instance in salesforce', async () => {
      expect(await instanceExists(client, ROLE, newInstanceFullName,
        { description: 'To Be Modified' })).toBe(true)
    })
    it('should update the object in the Nacl file', async () => {
      const newObject = verifyObject(await workspace.elements(), SALESFORCE, newObjectElemName,
        { [API_NAME]: BuiltinTypes.SERVICE_ID, [METADATA_TYPE]: BuiltinTypes.SERVICE_ID },
        { [API_NAME]: newObjectApiName, [METADATA_TYPE]: CUSTOM_OBJECT },
        {
          Alpha: apiNameAnno(newObjectApiName, 'Alpha__c'),
          Beta: apiNameAnno(newObjectApiName, 'Beta__c'),
        })
      await verifyTmpNaclFileObjectSourceMap(
        await workspace.getSourceMap(tmpNaclFileRelativePath), newObject, ['Alpha', 'Beta']
      )
    })
    it('should update the instance in the Nacl file', async () => {
      verifyInstance(await workspace.elements(), SALESFORCE, ROLE, newInstanceElemName,
        { description: 'To Be Modified', [INSTANCE_FULL_NAME_FIELD]: newInstanceFullName })
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('deploy after modifying the object and the instance', () => {
    beforeAll(async () => {
      await editNaclFile(fullPath(tmpNaclFileRelativePath), [
        ['Beta', 'Modified'],
        ['Beta__c', 'Modified__c'],
        ['To Be Modified', 'I Am Modified'],
      ])
      await runDeploy({ lastPlan, fetchOutputDir })
    })
    it('should have "modify" changes', async () => {
      verifyChanges(lastPlan, [
        { action: 'remove', element: 'Beta' },
        { action: 'add', element: 'Modified' },
        { action: 'modify', element: newInstanceElemName },
        // This instance is modified because its description is a variable
        // with the value of a reference to the description of the previous instance.
        { action: 'modify', element: newInstance2ElemName }])
    })
    it('should update the object in salesforce', async () => {
      expect(await objectExists(client, newObjectApiName, ['Alpha__c', 'Modified__c']))
        .toBe(true)
    })
    it('should update the instance in salesforce', async () => {
      expect(await instanceExists(client, ROLE, newInstanceFullName,
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
    it('should fetch the new object standard fields and annotations to the correct files', async () => {
      const newObject = verifyObject(await workspace.elements(), SALESFORCE, newObjectElemName,
        {
          [API_NAME]: BuiltinTypes.SERVICE_ID,
          [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
          enableFeeds: BuiltinTypes.BOOLEAN,
        },
        { [API_NAME]: newObjectApiName, [METADATA_TYPE]: CUSTOM_OBJECT },
        {
          Alpha: apiNameAnno(newObjectApiName, 'Alpha__c'),
          Modified: apiNameAnno(newObjectApiName, 'Modified__c'),
          IsDeleted: apiNameAnno(newObjectApiName, 'IsDeleted'),
        })

      await verifyTmpNaclFileObjectSourceMap(
        await workspace.getSourceMap(tmpNaclFileRelativePath), newObject, ['Alpha', 'Modified']
      )
      const annotationObjSourceMap = await workspace.getSourceMap(newObjectAnnotationsRelativePath)
      const standardFieldsObjSourceMap = await workspace
        .getSourceMap(newObjectStandardFieldRelativePath)
      expect(standardFieldsObjSourceMap.has(newObject.elemID.getFullName())).toBeTruthy()
      expect(standardFieldsObjSourceMap.has(newObject.elemID.createNestedID('annotation')
        .getFullName())).toBeFalsy()
      expect(standardFieldsObjSourceMap.has(newObject.fields.IsDeleted.elemID.getFullName()))
        .toBeTruthy()
      expect(annotationObjSourceMap.has(newObject.elemID.getFullName())).toBeTruthy()
      expect(annotationObjSourceMap.has(newObject.elemID.createNestedID('annotation').getFullName()))
        .toBeTruthy()
      expect(annotationObjSourceMap.has(newObject.elemID.createNestedID('annotation', 'enableFeeds')
        .getFullName())).toBeTruthy()
      expect(annotationObjSourceMap.has(newObject.elemID.createNestedID('attr', 'enableFeeds')
        .getFullName())).toBeTruthy()
    })
    it('should have no change in the instance', async () => {
      verifyInstance((await workspace.elements()), SALESFORCE, ROLE, newInstanceElemName,
        { description: 'I Am Modified', [INSTANCE_FULL_NAME_FIELD]: newInstanceFullName })
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('fetch with enableHideTypesInNacls false value', () => {
    beforeAll(async () => {
      await copyFile(salesforceConfigFile, `${fetchOutputDir}/salto.config/adapters/salesforce.nacl`)

      await runFetch(fetchOutputDir)
    })


    it('should not hide Types folder', async () => {
      expect(await exists(`${fetchOutputDir}/salesforce/Types`))
        .toBe(true)
    })

    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)

      await rm(`${fetchOutputDir}/salto.config/adapters/salesforce.nacl`)
    })
  })

  describe('deploy after deleting the object and the instance', () => {
    beforeAll(async () => {
      await rm(fullPath(tmpNaclFileRelativePath))
      await rm(fullPath(newObjectAnnotationsRelativePath))
      await rm(fullPath(newObjectStandardFieldRelativePath))
      // We have to run preview first, otherwise the last plan won't be updated
      lastPlan.clear()
      await runPreview(fetchOutputDir)
      // We have to run deploy with force = true because after we delete the new object
      // there are unresolved reference warnings in the workspace
      await runDeploy({ fetchOutputDir, allowErrors: false, force: true })
    })
    it('should have "remove" changes', async () => {
      verifyChanges(lastPlan, [
        { action: 'remove', element: newObjectElemName },
        { action: 'remove', element: newInstanceElemName },
        { action: 'remove', element: newInstance2ElemName },
      ])
    })
    it('should remove the object in salesforce', async () => {
      expect(await objectExists(client, newObjectApiName)).toBe(false)
    })
    it('should remove the instance in salesforce', async () => {
      expect(await instanceExists(client, ROLE, newInstanceFullName)).toBe(false)
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })
})
