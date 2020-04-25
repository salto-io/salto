/* eslint-disable */ 
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
import { SalesforceClient } from '@salto-io/salesforce-adapter'
import _ from 'lodash'
import path from 'path'
import { Plan, dumpElements } from '@salto-io/core'
import { strings } from '@salto-io/lowerdash'
import { addElements, objectExists, naclNameToSFName, instanceExists, removeElements } from './helpers/salesforce'
import { ensureFilesExist, runInit, runSetEnv, runFetch, runPreviewGetPlan, runAddSalesforceService, runCreateEnv, runDeploy } from './helpers/workspace'
import * as templates from './helpers/templates'
import tmp from 'tmp-promise'
import adapterConfigs from './adapter_configs'
import { writeFile, rm } from '@salto-io/file'

console.log([runSetEnv as unknown as Plan, runFetch, runPreviewGetPlan].length)

describe('multi env tests', () => {
  jest.setTimeout(15 * 60 * 1000)

  const WS_NAME = 'e2eWorkspace'
  const ENV1_NAME = 'env1'
  const ENV2_NAME = 'env2'
  let baseDir: string
  let saltoHomeDir: string
  const tempID = strings.insecureRandomString({ alphabet: strings.LOWERCASE, length: 12 })
  console.log("TTTTTEEEEEEMMMMMMPPPPPPPP", tempID)
  const commonObjName = `TestObj${tempID}`
  const commonWithDiffName = `TestDiffObj${tempID}`
  const env1ObjName = `Env1TestObj${tempID}`
  const env2ObjName = `Env2TestObj${tempID}`
  const commonInstName = `TestInst${tempID}`
  const commonInstWithDiffName = `TestDiffInst${tempID}`
  const env1InstName = `Env1TestInst${tempID}`
  const env2InstName = `Env2TestInst${tempID}`

  const commonInst = templates.instance({
    instName: commonInstName,
    description: 'Common instance'
  })

  const env1Inst = templates.instance({
    instName: env1InstName,
    description: 'Common instance'
  })

  const env2Inst = templates.instance({
    instName: env2InstName,
    description: 'Common instance'
  })

  const diffInstEnv1 = templates.instance({
    instName: commonInstWithDiffName,
    description: 'Common instance Env 1'
  })

  const diffInstEnv2 = templates.instance({
    instName: commonInstWithDiffName,
    description: 'Common instance Env 2'
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


  const [env1Creds, env2Creds] = adapterConfigs.salesforceMulti()
  const env1Client = new SalesforceClient({ credentials: {
    username: env1Creds.value.username,
    password: env1Creds.value.password,
    apiToken: env1Creds.value.token,
    isSandbox: env1Creds.value.sandbox,
  } })
  const env2Client = new SalesforceClient({ credentials: {
    username: env2Creds.value.username,
    password: env2Creds.value.password,
    apiToken: env2Creds.value.token,
    isSandbox: env2Creds.value.sandbox,
  } })
  // Setup the test env
  beforeAll(async () => {
    baseDir = '/Users/roironn/env_workspaces/tests' || (await tmp.dir()).path
    saltoHomeDir = (await tmp.dir()).path

    // Create the base elements in the services
    process.env['SALTO_HOME'] = saltoHomeDir
    await Promise.all([
      addElements(env1Client, env1Elements),
      addElements(env2Client, env2Elements),
    ])
  })

  describe('init envs', () => {
    beforeAll(async () => {
      // run salto init with env1
      await runInit(WS_NAME, ENV1_NAME, baseDir)
      // run add salesforce service
      await runAddSalesforceService(baseDir, env1Creds)
      // run create env with env2
      await runCreateEnv(baseDir, ENV2_NAME)
      // run add salesforce service
      await runAddSalesforceService(baseDir, env2Creds)
    })

    it('should create proper env structure', async () => {
      const filesToValidate = [
        path.join(baseDir, 'salto.config','workspace.nacl'),
        path.join(baseDir, 'salto.config','adapters', 'salesforce.nacl'),
        path.join(saltoHomeDir,`${WS_NAME}*`,'credentials', ENV1_NAME, 'salesforce.nacl'),
        path.join(saltoHomeDir,`${WS_NAME}*`,'credentials', ENV2_NAME, 'salesforce.nacl'),
        path.join(saltoHomeDir,`${WS_NAME}*`,'envs', ENV1_NAME, 'cache'),
        path.join(saltoHomeDir,`${WS_NAME}*`,'envs', ENV2_NAME, 'cache'),
        path.join(saltoHomeDir,`${WS_NAME}*`,'workspaceUser.nacl')
      ]
      expect(ensureFilesExist(filesToValidate)).toBeTruthy()
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
        // Note - we only check for existance here since sometimes annotations
        // will be different between envs so we might see them in env 1 or env 2.
        // In the other tests we also ensure that nothing was created in wrong envs...
        expect(ensureFilesExist([
          path.join(baseDir, 'salesforce','Objects', naclNameToSFName(commonObjName)),
          path.join(baseDir, 'salesforce','Records','Roles', `${commonInstName}.nacl`),
        ])).toBeTruthy()
      })

      it('should place env unique elements in the env folder', () => {
        expect(ensureFilesExist([
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Objects', naclNameToSFName(env1ObjName)),
          path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Objects', naclNameToSFName(env2ObjName)),
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Records','Roles', `${env1InstName}.nacl`),
          path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Records','Roles', `${env2InstName}.nacl`)
        ])).toBeTruthy()
        expect(ensureFilesExist([
          path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Objects', naclNameToSFName(env1ObjName)),
        ])).toBeFalsy()
        expect(ensureFilesExist([
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Objects', naclNameToSFName(env2ObjName)),
        ])).toBeFalsy()
        expect(ensureFilesExist([
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Records','Roles', `${env2InstName}.nacl`),
        ])).toBeFalsy()
        expect(ensureFilesExist([
          path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Records','Roles', `${env1InstName}.nacl`)
        ])).toBeFalsy()
      })

      it('should split common elements with diffs between common and env folders', () => {
        expect(ensureFilesExist([
          path.join(baseDir, 'salesforce','Objects', naclNameToSFName(commonWithDiffName)),
          path.join(baseDir, 'salesforce','Records','Roles', `${commonInstWithDiffName}.nacl`),
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Objects', naclNameToSFName(commonWithDiffName)),
          path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Objects', naclNameToSFName(commonWithDiffName)),
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Records','Roles', `${commonInstWithDiffName}.nacl`),
          path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Records','Roles', `${commonInstWithDiffName}.nacl`)
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

  describe('handle changes that originated in the service', () => {
    const objToSyncFromServiceName = `TestSyncFromServiceObj${tempID}`
    const instToSyncFromServiceName = `TestSyncFromServiceInst${tempID}`
    const objToSyncFromService = templates.customObject({
      objName: objToSyncFromServiceName,
      alphaLabel: 'alpha2',
      betaLabel: 'beta2',
    })
    const instToSyncFromService = templates.instance({
      instName: instToSyncFromServiceName,
      description: 'This was created on the service'
    })
    
    describe('fetch an add change from the service', () => {
      let afterFetchPlan: Plan | undefined 
      beforeAll(async () => {
        // Add the new element directly to the service
        await addElements(env1Client, [objToSyncFromService, instToSyncFromService])
        // We fetch it to common
        await runSetEnv(baseDir, ENV1_NAME)
        await runFetch(baseDir, false) // Fetch in normal mode
        afterFetchPlan = await runPreviewGetPlan(baseDir)
      })

      it('should add the fetched element to the common folder', () => {
        expect(ensureFilesExist([
          path.join(baseDir, 'salesforce','Objects', naclNameToSFName(objToSyncFromServiceName)),
          path.join(baseDir, 'salesforce','Records','Roles', `${instToSyncFromServiceName}.nacl`),
        ])).toBeTruthy()
        expect(ensureFilesExist([
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Objects', naclNameToSFName(objToSyncFromServiceName))
        ])).toBeFalsy()
        expect(ensureFilesExist([
          path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Objects', naclNameToSFName(objToSyncFromServiceName))
        ])).toBeFalsy()
        expect(ensureFilesExist([
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Records','Roles', `${instToSyncFromServiceName}.nacl`)
        ])).toBeFalsy()
        expect(ensureFilesExist([
          path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Records','Roles', `${instToSyncFromServiceName}.nacl`)
        ])).toBeFalsy()
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
        if (afterOtherEnvFetchPlan && afterOtherEnvFetchPlan.size> 10) {
          throw new Error('To many unexpected changes. Aborting')
        }
        await runDeploy(undefined, baseDir, true)
      })

      it('should have a non empty preview for the target enviornment', () => {
        expect(afterOtherEnvFetchPlan?.size).toBeGreaterThan(0)
      })

      it('should create the element in the target env', async () => {
        expect(await objectExists(env2Client, naclNameToSFName(objToSyncFromServiceName))).toBeTruthy()
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
          objToSyncFromService,
          instToSyncFromService,
          commonObj,
          commonInst,
          diffObjEnv1,
          diffInstEnv1,
          env1Obj,
          env1Inst
        ])
        await runSetEnv(baseDir, ENV1_NAME)
        await runFetch(baseDir, false) // Fetch in normal mode
        afterDeleteFetchPlan = await runPreviewGetPlan(baseDir)
      })

      it('should remove the elements from the nacl files in the common folder', async () => {
        const commonFilesToDelete = [
          path.join(baseDir, 'salesforce','Objects', naclNameToSFName(commonObjName)),
          path.join(baseDir, 'salesforce','Records','Roles', `${commonInstName}.nacl`),
          path.join(baseDir, 'salesforce','Objects', naclNameToSFName(objToSyncFromServiceName)),
          path.join(baseDir, 'salesforce','Records','Roles', `${instToSyncFromServiceName}.nacl`),
          path.join(baseDir, 'salesforce','Objects', naclNameToSFName(commonWithDiffName)),
          path.join(baseDir, 'salesforce','Records','Roles', `${commonInstWithDiffName}.nacl`),
        ]
        commonFilesToDelete.forEach(
          async filename =>expect(ensureFilesExist([filename])).toBeFalsy()
        )
      })
      it('should remove the elements from the nacl files in the env folder', async () => {
        const envFilesToDelete = [
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Objects', naclNameToSFName(env1ObjName)),
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Records','Roles', `${env1InstName}.nacl`),
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Objects', naclNameToSFName(commonWithDiffName)),
          path.join(baseDir, 'envs', ENV1_NAME, 'salesforce','Records','Roles', `${commonInstWithDiffName}.nacl`),
        ]
        envFilesToDelete.forEach(
          async filename =>expect(ensureFilesExist([filename])).toBeFalsy()
        )
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
        await runDeploy(undefined, baseDir, true)
      })

      it('should have a non empty preview for the target enviornment', () => {
        expect(afterDeleteOtherEnvFetchPlan?.size).toBeGreaterThan(0)
      })

      it('should delete the elements in the target env', async () => {
        expect(await objectExists(env2Client, naclNameToSFName(objToSyncFromServiceName))).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', instToSyncFromServiceName)).toBeFalsy()
        expect(await objectExists(env2Client, naclNameToSFName(commonObjName))).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', commonInstName)).toBeFalsy()
        expect(await objectExists(env2Client, naclNameToSFName(commonWithDiffName))).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', commonInstWithDiffName)).toBeFalsy()
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
    const commonNaclFile = dumpElements([
      templates.customObject({
        objName: commonNaclFileObjectName,
        alphaLabel: 'alpha1',
        betaLabel: 'beta1',
      }),
      templates.instance({
        instName: commonNaclFileInstName,
        description: 'Common from Nacl'
      })
    ])
    const env1NaclFile = dumpElements([
      templates.customObject({
        objName: env1NaclFileObjectName,
        alphaLabel: 'alpha1',
        betaLabel: 'beta1',
      }),
      templates.instance({
        instName: env1NaclFileInstName,
        description: 'Env1 from Nacl'
      })
    ])
    const env2NaclFile = dumpElements([
      templates.customObject({
        objName: env2NaclFileObjectName,
        alphaLabel: 'alpha1',
        betaLabel: 'beta1',
      }),
      templates.instance({
        instName: env2NaclFileInstName,
        description: 'Env2 from Nacl'
      })
    ])

    let naclChangeEnv1Plan: Plan | undefined
    let naclChangeEnv2Plan: Plan | undefined

    describe('handle nacl based add change', () => {
      beforeAll(async () => {
        await writeFile(path.join(baseDir, 'salesforce', 'common.nacl'), commonNaclFile)
        await writeFile(path.join(baseDir, 'envs', ENV1_NAME, 'salesforce', 'env1.nacl'), env1NaclFile)
        await writeFile(path.join(baseDir, 'envs', ENV2_NAME, 'salesforce', 'env2.nacl'), env2NaclFile)
        await runSetEnv(baseDir, ENV1_NAME)
        naclChangeEnv1Plan = await runPreviewGetPlan(baseDir)
        await runSetEnv(baseDir, ENV2_NAME)
        naclChangeEnv2Plan = await runPreviewGetPlan(baseDir)
        if ((naclChangeEnv1Plan?.size ?? 0) > 10 || (naclChangeEnv2Plan?.size ?? 0) > 10) {
          // Just a safety check to avoid deploying changes if something
          // went etong. 
          throw new Error('To many unexpected changes. Aborting')
        }
        await runSetEnv(baseDir, ENV1_NAME)
        await runDeploy(undefined, baseDir, true)
        await runSetEnv(baseDir, ENV2_NAME)
        await runDeploy(undefined, baseDir, true)
      })

      it('should create common elements in both envs', async () => {
        expect(await objectExists(env1Client, naclNameToSFName(commonNaclFileObjectName))).toBeTruthy()
        expect(await objectExists(env2Client, naclNameToSFName(commonNaclFileObjectName))).toBeTruthy()
        expect(await instanceExists(env1Client, 'Role', commonNaclFileInstName)).toBeTruthy()
        expect(await instanceExists(env2Client, 'Role', commonNaclFileInstName)).toBeTruthy()
      })

      it('should create env specific elements in proper env', async () => {
        expect(await objectExists(env1Client, naclNameToSFName(env1NaclFileObjectName))).toBeTruthy()
        expect(await objectExists(env2Client, naclNameToSFName(env2NaclFileObjectName))).toBeTruthy()
        expect(await instanceExists(env1Client, 'Role', env1NaclFileInstName)).toBeTruthy()
        expect(await instanceExists(env2Client, 'Role', env2NaclFileInstName)).toBeTruthy()
      })

      it('should not create env specific elements in the other env', async () => {
        expect(await objectExists(env1Client, naclNameToSFName(env2NaclFileObjectName))).toBeFalsy()
        expect(await objectExists(env2Client, naclNameToSFName(env1NaclFileObjectName))).toBeFalsy()
        expect(await instanceExists(env1Client, 'Role', env2NaclFileInstName)).toBeFalsy()
        expect(await instanceExists(env2Client, 'Role', env1NaclFileInstName)).toBeFalsy()
      })
    })
    
    describe('handle nacl file delete changes', () => {
      beforeAll(async () => {
        await rm(path.join(baseDir, 'salesforce', 'common.nacl'))
        await rm(path.join(baseDir, 'envs', ENV1_NAME, 'salesforce', 'env1.nacl'))
        await rm(path.join(baseDir, 'envs', ENV2_NAME, 'salesforce', 'env2.nacl'))
        await rm(path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Objects', naclNameToSFName(env2ObjName)))
        await rm(path.join(baseDir, 'envs', ENV2_NAME, 'salesforce','Records','Roles', `${env2InstName}.nacl`))
        await runSetEnv(baseDir, ENV1_NAME)
        naclChangeEnv1Plan = await runPreviewGetPlan(baseDir)
        await runSetEnv(baseDir, ENV2_NAME)
        naclChangeEnv2Plan = await runPreviewGetPlan(baseDir)
        await runSetEnv(baseDir, ENV1_NAME)
        await runDeploy(undefined, baseDir, true, true)
        await runSetEnv(baseDir, ENV2_NAME)
        await runDeploy(undefined, baseDir, true, true)
      })

      it('should remove common elements from nacl change', async () => {
        expect(await objectExists(env1Client, naclNameToSFName(commonNaclFileObjectName))).toBeFalsy()
        expect(await objectExists(env2Client, naclNameToSFName(commonNaclFileObjectName))).toBeFalsy()
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
