/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createElementSelectors, ValidationError, Workspace } from '@salto-io/workspace'
import {
  addAdapter,
  deploy,
  DeployError,
  fetch,
  fixElements,
  getDefaultAdapterConfig,
  preview,
  updateCredentials,
} from '@salto-io/core'
import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import tmp from 'tmp-promise'
import { initLocalWorkspace } from '@salto-io/local-workspace'
import {
  DetailedChangeWithBaseChange,
  Element,
  ElemID,
  InstanceElement,
  Adapter as AdapterType,
  ChangeError,
  ObjectType,
  Value,
  Values,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { rm } from '@salto-io/file'

const { awu } = collections.asynciterable

export const updateConfig = async ({
  workspace,
  adapterName,
  configOverride,
  adapterCreators,
}: {
  workspace: Workspace
  adapterName: string
  configOverride: Values
  adapterCreators: Record<string, AdapterType>
}): Promise<void> => {
  const defaultConfig = await getDefaultAdapterConfig({ adapterName, accountName: adapterName, adapterCreators })
  if (!_.isUndefined(defaultConfig)) {
    const newValue = definitions.mergeWithDefaultConfig(defaultConfig[0].value, configOverride)
    defaultConfig[0].value = newValue
    await workspace.updateAccountConfig(adapterName, defaultConfig, adapterName)
  }
}

export const setupWorkspace = (): (({
  envName,
  credLease,
  adapterName,
  configOverride,
  adapterCreators,
  credentialsType,
}: {
  envName: string
  credLease: CredsLease<Value>
  adapterName: string
  configOverride?: Values
  adapterCreators: Record<string, AdapterType>
  credentialsType: ObjectType
}) => Promise<Workspace>) => {
  let baseDir: string
  let workspace: Workspace

  beforeAll(async () => {
    baseDir = (await tmp.dir()).path
  })

  afterAll(async () => {
    await workspace.close()
    await rm(baseDir)
  })

  return async ({ envName, credLease, adapterName, configOverride, adapterCreators, credentialsType }) => {
    workspace = await initLocalWorkspace({ baseDir, envName, adapterCreators })
    await workspace.setCurrentEnv(envName, false)
    const newConfig = new InstanceElement(ElemID.CONFIG_NAME, credentialsType, credLease.value)
    await updateCredentials(workspace, newConfig, adapterName)
    await updateConfig({
      workspace,
      adapterName,
      configOverride: configOverride ?? {},
      adapterCreators,
    })
    await addAdapter({ workspace, adapterName, adapterCreators })
    await workspace.flush()
    return workspace
  }
}

export const getElementsFromWorkspace = async (workspace: Workspace): Promise<Element[]> => {
  const elementsSource = await workspace.elements()
  return awu(await elementsSource.getAll()).toArray()
}

const updateWorkspace = async (
  workspace: Workspace,
  changes: DetailedChangeWithBaseChange[],
  validationFilter: (error: ValidationError) => boolean = () => true,
): Promise<void> => {
  await workspace.updateNaclFiles(changes)
  const err = await workspace.errors()
  expect(err.parse).toEqual([])
  expect(err.merge).toEqual([])
  expect(err.validation.filter(error => validationFilter(error))).toEqual([])
  await workspace.flush()
}

export const fetchWorkspace = async ({
  workspace,
  adapterCreators,
  validationFilter,
}: {
  workspace: Workspace
  adapterCreators: Record<string, AdapterType>
  validationFilter?: (error: ValidationError) => boolean
}): Promise<void> => {
  const res = await fetch({ workspace, adapterCreators })
  expect(res.success).toBeTruthy()
  await updateWorkspace(
    workspace,
    res.changes.map(c => c.change),
    validationFilter,
  )
}

const runFixers = async ({
  workspace,
  adapterCreators,
  selectors,
  expectedFixerErrors = [],
  expectedFixerChanges = [],
}: {
  workspace: Workspace
  adapterCreators: Record<string, AdapterType>
  selectors: string[]
  expectedFixerErrors?: ChangeError[]
  expectedFixerChanges?: DetailedChangeWithBaseChange[]
}): Promise<void> => {
  const { validSelectors, invalidSelectors } = createElementSelectors(selectors)
  expect(invalidSelectors).toEqual([])
  const { changes, errors } = await fixElements(workspace, validSelectors, adapterCreators)
  expect(errors).toEqual(expectedFixerErrors)
  expect(changes).toEqual(expectedFixerChanges)
}

export const e2eDeploy = async ({
  workspace,
  detailedChanges,
  validationFilter,
  adapterCreators,
  changeErrorFilter = () => true,
  expectedChangeErrors = [],
  expectedDeployErrors = [],
  actionPlanAfterDeploySize = 0,
  expectedFixerErrors,
  expectedFixerChanges,
}: {
  workspace: Workspace
  detailedChanges: DetailedChangeWithBaseChange[]
  validationFilter?: (error: ValidationError) => boolean
  adapterCreators: Record<string, AdapterType>
  changeErrorFilter?: (error: ChangeError) => boolean
  expectedChangeErrors?: ChangeError[]
  expectedDeployErrors?: DeployError[]
  actionPlanAfterDeploySize?: number
  expectedFixerErrors?: ChangeError[]
  expectedFixerChanges?: DetailedChangeWithBaseChange[]
}): Promise<void | ChangeError[]> => {
  await updateWorkspace(workspace, detailedChanges, validationFilter)
  await runFixers({
    workspace,
    adapterCreators,
    selectors: _.uniq(detailedChanges.map(change => change.id.createTopLevelParentID().parent.getFullName())),
    expectedFixerErrors,
    expectedFixerChanges,
  })
  const actionPlan = await preview({ workspace, adapterCreators })
  const errors = actionPlan.changeErrors.filter(changeErrorFilter)
  expect(errors).toEqual(expectedChangeErrors)
  const result = await deploy({
    workspace,
    actionPlan,
    reportProgress: () => {},
    adapterCreators,
  })
  expect(result.errors).toEqual(expectedDeployErrors)
  expect(result.changes).toBeDefined()
  await updateWorkspace(
    workspace,
    Array.from(result.changes ?? []).map(c => c.change),
    validationFilter,
  )
  const actionPlanAfterDeploy = await preview({ workspace, adapterCreators })
  expect(actionPlanAfterDeploy.size).toEqual(actionPlanAfterDeploySize)
}
