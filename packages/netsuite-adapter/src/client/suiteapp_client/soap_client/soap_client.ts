/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import Ajv from 'ajv'
import crypto from 'crypto'
import path from 'path'
import { soap } from '@salto-io/adapter-components'
import { InstanceElement, isListType, isObjectType, ObjectType, Value, Values } from '@salto-io/adapter-api'
import { collections, decorators, promises, strings } from '@salto-io/lowerdash'
import { v4 as uuidv4 } from 'uuid'
import { RECORD_REF } from '../../../constants'
import { SuiteAppSoapCredentials, toUrlAccountId } from '../../credentials'
import {
  ATTRIBUTES,
  CONSUMER_KEY,
  CONSUMER_SECRET,
  ECONN_ERROR,
  INSUFFICIENT_PERMISSION_ERROR,
  REQUEST_ABORTED_ERROR,
  TYPE_ID,
  UNEXPECTED_ERROR,
  VALIDATION_ERROR,
} from '../constants'
import { ReadFileError } from '../errors'
import {
  CallsLimiter,
  ExistingFileCabinetInstanceDetails,
  FileCabinetInstanceDetails,
  FileDetails,
  FolderDetails,
  HasElemIDFunc,
} from '../types'
import {
  CustomRecordResponse,
  DeployListResults,
  GetAllResponse,
  GetResult,
  GetSelectValueResponse,
  SoapDeployResult,
  isDeployListSuccess,
  isGetAllErrorResponse,
  isGetSelectValueSuccessResponse,
  isGetSuccess,
  isSearchErrorResponse,
  isWriteResponseSuccess,
  RecordResponse,
  RecordValue,
  SearchErrorResponse,
  SearchPageResponse,
  SearchResponse,
  SoapSearchType,
  WriteResponse,
  WSDLVersion,
} from './types'
import {
  DEPLOY_LIST_SCHEMA,
  GET_ALL_RESPONSE_SCHEMA,
  GET_RESULTS_SCHEMA,
  GET_SELECT_VALUE_SCHEMA,
  SEARCH_RESPONSE_SCHEMA,
} from './schemas'
import { InvalidSuiteAppCredentialsError } from '../../types'
import { isCustomRecordType } from '../../../types'
import { getTypesToInternalId, isItemType, ITEM_TYPE_TO_SEARCH_STRING } from '../../../data_elements/types'
import { XSI_TYPE } from '../../constants'
import { InstanceLimiterFunc, SuiteAppClientConfig } from '../../../config/types'
import { toError } from '../../utils'
import { removeUneditableLockedField } from './filter_uneditable_locked_field'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

export const { createClientAsync } = soap

const log = logger(module)

const REQUEST_MAX_RETRIES = 5
const REQUEST_RETRY_DELAY = 5000
const LOCKED_FIELDS_MAX_DEPLOYS = 6

// When updating the version, we should also update the types in src/data_elements/types.ts
export const DEFAULT_WSDL_VERSION: WSDLVersion = '2024_1'
const SEARCH_PAGE_SIZE = 100

const SOAP_CUSTOM_RECORD_TYPE_NAME = 'CustomRecord'

const RETRYABLE_MESSAGES = [
  ECONN_ERROR,
  UNEXPECTED_ERROR,
  INSUFFICIENT_PERMISSION_ERROR,
  VALIDATION_ERROR,
  REQUEST_ABORTED_ERROR,
]
const SOAP_RETRYABLE_MESSAGES = ['CONCURRENT']
const SOAP_RETRYABLE_STATUS_INITIALS = ['5']

type DeleteDeployBody = {
  baseRef: object[]
}

type AddAndUpdateDeployBody = {
  attributes: Record<string, string>
  record: RecordValue[]
}

const retryOnBadResponseWithDelay = (
  retryableMessages: string[],
  retryableStatuses: string[] = [],
  retryDelay?: number,
): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(async (call: decorators.OriginalCall): Promise<unknown> => {
    const shouldRetry = (e: Value): boolean =>
      retryableMessages.some(
        message => toError(e).message.toUpperCase().includes(message) || e?.code?.toUpperCase?.()?.includes?.(message),
      ) || retryableStatuses.some(status => String(e?.response?.status).startsWith(status))

    const runWithRetry = async (retriesLeft: number): Promise<unknown> => {
      try {
        return await call.call()
      } catch (e) {
        const error = toError(e)
        if (shouldRetry(e) && retriesLeft > 0) {
          log.warn('Retrying soap request with error: %s. Retries left: %d', error.message, retriesLeft)
          if (retryDelay) {
            await new Promise(f => setTimeout(f, retryDelay))
          }
          return runWithRetry(retriesLeft - 1)
        }

        if (retriesLeft === 0) {
          log.error('Soap request exceed max retries with error: %s', error.message)
        } else {
          log.error('Soap request had error: %s', error.message)
        }

        throw e
      }
    }
    return runWithRetry(REQUEST_MAX_RETRIES)
  })

const retryOnBadResponse = retryOnBadResponseWithDelay(RETRYABLE_MESSAGES)

const recordFromSearchResponse = (searchResponse: SearchResponse): RecordValue[] =>
  searchResponse.searchResult.recordList?.record || []

export default class SoapClient {
  private credentials: SuiteAppSoapCredentials
  private callsLimiter: CallsLimiter
  private ajv: Ajv
  private client: soap.Client | undefined
  private instanceLimiter: InstanceLimiterFunc
  private timeout: number

  private readonly SOAP_CORE_URN: string
  private readonly SOAP_COMMON_URN: string
  private readonly SOAP_FILE_CABINET_URN: string
  private readonly SOAP_WSDL_URL: string
  private readonly SOAP_WSDL_ENDPOINT: string

  constructor(
    credentials: SuiteAppSoapCredentials,
    config: SuiteAppClientConfig | undefined,
    callsLimiter: CallsLimiter,
    instanceLimiter: InstanceLimiterFunc,
    timeout: number,
  ) {
    this.credentials = credentials
    this.callsLimiter = callsLimiter
    this.instanceLimiter = instanceLimiter
    this.timeout = timeout
    this.ajv = new Ajv({ allErrors: true, strict: false })

    const wsdlVersion = config?.wsdlVersion ?? DEFAULT_WSDL_VERSION
    log.info('Using SOAP WSDL version %s', wsdlVersion)

    this.SOAP_CORE_URN = `urn:core_${wsdlVersion}.platform.webservices.netsuite.com`
    this.SOAP_COMMON_URN = `urn:common_${wsdlVersion}.platform.webservices.netsuite.com`
    this.SOAP_FILE_CABINET_URN = `urn:filecabinet_${wsdlVersion}.documents.webservices.netsuite.com`
    this.SOAP_WSDL_URL = `https://webservices.netsuite.com/wsdl/v${wsdlVersion}_0/netsuite.wsdl`
    this.SOAP_WSDL_ENDPOINT = `https://${toUrlAccountId(this.credentials.accountId)}.suitetalk.api.netsuite.com/services/NetSuitePort_${wsdlVersion}`
  }

  @retryOnBadResponse
  private async getClient(): Promise<soap.Client> {
    if (this.client === undefined) {
      this.client = await createClientAsync(this.SOAP_WSDL_URL, {
        endpoint: this.SOAP_WSDL_ENDPOINT,
      })
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
          'xmlns:ns7': this.SOAP_CORE_URN,
        },
      },
    }
    const response = await this.sendSoapRequest('get', body)

    if (!this.ajv.validate<GetResult>(GET_RESULTS_SCHEMA, response)) {
      log.error(
        `Got invalid response from get request with id ${id} in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
      throw new Error(
        `VALIDATION_ERROR - Got invalid response from get request with id ${id} in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
    }

    if (!isGetSuccess(response)) {
      const { code, message } = response.readResponse.status.statusDetail[0]
      log.error(`Failed to read file with id ${id}: error code: ${code}, error message: ${message}`)
      throw new ReadFileError(`Failed to read file with id ${id}: error code: ${code}, error message: ${message}`)
    }

    const b64content = response.readResponse.record.content
    return b64content !== undefined ? Buffer.from(b64content, 'base64') : Buffer.from('')
  }

  private convertToFileRecord(file: FileDetails): object {
    const internalIdEntry = file.id !== undefined ? { internalId: file.id.toString() } : {}
    return {
      attributes: {
        [XSI_TYPE]: 'q1:File',
        'xmlns:q1': this.SOAP_FILE_CABINET_URN,
        ...internalIdEntry,
      },
      'q1:name': path.basename(file.path),
      'q1:attachFrom': '_computer',
      ...(file.folder
        ? {
            'q1:folder': {
              attributes: {
                internalId: file.folder,
              },
            },
          }
        : {}),
      'q1:description': file.description,
      'q1:bundleable': file.bundleable,
      'q1:isInactive': file.isInactive,
      'q1:isOnline': file.isOnline,
      'q1:hideInBundle': file.hideInBundle,
      ...('content' in file ? { 'q1:content': file.content.toString('base64') } : { 'q1:url': file.url }),
    }
  }

  private convertToFolderRecord(folder: FolderDetails): object {
    const parentEntry =
      folder.parent !== undefined
        ? {
            'q1:parent': {
              attributes: {
                internalId: folder.parent,
              },
            },
          }
        : {}

    const internalIdEntry = folder.id !== undefined ? { internalId: folder.id.toString() } : {}

    return {
      attributes: {
        [XSI_TYPE]: 'q1:Folder',
        'xmlns:q1': this.SOAP_FILE_CABINET_URN,
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

  private convertToFileCabinetRecord(fileCabinetInstance: FileCabinetInstanceDetails): object {
    return fileCabinetInstance.type === 'file'
      ? this.convertToFileRecord(fileCabinetInstance)
      : this.convertToFolderRecord(fileCabinetInstance)
  }

  private convertToDeletionRecord({
    id,
    type,
    isCustomRecord,
  }: {
    id: number
    type: string
    isCustomRecord?: boolean
  }): object {
    return {
      attributes: isCustomRecord
        ? {
            [TYPE_ID]: type,
            internalId: id,
            [XSI_TYPE]: 'q1:CustomRecordRef',
            'xmlns:q1': this.SOAP_CORE_URN,
          }
        : {
            type,
            internalId: id,
            [XSI_TYPE]: 'q1:RecordRef',
            'xmlns:q1': this.SOAP_CORE_URN,
          },
    }
  }

  @retryOnBadResponse
  public async addFileCabinetInstances(
    fileCabinetInstances: FileCabinetInstanceDetails[],
  ): Promise<SoapDeployResult[]> {
    const body = {
      record: fileCabinetInstances.map(instance => this.convertToFileCabinetRecord(instance)),
    }

    const response = await this.sendSoapRequest('addList', body)
    if (!this.ajv.validate<DeployListResults>(DEPLOY_LIST_SCHEMA, response)) {
      log.error(
        `Got invalid response from addList request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
      throw new Error(
        `VALIDATION_ERROR - Got invalid response from addList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
    }

    if (!isDeployListSuccess(response)) {
      const { code, message } = response.writeResponseList.status.statusDetail[0]
      log.error(`Failed to addList: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to addList: error code: ${code}, error message: ${message}`)
    }

    return SoapClient.parseWriteResponseList(
      response.writeResponseList.writeResponse,
      fileCabinetInstances.map(instance => instance.path),
      'addList',
    )
  }

  @retryOnBadResponse
  public async deleteFileCabinetInstances(
    instances: ExistingFileCabinetInstanceDetails[],
  ): Promise<SoapDeployResult[]> {
    const body = {
      baseRef: instances.map(instance => this.convertToDeletionRecord(instance)),
    }

    const response = await this.sendSoapRequest('deleteList', body)
    if (!this.ajv.validate<DeployListResults>(DEPLOY_LIST_SCHEMA, response)) {
      log.error(
        `Got invalid response from deleteList request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
      throw new Error(
        `VALIDATION_ERROR - Got invalid response from deleteList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
    }

    if (!isDeployListSuccess(response)) {
      const { code, message } = response.writeResponseList.status.statusDetail[0]

      log.error(`Failed to deleteList: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to deleteList: error code: ${code}, error message: ${message}`)
    }

    return SoapClient.parseWriteResponseList(
      response.writeResponseList.writeResponse,
      instances.map(instance => instance.path),
      'deleteList',
    )
  }

  @retryOnBadResponse
  public async updateFileCabinetInstances(
    fileCabinetInstances: ExistingFileCabinetInstanceDetails[],
  ): Promise<SoapDeployResult[]> {
    const body = {
      record: fileCabinetInstances.map(instance => this.convertToFileCabinetRecord(instance)),
    }

    const response = await this.sendSoapRequest('updateList', body)
    if (!this.ajv.validate<DeployListResults>(DEPLOY_LIST_SCHEMA, response)) {
      log.error(
        `Got invalid response from updateList request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
      throw new Error(
        `VALIDATION_ERROR - Got invalid response from updateList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
    }

    if (!isDeployListSuccess(response)) {
      const { code, message } = response.writeResponseList.status.statusDetail[0]
      log.error(`Failed to updateList: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to updateList: error code: ${code}, error message: ${message}`)
    }

    return SoapClient.parseWriteResponseList(
      response.writeResponseList.writeResponse,
      fileCabinetInstances.map(instance => instance.path),
      'updateList',
    )
  }

  public async getNetsuiteWsdl(): Promise<soap.WSDL> {
    // Though wsdl is private on the client, it is available publicly when using
    // the library without typescript so we rely on it to not change
    const { wsdl } = (await this.getClient()) as unknown as { wsdl: soap.WSDL }
    return wsdl
  }

  @retryOnBadResponseWithDelay(SOAP_RETRYABLE_MESSAGES, SOAP_RETRYABLE_STATUS_INITIALS, REQUEST_RETRY_DELAY)
  private static async soapRequestWithRetries(
    client: soap.Client,
    operation: string,
    body: object,
    timeout: number,
  ): Promise<unknown> {
    const result = await promises.timeout.withTimeout<unknown[]>(client[`${operation}Async`](body), timeout)
    return result[0]
  }

  private async sendSoapRequest(operation: string, body: object): Promise<unknown> {
    const client = await this.getClient()
    try {
      return await this.callsLimiter(async () =>
        log.timeDebug(
          () => SoapClient.soapRequestWithRetries(client, operation, body, this.timeout),
          `${operation}-soap-request`,
        ),
      )
    } catch (e) {
      log.warn(
        'Received error from NetSuite SuiteApp Soap request: operation - %s, body - %o, error - %o',
        operation,
        body,
        e,
      )
      if (toError(e).message.includes('Invalid login attempt.')) {
        throw new InvalidSuiteAppCredentialsError()
      }
      throw e
    }
  }

  private static getSearchType(type: string): string {
    return `${strings.capitalizeFirstLetter(type)}Search`
  }

  public async getAllRecords(types: string[]): Promise<RecordResponse> {
    log.debug(`Getting all records of ${types.join(', ')}`)

    const [itemTypes, otherTypes] = _.partition(types, isItemType)

    const typesToSearch: SoapSearchType[] = otherTypes.map(type => ({ type }))

    if (itemTypes.length !== 0) {
      typesToSearch.push({
        type: 'Item',
        originalTypes: itemTypes,
        subtypes: _.uniq(itemTypes.map(type => ITEM_TYPE_TO_SEARCH_STRING[type])),
      })
    }

    const responses = await Promise.all(
      typesToSearch.map(async params => {
        const { type, subtypes, originalTypes } = params
        const namespace = await this.getTypeNamespace(SoapClient.getSearchType(type))

        if (namespace !== undefined) {
          const response = await this.search(type, namespace, subtypes)
          return response.excludedFromSearch
            ? { largeTypesError: originalTypes ?? [type] }
            : { records: response.records }
        }
        log.debug(`type ${type} does not support 'search' operation. Fallback to 'getAll' request`)
        // This type of query cannot be limited, so there are no cases of largeTypesError
        const response = await this.sendGetAllRequest(type)

        log.debug(`Finished getting all records of ${type}`)
        return { records: response }
      }),
    )

    return {
      records: responses.flatMap(res => res.records ?? []),
      largeTypesError: responses.flatMap(res => res.largeTypesError ?? []),
    }
  }

  public async getCustomRecords(customRecordTypes: string[]): Promise<CustomRecordResponse> {
    const responses = await Promise.all(
      customRecordTypes.map(async type => ({ type, ...(await this.searchCustomRecords(type)) })),
    )
    const [errorResults, customRecords] = _.partition(responses, res => res.excludedFromSearch)
    return {
      customRecords,
      largeTypesError: errorResults.map(res => res.type),
    }
  }

  private static convertToSoapTypeName(type: ObjectType, isRecordRef: boolean): string {
    if (isRecordRef) {
      return RECORD_REF
    }
    if (isCustomRecordType(type)) {
      return SOAP_CUSTOM_RECORD_TYPE_NAME
    }
    return type.elemID.name[0].toUpperCase() + type.elemID.name.slice(1)
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
        ...(values.attributes ?? {}),
        [`xmlns:${namespaceAlias}`]: await this.getTypeNamespace(typeName),
        ...(isTopLevel ? { [XSI_TYPE]: `${namespaceAlias}:${typeName}` } : {}),
      },
      ...Object.fromEntries(
        await awu(Object.entries(values))
          .filter(([key]) => key !== ATTRIBUTES)
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
                  Boolean(type.fields[key]?.annotations.isReference),
                ),
              ]
            }

            if (isListType(fieldType)) {
              const innerType = await fieldType.getInnerType()
              if (isObjectType(innerType)) {
                return [
                  updateKey,
                  await awu(makeArray(value))
                    .map(async val => this.convertToSoapRecord(val, innerType, false))
                    .toArray(),
                ]
              }
            }

            return [updateKey, value]
          })
          .toArray(),
      ),
    }
  }

  @retryOnBadResponse
  private async runDeployAction(
    body: AddAndUpdateDeployBody | DeleteDeployBody,
    action: 'updateList' | 'addList' | 'deleteList',
  ): Promise<WriteResponse[]> {
    const response = await this.sendSoapRequest(action, body)
    if (!this.ajv.validate<DeployListResults>(DEPLOY_LIST_SCHEMA, response)) {
      log.error(
        `Got invalid response from ${action} request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
      throw new Error(
        `VALIDATION_ERROR - Got invalid response from ${action} request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
    }

    if (!isDeployListSuccess(response)) {
      const { code, message } = response.writeResponseList.status.statusDetail[0]
      log.error(`Failed to ${action}: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to ${action}: error code: ${code}, error message: ${message}`)
    }

    return response.writeResponseList.writeResponse
  }

  private async getAddAndUpdateDeployBody(instances: InstanceElement[]): Promise<AddAndUpdateDeployBody> {
    return {
      attributes: {
        'xmlns:platformCore': this.SOAP_CORE_URN,
      },
      record: await awu(instances)
        .map(async instance => this.convertToSoapRecord(instance.value, await instance.getType()))
        .toArray(),
    }
  }

  private static parseWriteResponseList(
    writeResponseList: WriteResponse[],
    instanceIds: string[],
    action: 'updateList' | 'addList' | 'deleteList',
  ): SoapDeployResult[] {
    return writeResponseList.map((writeResponse, index) => {
      if (!isWriteResponseSuccess(writeResponse)) {
        const { code, message } = writeResponse.status.statusDetail[0]
        log.error(
          `SOAP api call ${action} for instance ${instanceIds[index]} failed. error code: ${code}, error message: ${message}`,
        )
        return { isSuccess: false, errorMessage: message }
      }
      return { isSuccess: true, internalId: writeResponse.baseRef.attributes.internalId }
    })
  }

  private async redeployLockedFieldsWithRetry(
    retriesLeft: number,
    instancesToDeploy: InstanceElement[],
    fullNameToWriteResponse: Map<string, WriteResponse>,
    action: 'updateList' | 'addList',
    hasElemID: HasElemIDFunc,
  ): Promise<void> {
    if (retriesLeft === 0) {
      log.warn('Redeployment on locked fields exceed max retries.')
      return
    }

    const writeResponseList = await this.runDeployAction(
      await this.getAddAndUpdateDeployBody(instancesToDeploy),
      action,
    )
    instancesToDeploy.forEach(({ elemID }, index) =>
      fullNameToWriteResponse.set(elemID.getFullName(), writeResponseList[index]),
    )

    const modifiedInstances = await awu(instancesToDeploy)
      .filter((instance, index) => removeUneditableLockedField(instance, writeResponseList[index], hasElemID))
      .toArray()

    if (modifiedInstances.length > 0) {
      log.debug(
        "Deployment failed on 'INSUFFICIENT PERMISSION' error for uneditable locked fields." +
          ' Redeploying changes without the locked fields.',
        'Retries left: %d',
        retriesLeft - 1,
      )

      await this.redeployLockedFieldsWithRetry(
        retriesLeft - 1,
        modifiedInstances,
        fullNameToWriteResponse,
        action,
        hasElemID,
      )
    }
  }

  private async runFullDeploy(
    instances: InstanceElement[],
    action: 'updateList' | 'addList',
    hasElemID: HasElemIDFunc,
  ): Promise<SoapDeployResult[]> {
    const fullNameToWriteResponse = new Map<string, WriteResponse>()

    await this.redeployLockedFieldsWithRetry(
      LOCKED_FIELDS_MAX_DEPLOYS,
      instances,
      fullNameToWriteResponse,
      action,
      hasElemID,
    )

    return SoapClient.parseWriteResponseList(
      instances.map(({ elemID }) => fullNameToWriteResponse.get(elemID.getFullName())) as WriteResponse[],
      instances.map(instance => instance.elemID.getFullName()),
      action,
    )
  }

  public async updateInstances(instances: InstanceElement[], hasElemID: HasElemIDFunc): Promise<SoapDeployResult[]> {
    return this.runFullDeploy(instances, 'updateList', hasElemID)
  }

  public async addInstances(instances: InstanceElement[], hasElemID: HasElemIDFunc): Promise<SoapDeployResult[]> {
    return this.runFullDeploy(instances, 'addList', hasElemID)
  }

  public async deleteInstances(instances: InstanceElement[]): Promise<SoapDeployResult[]> {
    const body = {
      baseRef: await awu(instances)
        .map(async instance => {
          const isCustomRecord = isCustomRecordType(await instance.getType())
          return this.convertToDeletionRecord({
            id: instance.value.attributes.internalId,
            type: isCustomRecord
              ? instance.value.recType.attributes.internalId
              : instance.elemID.typeName[0].toLowerCase() + instance.elemID.typeName.slice(1),
            isCustomRecord,
          })
        })
        .toArray(),
    }
    return SoapClient.parseWriteResponseList(
      await this.runDeployAction(body, 'deleteList'),
      instances.map(instance => instance.elemID.getFullName()),
      'deleteList',
    )
  }

  public async deleteSdfInstances(instances: InstanceElement[]): Promise<SoapDeployResult[]> {
    // getting the hardcoded sdf types in SOAP format
    const { typeToInternalId } = getTypesToInternalId([])
    const body = {
      baseRef: await awu(instances)
        .map(async instance => {
          const instanceTypeFromMap = Object.keys(typeToInternalId).find(
            key => key.toLowerCase() === instance.elemID.typeName.toLowerCase(),
          )
          return this.convertToDeletionRecord({
            id: instance.value.internalId,
            type: instanceTypeFromMap ?? instance.elemID.typeName,
            isCustomRecord: false,
          })
        })
        .toArray(),
    }
    return SoapClient.parseWriteResponseList(
      await this.runDeployAction(body, 'deleteList'),
      instances.map(instance => instance.elemID.getFullName()),
      'deleteList',
    )
  }

  private async getAllSearchPages(initialSearchResponse: SearchResponse, type: string): Promise<SearchPageResponse> {
    const { totalPages, searchId } = initialSearchResponse.searchResult
    if (this.instanceLimiter(type, totalPages * SEARCH_PAGE_SIZE)) {
      log.info(`Excluding type ${type} as it has about ${totalPages * SEARCH_PAGE_SIZE} elements.`)
      return { records: [], excludedFromSearch: true }
    }
    if (totalPages <= 1) {
      return { records: recordFromSearchResponse(initialSearchResponse), excludedFromSearch: false }
    }
    const responses = await Promise.all(
      _.range(2, totalPages + 1).map(async i => {
        const res = await this.sendSearchWithIdRequest({ searchId, pageIndex: i }, type)
        log.debug(`Finished sending search request for page ${i}/${totalPages} of type ${type}`)
        return res
      }),
    )
    return {
      records: [initialSearchResponse].concat(responses).flatMap(recordFromSearchResponse),
      excludedFromSearch: false,
    }
  }

  private async search(type: string, namespace: string, subtypes?: string[]): Promise<SearchPageResponse> {
    return this.getAllSearchPages(await this.sendSearchRequest(type, namespace, subtypes), type)
  }

  private async searchCustomRecords(customRecordType: string): Promise<SearchPageResponse> {
    return this.getAllSearchPages(await this.sendCustomRecordsSearchRequest(customRecordType), customRecordType)
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

    if (!this.ajv.validate<GetAllResponse>(GET_ALL_RESPONSE_SCHEMA, response)) {
      log.error(
        `Got invalid response from get all request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
      throw new Error(
        `VALIDATION_ERROR - Got invalid response from get all request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
    }

    if (isGetAllErrorResponse(response)) {
      const { code, message } = response.getAllResult.status.statusDetail[0]
      log.error('Failed to run getAll request: %o', response)
      throw new Error(`Failed to run getAll request: error code: ${code}, error message: ${message}`)
    }

    return response.getAllResult.recordList.record
  }

  private assertSearchResponse(value: unknown): asserts value is SearchResponse | SearchErrorResponse {
    if (!this.ajv.validate(SEARCH_RESPONSE_SCHEMA, value)) {
      log.error(
        `Got invalid response from search request with SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(value, undefined, 2)}`,
      )
      throw new Error(
        `VALIDATION_ERROR - Got invalid response from search request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(value, undefined, 2)}`,
      )
    }
  }

  private static toSearchResponse(response: SearchResponse | SearchErrorResponse): SearchResponse {
    if ('totalPages' in response.searchResult) {
      return { searchResult: response.searchResult }
    }
    return { searchResult: { totalPages: 0, searchId: '', recordList: null } }
  }

  @retryOnBadResponse
  private async sendSearchRequest(type: string, namespace: string, subtypes?: string[]): Promise<SearchResponse> {
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
            'xmlns:platformCommon': this.SOAP_COMMON_URN,
            'xmlns:platformCore': this.SOAP_CORE_URN,
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
  private async sendCustomRecordsSearchRequest(customRecordType: string): Promise<SearchResponse> {
    const body = {
      searchRecord: {
        attributes: {
          [XSI_TYPE]: 'ns7:CustomRecordSearchBasic',
          'xmlns:ns7': this.SOAP_COMMON_URN,
        },
        'ns7:recType': {
          attributes: {
            scriptId: customRecordType,
            type: 'customRecordType',
            [XSI_TYPE]: 'ns8:CustomizationRef',
            'xmlns:ns8': this.SOAP_CORE_URN,
          },
        },
      },
    }
    const response = await this.sendSoapRequest('search', body)
    this.assertSearchResponse(response)
    return SoapClient.toSearchResponse(response)
  }

  @retryOnBadResponse
  private async sendGetSelectValueRequest(
    type: string,
    field: string,
    filterBy: { field: string; internalId: string }[],
    pageIndex: number,
  ): Promise<GetSelectValueResponse> {
    // https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N3504236.html#getSelectValue
    const body = {
      pageIndex,
      fieldDescription: {
        recordType: {
          attributes: { xmlns: this.SOAP_CORE_URN },
          $value: type,
        },
        field: {
          attributes: { xmlns: this.SOAP_CORE_URN },
          $value: field,
        },
        filterByValueList:
          filterBy.length > 0
            ? {
                attributes: { xmlns: this.SOAP_CORE_URN },
                filterBy: filterBy.map(row => ({
                  field: row.field,
                  internalId: row.internalId,
                })),
              }
            : undefined,
      },
    }
    const response = await this.sendSoapRequest('getSelectValue', body)
    if (!this.ajv.validate<GetSelectValueResponse>(GET_SELECT_VALUE_SCHEMA, response)) {
      log.error(
        `Got invalid response from getSelectValue request with SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
      throw new Error(
        `VALIDATION_ERROR - Got invalid response from getSelectValue request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`,
      )
    }
    return response
  }

  public async getSelectValue(
    type: string,
    field: string,
    filterBy: { field: string; internalId: string }[],
  ): Promise<Record<string, string[]>> {
    const firstResponse = await this.sendGetSelectValueRequest(type, field, filterBy, 1)
    if (!isGetSelectValueSuccessResponse(firstResponse)) {
      return {}
    }
    const restOfResponses = await Promise.all(
      _.range(2, firstResponse.getSelectValueResult.totalPages + 1, 1).map(pageIndex =>
        this.sendGetSelectValueRequest(type, field, filterBy, pageIndex),
      ),
    ).then(results => results.filter(isGetSelectValueSuccessResponse))
    const responses = [firstResponse].concat(restOfResponses)

    const result = _(responses)
      .flatMap(res => res.getSelectValueResult.baseRefList?.baseRef ?? [])
      .groupBy(row => row.name)
      .mapValues(rows => rows.map(item => item.attributes.internalId))
      .value()

    return result
  }

  @retryOnBadResponse
  private async sendSearchWithIdRequest(
    args: { searchId: string; pageIndex: number },
    type: string,
  ): Promise<SearchResponse> {
    const response = await this.sendSoapRequest('searchMoreWithId', args)
    this.assertSearchResponse(response)
    if (isSearchErrorResponse(response)) {
      const { code, message } = response.searchResult.status.statusDetail[0]
      log.error('Failed to run search request of type %s: %o', type, response)
      throw new Error(`Failed to run search request of type ${type}: error code: ${code}, error message: ${message}`)
    }
    return response
  }

  private async getTypeNamespace(type: string): Promise<string | undefined> {
    const wsdl = await this.getNetsuiteWsdl()
    return Object.entries(wsdl.definitions.schemas).find(
      ([_namespace, schema]) => schema.complexTypes[strings.capitalizeFirstLetter(type)] !== undefined,
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
