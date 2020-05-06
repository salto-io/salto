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
import { SalesforceClient, testHelpers as salesforceTestHelpers, Credentials } from '@salto-io/salesforce-adapter'
import path from 'path'
import { Plan, dumpElements } from '@salto-io/core'
import { strings } from '@salto-io/lowerdash'
import tmp from 'tmp-promise'
import { writeFile, rm } from '@salto-io/file'
import { Element, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store/dist/src/jest-environment/creds'
import { addElements, objectExists, naclNameToSFName, instanceExists, removeElements, getSalesforceCredsInstance } from './helpers/salesforce'
import { ensureFilesExist, runInit, runSetEnv, runFetch, runPreviewGetPlan, runAddSalesforceService, runCreateEnv, runDeploy, ensureFilesDontExist, getNaclFileElements } from './helpers/workspace'
import * as templates from './helpers/templates'

describe('multi env tests', () => {
  jest.setTimeout(15 * 60 * 1000)

  const WS_NAME = 'e2eWorkspace'
  const ENV1_NAME = 'env1'
  const ENV2_NAME = 'env2'
  let baseDir: string
  let saltoHomeDir: string
  const tempID = strings.insecureRandomString({ alphabet: strings.LOWERCASE, length: 12 })
  const commonObjName = `TestObj${tempID}`
  const commonWithDiffName = `TestDiffObj${tempID}`
  const env1ObjName = `Env1TestObj${tempID}`
  const env2ObjName = `Env2TestObj${tempID}`
  const commonInstName = `TestInst${tempID}`
  const commonInstWithDiffName = `TestDiffInst${tempID}`
  const env1InstName = `Env1TestInst${tempID}`
  const env2InstName = `Env2TestInst${tempID}`
  const homeWSDir = (): string => (
    path.join(saltoHomeDir, `${WS_NAME}*`)
  )
  const commonObjectDir = (): string => (
    path.join(baseDir, 'salesforce', 'Objects')
  )
  const commonInstanceDir = (): string => (
    path.join(baseDir, 'salesforce', 'Records', 'Role')
  )
  const env1ObjectDir = (): string => (
    path.join(baseDir, 'envs', ENV1_NAME, 'salesforce', 'Objects')
  )
  const env2ObjectDir = (): string => (
    path.join(baseDir, 'envs', ENV2_NAME, 'salesforce', 'Objects')
  )
  const env1InstanceDir = (): string => (
    path.join(baseDir, 'envs', ENV1_NAME, 'salesforce', 'Records', 'Role')
  )
  const env2InstanceDir = (): string => (
    path.join(baseDir, 'envs', ENV2_NAME, 'salesforce', 'Records', 'Role')
  )
  const workspaceConfigFilePath = (): string => (
    path.join(baseDir, 'salto.config', 'workspace.nacl')
  )
  const adapterConfigsFilePath = (): string => (
    path.join(baseDir, 'salto.config', 'adapters', 'salesforce.nacl')
  )
  const workspaceUserConfigFilePath = (): string => (
    path.join(homeWSDir(), 'workspaceUser.nacl')
  )
  const env1ObjFilePath = (): string => (
    path.join(env1ObjectDir(), naclNameToSFName(env1ObjName))
  )
  const env2ObjFilePath = (): string => (
    path.join(env2ObjectDir(), naclNameToSFName(env2ObjName))
  )
  const env1InstFilePath = (): string => (
    path.join(env1InstanceDir(), `${env1InstName}.nacl`)
  )
  const env2InstFilePath = (): string => (
    path.join(env2InstanceDir(), `${env2InstName}.nacl`)
  )
  const commonWithDiffCommonFilePath = (): string => (
    path.join(commonObjectDir(), naclNameToSFName(commonWithDiffName))
  )
  const commonInstWithDiffCommonFilePath = (): string => (
    path.join(commonInstanceDir(), `${commonInstWithDiffName}.nacl`)
  )
  const commonWithDiffEnv1FilePath = (): string => (
    path.join(env1ObjectDir(), naclNameToSFName(commonWithDiffName))
  )
  const commonWithDiffEnv2FilePath = (): string => (
    path.join(env2ObjectDir(), naclNameToSFName(commonWithDiffName))
  )
  const commonInstWithDiffEnv1FilePath = (): string => (
    path.join(env1InstanceDir(), `${commonInstWithDiffName}.nacl`)
  )
  const commonInstWithDiffEnv2FilePath = (): string => (
    path.join(env2InstanceDir(), `${commonInstWithDiffName}.nacl`)
  )

  const commonInst = templates.instance({
    instName: commonInstName,
    description: 'Common instance',
  })

  const env1Inst = templates.instance({
    instName: env1InstName,
    description: 'Common instance',
  })

  const env2Inst = templates.instance({
    instName: env2InstName,
    description: 'Common instance',
  })

  const diffInstEnv1 = templates.instance({
    instName: commonInstWithDiffName,
    description: 'Common instance Env 1',
  })

  const diffInstEnv2 = templates.instance({
    instName: commonInstWithDiffName,
    description: 'Common instance Env 2',
  })

  const commonObj = templates.customObject({
    objName: commonObjName,
    alphaLabel: 'alpha',
    betaLabel: 'beta',
  })
  const env1Obj = templates.customObject({
    objName: env1ObjName,
    alphaLabel: 'alpha',
    betaLabel: 'beta',
  })
  const env2Obj = templates.customObject({
    objName: env2ObjName,
    alphaLabel: 'alpha',
    betaLabel: 'beta',
  })
  const diffObjEnv1 = templates.customObject({
    objName: commonWithDiffName,
    alphaLabel: 'alpha1',
    betaLabel: 'beta1',
  })
  const diffObjEnv2 = templates.customObject({
    objName: commonWithDiffName,
    alphaLabel: 'alpha2',
    betaLabel: 'beta2',
  })

  const env1Elements = [commonObj, env1Obj, diffObjEnv1, commonInst, env1Inst, diffInstEnv1]
  const env2Elements = [commonObj, env2Obj, diffObjEnv2, commonInst, env2Inst, diffInstEnv2]
  let env1ElementAfterDeploy: Element[]
  let env2ElementAfterDeploy: Element[]
  let env1CredsLease: CredsLease<Credentials>
  let env2CredsLease: CredsLease<Credentials>
  let env1Creds: Credentials
  let env2Creds: Credentials
  let env1Client: SalesforceClient
  let env2Client: SalesforceClient

  // Setup the test env
  beforeAll(async () => {
    env1CredsLease = await salesforceTestHelpers().credentials()
    env2CredsLease = await salesforceTestHelpers().credentials('ENV_2')
    env1Creds = env1CredsLease.value
    env2Creds = env2CredsLease.value
    env1Client = new SalesforceClient({ credentials: env1Creds })
    env2Client = new SalesforceClient({ credentials: env2Creds })

    baseDir = (await tmp.dir()).path
    saltoHomeDir = (await tmp.dir()).path

    // Create the base elements in the services
    process.env.SALTO_HOME = saltoHomeDir
    env1ElementAfterDeploy = await addElements(env1Client, env1Elements)
    env2ElementAfterDeploy = await addElements(env2Client, env2Elements)
  })

  afterAll(async () => {
    await removeElements(env1Client, env1ElementAfterDeploy)
    await removeElements(env2Client, env2ElementAfterDeploy)
    if (env1CredsLease.return) {
      await env1CredsLease.return()
    }
    if (env2CredsLease.return) {
      await env2CredsLease.return()
    }
  })

  describe('init envs', () => {
    beforeAll(async () => {
      // run salto init with env1
      await runInit(WS_NAME, ENV1_NAME, baseDir)
      // run add salesforce service
      await runAddSalesforceService(baseDir, getSalesforceCredsInstance(env1Creds))
      // run create env with env2
      await runCreateEnv(baseDir, ENV2_NAME)
      // run add salesforce service
      await runAddSalesforceService(baseDir, getSalesforceCredsInstance(env2Creds))
    })

    it('should create proper env structure', async () => {
      expect(ensureFilesExist([
        workspaceConfigFilePath(),
        adapterConfigsFilePath(),
        workspaceUserConfigFilePath(),
      ])).toBeTruthy()
    })
  })

  describe('fetch from multiple envs', () => {
    beforeAll(async () => {
      await runSetEnv(baseDir, ENV1_NAME)
      await runFetch(baseDir, false) // Fetch in normal mode
      await runSetEnv(baseDir, ENV2_NAME)
      await runFetch(baseDir, true) // Fetch in isolated mode
    })

    describe('create correct file structure', () => {
      it('should place common elements in the common folder', () => {
        expect(ensureFilesExist([
          path.join(commonObjectDir(), naclNameToSFName(commonObjName)),
          path.join(commonInstanceDir(), `${commonInstName}.nacl`),
        ])).toBeTruthy()
      })

      it('should place env unique elements in the env folder', () => {
        expect(ensureFilesExist([
          env1ObjFilePath(),
          env2ObjFilePath(),
          env1InstFilePath(),
          env2InstFilePath(),
        ])).toBeTruthy()

        expect(ensureFilesDontExist([
          path.join(env2ObjectDir(), naclNameToSFName(env1ObjName)),
          path.join(env1ObjectDir(), naclNameToSFName(env2ObjName)),
          path.join(env1InstanceDir(), `${env2InstName}.nacl`),
          path.join(env2InstanceDir(), `${env1InstName}.nacl`),
        ])).toBeTruthy()
      })

      it('should split common elements with diffs between common and env folders', () => {
        expect(ensureFilesExist([
          commonWithDiffCommonFilePath(),
          commonInstWithDiffCommonFilePath(),
          commonWithDiffEnv1FilePath(),
          commonWithDiffEnv2FilePath(),
          commonInstWithDiffEnv1FilePath(),
          commonInstWithDiffEnv2FilePath(),
        ])).toBeTruthy()
      })
    })

    describe('have empty previews', () => {
      let env1Plan: Plan | undefined
      let env2Plan: Plan | undefined
      beforeAll(async () => {
        await runSetEnv(baseDir, ENV1_NAME)
        env1Plan = await runPreviewGetPlan(baseDir)
        await runSetEnv(baseDir, ENV2_NAME)
        env2Plan = await runPreviewGetPlan(baseDir)
      })
      it('should have empty previews for all envs', async () => {
        expect(env1Plan?.size).toBe(0)
        expect(env2Plan?.size).toBe(0)
      })
    })
  })

  // eslint-disable-next-line jest/no-disabled-tests
  describe.skip('handle changes that originated in the service', () => {
    const objToSyncFromServiceName = `TestSyncFromServiceObj${tempID}`
    const instToSyncFromServiceName = `TestSyncFromServiceInst${tempID}`
    let fromSyncToRemove: Element[]
    const objToSyncFromService = templates.customObject({
      objName: objToSyncFromServiceName,
      alphaLabel: 'alpha2',
      betaLabel: 'beta2',
    })
    const instToSyncFromService = templates.instance({
      instName: instToSyncFromServiceName,
      description: 'This was created on the service',
    })

    describe('fetch an add change from the service', () => {
      let afterFetchPlan: Plan | undefined
      beforeAll(async () => {
        // Add the new element directly to the service
        fromSyncToRemove = await addElements(
          env1Client, [objToSyncFromService, instToSyncFromService]
        )
        // We fetch it to common
        await runSetEnv(baseDir, ENV1_NAME)
        await runFetch(baseDir, false) // Fetch in normal mode
        afterFetchPlan = await runPreviewGetPlan(baseDir)
      })

      it('should add the fetched element to the common folder', () => {
        expect(ensureFilesExist([
          path.join(commonObjectDir(), naclNameToSFName(objToSyncFromServiceName)),
          path.join(commonInstanceDir(), `${instToSyncFromServiceName}.nacl`),
        ])).toBeTruthy()

        expect(ensureFilesDontExist([
          path.join(env1ObjectDir(), naclNameToSFName(objToSyncFromServiceName)),
          path.join(env2ObjectDir(), naclNameToSFName(objToSyncFromServiceName)),
          path.join(env1InstanceDir(), `${instToSyncFromServiceName}.nacl`),
          path.join(env2InstanceDir(), `${instToSyncFromServiceName}.nacl`),
        ])).toBeTruthy()
      })

      it('should have empty preview for the env from which the element was fetched', () => {
        expect(afterFetchPlan?.size).toBe(0)
      })
    })

    describe('apply the add chnage to the target env', () => {
      let afterOtherEnvFetchPlan: Plan | undefined
      beforeAll(async () => {
        // We fetch it to common
        await runSetEnv(baseDir, ENV2_NAME)
        afterOtherEnvFetchPlan = await runPreviewGetPlan(baseDir)
        // Just a safety check to avoid deploying changes if something
        // went etong.
        if (afterOtherEnvFetchPlan && afterOtherEnvFetchPlan.size > 10) {
          throw new Error('To many unexpected changes. Aborting')
        }
        await runDeploy(undefined, baseDir, true)
      })

      it('should have a non empty preview for the target enviornment', () => {
        expect(afterOtherEnvFetchPlan?.size).toBeGreaterThan(0)
      })

      it('should create the element in the target env', async () => {
        expect(await objectExists(
          env2Client,
          naclNameToSFName(objToSyncFromServiceName)
        )).toBeTruthy()
        expect(await instanceExists(env2Client, 'Role', instToSyncFromServiceName)).toBeTruthy()
      })
    })

    describe('fetch a delete change from the source env', () => {
      let afterDeleteFetchPlan: Plan | undefined

      // Just a note on what we delete here - we delete all of the things that
      // were added to env1 and common. env2 cleanup will happen when we will
      // test Nacl based deletion below...
      beforeAll(async () => {
        await removeElements(env1Client, [
          ...fromSyncToRemove,
          ...env1ElementAfterDeploy,
        ])
        await runSetEnv(baseDir, ENV1_NAME)
        await runFetch(baseDir, false) // Fetch in normal mode
        afterDeleteFetchPlan = await runPreviewGetPlan(baseDir)
      })

      it('should remove the elements from the nacl files in the common folder', async () => {
        expect(ensureFilesDontExist([
          path.join(commonObjectDir(), naclNameToSFName(commonObjName)),
          path.join(commonInstanceDir(), `${commonInstName}.nacl`),
          path.join(commonObjectDir(), naclNameToSFName(objToSyncFromServiceName)),
          path.join(commonInstanceDir(), `${instToSyncFromServiceName}.nacl`),
          commonWithDiffCommonFilePath(),
          commonInstWithDiffCommonFilePath(),
        ])).toBeTruthy()
      })
      it('should remove the elements from the nacl files in the env folder', async () => {
        expect(ensureFilesDontExist([
          env1ObjFilePath(),
          env1InstFilePath(),
          commonWithDiffEnv1FilePath(),
          commonInstWithDiffEnv1FilePath(),
        ])).toBeTruthy()
      })
      it('should have empty preview after fetching the delete changes', async () => {
        expect(afterDeleteFetchPlan?.size).toBe(0)
      })
    })

    describe('apply the delete changes to the target env', () => {
      let afterDeleteOtherEnvFetchPlan: Plan | undefined
      beforeAll(async () => {
        // We fetch it to common
        await runSetEnv(baseDir, ENV2_NAME)
        afterDeleteOtherEnvFetchPlan = await runPreviewGetPlan(baseDir)
        await runDeploy(undefined, baseDir, true, true)
      })

      it('should have a non empty preview for the target enviornment', () => {
        expect(afterDeleteOtherEnvFetchPlan?.size).toBeGreaterThan(0)
      })

      it('should delete the elements in the target env', async () => {
        expect(await objectExists(
          env2Client,
          naclNameToSFName(objToSyncFromServiceName)
        )).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', instToSyncFromServiceName)).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', commonInstName)).toBeFalsy()
      })
    })
  })

  describe('handle changes that originated in the NaCL files', () => {
    const commonNaclFileObjectName = `CommonObjectNacl${tempID}`
    const env1NaclFileObjectName = `Env1ObjectNacl${tempID}`
    const env2NaclFileObjectName = `Env2ObjectNacl${tempID}`
    const commonNaclFileInstName = `CommonInstNacl${tempID}`
    const env1NaclFileInstName = `Env1InstNacl${tempID}`
    const env2NaclFileInstName = `Env2InstNacl${tempID}`


    describe('handle nacl based add change', () => {
      beforeAll(async () => {
        const commonNaclFile = await dumpElements([
          templates.customObject({
            objName: commonNaclFileObjectName,
            alphaLabel: 'alpha1',
            betaLabel: 'beta1',
          }),
          templates.instance({
            instName: commonNaclFileInstName,
            description: 'Common from Nacl',
          }),
        ])
        const env1NaclFile = await dumpElements([
          templates.customObject({
            objName: env1NaclFileObjectName,
            alphaLabel: 'alpha1',
            betaLabel: 'beta1',
          }),
          templates.instance({
            instName: env1NaclFileInstName,
            description: 'Env1 from Nacl',
          }),
        ])
        const env2NaclFile = await dumpElements([
          templates.customObject({
            objName: env2NaclFileObjectName,
            alphaLabel: 'alpha1',
            betaLabel: 'beta1',
          }),
          templates.instance({
            instName: env2NaclFileInstName,
            description: 'Env2 from Nacl',
          }),
        ])
        await writeFile(path.join(baseDir, 'salesforce', 'common.nacl'), commonNaclFile)
        await writeFile(path.join(baseDir, 'envs', ENV1_NAME, 'salesforce', 'env1.nacl'), env1NaclFile)
        await writeFile(path.join(baseDir, 'envs', ENV2_NAME, 'salesforce', 'env2.nacl'), env2NaclFile)
        await runSetEnv(baseDir, ENV1_NAME)
        await runPreviewGetPlan(baseDir)
        await runSetEnv(baseDir, ENV2_NAME)
        await runPreviewGetPlan(baseDir)
        await runSetEnv(baseDir, ENV1_NAME)
        await runDeploy(undefined, baseDir, true, true)
        await runSetEnv(baseDir, ENV2_NAME)
        await runDeploy(undefined, baseDir, true, true)
      })

      it('should create common elements in both envs', async () => {
        expect(await objectExists(
          env1Client,
          naclNameToSFName(commonNaclFileObjectName)
        )).toBeTruthy()
        expect(await objectExists(
          env2Client,
          naclNameToSFName(commonNaclFileObjectName)
        )).toBeTruthy()
        expect(await instanceExists(env1Client, 'Role', commonNaclFileInstName)).toBeTruthy()
        expect(await instanceExists(env2Client, 'Role', commonNaclFileInstName)).toBeTruthy()
      })

      it('should create env specific elements in proper env', async () => {
        expect(await objectExists(
          env1Client,
          naclNameToSFName(env1NaclFileObjectName)
        )).toBeTruthy()
        expect(await objectExists(
          env2Client,
          naclNameToSFName(env2NaclFileObjectName)
        )).toBeTruthy()
        expect(await instanceExists(env1Client, 'Role', env1NaclFileInstName)).toBeTruthy()
        expect(await instanceExists(env2Client, 'Role', env2NaclFileInstName)).toBeTruthy()
      })

      it('should not create env specific elements in the other env', async () => {
        expect(await objectExists(env1Client, naclNameToSFName(env2NaclFileObjectName))).toBeFalsy()
        expect(await objectExists(env2Client, naclNameToSFName(env1NaclFileObjectName))).toBeFalsy()
        expect(await instanceExists(env1Client, 'Role', env2NaclFileInstName)).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', env1NaclFileInstName)).toBeFalsy()
      })


      it('should update the attributes added in the deploy in the proper file', async () => {
        await Promise.all([
          env1NaclFileObjectName,
          env2NaclFileObjectName,
          commonNaclFileObjectName,
        ].map(async filename => {
          const element = (await getNaclFileElements(filename))[0]
          expect(isObjectType(element)).toBeTruthy()
          const obj = element as ObjectType
          expect(obj.fields.alpha.annotations.apiName).toBeDefined()
          expect(obj.fields.alpha.annotations.apiName).toBeDefined()
          expect(obj.annotations.metadataType).toBeDefined()
        }))
      })
    })

    describe('handle nacl file delete changes', () => {
      beforeAll(async () => {
        await rm(path.join(baseDir, 'salesforce', 'common.nacl'))
        await rm(path.join(baseDir, 'envs', ENV1_NAME, 'salesforce', 'env1.nacl'))
        await rm(path.join(baseDir, 'envs', ENV2_NAME, 'salesforce', 'env2.nacl'))
        await rm(env2ObjFilePath())
        await rm(env2InstFilePath())
        await runSetEnv(baseDir, ENV1_NAME)
        await runPreviewGetPlan(baseDir)
        await runSetEnv(baseDir, ENV2_NAME)
        await runPreviewGetPlan(baseDir)
        await runSetEnv(baseDir, ENV1_NAME)
        await runDeploy(undefined, baseDir, true, true)
        await runSetEnv(baseDir, ENV2_NAME)
        await runDeploy(undefined, baseDir, true, true)
      })

      it('should remove common elements from nacl change', async () => {
        expect(await objectExists(
          env1Client,
          naclNameToSFName(commonNaclFileObjectName)
        )).toBeFalsy()
        expect(await objectExists(
          env2Client,
          naclNameToSFName(commonNaclFileObjectName)
        )).toBeFalsy()
        expect(await instanceExists(env1Client, 'Role', commonNaclFileInstName)).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', commonNaclFileInstName)).toBeFalsy()
      })

      it('should remove env elements from nacl change', async () => {
        expect(await objectExists(env1Client, naclNameToSFName(env1NaclFileObjectName))).toBeFalsy()
        expect(await objectExists(env2Client, naclNameToSFName(env2NaclFileObjectName))).toBeFalsy()
        expect(await instanceExists(env1Client, 'Role', env1NaclFileInstName)).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', env2NaclFileInstName)).toBeFalsy()
        expect(await objectExists(env2Client, naclNameToSFName(env2ObjName))).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', env2InstName)).toBeFalsy()
      })
    })
  })
})
