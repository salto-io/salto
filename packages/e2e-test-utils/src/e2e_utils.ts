/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ValidationError, Workspace } from '@salto-io/workspace'
import { addAdapter, deploy, fetch, getDefaultAdapterConfig, preview, updateCredentials } from '@salto-io/core'
import _ from 'lodash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import tmp from 'tmp-promise'
import { initLocalWorkspace } from '@salto-io/local-workspace'
import {
  DetailedChangeWithBaseChange,
  Element,
  ElemID,
  InstanceElement,
  toChange,
  Adapter as AdapterType,
  AdapterAuthentication,
  ChangeError,
} from '@salto-io/adapter-api'
import { getDetailedChanges } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

const updateConfig = async ({
  workspace,
  adapterName,
  fetchAddition,
  adapterCreators,
}: {
  workspace: Workspace
  adapterName: string
  fetchAddition: Record<string, unknown>
  adapterCreators: Record<string, AdapterType>
}): Promise<void> => {
  const defaultConfig = await getDefaultAdapterConfig({ adapterName, accountName: adapterName, adapterCreators })
  if (!_.isUndefined(defaultConfig)) {
    defaultConfig[0].value.fetch = { ...defaultConfig[0].value.fetch, ...fetchAddition }
    await workspace.updateAccountConfig(adapterName, defaultConfig, adapterName)
  }
}
export const initWorkspace = async <T extends {}>({
  envName,
  credLease,
  adapterName,
  configOverride,
  adapterCreators,
  authMethods,
}: {
  envName: string
  credLease: CredsLease<T>
  adapterName: string
  configOverride?: Record<string, unknown>
  adapterCreators: Record<string, AdapterType>
  authMethods: AdapterAuthentication
}): Promise<Workspace> => {
  const baseDir = (await tmp.dir()).path
  const workspace = await initLocalWorkspace({ baseDir, envName, adapterCreators })
  await workspace.setCurrentEnv(envName, false)
  const configType = authMethods.basic
  const { credentialsType } = configType
  const newConfig = new InstanceElement(ElemID.CONFIG_NAME, credentialsType, credLease.value)
  await updateCredentials(workspace, newConfig, adapterName)
  await updateConfig({
    workspace,
    adapterName,
    fetchAddition: configOverride ?? {},
    adapterCreators,
  })
  await addAdapter({ workspace, adapterName, adapterCreators })
  await workspace.flush()
  return workspace
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
export const getAdditionDetailedChangesFromInstances = (
  instances: InstanceElement[],
): DetailedChangeWithBaseChange[] => {
  const changes = instances.map(inst => toChange({ after: inst }))
  return changes.flatMap(change => getDetailedChanges(change))
}
export const getDeletionDetailedChangesFromInstances = (
  instances: InstanceElement[],
): DetailedChangeWithBaseChange[] => {
  const changes = instances.map(inst => toChange({ before: inst }))
  return changes.flatMap(change => getDetailedChanges(change))
}

export const getCVErrors = async ({
  workspace,
  detailedChanges,
  validationFilter,
  adapterCreators,
}: {
  workspace: Workspace
  detailedChanges: DetailedChangeWithBaseChange[]
  validationFilter?: (error: ValidationError) => boolean
  adapterCreators: Record<string, AdapterType>
}): Promise<readonly ChangeError[]> => {
  await updateWorkspace(workspace, detailedChanges, validationFilter)
  const actionPlan = await preview({ workspace, adapterCreators })
  return actionPlan.changeErrors
}
export const e2eDeploy = async ({
  workspace,
  detailedChanges,
  validationFilter,
  adapterCreators,
  changeErrorFilter = e => e.severity === 'Error',
}: {
  workspace: Workspace
  detailedChanges: DetailedChangeWithBaseChange[]
  validationFilter?: (error: ValidationError) => boolean
  adapterCreators: Record<string, AdapterType>
  changeErrorFilter?: (error: ChangeError) => boolean
}): Promise<void | ChangeError[]> => {
  await updateWorkspace(workspace, detailedChanges, validationFilter)
  const actionPlan = await preview({ workspace, adapterCreators })
  const errors = actionPlan.changeErrors.filter(changeErrorFilter)
  expect(errors).toEqual([])
  const result = await deploy({
    workspace,
    actionPlan,
    reportProgress: () => {},
    adapterCreators,
  })
  expect(result.errors).toEqual([])
  expect(result.changes).toBeDefined()
  await updateWorkspace(
    workspace,
    Array.from(result.changes ?? []).map(c => c.change),
    validationFilter,
  )
  const actionPlan2 = await preview({ workspace, adapterCreators })
  expect(actionPlan2.size).toEqual(0)
}
