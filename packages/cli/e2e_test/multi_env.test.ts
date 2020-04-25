import { SalesforceClient } from '@salto-io/salesforce-adapter'
import { addElements } from './helpers/salesforce'
import _ from 'lodash'
import { ensureDir, runInit, runSetEnv, runFetch, runPreviewGetPlan, runAddSalesforceService, runCreateEnv } from './helpers/workspace'
import * as templates from './helpers/templates'
import { Plan } from '@salto-io/core'
console.log('A')
import adapterConfigs from './adapter_configs'
import { strings } from '@salto-io/lowerdash'
describe('multi env tests', () => {
    jest.setTimeout(15 * 60 * 1000)
    const baseDir = '/Users/roironn/env_workspaces/tests'
    const ENV1_NAME = 'env1'
    const ENV2_NAME = 'env2'
    const [env1Creds, env2Creds] = adapterConfigs.salesforceMulti()
    console.log('B', env1Creds.value)
    const env1Client = new SalesforceClient({credentials: {
      username: env1Creds.value.username,
      password: env1Creds.value.password,
      apiToken: env1Creds.value.token,
      isSandbox: env1Creds.value.sandbox
    }})
    const env2Client = new SalesforceClient({credentials: {
      username: env2Creds.value.username,
      password: env2Creds.value.password,
      apiToken: env2Creds.value.token,
      isSandbox: env2Creds.value.sandbox
    }})
    console.log('C')
    const tempID = strings.insecureRandomString({ alphabet: strings.LOWERCASE, length: 12 })

    const commonObjName = `TestObj${tempID}`
    const commonWithDiffName = `TestDiffObj${tempID}`
    const env1ObjName = `Env1TestObj${tempID}`
    const env2ObjName = `Env2TestObj${tempID}`

    const commonObj = templates.customObject({
        objName: commonObjName,
        alphaLabel: 'alpha',
        betaLabel: 'beta'
    })

    const env1Obj = templates.customObject({
        objName: env1ObjName,
        alphaLabel: 'alpha',
        betaLabel: 'beta'
    })

    const env2Obj = templates.customObject({
        objName: env2ObjName,
        alphaLabel: 'alpha',
        betaLabel: 'beta'
    })

    const diffObjEnv1 = templates.customObject({
        objName: commonWithDiffName,
        alphaLabel: 'alpha1',
        betaLabel: 'beta1'
    })

    const diffObjEnv2 = templates.customObject({
        objName: commonWithDiffName,
        alphaLabel: 'alpha2',
        betaLabel: 'beta2'
    })

    const env1Elements = [commonObj, env1Obj, diffObjEnv1]
    const env2Elements = [commonObj, env2Obj, diffObjEnv2]
    // Setup the test env
    beforeAll(async () => {
        // Create the base elements in the services
        await Promise.all([
          addElements(env1Client, env1Elements),
          addElements(env2Client, env2Elements)
        ])
    })

    describe('init envs', () => {
        beforeAll(async () => {
            // run salto init with env1
            console.log(1)
            await runInit('e2eWorkspace', ENV1_NAME, baseDir)
            console.log(2)
            // run add salesforce service
            await runAddSalesforceService(baseDir, env1Creds)
            // run create env with env2
            console.log(3)
            await runCreateEnv(baseDir, ENV2_NAME)
            // run add salesforce service
            console.log(4)
            await runAddSalesforceService(baseDir, env2Creds)
        })

        it('should create proper env structure', async () => {
            const dirsToValidate: Record<string, string[]> = {
            }
            expect( _.every( await Promise.all(
                _.entries(dirsToValidate)
                    .map(([dirPath, filePathes]) => ensureDir(dirPath, filePathes)
                )
            ))).toBeTruthy()
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

        })

        it('should place env unique elements in the env folder', () => {

        })

        it('should split common elements with diffs between common and env folders', () =>{

        })
      })

      describe('have empty previews', () => {
        let env1Plan: Plan | undefined //TODO LOAD VALUE
        let env2Plan: Plan | undefined//TODO LOAD VALUE
        beforeAll(async () => {
          await runSetEnv(baseDir, ENV1_NAME)
          env1Plan = await runPreviewGetPlan(baseDir)
          await runSetEnv(baseDir, ENV2_NAME)
          env2Plan = await runPreviewGetPlan(baseDir)
        })
        it('should have empty previews for all envs', async () => {
          expect(!_.isUndefined(env1Plan) && _.isEmpty(env1Plan)).toBeTruthy()
          expect(!_.isUndefined(env1Plan) && _.isEmpty(env2Plan)).toBeTruthy()
        })
      })
    })

    describe('handle changes that originated in the service', () => {

    })

    describe('handle changes that originated in the NaCL files', () => {

    })
})