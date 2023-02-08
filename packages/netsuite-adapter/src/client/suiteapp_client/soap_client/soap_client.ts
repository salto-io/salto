/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, isListType, isObjectType, ObjectType, Value, Values } from '@salto-io/adapter-api'
import { collections, decorators, strings } from '@salto-io/lowerdash'
import { v4 as uuidv4 } from 'uuid'
import { RECORD_REF } from '../../../constants'
import { SuiteAppSoapCredentials, toUrlAccountId } from '../../credentials'
import { CONSUMER_KEY, CONSUMER_SECRET } from '../constants'
import { ReadFileError } from '../errors'
import { CallsLimiter, ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails, FileDetails, FolderDetails } from '../types'
import { CustomRecordTypeRecords, DeployListResults, GetAllResponse, GetResult, isDeployListSuccess, isGetSuccess, isWriteResponseSuccess, RecordValue, SearchErrorResponse, SearchResponse } from './types'
import { DEPLOY_LIST_SCHEMA, GET_ALL_RESPONSE_SCHEMA, GET_RESULTS_SCHEMA, SEARCH_RESPONSE_SCHEMA, SEARCH_SUCCESS_SCHEMA } from './schemas'
import { InvalidSuiteAppCredentialsError } from '../../types'
import { isCustomRecordType } from '../../../types'
import { INTERNAL_ID_TO_TYPES, ITEM_TYPE_ID, ITEM_TYPE_TO_SEARCH_STRING, TYPES_TO_INTERNAL_ID } from '../../../data_elements/types'
import { XSI_TYPE } from '../../constants'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

export const { createClientAsync } = elementUtils.soap

const log = logger(module)

export const ITEMS_TYPES = INTERNAL_ID_TO_TYPES[ITEM_TYPE_ID]
export const WSDL_PATH = `${__dirname}/client/suiteapp_client/soap_client/wsdl/netsuite_1.wsdl`
const REQUEST_MAX_RETRIES = 5
const REQUEST_RETRY_DELAY = 5000

// When updating the version, we should also update the types in src/data_elements/types.ts
const NETSUITE_VERSION = '2020_2'
const SEARCH_PAGE_SIZE = 100
const SOAP_CORE_URN = `urn:core_${NETSUITE_VERSION}.platform.webservices.netsuite.com`
const SOAP_COMMON_URN = `urn:common_${NETSUITE_VERSION}.platform.webservices.netsuite.com`
const SOAP_FILE_CABINET_URN = `urn:filecabinet_${NETSUITE_VERSION}.documents.webservices.netsuite.com`

const SOAP_CUSTOM_RECORD_TYPE_NAME = 'CustomRecord'

const RETRYABLE_MESSAGES = ['ECONN', 'UNEXPECTED_ERROR', 'INSUFFICIENT_PERMISSION', 'VALIDATION_ERROR']
const SOAP_RETRYABLE_MESSAGES = ['CONCURRENT']
const SOAP_RETRYABLE_STATUS_INITIALS = ['5']

type SoapSearchType = {
  type: string
  subtypes?: string[]
}

const retryOnBadResponseWithDelay = (
  retryableMessages: string[],
  retryableStatuses: string[] = [],
  retryDelay?: number
): decorators.InstanceMethodDecorator => (
  decorators.wrapMethodWith(
    async (
      call: decorators.OriginalCall,
    ): Promise<unknown> => {
      const shouldRetry = (e: Value): boolean =>
        retryableMessages.some(message => e?.message?.toUpperCase?.()?.includes?.(message)
          || e?.code?.toUpperCase?.()?.includes?.(message))
        || retryableStatuses.some(status => String(e?.response?.status).startsWith(status))

      const runWithRetry = async (retriesLeft: number): Promise<unknown> => {
        try {
          // eslint-disable-next-line @typescript-eslint/return-await
          return await call.call()
        } catch (e) {
          if (shouldRetry(e) && retriesLeft > 0) {
            log.warn('Retrying soap request with error: %s. Retries left: %d', e.message, retriesLeft)
            if (retryDelay) {
              await new Promise(f => setTimeout(f, retryDelay))
            }
            return runWithRetry(retriesLeft - 1)
          }

          if (retriesLeft === 0) {
            log.error('Soap request exceed max retries with error: %s', e.message)
          } else {
            log.error('Soap request had error: %s', e.message)
          }

          throw e
        }
      }
      return runWithRetry(REQUEST_MAX_RETRIES)
    }
  )
)

const retryOnBadResponse = retryOnBadResponseWithDelay(RETRYABLE_MESSAGES)

export default class SoapClient {
  private credentials: SuiteAppSoapCredentials
  private callsLimiter: CallsLimiter
  private ajv: Ajv
  private client: elementUtils.soap.Client | undefined

  constructor(credentials: SuiteAppSoapCredentials, callsLimiter: CallsLimiter) {
    this.credentials = credentials
    this.callsLimiter = callsLimiter
    this.ajv = new Ajv({ allErrors: true, strict: false })
  }

  @retryOnBadResponse
  private async getClient(): Promise<elementUtils.soap.Client> {
    if (this.client === undefined) {
      this.client = await createClientAsync(
        `https://webservices.netsuite.com/wsdl/v${NETSUITE_VERSION}_0/netsuite.wsdl`,
        { endpoint: `https://${toUrlAccountId(this.credentials.accountId)}.suitetalk.api.netsuite.com/services/NetSuitePort_${NETSUITE_VERSION}` }
      )
      this.client.addSoapHeader(() => this.generateSoapHeader())
    }
    return this.client
  }

  @retryOnBadResponse
  public async readFile(id: number): Promise<Buffer> {
    const body = {
      baseRef: {
        attributes: {
          internalId: id.toString(),
          type: 'file',
          [XSI_TYPE]: 'ns7:RecordRef',
          'xmlns:ns7': SOAP_CORE_URN,
        },
      },
    }
    const response = (await this.sendSoapRequest('get', body))

    if (!this.ajv.validate<GetResult>(
      GET_RESULTS_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from get request with id ${id} in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`VALIDATION_ERROR - Got invalid response from get request with id ${id} in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
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
        [XSI_TYPE]: 'q1:File',
        'xmlns:q1': SOAP_FILE_CABINET_URN,
        ...internalIdEntry,
      },
      'q1:name': path.basename(file.path),
      'q1:attachFrom': '_computer',
      ...file.folder ? {
        'q1:folder': {
          attributes: {
            internalId: file.folder.toString(),
          },
        },
      } : {},
      'q1:description': file.description,
      'q1:bundleable': file.bundleable,
      'q1:isInactive': file.isInactive,
      'q1:isOnline': file.isOnline,
      'q1:hideInBundle': file.hideInBundle,
      ...'content' in file
        ? { 'q1:content': file.content.toString('base64') }
        : { 'q1:url': file.url },
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
        [XSI_TYPE]: 'q1:Folder',
        'xmlns:q1': SOAP_FILE_CABINET_URN,
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

  private static convertToDeletionRecord({
    id, type, isCustomRecord,
  } : { id: number; type: string; isCustomRecord?: boolean }): object {
    return {
      attributes: isCustomRecord ? {
        typeId: type,
        internalId: id,
        [XSI_TYPE]: 'q1:CustomRecordRef',
        'xmlns:q1': SOAP_CORE_URN,
      } : {
        type,
        internalId: id,
        [XSI_TYPE]: 'q1:RecordRef',
        'xmlns:q1': SOAP_CORE_URN,
      },
    }
  }

  @retryOnBadResponse
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
      throw new Error(`VALIDATION_ERROR - Got invalid response from addList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
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

  @retryOnBadResponse
  public async deleteFileCabinetInstances(instances: ExistingFileCabinetInstanceDetails[]):
  Promise<(number | Error)[]> {
    const body = {
      baseRef: instances.map(SoapClient.convertToDeletionRecord),
    }

    const response = await this.sendSoapRequest('deleteList', body)
    if (!this.ajv.validate<DeployListResults>(
      DEPLOY_LIST_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from deleteList request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`VALIDATION_ERROR - Got invalid response from deleteList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
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

  @retryOnBadResponse
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
      throw new Error(`VALIDATION_ERROR - Got invalid response from updateList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
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

  public async getNetsuiteWsdl(): Promise<elementUtils.soap.WSDL> {
    // Though wsdl is private on the client, it is available publicly when using
    // the library without typescript so we rely on it to not change
    const { wsdl } = (await this.getClient()) as unknown as { wsdl: elementUtils.soap.WSDL }
    return wsdl
  }

  @retryOnBadResponseWithDelay(
    SOAP_RETRYABLE_MESSAGES,
    SOAP_RETRYABLE_STATUS_INITIALS,
    REQUEST_RETRY_DELAY
  )
  private static async soapRequestWithRetries(
    client: elementUtils.soap.Client, operation: string, body: object
  ): Promise<unknown> {
    return (await client[`${operation}Async`](body))[0]
  }

  private async sendSoapRequest(operation: string, body: object): Promise<unknown> {
    const client = await this.getClient()
    try {
      return await this.callsLimiter(
        async () => log.time(
          () => SoapClient.soapRequestWithRetries(client, operation, body),
          `${operation}-soap-request`
        )
      )
    } catch (e) {
      log.warn('Received error from NetSuite SuiteApp Soap request: operation - %s, body - %o, error - %o', operation, body, e)
      if (e.message.includes('Invalid login attempt.')) {
        throw new InvalidSuiteAppCredentialsError()
      }
      throw e
    }
  }

  private static getSearchType(type: string): string {
    return `${strings.capitalizeFirstLetter(type)}Search`
  }

  public async getAllRecords(types: string[]): Promise<RecordValue[]> {
    log.debug(`Getting all records of ${types.join(', ')}`)

    const [itemTypes, otherTypes] = _.partition(types, type => type in ITEM_TYPE_TO_SEARCH_STRING)

    const typesToSearch: SoapSearchType[] = otherTypes
      .map(type => ({ type }))
    if (itemTypes.length !== 0) {
      typesToSearch.push({ type: 'Item', subtypes: _.uniq(itemTypes.map(type => ITEM_TYPE_TO_SEARCH_STRING[type])) })
    }

    return (await Promise.all(typesToSearch.map(async ({ type, subtypes }) => {
      const namespace = await this.getTypeNamespace(SoapClient.getSearchType(type))

      if (namespace !== undefined) {
        return this.search(type, namespace, subtypes)
      }
      log.debug(`type ${type} does not support 'search' operation. Fallback to 'getAll' request`)
      const records = await this.sendGetAllRequest(type)

      log.debug(`Finished getting all records of ${type}`)
      return records
    }))).flat()
  }

  public async getCustomRecords(customRecordTypes: string[]): Promise<CustomRecordTypeRecords[]> {
    return Promise.all(
      customRecordTypes.map(async type => ({
        type,
        records: await this.searchCustomRecords(type),
      }))
    )
  }

  private static convertToSoapTypeName(type: ObjectType, isRecordRef: boolean): string {
    if (isRecordRef) {
      return RECORD_REF
    }
    if (isCustomRecordType(type)) {
      return SOAP_CUSTOM_RECORD_TYPE_NAME
    }
    return (type.elemID.name[0].toUpperCase() + type.elemID.name.slice(1))
  }

  private async convertToSoapRecord(
    values: Values,
    type: ObjectType,
    isTopLevel = true,
    isRecordRef = false,
  ): Promise<RecordValue> {
    const typeName = SoapClient.convertToSoapTypeName(type, isRecordRef)
    // Namespace alias must start with a character (and not a number)
    const namespaceAlias = `pre${uuidv4()}`

    return {
      attributes: {
        ...values.attributes ?? {},
        [`xmlns:${namespaceAlias}`]: await this.getTypeNamespace(typeName),
        ...isTopLevel ? { [XSI_TYPE]: `${namespaceAlias}:${typeName}` } : {},

      },
      ...Object.fromEntries(await awu(Object.entries(values))
        .filter(([key]) => key !== 'attributes')
        .map(async ([key, value]) => {
          const updateKey = !key.includes(':') ? `${namespaceAlias}:${key}` : key
          const fieldType = await type.fields[key]?.getType()

          if (isObjectType(fieldType) && _.isPlainObject(value)) {
            return [
              updateKey,
              await this.convertToSoapRecord(
                value,
                fieldType,
                false,
                Boolean(type.fields[key]?.annotations.isReference)
              ),
            ]
          }

          if (isListType(fieldType)) {
            const innerType = await fieldType.getInnerType()
            if (isObjectType(innerType)) {
              return [updateKey, await awu(makeArray(value)).map(
                async val => this.convertToSoapRecord(
                  val,
                  innerType,
                  false
                )
              ).toArray()]
            }
          }

          return [updateKey, value]
        }).toArray()),
    }
  }

  @retryOnBadResponse
  private async runDeployAction(
    instances: InstanceElement[],
    body: {
      attributes: Record<string, string>
      record: RecordValue[]
    } | {
      baseRef: object[]
    },
    action: 'updateList' | 'addList' | 'deleteList'
  ): Promise<(number | Error)[]> {
    const response = await this.sendSoapRequest(action, body)
    if (!this.ajv.validate<DeployListResults>(
      DEPLOY_LIST_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from ${action} request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`VALIDATION_ERROR - Got invalid response from ${action} request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    if (!isDeployListSuccess(response)) {
      const { code, message } = response.writeResponseList.status.statusDetail[0]
      log.error(`Failed to ${action}: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to ${action}: error code: ${code}, error message: ${message}`)
    }

    return response.writeResponseList.writeResponse.map((writeResponse, index) => {
      if (!isWriteResponseSuccess(writeResponse)) {
        const { code, message } = writeResponse.status.statusDetail[0]

        log.error(`SOAP api call ${action} for instance ${instances[index].elemID.getFullName()} failed. error code: ${code}, error message: ${message}`)
        return Error(`SOAP api call ${action} for instance ${instances[index].elemID.getFullName()} failed. error code: ${code}, error message: ${message}`)
      }
      return parseInt(writeResponse.baseRef.attributes.internalId, 10)
    })
  }

  public async updateInstances(instances: InstanceElement[]): Promise<(number | Error)[]> {
    const body = {
      attributes: {
        'xmlns:platformCore': SOAP_CORE_URN,
      },
      record: await awu(instances).map(
        async instance => this.convertToSoapRecord(instance.value, await instance.getType())
      ).toArray(),
    }
    return this.runDeployAction(instances, body, 'updateList')
  }

  public async addInstances(instances: InstanceElement[]): Promise<(number | Error)[]> {
    const body = {
      attributes: {
        'xmlns:platformCore': SOAP_CORE_URN,
      },
      record: await awu(instances).map(
        async instance => this.convertToSoapRecord(instance.value, await instance.getType())
      ).toArray(),
    }
    return this.runDeployAction(instances, body, 'addList')
  }

  public async deleteInstances(instances: InstanceElement[]):
  Promise<(number | Error)[]> {
    const body = {
      baseRef: await awu(instances).map(async instance => {
        const isCustomRecord = isCustomRecordType(await instance.getType())
        return SoapClient.convertToDeletionRecord({
          id: instance.value.attributes.internalId,
          type: isCustomRecord
            ? instance.value.recType.attributes.internalId
            : instance.elemID.typeName[0].toLowerCase() + instance.elemID.typeName.slice(1),
          isCustomRecord,
        })
      }).toArray(),
    }
    return this.runDeployAction(instances, body, 'deleteList')
  }

  public async deleteSdfInstances(instances: InstanceElement[]):
  Promise<(number | Error)[]> {
    const body = {
      baseRef: await awu(instances).map(async instance => {
        const instanceTypeFromMap = Object.keys(TYPES_TO_INTERNAL_ID)
          .find(key => key.toLowerCase() === instance.elemID.typeName.toLowerCase())
        return SoapClient.convertToDeletionRecord({
          id: instance.value.internalId,
          type: instanceTypeFromMap ?? instance.elemID.typeName,
          isCustomRecord: false,
        })
      }).toArray(),
    }
    return this.runDeployAction(instances, body, 'deleteList')
  }

  private async getAllSearchPages(
    initialSearchResponse: SearchResponse,
    type: string
  ): Promise<SearchResponse[]> {
    const { totalPages, searchId } = initialSearchResponse.searchResult
    if (totalPages <= 1) {
      return [initialSearchResponse]
    }
    const responses = await Promise.all(
      _.range(2, totalPages + 1).map(async i => {
        const res = await this.sendSearchWithIdRequest({ searchId, pageIndex: i })
        log.debug(`Finished sending search request for page ${i}/${totalPages} of type ${type}`)
        return res
      })
    )
    return [initialSearchResponse].concat(responses)
  }

  private async search(
    type: string,
    namespace: string,
    subtypes?: string[]
  ): Promise<RecordValue[]> {
    const responses = await this.getAllSearchPages(
      await this.sendSearchRequest(type, namespace, subtypes),
      type
    )
    return responses.flatMap(({ searchResult }) => searchResult.recordList?.record ?? [])
  }

  private async searchCustomRecords(
    customRecordType: string
  ): Promise<RecordValue[]> {
    const responses = await this.getAllSearchPages(
      await this.sendCustomRecordsSearchRequest(customRecordType),
      customRecordType
    )
    return responses.flatMap(({ searchResult }) => searchResult.recordList?.record ?? [])
  }

  @retryOnBadResponse
  private async sendGetAllRequest(type: string): Promise<RecordValue[]> {
    const body = {
      record: {
        attributes: {
          recordType: type,
        },
      },
    }

    const response = await this.sendSoapRequest('getAll', body)

    if (!this.ajv.validate<GetAllResponse>(
      GET_ALL_RESPONSE_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from get all request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`VALIDATION_ERROR - Got invalid response from get all request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    return response.getAllResult.recordList.record
  }

  private assertSearchResponse(
    value: unknown
  ): asserts value is SearchResponse | SearchErrorResponse {
    if (!this.ajv.validate(SEARCH_RESPONSE_SCHEMA, value)) {
      log.error(`Got invalid response from search request with SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(value, undefined, 2)}`)
      throw new Error(`VALIDATION_ERROR - Got invalid response from search request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(value, undefined, 2)}`)
    }
  }

  private assertSuccessSearchResponse(
    value: unknown
  ): asserts value is SearchResponse {
    if (!this.ajv.validate(SEARCH_SUCCESS_SCHEMA, value)) {
      log.error(`Got invalid response from search request with SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(value, undefined, 2)}`)
      throw new Error(`VALIDATION_ERROR - Got invalid response from search request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(value, undefined, 2)}`)
    }
  }

  private static toSearchResponse(
    response: SearchResponse | SearchErrorResponse
  ): SearchResponse {
    if ('totalPages' in response.searchResult) {
      return { searchResult: response.searchResult }
    }
    return { searchResult: { totalPages: 0, searchId: '', recordList: null } }
  }

  @retryOnBadResponse
  private async sendSearchRequest(
    type: string,
    namespace: string,
    subtypes?: string[],
  ): Promise<SearchResponse> {
    const searchTypeName = SoapClient.getSearchType(type)
    const body = {
      searchRecord: {
        attributes: {
          [XSI_TYPE]: `q1:${searchTypeName}`,
          'xmlns:q1': namespace,
        },
      },
    }

    if (subtypes !== undefined) {
      _.assign(body.searchRecord, {
        'q1:basic': {
          attributes: {
            'xmlns:platformCommon': SOAP_COMMON_URN,
            'xmlns:platformCore': SOAP_CORE_URN,
          },
          'platformCommon:type': {
            attributes: {
              [XSI_TYPE]: 'platformCore:SearchEnumMultiSelectField',
              operator: 'anyOf',
            },
            'platformCore:searchValue': subtypes,
          },
        },
      })
    }

    const response = await this.sendSoapRequest('search', body)
    this.assertSearchResponse(response)
    return SoapClient.toSearchResponse(response)
  }

  @retryOnBadResponse
  private async sendCustomRecordsSearchRequest(
    customRecordType: string
  ): Promise<SearchResponse> {
    const body = {
      searchRecord: {
        attributes: {
          [XSI_TYPE]: 'ns7:CustomRecordSearchBasic',
          'xmlns:ns7': SOAP_COMMON_URN,
        },
        'ns7:recType': {
          attributes: {
            scriptId: customRecordType,
            type: 'customRecordType',
            [XSI_TYPE]: 'ns8:CustomizationRef',
            'xmlns:ns8': SOAP_CORE_URN,
          },
        },
      },
    }
    const response = await this.sendSoapRequest('search', body)
    this.assertSearchResponse(response)
    return SoapClient.toSearchResponse(response)
  }

  @retryOnBadResponse
  private async sendSearchWithIdRequest(
    args: {
      searchId: string
      pageIndex: number
    }
  ): Promise<SearchResponse> {
    const response = await this.sendSoapRequest('searchMoreWithId', args)
    this.assertSuccessSearchResponse(response)
    return response
  }

  private async getTypeNamespace(type: string): Promise<string | undefined> {
    const wsdl = await this.getNetsuiteWsdl()
    return Object.entries(wsdl.definitions.schemas).find(
      ([_namespace, schema]) =>
        schema.complexTypes[strings.capitalizeFirstLetter(type)] !== undefined
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
