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
import { SuiteAppCredentials } from '../../credentials'
import { CONSUMER_KEY, CONSUMER_SECRET } from '../constants'
import { ReadFileError } from '../errors'
import { CallsLimiter } from '../types'
import { GetResult, GET_RESULTS_SCHEMA, isGetSuccess } from './types'

const log = logger(module)

export default class SoapClient {
  private credentials: SuiteAppCredentials
  private callsLimiter: CallsLimiter
  private soapUrl: URL
  private ajv: Ajv

  constructor(credentials: SuiteAppCredentials, callsLimiter: CallsLimiter) {
    this.credentials = credentials
    this.callsLimiter = callsLimiter
    this.soapUrl = new URL(`https://${credentials.accountId.replace('_', '-')}.suitetalk.api.netsuite.com/services/NetSuitePort_2017_1`)
    this.ajv = new Ajv({ allErrors: true, strict: false })
  }

  public async readFile(id: number): Promise<Buffer> {
    const body = {
      get: {
        _attributes: {
          'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          'xmlns:platformCore': 'urn:core_2017_1.platform.webservices.netsuite.com',
        },
        baseRef: {
          _attributes: {
            internalId: id,
            type: 'file',
            'xsi:type': 'platformCore:RecordRef',
          },
          'platformCore:name': {},
        },
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

  private async sendSoapRequest(operation: string, body: object): Promise<unknown> {
    const headers = {
      'Content-Type': 'text/xml',
      SOAPAction: operation,
    }
    const response = await this.callsLimiter(() => axios.post(
      this.soapUrl.href,
      this.generateSoapPayload(body),
      { headers },
    ))

    return xmlConvert.xml2js(response.data, { compact: true })
  }

  private generateSoapPayload(body: object): string {
    return xmlConvert.js2xml({
      'soap-env:Envelope': {
        _attributes: {
          'xmlns:soap-env': 'http://schemas.xmlsoap.org/soap/envelope/',
        },
        'soap-env:Header': this.generateSoapHeader(),
        'soap-env:Body': body,
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
