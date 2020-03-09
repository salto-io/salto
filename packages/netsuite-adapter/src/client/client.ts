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

import { Configuration, Record, Service as Connection } from 'node-suitetalk'
import { decorators } from '@salto-io/lowerdash'
import { ATTRIBUTES, RECORD_REF } from '../constants'

export type NetsuiteRecord = Record.Types.Record
export type NetsuiteReference = Record.Types.Reference
type ReferenceTypeAndId = { type: string; internalId: string }

const API_VERSION = '2019_2'

export type Credentials = {
  account: string
  consumerKey: string
  consumerSecret: string
  tokenId: string
  tokenSecret: string
}

export type NetsuiteClientOpts = {
  credentials: Credentials
  connection?: Connection
}

export const realConnection = (credentials: Credentials): Connection => {
  const config = new Configuration({
    account: credentials.account,
    apiVersion: API_VERSION,
    accountSpecificUrl: true,
    token: {
      // eslint-disable-next-line @typescript-eslint/camelcase
      consumer_key: credentials.consumerKey,
      // eslint-disable-next-line @typescript-eslint/camelcase
      consumer_secret: credentials.consumerSecret,
      // eslint-disable-next-line @typescript-eslint/camelcase
      token_key: credentials.tokenId,
      // eslint-disable-next-line @typescript-eslint/camelcase
      token_secret: credentials.tokenSecret,
    },
    wsdlPath: `https://webservices.netsuite.com/wsdl/v${API_VERSION}_0/netsuite.wsdl`,
  })
  return new Connection(config)
}

const toNetsuiteRecordRef = (recordReference: ReferenceTypeAndId):
  NetsuiteReference => {
  const recordRef = new Record.Types.Reference(RECORD_REF)
  recordRef.internalId = recordReference.internalId
  recordRef.type = recordReference.type
  return recordRef
}

export default class NetsuiteClient {
  private isLoggedIn = false
  private readonly conn: Connection

  static validateCredentials(credentials: Credentials): Promise<void> {
    return realConnection(credentials).init()
  }

  constructor({ credentials, connection }: NetsuiteClientOpts) {
    this.conn = connection ?? realConnection(credentials)
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      await this.conn.init()
      // this.isLoggedIn = true // todo uncomment -> currently each API call requires a new init()
    }
  }

  private static requiresLogin = decorators.wrapMethodWith(
    async function withLogin(
      this: NetsuiteClient,
      originalMethod: decorators.OriginalCall
    ): Promise<unknown> {
      await this.ensureLoggedIn()
      return originalMethod.call()
    }
  )

  @NetsuiteClient.requiresLogin
  async list(referenceTypeAndIds: ReferenceTypeAndId[]):
    Promise<NetsuiteRecord[]> {
    const recordRefs = referenceTypeAndIds.map(toNetsuiteRecordRef)
    const getListResponse = await this.conn.getList(recordRefs)
    return getListResponse.readResponseList.readResponse.map(item => item.record)
  }

  @NetsuiteClient.requiresLogin
  private async getCustomizationIds(type: string, includeInactives = true): Promise<string[]> {
    const getCustomizationIdResponse = await this.conn.getCustomizationId(type, includeInactives)
    return getCustomizationIdResponse.getCustomizationIdResult.customizationRefList
      .customizationRef.map(customization => customization[ATTRIBUTES].internalId)
  }

  @NetsuiteClient.requiresLogin
  async listCustomizations(type: string, includeInactives = true): Promise<NetsuiteRecord[]> {
    const customizationInternalIds = await this.getCustomizationIds(type, includeInactives)
    const customRecordRefs = customizationInternalIds.map(internalId => ({ type, internalId }))
    return this.list(customRecordRefs)
  }

  @NetsuiteClient.requiresLogin
  async add(record: NetsuiteRecord): Promise<NetsuiteReference> {
    const addResponse = await this.conn.add(record)
    return addResponse.writeResponse.baseRef
  }

  @NetsuiteClient.requiresLogin
  async delete(referenceTypeAndId: ReferenceTypeAndId): Promise<NetsuiteReference> {
    const deleteResponse = await this.conn.delete(toNetsuiteRecordRef(referenceTypeAndId))
    return deleteResponse.writeResponse.baseRef
  }
}
