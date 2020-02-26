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
import { strings } from '@salto-io/lowerdash'
import { testHelpers as salesforceTestHelpers, SalesforceClient } from '@salto-io/salesforce-adapter'
import { Plan, file, Workspace, SALTO_HOME_VAR, SourceMap } from '@salto-io/core'
import {
  API_NAME, CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, SALESFORCE,
  SALESFORCE_CUSTOM_SUFFIX, API_NAME_SEPERATOR, OBJECTS_PATH, METADATA_TYPE,
} from '@salto-io/salesforce-adapter/dist/src/constants'
import { BuiltinTypes, ObjectType } from '@salto-io/adapter-api'
import * as formatterImpl from '../src/formatter'
import * as callbacksImpl from '../src/callbacks'
import {
  editBlueprint, loadValidWorkspace, runDeploy, runFetch, verifyChanges, verifyInstance,
  verifyObject, runEmptyPreview, runSalesforceLogin,
} from './helpers/workspace'
import { instanceExists, objectExists } from './helpers/salesforce'

const { copyFile, rm, mkdirp, exists } = file

let lastPlan: Plan

const apiNameAnno = (
  obj: string,
  field: string
): Record<string, string> => ({ [API_NAME]: [obj, field].join(API_NAME_SEPERATOR) })

describe('cli e2e', () => {
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
    jest.spyOn(callbacksImpl, 'getEnvName').mockImplementation(
      () => Promise.resolve('default')
    )
  })

  const addModelBP = `${__dirname}/../../e2e_test/BP/add.bp`
  const configFile = `${__dirname}/../../e2e_test/BP/salto.config/config.bp`
  const envConfigFile = `${__dirname}/../../e2e_test/BP/salto.config/env.bp`
  const NEW_INSTANCE_BASE_ELEM_NAME = 'NewInstanceName'
  const NEW_OBJECT_BASE_ELEM_NAME = 'NewObjectName'

  let homePath: string
  let fetchOutputDir: string
  let localStorageDir: string
  let statePath: string
  let randomString: string
  let tmpBPRelativePath: string
  let newInstanceElemName: string
  let newInstanceFullName: string
  let newObjectElemName: string
  let newObjectApiName: string
  let newObjectStandardFieldRelativePath: string
  let newObjectAnnotationsRelativePath: string

  const ROLE = 'Role'
  let client: SalesforceClient

  const fullPath = (bpPartialPath: string): string =>
    path.join(fetchOutputDir, bpPartialPath)

  beforeAll(async () => {
    homePath = tmp.dirSync().name
    fetchOutputDir = `${homePath}/BP/test_fetch`
    localStorageDir = `${homePath}/.salto/test_fetch`
    statePath = `${fetchOutputDir}/envs/default/salto.config/state.bpc`
    randomString = strings.insecureRandomString({ alphabet: strings.LOWERCASE, length: 12 })
    newInstanceElemName = NEW_INSTANCE_BASE_ELEM_NAME + randomString
    newInstanceFullName = `${NEW_INSTANCE_BASE_ELEM_NAME}${randomString}`
    newObjectElemName = NEW_OBJECT_BASE_ELEM_NAME + randomString
    newObjectApiName = `${newObjectElemName}${SALESFORCE_CUSTOM_SUFFIX}`
    newObjectStandardFieldRelativePath = `${SALESFORCE}/${OBJECTS_PATH}/${newObjectElemName}/${newObjectElemName}StandardFields.bp`
    newObjectAnnotationsRelativePath = `${SALESFORCE}/${OBJECTS_PATH}/${newObjectElemName}/${newObjectElemName}Annotations.bp`
    tmpBPRelativePath = `${SALESFORCE}/${OBJECTS_PATH}/${newObjectElemName}.bp`

    process.env[SALTO_HOME_VAR] = homePath
    client = new SalesforceClient({ credentials: salesforceTestHelpers().credentials })
    await mkdirp(`${fetchOutputDir}/salto.config`)
    await mkdirp(`${fetchOutputDir}/envs/default/salto.config`)
    await mkdirp(localStorageDir)
    await copyFile(configFile, `${fetchOutputDir}/salto.config/config.bp`)
    await copyFile(envConfigFile, `${fetchOutputDir}/envs/default/salto.config/config.bp`)
    await rm(fullPath(tmpBPRelativePath))
    if (await objectExists(client, newObjectApiName)) {
      await client.delete(CUSTOM_OBJECT, newObjectApiName)
    }
    if (await instanceExists(client, ROLE, newInstanceFullName)) {
      await client.delete(ROLE, newInstanceFullName)
    }
    await runSalesforceLogin(fetchOutputDir)
    await runFetch(fetchOutputDir)
  })

  afterAll(async () => {
    if (await objectExists(client, newObjectApiName)) {
      await client.delete(CUSTOM_OBJECT, newObjectApiName)
    }
    if (await instanceExists(client, ROLE, newInstanceFullName)) {
      await client.delete(ROLE, newInstanceFullName)
    }
    await rm(homePath)
  })

  const verifyTmpBpObjectSourceMap = (sourceMap: SourceMap, object: ObjectType,
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
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('deploy with a new object and instance', () => {
    let workspace: Workspace
    beforeAll(async () => {
      await copyFile(addModelBP, fullPath(tmpBPRelativePath))
      await editBlueprint(fullPath(tmpBPRelativePath), [
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
      expect(await instanceExists(client, ROLE, newInstanceFullName,
        { description: 'To Be Modified' })).toBe(true)
    })
    it('should update the object in the BP', async () => {
      const newObject = verifyObject(await workspace.elements, SALESFORCE, newObjectElemName,
        { [API_NAME]: BuiltinTypes.SERVICE_ID, [METADATA_TYPE]: BuiltinTypes.SERVICE_ID },
        { [API_NAME]: newObjectApiName, [METADATA_TYPE]: CUSTOM_OBJECT },
        { Alpha: apiNameAnno(newObjectApiName, 'Alpha__c'),
          Beta: apiNameAnno(newObjectApiName, 'Beta__c') })
      await verifyTmpBpObjectSourceMap(await workspace.getSourceMap(tmpBPRelativePath), newObject,
        ['Alpha', 'Beta'])
    })
    it('should update the instance in the BP', async () => {
      verifyInstance(await workspace.elements, SALESFORCE, ROLE, newInstanceElemName,
        { description: 'To Be Modified', [INSTANCE_FULL_NAME_FIELD]: newInstanceFullName })
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })

  describe('deploy after modifying the object and the instance', () => {
    beforeAll(async () => {
      await editBlueprint(fullPath(tmpBPRelativePath), [
        ['Beta', 'Modified'],
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
      const newObject = verifyObject(await workspace.elements, SALESFORCE, newObjectElemName,
        { [API_NAME]: BuiltinTypes.SERVICE_ID,
          [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
          enableFeeds: BuiltinTypes.BOOLEAN },
        { [API_NAME]: newObjectApiName, [METADATA_TYPE]: CUSTOM_OBJECT },
        { Alpha: apiNameAnno(newObjectApiName, 'Alpha__c'),
          Modified: apiNameAnno(newObjectApiName, 'Modified__c'),
          IsDeleted: apiNameAnno(newObjectApiName, 'IsDeleted') })

      await verifyTmpBpObjectSourceMap(await workspace.getSourceMap(tmpBPRelativePath), newObject,
        ['Alpha', 'Modified'])

      const standardFieldsObjSourceMap = await workspace
        .getSourceMap(newObjectStandardFieldRelativePath)
      expect(standardFieldsObjSourceMap.has(newObject.elemID.getFullName())).toBeTruthy()
      expect(standardFieldsObjSourceMap.has(newObject.elemID.createNestedID('annotation')
        .getFullName())).toBeFalsy()
      expect(standardFieldsObjSourceMap.has(newObject.fields.IsDeleted.elemID.getFullName()))
        .toBeTruthy()

      const annotationObjSourceMap = await workspace.getSourceMap(newObjectAnnotationsRelativePath)
      expect(annotationObjSourceMap.has(newObject.elemID.getFullName())).toBeTruthy()
      expect(annotationObjSourceMap.has(newObject.elemID.createNestedID('annotation').getFullName()))
        .toBeTruthy()
      expect(annotationObjSourceMap.has(newObject.elemID.createNestedID('annotation', 'enableFeeds')
        .getFullName())).toBeTruthy()
      expect(annotationObjSourceMap.has(newObject.elemID.createNestedID('attr', 'enableFeeds')
        .getFullName())).toBeTruthy()
    })
    it('should have no change in the instance', async () => {
      verifyInstance(await workspace.elements, SALESFORCE, ROLE, newInstanceElemName,
        { description: 'I Am Modified', [INSTANCE_FULL_NAME_FIELD]: newInstanceFullName })
    })
    afterAll(async () => {
      await runEmptyPreview(lastPlan, fetchOutputDir)
    })
  })
  describe('deploy after deleting the object and the instance', () => {
    beforeAll(async () => {
      await rm(fullPath(tmpBPRelativePath))
      await rm(fullPath(newObjectAnnotationsRelativePath))
      await rm(fullPath(newObjectStandardFieldRelativePath))
      // delete references from SearchSettings
      await editBlueprint(fullPath('salesforce/Records/Settings/Search.bp'),
        [
          [`{
            enhancedLookupEnabled = false
            lookupAutoCompleteEnabled = false
            name = salesforce.${newObjectElemName}
            resultsPerPageCount = 0
          },`, ''],
        ])
      await runDeploy(lastPlan, fetchOutputDir)
    })
    it('should have "remove" changes', async () => {
      verifyChanges(lastPlan, [
        { action: 'remove', element: newObjectElemName },
        { action: 'remove', element: newInstanceElemName },
        // modify on SearchSettings
        { action: 'modify', element: '_config' }])
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
