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

import { AccountId } from '@salto-io/adapter-api'
import { NetsuiteQuery } from '../query'
import { Credentials } from './credentials'
import SdfClient from './sdf_client'
import { SuiteAppClient } from './suiteapp_client/suiteapp_client'
import { SavedSearchQuery } from './suiteapp_client/types'
import { CustomizationInfo, GetCustomObjectsResult, ImportFileCabinetResult } from './types'

export class NetsuiteClient {
  private sdfClient: SdfClient
  private suiteAppClient?: SuiteAppClient

  constructor(sdfClient: SdfClient, suiteAppClient?: SuiteAppClient) {
    this.sdfClient = sdfClient
    this.suiteAppClient = suiteAppClient
  }

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

  async getCustomObjects(typeNames: string[], query: NetsuiteQuery):
    Promise<GetCustomObjectsResult> {
    return this.sdfClient.getCustomObjects(typeNames, query)
  }

  async importFileCabinetContent(query: NetsuiteQuery):
    Promise<ImportFileCabinetResult> {
    return this.sdfClient.importFileCabinetContent(query)
  }

  async deploy(customizationInfos: CustomizationInfo[]): Promise<void> {
    return this.sdfClient.deploy(customizationInfos)
  }

  public async runSuiteQL(query: string):
    Promise<Record<string, unknown>[] | undefined> {
    return this.suiteAppClient?.runSuiteQL(query)
  }

  public async runSavedSearchQuery(query: SavedSearchQuery):
    Promise<Record<string, unknown>[] | undefined> {
    return this.suiteAppClient?.runSavedSearchQuery(query)
  }
}
