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
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElementIDResolver, ElemID,
  InstanceElement, isInstanceElement, ObjectType, Element,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import * as constants from './constants'
import SalesforceClient from './client/client'

const log = logger(module)

// The random suffix is to avoid collisions with salesforce elements
export const INTERNAL_ACCOUNT_INFO = 'AccountInfo5a2ca8777a7743c3814ec83e3c4f0147'

export const getInstanceUrl = async (elementIDResolver: ElementIDResolver):
  Promise<URL | undefined> => {
  const internalAccountInfoElement = await elementIDResolver(new ElemID(constants.SALESFORCE, INTERNAL_ACCOUNT_INFO, 'instance', ElemID.CONFIG_NAME))

  if (internalAccountInfoElement === undefined || !isInstanceElement(internalAccountInfoElement)) {
    log.error('Could not find internalAccountInfo element')
    return undefined
  }
  const url = internalAccountInfoElement.value.instanceUrl
  if (url === undefined) {
    log.error('internalAccountInfo does not contain instanceUrl')
    return undefined
  }

  try {
    return new URL(url)
  } catch (e) {
    log.error('Failed to parse url: %o', e)
    return undefined
  }
}

export const createInternalAccountInfoElements = async (client: SalesforceClient):
  Promise<Element[]> => {
  const instanceUrl = await client.getUrl()

  if (_.isUndefined(instanceUrl)) {
    return []
  }

  const type = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, INTERNAL_ACCOUNT_INFO),
    isSettings: true,
    fields: {
      instanceUrl: { type: BuiltinTypes.STRING },
    },
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
    path: [constants.SALESFORCE, constants.TYPES_PATH, INTERNAL_ACCOUNT_INFO],
  })

  const instance = new InstanceElement(
    ElemID.CONFIG_NAME,
    type,
    { instanceUrl: instanceUrl.href },
    [constants.SALESFORCE, constants.RECORDS_PATH, constants.SETTINGS_PATH,
      INTERNAL_ACCOUNT_INFO],
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )

  return [type, instance]
}
