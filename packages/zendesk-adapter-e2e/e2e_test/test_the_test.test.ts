/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { adapter, Credentials, GROUP_TYPE_NAME } from '@salto-io/zendesk-adapter'
import { Workspace } from '@salto-io/workspace'
import {
  addAdapter,
  deploy,
  fetch,
  getDefaultAdapterConfig,
  initLocalWorkspace,
  preview,
  updateCredentials,
} from '@salto-io/core'
import {
  DetailedChangeWithBaseChange,
  ElemID,
  InstanceElement,
  isInstanceElement,
  toChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import tmp from 'tmp-promise'
import _ from 'lodash'
import { getDetailedChanges } from '@salto-io/adapter-utils'
import { credsLease } from './adapter'
import { getAllInstancesToDeploy, HELP_CENTER_BRAND_NAME } from './e2e_utils'

const log = logger(module)
const { awu } = collections.asynciterable

// Set long timeout as we communicate with Zendesk APIs
jest.setTimeout(1000 * 60 * 15)

const GUIDE_CONFIG = {
  guide: {
    brands: ['.*'],
    themes: {
      brands: ['.*'],
      referenceOptions: {
        enableReferenceLookup: false,
      },
    },
  },
}

const updateConfig = async ({
  workspace,
  adapterName,
  fetchAddition,
}: {
  workspace: Workspace
  adapterName: string
  fetchAddition: Record<string, unknown>
}): Promise<void> => {
  const defaultConfig = await getDefaultAdapterConfig(adapterName, adapterName)
  if (!_.isUndefined(defaultConfig)) {
    defaultConfig[0].value.fetch = { ...defaultConfig[0].value.fetch, ...fetchAddition }
    await workspace.updateAccountConfig(adapterName, defaultConfig, adapterName)
  }
}

const initWorkspace = async ({
  envName,
  credLease,
  adapterName,
}: {
  envName: string
  credLease: CredsLease<Credentials>
  adapterName: string
}): Promise<Workspace> => {
  const baseDir = (await tmp.dir()).path
  const workspace = await initLocalWorkspace(baseDir, envName)
  await workspace.setCurrentEnv(envName, false)
  const authMethods = adapter.authenticationMethods
  const configType = authMethods.basic
  const { credentialsType } = configType
  const newConfig = new InstanceElement(ElemID.CONFIG_NAME, credentialsType, credLease.value)
  await updateCredentials(workspace, newConfig, adapterName)
  await updateConfig({
    workspace,
    adapterName,
    fetchAddition: GUIDE_CONFIG,
  })
  await addAdapter(workspace, adapterName)
  await workspace.flush()
  return workspace
}

const updateWorkspace = async (workspace: Workspace, changes: DetailedChangeWithBaseChange[]): Promise<void> => {
  await workspace.updateNaclFiles(changes)
  const err = await workspace.errors()
  expect(err.parse.length > 0).toBeFalsy()
  expect(err.merge.length > 0).toBeFalsy()
  expect(err.validation.length > 0).toBeFalsy()
  await workspace.flush()
}

const fetchWorkspace = async (workspace: Workspace): Promise<void> => {
  const res = await fetch(workspace)
  expect(res.success).toBeTruthy()
  await updateWorkspace(
    workspace,
    res.changes.map(c => c.change),
  )
}

const getElementsFromWorkspace = async (workspace: Workspace): Promise<InstanceElement[]> => {
  const elementsSource = await workspace.elements()
  return awu(await elementsSource.getAll())
    .filter(isInstanceElement)
    .toArray()
}

describe('Zendesk adapter E2E - 2', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>

    beforeAll(async () => {
      log.resetLogCount()
      credLease = await credsLease()
      const workspace = await initWorkspace({ envName: 'zendesk-env', adapterName: 'zendesk', credLease })
      await fetchWorkspace(workspace)
      const instances = await getElementsFromWorkspace(workspace)
      const brandInstanceE2eHelpCenter = instances.find(e => e.elemID.name === HELP_CENTER_BRAND_NAME)
      expect(brandInstanceE2eHelpCenter).toBeDefined()
      const defaultGroup = instances.find(e => e.elemID.typeName === GROUP_TYPE_NAME && e.value.default === true)
      expect(defaultGroup).toBeDefined()
      if (brandInstanceE2eHelpCenter == null || defaultGroup == null) {
        return
      }
      // await cleanup(adapterAttr, firstFetchResult)
      const { instancesToDeploy } = await getAllInstancesToDeploy({ brandInstanceE2eHelpCenter, defaultGroup })
      const changes = instancesToDeploy.map(inst => toChange({ after: inst }))
      const detailedChanges = changes.flatMap(change => getDetailedChanges(change))
      await updateWorkspace(workspace, detailedChanges)
      const actionPlan = await preview(workspace)
      const result = await deploy(workspace, actionPlan, () => {})
      if (result.errors.length > 0) {
        log.error('error')
      }
      if (result.changes === undefined) {
        log.error('error no changes')
        return
      }
      await updateWorkspace(
        workspace,
        Array.from(result.changes).map(c => c.change),
      )
      const actionPlan2 = await preview(workspace)
      if (_.isEmpty(actionPlan2)) {
        log.error('plan is empty')
      }
    })

    it('does nothing', async () => {})
  })
})
