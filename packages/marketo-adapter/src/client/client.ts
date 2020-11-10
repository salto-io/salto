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
import { Values } from '@salto-io/adapter-api'
import { Credentials, Lead, MarketoMetadata } from './types'
import { Marketo, MarketoClientOpts, MarketoObjectAPI, RequestOptions } from './marketo'
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

export default class MarketoClient {
  private readonly conn: MarketoObjectAPI

  static async validateCredentials(
    credentials: Credentials, connection?: MarketoObjectAPI
  ): Promise<string> {
    const conn = connection
      || new Marketo({ ...credentials, endpoint: new URL(credentials.endpoint).origin })
    return (await conn.refreshAccessToken()).accessToken
  }

  constructor(
    { credentials, connection }: MarketoClientOpts
  ) {
    this.conn = connection || new Marketo(credentials)
  }

  async getAllInstances(typeName: string): Promise<Values[]> {
    return this.conn.getAll({
      path: `/rest/v1/${typeName}.json`,
    })
  }

  async describe(typeName: string, options?: RequestOptions): Promise<Values[]> {
    return this.conn.describe({
      path: `/rest/v1/${typeName}/describe.json`,
      ...options,
    })
  }

  async createInstance(
    typeName: string,
    _marketoMetadata: MarketoMetadata
  ): Promise<Values[]> {
    return this.conn.create({
      path: `/rest/v1/${typeName}/describe.json`,
      body: {},
    })
  }

  async updateInstance(
    typeName: string,
    marketoMetadata: MarketoMetadata
  ): Promise<Values[]> {
    return this.conn.update({
      id: extractInstanceId(marketoMetadata, typeName),
      body: {},
    })
  }

  async deleteInstance(
    typeName: string,
    marketoMetadata: MarketoMetadata
  ): Promise<boolean> {
    await this.conn.delete({
      id: extractInstanceId(marketoMetadata, typeName),
      body: {},
    })
    return true
  }
}
