/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ActionName } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { values, promises } from '@salto-io/lowerdash'
import _ from 'lodash'
import xmljs from 'xml-js'
import { UserConfig } from '../../config'
import { AdditionalAction, ClientOptions } from '../types'

const { timeout } = promises
const DEFAULT_POST_DEPLOY_DELAY = 50 * 1000 // 50 seconds in ms

// we use a delay to handle the delay of the service to be updated after addition and deletion
// https://community.jamf.com/t5/jamf-pro/delay-time-after-post-or-delete-api-calls/m-p/323383/emcs_t/S2h8ZW1haWx8dG9waWNfc3Vic2NyaXB0aW9ufE0wM1dLNk4xNU4yMlBFfDMyMzM4M3xTVUJTQ1JJUFRJT05TfGhL#M278490
const postDeployDelay = (delay = DEFAULT_POST_DEPLOY_DELAY): Promise<void> => timeout.sleep(delay)

/*
 * Util function to create deploy definitions for classic Jamf api given a type.
 * Classic Jamf api uses XML for requests and responses, this definition handle it correctly.
 */
export const createClassicApiDefinitionsForType = (
  userConfig: UserConfig,
  typeName: string,
  plural: string,
  adjustFunctions?: Partial<
    Record<AdditionalAction | ActionName, definitions.AdjustFunction<definitions.deploy.ChangeAndExtendedContext>>
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
                await postDeployDelay(userConfig.deploy?.delayAfterDeploy)
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
          copyFromResponse: {
            additional: {
              adjust: async () => {
                // We do not really copy from response
                // This is a hack to run postDeployDelay function after the API call
                await postDeployDelay(userConfig.deploy?.delayAfterDeploy)
                return { value: {} }
              },
            },
          },
        },
      ],
    },
  },
})
