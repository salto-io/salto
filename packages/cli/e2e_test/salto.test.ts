/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { strings, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { copyFile, rm, mkdirp, exists, readFile, writeFile } from '@salto-io/file'
import { SalesforceClient, UsernamePasswordCredentials } from '@salto-io/salesforce-adapter'
// eslint-disable-next-line no-restricted-imports
import { testHelpers as salesforceTestHelpers } from '@salto-io/salesforce-adapter/dist/e2e_test/jest_environment'
import { Plan, SALTO_HOME_VAR } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { parser } from '@salto-io/parser'
// eslint-disable-next-line no-restricted-imports
import {
  API_NAME,
  CUSTOM_OBJECT,
  INSTANCE_FULL_NAME_FIELD,
  SALESFORCE_CUSTOM_SUFFIX,
  API_NAME_SEPARATOR,
  OBJECTS_PATH,
  METADATA_TYPE,
  CUSTOM_FIELD,
} from '@salto-io/salesforce-adapter/dist/src/constants'
import { BuiltinTypes, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import * as callbacksImpl from '../src/callbacks'
import * as DeployCommandImpl from '../src/commands/deploy'
import {
  editNaclFile,
  loadValidWorkspace,
  runDeploy,
  runFetch,
  verifyChanges,
  verifyInstance,
  verifyObject,
  runEmptyPreview,
  runSalesforceLogin,
  cleanup as workspaceHelpersCleanup,
  runCreateEnv,
  runDeleteEnv,
  runSetEnv,
  runPreviewGetPlan,
  runClean,
} from './helpers/workspace'
import { instanceExists, objectExists, getSalesforceCredsInstance, getSalesforceClient } from './helpers/salesforce'

const { awu } = collections.asynciterable

const SALESFORCE_SERVICE_NAME = 'salesforce'
const ALTERNATIVE_SALESFORCE_ACCOUNT_NAME = 'e2esalesforce'
const apiNameAnno = (obj: string, field: string): Record<string, string> => ({
  [API_NAME]: [obj, field].join(API_NAME_SEPARATOR),
})
const log = logger(module)

describe.each([[SALESFORCE_SERVICE_NAME], [ALTERNATIVE_SALESFORCE_ACCOUNT_NAME]])(
  'cli e2e with account name %s',
  accountName => {
    jest.setTimeout(15 * 60 * 1000)
    // in the case that account name is just normal salesforce
    // we want to go through the default behavior, so we send undefined, instead of ['salesforce']
    const accounts = accountName === SALESFORCE_SERVICE_NAME ? undefined : [accountName]
    afterAll(async () => {
      await workspaceHelpersCleanup()
      log.info('cli e2e: Log counts = %o', log.getLogCount())
    })

    const workspaceConfigFile = `${__dirname}/../e2e_test/NACL/salto.config/workspace.nacl`
    const localWorkspaceConfigFile = `${__dirname}/../e2e_test/NACL/salto.config/local/workspaceUser.nacl`
    const NEW_INSTANCE_BASE_ELEM_NAME = 'NewInstanceName'
    const NEW_INSTANCE2_BASE_ELEM_NAME = 'NewInstance2Name'
    const NEW_INSTANCE_WITH_STATIC_FILE_BASE_ELEM_NAME = 'NewInstanceWithStaticFile'
    const NEW_OBJECT_BASE_ELEM_NAME = 'NewObjectName'

    let credsLease: CredsLease<UsernamePasswordCredentials>
    let homePath: string
    let fetchOutputDir: string
    let localStorageDir: string
    let localWorkspaceDir: string
    let statePath: string
    let randomString: string
    let tmpNaclFileRelativePath: string
    let newInstanceElemName: string
    let newInstance2ElemName: string
    let newInstanceWithStaticFileElemName: string
    let newStaticFilePath: string
    let newObjectElemName: string
    let newObjectApiName: string
    let newObjectStandardFieldRelativePath: string
    let newObjectAnnotationsRelativePath: string
    let newObjectCustomFieldRelativePath: string

    const ROLE = 'Role'
    const STATIC_RESOURCE = 'StaticResource'
    let client: SalesforceClient

    const fullPath = (partialPath: string): string => path.join(fetchOutputDir, partialPath)

    beforeAll(async () => {
      log.resetLogCount()
      homePath = tmp.dirSync().name
      randomString = strings.insecureRandomString({ alphabet: strings.LOWERCASE, length: 12 })
      fetchOutputDir = `${homePath}/NACL/test_fetch`
      localStorageDir = `${homePath}/.salto/test_fetch`
      localWorkspaceDir = `${homePath}/e2e-375e3f65-be66-4fdc-a561-4c4f9735db94`
      statePath = `${fetchOutputDir}/salto.config/states/default.${accountName}.jsonl.zip`
      newInstanceElemName = NEW_INSTANCE_BASE_ELEM_NAME + randomString
      newInstance2ElemName = NEW_INSTANCE2_BASE_ELEM_NAME + randomString
      newInstanceWithStaticFileElemName = NEW_INSTANCE_WITH_STATIC_FILE_BASE_ELEM_NAME + randomString
      newStaticFilePath = `${accountName}/Records/${STATIC_RESOURCE}/${newInstanceWithStaticFileElemName}.json`
      newObjectElemName = NEW_OBJECT_BASE_ELEM_NAME + randomString
      newObjectApiName = `${newObjectElemName}${SALESFORCE_CUSTOM_SUFFIX}`
      newObjectStandardFieldRelativePath = `${accountName}/${OBJECTS_PATH}/${newObjectElemName}/${newObjectElemName}StandardFields.nacl`
      newObjectAnnotationsRelativePath = `${accountName}/${OBJECTS_PATH}/${newObjectElemName}/${newObjectElemName}Annotations.nacl`
      newObjectCustomFieldRelativePath = `${accountName}/${OBJECTS_PATH}/${newObjectElemName}/${newObjectElemName}CustomFields.nacl`
      tmpNaclFileRelativePath = `${accountName}/${OBJECTS_PATH}/${newObjectElemName}.nacl`

      process.env[SALTO_HOME_VAR] = homePath
      credsLease = await salesforceTestHelpers().credentials()
      client = getSalesforceClient(credsLease.value)
      jest.spyOn(DeployCommandImpl, 'shouldDeploy').mockImplementation((p: Plan): Promise<boolean> => {
        const { length } = [...wu(p.itemsByEvalOrder())]
        return Promise.resolve(length < 100) // Safety to avoid breaking the SF instance
      })
      jest.spyOn(callbacksImpl, 'getEnvName').mockImplementation(() => Promise.resolve('default'))
      jest
        .spyOn(callbacksImpl, 'getCredentialsFromUser')
        .mockResolvedValue(getSalesforceCredsInstance(credsLease.value))
      await mkdirp(`${fetchOutputDir}/salto.config`)
      await mkdirp(`${fetchOutputDir}/salto.config/adapters`)
      await mkdirp(`${fetchOutputDir}/salto.config/adapters/${accountName}`)
      await mkdirp(localStorageDir)
      await mkdirp(localWorkspaceDir)
      await copyFile(workspaceConfigFile, `${fetchOutputDir}/salto.config/workspace.nacl`)
      await writeFile(
        `${fetchOutputDir}/salto.config/envs.nacl`,
        `envs {
      envs = [
       {
         name = "default"
         accounts = ["${accountName}"]
         accountToServiceName = {
           ${accountName} = "salesforce"
         }
       }
     ]
   }`,
      )
      await copyFile(localWorkspaceConfigFile, `${localWorkspaceDir}/workspaceUser.nacl`)
      await rm(fullPath(tmpNaclFileRelativePath))
      if (await objectExists(client, newObjectApiName)) {
        await client.delete(CUSTOM_OBJECT, newObjectApiName)
      }
      if (await instanceExists(client, ROLE, newInstanceElemName)) {
        await client.delete(ROLE, newInstanceElemName)
      }
      if (await instanceExists(client, ROLE, newInstance2ElemName)) {
        await client.delete(ROLE, newInstance2ElemName)
      }
      if (await instanceExists(client, STATIC_RESOURCE, newInstanceWithStaticFileElemName)) {
        await client.delete(STATIC_RESOURCE, newInstanceWithStaticFileElemName)
      }
      await runSalesforceLogin(fetchOutputDir, accountName)
      await runFetch(fetchOutputDir)
    })

    afterAll(async () => {
      if (await objectExists(client, newObjectApiName)) {
        await client.delete(CUSTOM_OBJECT, newObjectApiName)
      }
      if (await instanceExists(client, ROLE, newInstanceElemName)) {
        await client.delete(ROLE, newInstanceElemName)
      }
      if (await instanceExists(client, ROLE, newInstance2ElemName)) {
        await client.delete(ROLE, newInstance2ElemName)
      }
      if (await instanceExists(client, STATIC_RESOURCE, newInstanceWithStaticFileElemName)) {
        await client.delete(STATIC_RESOURCE, newInstanceWithStaticFileElemName)
      }
      await rm(homePath)
      if (credsLease.return) {
        await credsLease.return()
      }
    })

    const verifyTmpNaclFileObjectSourceMap = (
      sourceMap: parser.SourceMap,
      object: ObjectType,
      fieldNames: string[],
      annotations: string[] = [API_NAME, METADATA_TYPE],
      annotationTypes: string[] = [API_NAME, METADATA_TYPE],
    ): void => {
      expect(sourceMap.has(object.elemID.getFullName())).toBeTruthy()
      expect(sourceMap.has(object.elemID.createNestedID('annotation').getFullName())).toBeTruthy()
      fieldNames.forEach(fieldName => expect(sourceMap.has(object.fields[fieldName].elemID.getFullName())).toBeTruthy())
      annotations.forEach(annotation =>
        expect(sourceMap.has(object.elemID.createNestedID('attr', annotation).getFullName())).toBeTruthy(),
      )
      annotationTypes.forEach(annotationType =>
        expect(sourceMap.has(object.elemID.createNestedID('annotation', annotationType).getFullName())).toBeTruthy(),
      )
    }

    describe('initial fetch', () => {
      it('should create fetchOutputDir', async () => {
        expect(await exists(fetchOutputDir)).toBe(true)
      })
      it('should create statePath', async () => {
        expect(await exists(statePath)).toBe(true)
      })
      it('should not hide Types folder', async () => {
        expect(await exists(`${fetchOutputDir}/${accountName}/Types`)).toBe(true)
      })
      afterAll(async () => {
        await runEmptyPreview(fetchOutputDir, accounts)
      })
    })

    describe('deploy with a new object, instance, and instance with variable expressions', () => {
      let workspace: Workspace
      let deployPlan: Plan
      beforeAll(async () => {
        await writeFile(
          fullPath(tmpNaclFileRelativePath),
          `type ${accountName}.NewObjectName {
        annotations {
          serviceid metadataType {
          }
          salesforce.CustomField nameField {
          }
          string pluralLabel {
          }
          string sharingModel {
          }
          string deploymentStatus {
          }
        }
        metadataType = "CustomObject"
        nameField = {
          label = "Name"
          type = "Text"
        }
        pluralLabel = "TestDiffObjozkjqxojoxhfs"
        sharingModel = "ReadWrite"
        deploymentStatus = "Deployed"
        ${accountName}.Text Alpha {
          label = "Alpha"
          _required = false
        }
        ${accountName}.Text Beta {
          label = "Beta"
          _required = false
        }
      }
      
      ${accountName}.Role NewInstanceName {
        description = "To Be Modified"
        name = "New Role Instance"
      }
      
      ${accountName}.Role NewInstance2Name {
        description = var.desc
        name = "Another new Role Instance"
        mayForecastManagerShare = var.isStaging
      }

      ${accountName}.StaticResource ${newInstanceWithStaticFileElemName} {
        cacheControl = "Public"
        contentType = "application/json"
        description = "Some static resource"
        fullName = "${newInstanceWithStaticFileElemName}"
        content = file("${newStaticFilePath}")
      }
      
      vars {
        desc = ${accountName}.Role.instance.NewInstanceName.description
        isStaging = false
        age = 60
      }`,
        )
        await editNaclFile(fullPath(tmpNaclFileRelativePath), [
          // Replace all occurrences
          [new RegExp(NEW_OBJECT_BASE_ELEM_NAME, 'g'), newObjectElemName],
          [new RegExp(NEW_INSTANCE_BASE_ELEM_NAME, 'g'), newInstanceElemName],
          [new RegExp(NEW_INSTANCE2_BASE_ELEM_NAME, 'g'), newInstance2ElemName],
        ])
        const fullNewStaticFilePath = fullPath(`static-resources/${newStaticFilePath}`)
        await mkdirp(path.dirname(fullNewStaticFilePath))
        await writeFile(fullNewStaticFilePath, '{}')
        deployPlan = await runPreviewGetPlan(fetchOutputDir, accounts)
        await runDeploy({ workspacePath: fetchOutputDir })
        workspace = await loadValidWorkspace(fetchOutputDir)
      })
      it('should have "add" changes', async () => {
        verifyChanges(deployPlan, [
          { action: 'add', element: newObjectElemName },
          { action: 'add', element: newInstanceElemName },
          { action: 'add', element: newInstance2ElemName },
          { action: 'add', element: newInstanceWithStaticFileElemName },
        ])
      })
      it('should create the object in salesforce', async () => {
        expect(await objectExists(client, newObjectApiName, ['Alpha__c', 'Beta__c'])).toBe(true)
      })
      it('should create the instance in salesforce', async () => {
        expect(await instanceExists(client, ROLE, newInstanceElemName, { description: 'To Be Modified' })).toBe(true)
        expect(await instanceExists(client, STATIC_RESOURCE, newInstanceWithStaticFileElemName)).toBeTruthy()
      })
      it('should update the object in the Nacl file', async () => {
        const elements = await awu(await (await workspace.elements()).getAll()).toArray()
        const newObject = await verifyObject(
          elements,
          accountName,
          newObjectElemName,
          {
            [API_NAME]: BuiltinTypes.SERVICE_ID,
            [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
          },
          { [API_NAME]: newObjectApiName, [METADATA_TYPE]: CUSTOM_OBJECT },
          {
            Alpha: apiNameAnno(newObjectApiName, 'Alpha__c'),
            Beta: apiNameAnno(newObjectApiName, 'Beta__c'),
          },
        )
        verifyTmpNaclFileObjectSourceMap(await workspace.getSourceMap(tmpNaclFileRelativePath), newObject, [
          'Alpha',
          'Beta',
        ])
      })
      it('should update the instance in the Nacl file', async () => {
        await verifyInstance(await (await workspace.elements()).getAll(), accountName, ROLE, newInstanceElemName, {
          description: 'To Be Modified',
          [INSTANCE_FULL_NAME_FIELD]: newInstanceElemName,
        })
      })
      afterAll(async () => {
        await runEmptyPreview(fetchOutputDir, accounts)
      })
    })

    describe('deploy after modifying the object and the instance', () => {
      let deployPlan: Plan
      beforeAll(async () => {
        await editNaclFile(fullPath(tmpNaclFileRelativePath), [
          ['Beta', 'Modified'],
          ['Beta__c', 'Modified__c'],
          ['To Be Modified', 'I Am Modified'],
        ])
        deployPlan = await runPreviewGetPlan(fetchOutputDir, accounts)
        await runDeploy({ workspacePath: fetchOutputDir })
      })
      it('should have "modify" changes', async () => {
        verifyChanges(deployPlan, [
          { action: 'remove', element: 'Beta' },
          { action: 'add', element: 'Modified' },
          { action: 'modify', element: newInstanceElemName },
          // This instance is modified because its description is a variable
          // with the value of a reference to the description of the previous instance.
          { action: 'modify', element: newInstance2ElemName },
        ])
      })
      it('should update the object in salesforce', async () => {
        expect(await objectExists(client, newObjectApiName, ['Alpha__c', 'Modified__c'])).toBe(true)
      })
      it('should update the instance in salesforce', async () => {
        expect(await instanceExists(client, ROLE, newInstanceElemName, { description: 'I Am Modified' })).toBe(true)
      })
      afterAll(async () => {
        await runEmptyPreview(fetchOutputDir, accounts)
      })
    })
    describe('fetch expecting no changes', () => {
      let workspace: Workspace
      beforeAll(async () => {
        await runFetch(fetchOutputDir)
        workspace = await loadValidWorkspace(fetchOutputDir)
      })
      it('should fetch the new object standard fields and annotations to the correct files', async () => {
        const elements = await awu(await (await workspace.elements()).getAll()).toArray()
        const newObject = await verifyObject(
          elements,
          accountName,
          newObjectElemName,
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
          },
        )

        verifyTmpNaclFileObjectSourceMap(await workspace.getSourceMap(tmpNaclFileRelativePath), newObject, [
          'Alpha',
          'Modified',
        ])
        const annotationObjSourceMap = await workspace.getSourceMap(newObjectAnnotationsRelativePath)
        const standardFieldsObjSourceMap = await workspace.getSourceMap(newObjectStandardFieldRelativePath)
        expect(standardFieldsObjSourceMap.has(newObject.elemID.getFullName())).toBeTruthy()
        expect(standardFieldsObjSourceMap.has(newObject.elemID.createNestedID('annotation').getFullName())).toBeFalsy()
        expect(standardFieldsObjSourceMap.has(newObject.fields.IsDeleted.elemID.getFullName())).toBeTruthy()
        expect(annotationObjSourceMap.has(newObject.elemID.getFullName())).toBeTruthy()
        expect(annotationObjSourceMap.has(newObject.elemID.createNestedID('annotation').getFullName())).toBeTruthy()
        expect(
          annotationObjSourceMap.has(newObject.elemID.createNestedID('annotation', 'enableFeeds').getFullName()),
        ).toBeTruthy()
        expect(
          annotationObjSourceMap.has(newObject.elemID.createNestedID('attr', 'enableFeeds').getFullName()),
        ).toBeTruthy()
      })
      it('should have no change in the instance', async () => {
        await verifyInstance(await (await workspace.elements()).getAll(), accountName, ROLE, newInstanceElemName, {
          description: 'I Am Modified',
          [INSTANCE_FULL_NAME_FIELD]: newInstanceElemName,
        })
      })
      afterAll(async () => {
        await runEmptyPreview(fetchOutputDir, accounts)
      })
    })

    describe('partial fetch', () => {
      let fetchedObject: ObjectType
      let fetchedRole: InstanceElement
      beforeAll(async () => {
        // Make two changes on salesforce, one in a custom object and one in a role
        const updatedField = {
          fullName: `${newObjectApiName}.Alpha__c`,
          type: 'Text',
          label: 'updated label',
          length: 80,
        }
        await client.upsert(CUSTOM_FIELD, updatedField)

        const updatedRole = {
          fullName: newInstanceElemName,
          name: 'Updated role name',
        }
        await client.upsert(ROLE, updatedRole)

        // Run partial fetch only for custom object
        await runFetch(fetchOutputDir, false, undefined, [`${accountName}.fetch.target=["${CUSTOM_OBJECT}"]`])

        const workspace = await loadValidWorkspace(fetchOutputDir)
        fetchedObject = await workspace.getValue(new ElemID(accountName, newObjectElemName))
        fetchedRole = await workspace.getValue(new ElemID(accountName, ROLE, 'instance', newInstanceElemName))
      })
      it('should update elements that were part of the partial fetch', () => {
        expect(fetchedObject).toBeInstanceOf(ObjectType)
        expect(fetchedObject.fields).toHaveProperty('Alpha')
        expect(fetchedObject.fields.Alpha.annotations.label).toEqual('updated label')
      })
      it('should not update elements that were not part of the partial fetch', () => {
        expect(fetchedRole).toBeInstanceOf(InstanceElement)
        expect(fetchedRole.value.name).not.toEqual('Updated role name')
      })
    })

    describe('deploy after deleting the object and the instance', () => {
      let deployPlan: Plan
      beforeAll(async () => {
        await rm(fullPath(tmpNaclFileRelativePath))
        await rm(fullPath(newObjectAnnotationsRelativePath))
        await rm(fullPath(newObjectStandardFieldRelativePath))
        await rm(fullPath(newObjectCustomFieldRelativePath))
        // We have to run preview before the deploy to get the plan
        deployPlan = await runPreviewGetPlan(fetchOutputDir, accounts)
        await runDeploy({ workspacePath: fetchOutputDir })
      })
      it('should have "remove" changes', async () => {
        verifyChanges(deployPlan, [
          { action: 'remove', element: newObjectElemName },
          { action: 'remove', element: newInstanceElemName },
          { action: 'remove', element: newInstance2ElemName },
          { action: 'remove', element: newInstanceWithStaticFileElemName },
        ])
      })
      it('should remove the object in salesforce', async () => {
        expect(await objectExists(client, newObjectApiName)).toBe(false)
      })
      it('should remove the instance in salesforce', async () => {
        expect(await instanceExists(client, ROLE, newInstanceElemName)).toBe(false)
      })
      afterAll(async () => {
        await runEmptyPreview(fetchOutputDir, accounts)
      })
    })
    describe('multi-env after initial fetch', () => {
      // Note: this test relies on the existence of the salesforce folder from an earlier fetch,
      // and should be run after all non-multienv tests have completed
      beforeAll(() => {
        jest.spyOn(callbacksImpl, 'cliApproveIsolateBeforeMultiEnv').mockImplementation(() => Promise.resolve(true))
      })
      afterEach(async () => {
        await runSetEnv(fetchOutputDir, 'default')
        try {
          await runDeleteEnv(fetchOutputDir, 'env2')
        } catch (err) {} // eslint-disable-line no-empty
        jest.clearAllMocks()
      })

      it('should not prompt when creating env with force=true', async () => {
        await runCreateEnv(fetchOutputDir, 'env2', true)
        expect(await exists(`${fetchOutputDir}/${accountName}`)).toBe(true)
        expect(await exists(`${fetchOutputDir}/envs/default/${accountName}`)).toBe(false)
        expect(await exists(`${fetchOutputDir}/envs/env2`)).toBe(false)
        expect(callbacksImpl.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
      })

      it('should move everything to the first env when isolating before 2nd env', async () => {
        await runCreateEnv(fetchOutputDir, 'env2')
        expect(await exists(`${fetchOutputDir}/envs/default/${accountName}`)).toBe(true)
        expect(await exists(`${fetchOutputDir}/${accountName}`)).toBe(false)
        expect(await exists(`${fetchOutputDir}/envs/env2`)).toBe(false)
        expect(callbacksImpl.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalled()
      })
    })
    describe('clean after initial fetch', () => {
      // Note: this should be the last test to run, as it will clear out parts of the workspace
      let salesforceConfPath: string
      beforeAll(async () => {
        salesforceConfPath = `${fetchOutputDir}/salto.config/adapters/${accountName}/${accountName}.nacl`
        await writeFile(
          `${fetchOutputDir}/salto.config/adapters/${accountName}/${accountName}.nacl`,
          `${accountName} {
        fetch = {
          exclude = [
            {
              metadataType = "Report"
            },
            {
              metadataType = "ReportType"
            },
            {
              metadataType = "ReportFolder"
            },
            {
              metadataType = "Dashboard"
            },
            {
              metadataType = "DashboardFolder"
            },
            {
              metadataType = "Profile"
            },
            {
              metadataType = "EmailTemplate"
            },
          ]
        }
        maxItemsInRetrieveRequest = 2500
        client = {
          maxConcurrentApiRequests = {
            retrieve = 3
          }
        }
      }`,
        )
      })

      it('should clear out only the requested parts - nacl', async () => {
        expect(`${fetchOutputDir}/envs/default/${accountName}`).toExist()
        expect(`${fetchOutputDir}/envs/default/static-resources`).toExist()
        expect(`${fetchOutputDir}/${accountName}`).not.toExist() // not checking common folder for now
        expect(`${fetchOutputDir}/salto.config/states/default.${accountName}.jsonl.zip`).toExist()
        await runClean({
          workspacePath: fetchOutputDir,
          cleanArgs: {
            state: false,
            cache: false,
            staticResources: false,
          },
        })
        expect(`${fetchOutputDir}/envs/default/${accountName}`).not.toExist()
        expect(`${fetchOutputDir}/envs/default/static-resources`).toExist()
        expect(`${fetchOutputDir}/salto.config/states/default.${accountName}.jsonl.zip`).toExist()
      })

      it('should clear out only the requested parts - state + static resources', async () => {
        expect(`${fetchOutputDir}/envs/default/static-resources`).toExist()
        expect(`${fetchOutputDir}/salto.config/states/default.${accountName}.jsonl.zip`).toExist()
        await runClean({
          workspacePath: fetchOutputDir,
          cleanArgs: {},
        })
        expect(`${fetchOutputDir}/envs`).not.toExist()
        expect(`${fetchOutputDir}/salto.config/states/default.${accountName}.jsonl.zip`).not.toExist()
      })

      it('should clear out only the requested parts - service config', async () => {
        const salesforceConfBefore = await readFile(salesforceConfPath)
        await runClean({
          workspacePath: fetchOutputDir,
          cleanArgs: {
            nacl: false,
            state: false,
            cache: false,
            staticResources: false,
            accountConfig: true,
          },
        })
        expect(await readFile(salesforceConfPath)).not.toEqual(salesforceConfBefore)
      })
    })
  },
)
