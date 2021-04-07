/*
*                      Copyright 2021 Salto Labs Ltd.
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

import { AccountId, Change, ChangeGroup, DeployResult, getChangeElement, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { decorators } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-utils'
import { NetsuiteQuery } from '../query'
import { Credentials } from './credentials'
import SdfClient from './sdf_client'
import SuiteAppClient from './suiteapp_client/suiteapp_client'
import * as suiteAppFileCabinet from '../suiteapp_file_cabinet'
import { SavedSearchQuery, SystemInformation } from './suiteapp_client/types'
import { GetCustomObjectsResult, ImportFileCabinetResult } from './types'
import { getAllReferencedInstances, getRequiredReferencedInstances } from '../reference_dependencies'
import { getLookUpName, toCustomizationInfo } from '../transformer'
import { SDF_CHANGE_GROUP_ID, SUITEAPP_CREATING_FILES_GROUP_ID } from '../group_changes'

const log = logger(module)

export default class NetsuiteClient {
  private sdfClient: SdfClient
  private suiteAppClient?: SuiteAppClient

  constructor(sdfClient: SdfClient, suiteAppClient?: SuiteAppClient) {
    this.sdfClient = sdfClient
    this.suiteAppClient = suiteAppClient
    if (this.suiteAppClient === undefined) {
      log.debug('Salto SuiteApp not configured')
    } else {
      log.debug('Salto SuiteApp configured')
    }
  }

  @NetsuiteClient.logDecorator
  static async validateCredentials(credentials: Credentials): Promise<AccountId> {
    if (credentials.suiteAppTokenId && credentials.suiteAppTokenSecret) {
      try {
        await SuiteAppClient.validateCredentials({
          accountId: credentials.accountId,
          suiteAppTokenId: credentials.suiteAppTokenId,
          suiteAppTokenSecret: credentials.suiteAppTokenSecret,
        })
      } catch (e) {
        e.message = `Salto SuiteApp Authentication failed. ${e.message}`
        throw e
      }
    }

    try {
      return await SdfClient.validateCredentials(credentials)
    } catch (e) {
      e.message = `SDF Authentication failed. ${e.message}`
      throw e
    }
  }

  @NetsuiteClient.logDecorator
  async getCustomObjects(typeNames: string[], query: NetsuiteQuery):
    Promise<GetCustomObjectsResult> {
    return this.sdfClient.getCustomObjects(typeNames, query)
  }

  @NetsuiteClient.logDecorator
  async importFileCabinetContent(query: NetsuiteQuery):
    Promise<ImportFileCabinetResult> {
    if (this.suiteAppClient !== undefined) {
      return suiteAppFileCabinet.importFileCabinet(this.suiteAppClient, query)
    }

    return this.sdfClient.importFileCabinetContent(query)
  }

  private static getAllRequiredReferencedInstances(
    changedInstances: ReadonlyArray<InstanceElement>,
    deployReferencedElements: boolean,
  ): ReadonlyArray<InstanceElement> {
    if (deployReferencedElements) {
      return getAllReferencedInstances(changedInstances)
    }
    return getRequiredReferencedInstances(changedInstances)
  }

  private async sdfDeploy(
    changes: ReadonlyArray<Change<InstanceElement>>,
    deployReferencedElements: boolean
  ): Promise<DeployResult> {
    const changedInstances = changes.map(getChangeElement)
    const customizationInfos = NetsuiteClient.getAllRequiredReferencedInstances(
      changedInstances,
      deployReferencedElements
    ).map(instance => resolveValues(instance, getLookUpName))
      .map(toCustomizationInfo)

    try {
      await this.sdfClient.deploy(customizationInfos)
      return { errors: [], appliedChanges: changes }
    } catch (e) {
      return { errors: [e], appliedChanges: [] }
    }
  }

  @NetsuiteClient.logDecorator
  async deploy(changeGroup: ChangeGroup, deployReferencedElements: boolean):
    Promise<DeployResult> {
    const instancesChanges = changeGroup.changes.filter(isInstanceChange)

    if (SDF_CHANGE_GROUP_ID === changeGroup.groupID) {
      return this.sdfDeploy(instancesChanges, deployReferencedElements)
    }

    return this.suiteAppClient !== undefined
      ? suiteAppFileCabinet.deploy(this.suiteAppClient, instancesChanges, changeGroup.groupID === SUITEAPP_CREATING_FILES_GROUP_ID ? 'add' : 'update')
      : { errors: [new Error(`Salto SuiteApp is not configured and therefore changes group "${changeGroup.groupID}" cannot be deployed`)], appliedChanges: [] }
  }

  public async runSuiteQL(query: string):
    Promise<Record<string, unknown>[] | undefined> {
    return this.suiteAppClient?.runSuiteQL(query)
  }

  public async runSavedSearchQuery(query: SavedSearchQuery):
    Promise<Record<string, unknown>[] | undefined> {
    return this.suiteAppClient?.runSavedSearchQuery(query)
  }

  public async getSystemInformation(): Promise<SystemInformation | undefined> {
    return this.suiteAppClient?.getSystemInformation()
  }

  public isSuiteAppConfigured(): boolean {
    return this.suiteAppClient !== undefined
  }

  private static logDecorator = decorators.wrapMethodWith(
    async (
      { call, name }: decorators.OriginalCall,
    ): Promise<unknown> => {
      const desc = `client.${name}`
      try {
        return await log.time(call, desc)
      } catch (e) {
        log.error('failed to run Netsuite client command on: %o', e)
        throw e
      }
    }
  )
}
