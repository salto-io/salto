/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { ActionName } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
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
  adjustFunctions?: Partial<
    Record<AdditionalAction | ActionName, definitions.AdjustFunction<definitions.deploy.ChangeAndContext>>
  >,
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
                return { value: { id: Number(id) } }
              },
            },
          },
          request: {
            endpoint: {
              // In classic api id is mandatory on addition as well, we should provide -1 to let the service generate a new id
              path: `/JSSResource/${plural}/id/-1` as definitions.EndpointPath,
              method: 'post',
              headers: {
                'Content-Type': 'application/xml',
              },
            },
            transformation: {
              adjust: async item => {
                await adjustFunctions?.add?.(item)
                const { value } = item
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
              path: `/JSSResource/${plural}/id/{id}` as definitions.EndpointPath,
              method: 'put',
              headers: {
                'Content-Type': 'application/xml',
              },
            },
            transformation: {
              adjust: async item => {
                await adjustFunctions?.modify?.(item)
                const { value } = item
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
              path: `/JSSResource/${plural}/id/{id}` as definitions.EndpointPath,
              method: 'delete',
            },
            transformation: {
              adjust: async item => {
                await adjustFunctions?.remove?.(item)
                return item
              },
            },
          },
        },
      ],
    },
  },
})
