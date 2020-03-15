
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

declare module 'node-suitetalk' {
  import { Value } from '@salto-io/adapter-api'

  export class Service {
    constructor(config: Configuration)
    init(): Promise<void>
    add(record: Record.Types.Record): Promise<AddResponse>
    update(record: Record.Types.Record): Promise<UpdateResponse>
    delete(recordRef: Record.Types.Reference): Promise<DeleteResponse>
    getList(recordRefs: Record.Types.Reference[]): Promise<GetListResponse>
    getCustomizationId(type: string, includeInactives: boolean):
      Promise<GetCustomizationIdResponse>
  }

  export interface Token {
    consumer_key: string
    consumer_secret: string
    token_key: string
    token_secret: string
  }

  export namespace Record {
    export namespace Fields {
      export class Field {
      }

      export class PrimitiveField {
        constructor(name: string, value: Value)
      }

      export class RecordRef {
        constructor(name: string)
        internalId: string
        externalId: string
        type: string
      }

      export class List {
        constructor(typeName: string, name: string)
        list: Record.Fields.Line[]
      }

      export class Line {
        constructor(typeName: string, name: string)
        bodyFieldList: Record.Fields.Field[]
      }
    }

    export namespace Types {
      // eslint-disable-next-line no-shadow
      export class Record {
        constructor(familyType: string, typeName: string)
        internalId: string
        externalId: string
        bodyFieldList: Record.Fields.Field[]
      }

      const ATTRIBUTES = '$attributes'
      export class Reference {
        constructor(reference: string, type: string, internalId: string, externalId?: string)
        [ATTRIBUTES]: {
          type: string
          internalId: string
          externalId: string
          scriptId: string
        }
      }
    }
  }

  export class Configuration {
    constructor(config: Configuration)
    account: string
    apiVersion: string
    accountSpecificUrl: boolean
    token: Token
    wsdlPath: string
  }

  export interface StatusDetail {
    code: string
    message: string
    afterSubmitFailed: boolean
  }

  export interface Status {
    statusDetail: StatusDetail
    $attributes: {
      isSuccess: boolean
    }
  }

  export interface WriteResponse {
    status: Status
    baseRef: Record.Types.Reference
  }

  // getList
  export interface ReadResponse {
    status: Status
    record: Record.Types.Record
  }

  export interface ReadResponseList {
    status: Status
    readResponse: ReadResponse[]
  }

  export interface GetListResponse {
    readResponseList: ReadResponseList
  }

  export interface RecordRefList {
    customizationRef: Record.Types.Reference[]
  }

  // getCustomizationId
  export interface GetCustomizationIdResult {
    status: Status
    totalRecords: number
    customizationRefList: RecordRefList
  }

  export interface GetCustomizationIdResponse {
    getCustomizationIdResult: GetCustomizationIdResult
  }

  // add
  export interface AddResponse {
    writeResponse: WriteResponse
  }

  // update
  export interface UpdateResponse {
    writeResponse: WriteResponse
  }

  // delete
  export interface DeleteResponse {
    writeResponse: WriteResponse
  }
}
