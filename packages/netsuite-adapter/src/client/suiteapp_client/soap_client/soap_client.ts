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
import { logger } from '@salto-io/logging'
import Ajv from 'ajv'
import crypto from 'crypto'
import path from 'path'
import * as soap from 'soap'
import _ from 'lodash'
import { SuiteAppCredentials, toUrlAccountId } from '../../credentials'
import { CONSUMER_KEY, CONSUMER_SECRET } from '../constants'
import { ReadFileError } from '../errors'
import { CallsLimiter, ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails, FileDetails, FolderDetails } from '../types'
import { DeployListResults, GetAllResponse, GetResult, isDeployListSuccess, isGetSuccess, isWriteResponseSuccess, SearchResponse } from './types'
import { DEPLOY_LIST_SCHEMA, GET_ALL_RESPONSE_SCHEMA, GET_RESULTS_SCHEMA, SEARCH_RESPONSE_SCHEMA } from './schemas'

const log = logger(module)

export const TRANSACTION_TYPES = ['SalesOrder']
export const WSDL_PATH = `${__dirname}/client/suiteapp_client/soap_client/wsdl/netsuite_1.wsdl`

const NETSUITE_VERSION = '2020_2'
const SEARCH_PAGE_SIZE = 100

export default class SoapClient {
  private credentials: SuiteAppCredentials
  private callsLimiter: CallsLimiter
  private ajv: Ajv
  private client: soap.Client | undefined

  constructor(credentials: SuiteAppCredentials, callsLimiter: CallsLimiter) {
    this.credentials = credentials
    this.callsLimiter = callsLimiter
    this.ajv = new Ajv({ allErrors: true, strict: false })
  }

  private async getClient(): Promise<soap.Client> {
    if (this.client === undefined) {
      this.client = await soap.createClientAsync(
        `https://webservices.netsuite.com/wsdl/v${NETSUITE_VERSION}_0/netsuite.wsdl`,
        { endpoint: `https://${toUrlAccountId(this.credentials.accountId)}.suitetalk.api.netsuite.com/services/NetSuitePort_${NETSUITE_VERSION}` }
      )
      this.client.addSoapHeader(() => this.generateSoapHeader())
    }
    return this.client
  }

  public async readFile(id: number): Promise<Buffer> {
    const body = {
      baseRef: {
        attributes: {
          internalId: id.toString(),
          type: 'file',
          'xsi:type': 'ns7:RecordRef',
          'xmlns:ns7': `urn:core_${NETSUITE_VERSION}.platform.webservices.netsuite.com`,
        },
      },
    }
    const response = (await this.sendSoapRequest('get', body))

    if (!this.ajv.validate<GetResult>(
      GET_RESULTS_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from get request with id ${id} in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from get request with id ${id} in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    if (!isGetSuccess(response)) {
      const { code, message } = response.readResponse.status.statusDetail[0]
      log.error(`Failed to read file with id ${id}: error code: ${code}, error message: ${message}`)
      throw new ReadFileError(`Failed to read file with id ${id}: error code: ${code}, error message: ${message}`)
    }

    const b64content = response.readResponse.record.content
    return b64content !== undefined ? Buffer.from(b64content, 'base64') : Buffer.from('')
  }

  private static convertToFileRecord(file: FileDetails): object {
    const internalIdEntry = file.id !== undefined ? { internalId: file.id.toString() } : {}
    return {
      attributes: {
        'xsi:type': 'q1:File',
        'xmlns:q1': `urn:filecabinet_${NETSUITE_VERSION}.documents.webservices.netsuite.com`,
        ...internalIdEntry,
      },
      'q1:name': path.basename(file.path),
      'q1:attachFrom': '_computer',
      'q1:content': file.content.toString('base64'),
      'q1:folder': {
        attributes: {
          internalId: file.folder.toString(),
        },
      },
      'q1:description': file.description,
      'q1:bundleable': file.bundleable,
      'q1:isInactive': file.isInactive,
      'q1:isOnline': file.isOnline,
      'q1:hideInBundle': file.hideInBundle,
    }
  }

  private static convertToFolderRecord(folder: FolderDetails): object {
    const parentEntry = folder.parent !== undefined
      ? {
        'q1:parent': {
          attributes: {
            internalId: folder.parent.toString(),
          },
        },
      }
      : {}

    const internalIdEntry = folder.id !== undefined ? { internalId: folder.id.toString() } : {}

    return {
      attributes: {
        'xsi:type': 'q1:Folder',
        'xmlns:q1': `urn:filecabinet_${NETSUITE_VERSION}.documents.webservices.netsuite.com`,
        ...internalIdEntry,
      },
      'q1:name': path.basename(folder.path),
      'q1:description': folder.description,
      'q1:bundleable': folder.bundleable,
      'q1:isInactive': folder.isInactive,
      'q1:isPrivate': folder.isPrivate,
      ...parentEntry,
    }
  }

  private static convertToFileCabinetRecord(fileCabinetInstance: FileCabinetInstanceDetails):
    object {
    return fileCabinetInstance.type === 'file'
      ? SoapClient.convertToFileRecord(fileCabinetInstance)
      : SoapClient.convertToFolderRecord(fileCabinetInstance)
  }

  private static convertToDeletionFileCabinetRecord(fileCabinetInstance:
    { id: number; type: 'file' | 'folder' }): object {
    return {
      attributes: {
        type: fileCabinetInstance.type,
        internalId: fileCabinetInstance.id,
        'xsi:type': 'q1:RecordRef',
        'xmlns:q1': `urn:core_${NETSUITE_VERSION}.platform.webservices.netsuite.com`,
      },
    }
  }

  public async addFileCabinetInstances(fileCabinetInstances:
    (FileCabinetInstanceDetails)[]): Promise<(number | Error)[]> {
    const body = {
      record: fileCabinetInstances.map(SoapClient.convertToFileCabinetRecord),
    }

    const response = await this.sendSoapRequest('addList', body)
    if (!this.ajv.validate<DeployListResults>(
      DEPLOY_LIST_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from addList request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from addList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    if (!isDeployListSuccess(response)) {
      const { code, message } = response.writeResponseList.status.statusDetail[0]
      log.error(`Failed to addList: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to addList: error code: ${code}, error message: ${message}`)
    }

    return response.writeResponseList.writeResponse.map((writeResponse, index) => {
      if (!isWriteResponseSuccess(writeResponse)) {
        const { code, message } = writeResponse.status.statusDetail[0]

        log.error(`SOAP api call to add file cabinet instance ${fileCabinetInstances[index].path} failed. error code: ${code}, error message: ${message}`)
        return new Error(`SOAP api call to add file cabinet instance ${fileCabinetInstances[index].path} failed. error code: ${code}, error message: ${message}`)
      }
      return parseInt(writeResponse.baseRef.attributes.internalId, 10)
    })
  }

  public async deleteFileCabinetInstances(instances: ExistingFileCabinetInstanceDetails[]):
  Promise<(number | Error)[]> {
    const body = {
      baseRef: instances.map(SoapClient.convertToDeletionFileCabinetRecord),
    }

    const response = await this.sendSoapRequest('deleteList', body)
    if (!this.ajv.validate<DeployListResults>(
      DEPLOY_LIST_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from deleteList request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from deleteList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    if (!isDeployListSuccess(response)) {
      const { code, message } = response.writeResponseList.status.statusDetail[0]

      log.error(`Failed to deleteList: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to deleteList: error code: ${code}, error message: ${message}`)
    }

    return response.writeResponseList.writeResponse.map((writeResponse, index) => {
      if (!isWriteResponseSuccess(writeResponse)) {
        const { code, message } = writeResponse.status.statusDetail[0]
        log.error(`SOAP api call to delete file cabinet instance ${instances[index].path} failed. error code: ${code}, error message: ${message}`)
        return Error(`SOAP api call to delete file cabinet instance ${instances[index].path} failed. error code: ${code}, error message: ${message}`)
      }
      return parseInt(writeResponse.baseRef.attributes.internalId, 10)
    })
  }

  public async updateFileCabinetInstances(fileCabinetInstances:
    ExistingFileCabinetInstanceDetails[]): Promise<(number | Error)[]> {
    const body = {
      record: fileCabinetInstances.map(SoapClient.convertToFileCabinetRecord),
    }

    const response = await this.sendSoapRequest('updateList', body)
    if (!this.ajv.validate<DeployListResults>(
      DEPLOY_LIST_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from updateList request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from updateList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    if (!isDeployListSuccess(response)) {
      const { code, message } = response.writeResponseList.status.statusDetail[0]
      log.error(`Failed to updateList: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to updateList: error code: ${code}, error message: ${message}`)
    }

    return response.writeResponseList.writeResponse.map((writeResponse, index) => {
      if (!isWriteResponseSuccess(writeResponse)) {
        const { code, message } = writeResponse.status.statusDetail[0]

        log.error(`SOAP api call to update file cabinet instance ${fileCabinetInstances[index].path} failed. error code: ${code}, error message: ${message}`)
        return Error(`SOAP api call to update file cabinet instance ${fileCabinetInstances[index].path} failed. error code: ${code}, error message: ${message}`)
      }
      return parseInt(writeResponse.baseRef.attributes.internalId, 10)
    })
  }

  public async getNetsuiteWsdl(): Promise<soap.WSDL> {
    // Though wsdl is private on the client, it is available publicly when using
    // the library without typescript so we rely on it to not change
    const { wsdl } = (await this.getClient()) as unknown as { wsdl: soap.WSDL }
    return wsdl
  }

  private async sendSoapRequest(operation: string, body: object): Promise<unknown> {
    const client = await this.getClient()
    return this.callsLimiter(async () => (await client[`${operation}Async`](body))[0])
  }

  private static getSearchType(type: string): string {
    return TRANSACTION_TYPES.includes(type) ? 'TransactionSearch' : `${type}Search`
  }

  public async getAllRecords(type: string): Promise<Record<string, unknown>[]> {
    log.debug(`Getting all records of ${type}`)

    const namespace = await this.getTypeNamespace(SoapClient.getSearchType(type))

    let results: Record<string, unknown>[]
    if (namespace !== undefined) {
      results = await this.search(type, namespace)
    } else {
      log.debug(`type ${type} does not support 'search' operation. Fallback to 'getAll' request`)
      results = await this.sendGetAllRequest(type)
    }

    log.debug(`Finished getting all records of ${type}`)
    return results
  }

  private async search(type: string, namespace: string): Promise<Record<string, unknown>[]> {
    const initialResponse = await this.sendSearchRequest(type, namespace)
    log.debug(`Finished sending initial search request for type ${type}`)

    const responses = [initialResponse]

    if (initialResponse.searchResult.totalPages > 1) {
      responses.push(
        ...await Promise.all(
          _.range(2, initialResponse.searchResult.totalPages + 1)
            .map(async i => {
              const res = await this.sendSearchWithIdRequest(
                initialResponse.searchResult.searchId,
                i
              )
              log.debug(`Finished sending search request for page ${i}/${initialResponse.searchResult.totalPages} of type ${type}`)
              return res
            })
        )
      )
    }

    return responses.map(
      response => response.searchResult.recordList?.record ?? []
    ).flat()
  }

  private async sendGetAllRequest(type: string): Promise<Record<string, unknown>[]> {
    const body = {
      record: {
        attributes: {
          recordType: type[0].toLowerCase() + type.slice(1),
        },
      },
    }

    const response = await this.sendSoapRequest('getAll', body)

    if (!this.ajv.validate<GetAllResponse>(
      GET_ALL_RESPONSE_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from get all request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from get all request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    return response.getAllResult.recordList.record
  }

  private async sendSearchRequest(type: string, namespace: string): Promise<SearchResponse> {
    const searchTypeName = SoapClient.getSearchType(type)
    const body = {
      searchRecord: {
        attributes: {
          'xsi:type': `q1:${searchTypeName}`,
          'xmlns:q1': namespace,
        },
      },
    }

    if (TRANSACTION_TYPES.includes(type)) {
      _.assign(body.searchRecord, {
        'tranSales:basic': {
          attributes: {
            'xmlns:tranSales': 'urn:sales_2020_2.transactions.webservices.netsuite.com',
            'xmlns:platformCommon': 'urn:common_2020_2.platform.webservices.netsuite.com',
            'xmlns:platformCore': 'urn:core_2020_2.platform.webservices.netsuite.com',
          },
          'platformCommon:type': {
            attributes: {
              'xsi:type': 'platformCore:SearchEnumMultiSelectField',
              operator: 'anyOf',
            },
            'platformCore:searchValue': type[0].toLowerCase() + type.slice(1),
          },
        },
      })
    }

    const response = await this.sendSoapRequest('search', body)

    if (!this.ajv.validate<SearchResponse>(
      SEARCH_RESPONSE_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from search request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from search request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    return response
  }

  private async sendSearchWithIdRequest(
    searchId: string,
    pageIndex: number
  ): Promise<SearchResponse> {
    const body = {
      searchId,
      pageIndex,
    }

    const response = await this.sendSoapRequest('searchMoreWithId', body)

    if (!this.ajv.validate<SearchResponse>(
      SEARCH_RESPONSE_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from search with id request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from search with id request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    return response
  }

  private async getTypeNamespace(type: string): Promise<string | undefined> {
    const wsdl = await this.getNetsuiteWsdl()
    return Object.entries(wsdl.definitions.schemas).find(
      ([_namespace, schema]) => schema.complexTypes[type] !== undefined
    )?.[0]
  }

  private generateSoapHeader(): object {
    const timestamp = new Date().getTime().toString().substring(0, 10)
    const nonce = crypto.randomBytes(10).toString('base64')
    const baseString = `${this.credentials.accountId}&${CONSUMER_KEY}&${this.credentials.suiteAppTokenId}&${nonce}&${timestamp}`
    const key = `${CONSUMER_SECRET}&${this.credentials.suiteAppTokenSecret}`
    const signature = crypto.createHmac('sha256', key).update(baseString).digest('base64')
    return {
      tokenPassport: {
        account: this.credentials.accountId,
        consumerKey: CONSUMER_KEY,
        token: this.credentials.suiteAppTokenId,
        nonce,
        timestamp,
        signature: {
          attributes: {
            algorithm: 'HMAC-SHA256',
          },
          $value: signature,
        },
      },
      preferences: {
        runServerSuiteScriptAndTriggerWorkflows: false,
      },
      searchPreferences: {
        pageSize: SEARCH_PAGE_SIZE,
        bodyFieldsOnly: false,
      },
    }
  }
}
