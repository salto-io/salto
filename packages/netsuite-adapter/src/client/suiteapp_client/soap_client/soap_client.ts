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
import axios from 'axios'
import crypto from 'crypto'
import xmlConvert from 'xml-js'
import { collections } from '@salto-io/lowerdash'
import path from 'path'
import { SuiteAppCredentials } from '../../credentials'
import { CONSUMER_KEY, CONSUMER_SECRET } from '../constants'
import { ReadFileError } from '../errors'
import { CallsLimiter, ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails, FileDetails, FolderDetails } from '../types'
import { AddListResults, GetResult, isAddListSuccess, isGetSuccess, isUpdateListSuccess, isWriteResponseSuccess, UpdateListResults } from './types'
import { ADD_LIST_SCHEMA, GET_RESULTS_SCHEMA, UPDATE_LIST_SCHEMA } from './schemas'

const log = logger(module)

export default class SoapClient {
  private credentials: SuiteAppCredentials
  private callsLimiter: CallsLimiter
  private soapUrl: URL
  private ajv: Ajv

  constructor(credentials: SuiteAppCredentials, callsLimiter: CallsLimiter) {
    this.credentials = credentials
    this.callsLimiter = callsLimiter
    this.soapUrl = new URL(`https://${credentials.accountId.replace('_', '-')}.suitetalk.api.netsuite.com/services/NetSuitePort_2020_2`)
    this.ajv = new Ajv({ allErrors: true, strict: false })
  }

  public async readFile(id: number): Promise<Buffer> {
    const body = {
      _attributes: {
        'xmlns:platformCore': 'urn:core_2020_2.platform.webservices.netsuite.com',
      },
      baseRef: {
        _attributes: {
          internalId: id,
          type: 'file',
          'xsi:type': 'platformCore:RecordRef',
        },
        'platformCore:name': {},
      },
    }
    const response = await this.sendSoapRequest('get', body)

    if (!this.ajv.validate<GetResult>(
      GET_RESULTS_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from get request with id ${id} in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from get request with id ${id} in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    if (!isGetSuccess(response)) {
      const result = response['soapenv:Envelope']['soapenv:Body'].getResponse['platformMsgs:readResponse']
      // eslint-disable-next-line no-underscore-dangle
      const code = result['platformCore:status']['platformCore:statusDetail']['platformCore:code']._text
      // eslint-disable-next-line no-underscore-dangle
      const message = result['platformCore:status']['platformCore:statusDetail']['platformCore:message']._text

      log.error(`Failed to read file with id ${id}: error code: ${code}, error message: ${message}`)
      throw new ReadFileError(`Failed to read file with id ${id}: error code: ${code}, error message: ${message}`)
    }

    // eslint-disable-next-line no-underscore-dangle
    const b64content = response['soapenv:Envelope']['soapenv:Body'].getResponse['platformMsgs:readResponse']['platformMsgs:record']['docFileCab:content']._text
    return b64content !== undefined ? Buffer.from(b64content, 'base64') : Buffer.from('')
  }

  private static convertToFileRecord(file: FileDetails): object {
    const internalIdEntry = file.id !== undefined ? { internalId: file.id.toString() } : {}
    return {
      _attributes: {
        'xsi:type': 'q1:File',
        'xmlns:q1': 'urn:filecabinet_2020_2.documents.webservices.netsuite.com',
        ...internalIdEntry,
      },
      'q1:name': {
        _text: path.basename(file.path),
      },
      'q1:attachFrom': {
        _text: '_computer',
      },
      'q1:content': {
        _text: file.content.toString('base64'),
      },
      'q1:folder': {
        _attributes: {
          internalId: file.folder.toString(),
        },
      },
      'q1:description': {
        _text: file.description,
      },
      'q1:bundleable': {
        _text: file.bundleable,
      },
      'q1:isInactive': {
        _text: file.isInactive,
      },
      'q1:isOnline': {
        _text: file.isOnline,
      },
      'q1:hideInBundle': {
        _text: file.hideInBundle,
      },
    }
  }

  private static convertToFolderRecord(folder: FolderDetails): object {
    const parentEntry = folder.parent !== undefined
      ? {
        'q1:parent': {
          _attributes: {
            internalId: folder.parent.toString(),
          },
        },
      }
      : {}

    const internalIdEntry = folder.id !== undefined ? { internalId: folder.id.toString() } : {}

    return {
      _attributes: {
        'xsi:type': 'q1:Folder',
        'xmlns:q1': 'urn:filecabinet_2020_2.documents.webservices.netsuite.com',
        ...internalIdEntry,
      },
      'q1:name': {
        _text: path.basename(folder.path),
      },
      'q1:description': {
        _text: folder.description,
      },
      'q1:bundleable': {
        _text: folder.bundleable,
      },
      'q1:isInactive': {
        _text: folder.isInactive,
      },
      'q1:isOnline': {
        _text: folder.isOnline,
      },
      'q1:hideInBundle': {
        _text: folder.hideInBundle,
      },
      ...parentEntry,
    }
  }

  private static convertToFileCabinetRecord(fileCabinetInstance: FileCabinetInstanceDetails):
    object {
    return fileCabinetInstance.type === 'file'
      ? SoapClient.convertToFileRecord(fileCabinetInstance)
      : SoapClient.convertToFolderRecord(fileCabinetInstance)
  }

  public async addFileCabinetInstances(fileCabinetInstances:
    (FileCabinetInstanceDetails)[]): Promise<(number | Error)[]> {
    const body = {
      _attributes: {
        xmlns: 'urn:messages_2020_2.platform.webservices.netsuite.com',
      },
      record: fileCabinetInstances.map(SoapClient.convertToFileCabinetRecord),
    }

    const response = await this.sendSoapRequest('addList', body)
    if (!this.ajv.validate<AddListResults>(
      ADD_LIST_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from addList request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from addList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    if (!isAddListSuccess(response)) {
      const details = response['soapenv:Envelope']['soapenv:Body'].addListResponse.writeResponseList['platformCore:status']['platformCore:statusDetail']
      // eslint-disable-next-line no-underscore-dangle
      const code = details['platformCore:code']._text
      // eslint-disable-next-line no-underscore-dangle
      const message = details['platformCore:message']._text

      log.error(`Failed to addList: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to addList: error code: ${code}, error message: ${message}`)
    }

    return collections.array.makeArray(response['soapenv:Envelope']['soapenv:Body'].addListResponse.writeResponseList.writeResponse).map((writeResponse, index) => {
      if (!isWriteResponseSuccess(writeResponse)) {
        const details = writeResponse['platformCore:status']['platformCore:statusDetail']
        // eslint-disable-next-line no-underscore-dangle
        const code = details['platformCore:code']._text
        // eslint-disable-next-line no-underscore-dangle
        const message = details['platformCore:message']._text

        log.error(`SOAP api call to add file cabinet instance ${fileCabinetInstances[index].path} failed. error code: ${code}, error message: ${message}`)
        return new Error(`SOAP api call to add file cabinet instance ${fileCabinetInstances[index].path} failed. error code: ${code}, error message: ${message}`)
      }
      // eslint-disable-next-line no-underscore-dangle
      return parseInt(writeResponse.baseRef._attributes.internalId, 10)
    })
  }

  public async updateFileCabinet(fileCabinetInstances:
    ExistingFileCabinetInstanceDetails[]): Promise<(number | Error)[]> {
    const body = {
      _attributes: {
        xmlns: 'urn:messages_2020_2.platform.webservices.netsuite.com',
      },
      record: fileCabinetInstances.map(SoapClient.convertToFileCabinetRecord),
    }

    const response = await this.sendSoapRequest('updateList', body)
    if (!this.ajv.validate<UpdateListResults>(
      UPDATE_LIST_SCHEMA,
      response
    )) {
      log.error(`Got invalid response from updateList request with in SOAP api. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
      throw new Error(`Got invalid response from updateList request. Errors: ${this.ajv.errorsText()}. Response: ${JSON.stringify(response, undefined, 2)}`)
    }

    if (!isUpdateListSuccess(response)) {
      const details = response['soapenv:Envelope']['soapenv:Body'].updateListResponse.writeResponseList['platformCore:status']['platformCore:statusDetail']
      // eslint-disable-next-line no-underscore-dangle
      const code = details['platformCore:code']._text
      // eslint-disable-next-line no-underscore-dangle
      const message = details['platformCore:message']._text

      log.error(`Failed to updateList: error code: ${code}, error message: ${message}`)
      throw new Error(`Failed to updateList: error code: ${code}, error message: ${message}`)
    }

    return collections.array.makeArray(response['soapenv:Envelope']['soapenv:Body'].updateListResponse.writeResponseList.writeResponse).map((writeResponse, index) => {
      if (!isWriteResponseSuccess(writeResponse)) {
        const details = writeResponse['platformCore:status']['platformCore:statusDetail']
        // eslint-disable-next-line no-underscore-dangle
        const code = details['platformCore:code']._text
        // eslint-disable-next-line no-underscore-dangle
        const message = details['platformCore:message']._text

        log.error(`SOAP api call to update file cabinet instance ${fileCabinetInstances[index].path} failed. error code: ${code}, error message: ${message}`)
        return Error(`SOAP api call to update file cabinet instance ${fileCabinetInstances[index].path} failed. error code: ${code}, error message: ${message}`)
      }
      // eslint-disable-next-line no-underscore-dangle
      return parseInt(writeResponse.baseRef._attributes.internalId, 10)
    })
  }

  private async sendSoapRequest(operation: string, body: object): Promise<unknown> {
    const headers = {
      'Content-Type': 'text/xml',
      SOAPAction: operation,
    }
    const response = await this.callsLimiter(() => axios.post(
      this.soapUrl.href,
      this.generateSoapPayload({ [operation]: body }),
      { headers },
    ))

    return xmlConvert.xml2js(response.data, { compact: true })
  }

  private generateSoapPayload(body: object): string {
    return xmlConvert.js2xml({
      'soap:Envelope': {
        _attributes: {
          'xmlns:soap': 'http://www.w3.org/2003/05/soap-envelope',
          'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        },
        'soap:Header': this.generateSoapHeader(),
        'soap:Body': body,
      },
    }, { compact: true })
  }

  private generateSoapHeader(): object {
    const timestamp = new Date().getTime().toString().substring(0, 10)
    const nonce = crypto.randomBytes(10).toString('base64')
    const baseString = `${this.credentials.accountId}&${CONSUMER_KEY}&${this.credentials.suiteAppTokenId}&${nonce}&${timestamp}`
    const key = `${CONSUMER_SECRET}&${this.credentials.suiteAppTokenSecret}`
    const signature = crypto.createHmac('sha256', key).update(baseString).digest('base64')

    return {
      tokenPassport: {
        account: {
          _text: this.credentials.accountId,
        },
        consumerKey: {
          _text: CONSUMER_KEY,
        },
        token: {
          _text: this.credentials.suiteAppTokenId,
        },
        nonce: {
          _text: nonce,
        },
        timestamp: {
          _text: timestamp,
        },
        signature: {
          _attributes: {
            algorithm: 'HMAC-SHA256',
          },
          _text: signature,
        },
      },
      preferences: {
        runServerSuiteScriptAndTriggerWorkflows: {
          _text: 'false',
        },
      },
    }
  }
}
