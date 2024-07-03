/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { definitions } from '@salto-io/adapter-components'
import { EndpointPath } from '@salto-io/adapter-components/src/definitions'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import xmljs from 'xml-js'
import { AdditionalAction, ClientOptions } from '../types'

/*
 * Util function to create deploy definitions for classic Jamf api given a type.
 * Classic Jamf api uses XML for requests and responses, this definition handle it correctly.
 */
export const createClassicApiDefinitionsForType = (
  typeName: string,
  plural: string,
  shouldConvertIdToNumber?: boolean,
): Partial<definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>> => ({
  requestsByAction: {
    customizations: {
      add: [
        {
          copyFromResponse: {
            additional: {
              root: typeName,
              adjust: async ({ value }) => {
                if (!_.isString(value)) {
                  throw new Error('Expected value to be a string')
                }
                const parsedXML = xmljs.xml2js(value, { compact: true })
                const id = _.get(parsedXML, `${typeName}.id._text`)
                return { value: { id: shouldConvertIdToNumber ? Number(id) : id } }
              },
            },
          },
          request: {
            endpoint: {
              // In classic api id is mandatory on addition as well, we should provide -1 to let the service generate a new id
              path: `/JSSResource/${plural}/id/-1` as EndpointPath,
              method: 'post',
              headers: {
                'Content-Type': 'application/xml',
              },
            },
            transformation: {
              adjust: async ({ value }) => {
                if (!values.isPlainRecord(value)) {
                  throw new Error('Expected value to be a record')
                }
                const xmlVal = xmljs.js2xml({ [typeName]: { ...value } }, { compact: true })
                return { value: xmlVal }
              },
            },
          },
        },
      ],
      modify: [
        {
          request: {
            endpoint: {
              path: `/JSSResource/${plural}/id/{id}` as EndpointPath,
              method: 'put',
              headers: {
                'Content-Type': 'application/xml',
              },
            },
            transformation: {
              adjust: async ({ value }) => {
                if (!values.isPlainRecord(value)) {
                  throw new Error('Expected value to be a record')
                }
                const xmlVal = xmljs.js2xml({ [typeName]: { ...value } }, { compact: true })
                return { value: xmlVal }
              },
            },
          },
        },
      ],
      remove: [
        {
          request: {
            endpoint: {
              path: `/JSSResource/${plural}/id/{id}` as EndpointPath,
              method: 'delete',
            },
          },
        },
      ],
    },
  },
})
