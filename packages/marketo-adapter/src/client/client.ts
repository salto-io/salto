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
import { Credentials, Lead, MarketoMetadata } from './types'
import Connection, { Marketo, MarketoClientOpts, MarketoObjectAPI, RequestOptions } from './marketo'
import { OBJECTS_NAMES } from '../constants'

/**
 * Extracting instance id for the delete && update operations,
 * The instance id have different names in each Marketo object.
 *
 * The type name doesn't part of the metadata (instance), but we need this info to determine
 * about the instance type.
 *
 * @param marketoMetadata
 * @param typeName
 */
const extractInstanceId = (marketoMetadata: MarketoMetadata, typeName: string): string => {
  const isLead = (
    metadata: MarketoMetadata
  ): metadata is Lead => (metadata as Lead).name !== undefined
    && typeName === OBJECTS_NAMES.LEAD

  if (isLead(marketoMetadata)) {
    return marketoMetadata.name.toString()
  }

  throw new Error(`Instance id ${marketoMetadata.name} not found.`)
}

const marketoTypeErr = (typeName: string): void => {
  throw new Error(`Unknown Marketo type: ${typeName}.`)
}

export default class MarketoClient {
  private readonly conn: Connection
  private readonly marketoObjectsAPI: Record<string, MarketoObjectAPI>

  static async validateCredentials(
    credentials: Credentials, connection?: Connection
  ): Promise<string> {
    const endpointURL = new URL(credentials.endpoint)
    credentials.endpoint = endpointURL.origin
    const conn = connection || new Marketo(credentials)
    const identity = await conn.auth.refreshAccessToken()
    return identity.access_token
  }

  constructor(
    { credentials, connection }: MarketoClientOpts
  ) {
    this.conn = connection
      || new Marketo(credentials)

    this.marketoObjectsAPI = {
      [OBJECTS_NAMES.LEAD]: this.conn.leads,
      [OBJECTS_NAMES.OPPORTUNITY]: this.conn.opportunities,
      [OBJECTS_NAMES.CUSTOM_OBJECTS]: this.conn.customObjects,
    }
  }

  async getAllInstances<T>(typeName: string): Promise<T | undefined> {
    const marketoAPI = this.getMarketoObjectAPI(typeName)
    if (marketoAPI.getAll) {
      return marketoAPI.getAll<T>()
    }
    return undefined
  }

  async describe<T>(typeName: string, options?: RequestOptions): Promise<T | []> {
    const marketoAPI = this.getMarketoObjectAPI(typeName)
    if (!marketoAPI.describe) {
      return []
    }
    return marketoAPI.describe<T>(options)
  }

  async createInstance<T>(
    typeName: string,
    marketoMetadata: MarketoMetadata
  ): Promise<T | undefined> {
    const marketoAPI = this.getMarketoObjectAPI(typeName)
    if (marketoAPI.create) {
      return marketoAPI.create<T>({
        id: extractInstanceId(marketoMetadata, typeName),
        body: {},
      })
    }
    return undefined
  }

  async updateInstance<T>(
    typeName: string,
    marketoMetadata: MarketoMetadata
  ): Promise<T | undefined> {
    const marketoAPI = this.getMarketoObjectAPI(typeName)
    if (marketoAPI.update) {
      return marketoAPI.update<T>({
        id: extractInstanceId(marketoMetadata, typeName),
        body: {},
      })
    }
    return undefined
  }

  async deleteInstance<T>(
    typeName: string,
    marketoMetadata: MarketoMetadata
  ): Promise<boolean> {
    const marketoAPI = this.getMarketoObjectAPI(typeName)
    if (marketoAPI.delete) {
      await marketoAPI.delete<T>({
        id: extractInstanceId(marketoMetadata, typeName),
        body: {},
      })
      return true
    }
    return false
  }

  /**
   * Returning the appropriate MarketoObjectAPI for using Marketo CRUD API operations
   * @param typeName
   *
   * @throws error in case wrong type received
   */
  private getMarketoObjectAPI(typeName: string): MarketoObjectAPI {
    const objectAPI = this.marketoObjectsAPI[typeName]
    if (objectAPI === undefined) {
      marketoTypeErr(typeName)
    }
    return objectAPI
  }
}
