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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Element,
  ElemID, InstanceElement, isInstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { AUDIT_TIME_TYPE_NAME, ZENDESK } from '../constants'
import ZendeskClient from '../client/client'

const log = logger(module)


const AUDIT_TIME_TYPE_ID = new ElemID(ZENDESK, AUDIT_TIME_TYPE_NAME)
const AUDIT_TIME_INSTANCE_ID = new ElemID(ZENDESK, AUDIT_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)

type ValidAuditRes = {
  // eslint-disable-next-line camelcase
  audit_logs: {
    // eslint-disable-next-line camelcase
    created_at: string
  }
}

const AUDIT_SCHEMA = Joi.object({
  audit_logs: Joi.object({
    created_at: Joi.string().required(),
  }).unknown(true).required(),
}).unknown(true).required()

const isValidAuditRes = createSchemeGuard<ValidAuditRes>(
  AUDIT_SCHEMA, 'Received an invalid value for audit_logs response'
)

const getLastAuditTime = async (client: ZendeskClient): Promise<string | undefined> => {
  try {
    const res = (await client.getSinglePage({
      url: '/api/v2/audit_logs',
      queryParams: {
        'page[size]': '1',
        sort: '-created_at',
      },
    })).data
    if (isValidAuditRes(res)) {
      return res.audit_logs.created_at
    }
  } catch (e) {
    log.error(`could not get the last audit_log'. error: ${e}`)
  }
  return undefined
}

const createTimeElements = async (client: ZendeskClient): Promise<Element[]> => {
  const auditTimeType = new ObjectType({
    elemID: AUDIT_TIME_TYPE_ID,
    isSettings: true,
    fields: {
      time: { refType: BuiltinTypes.STRING },
    },
    path: [ZENDESK, elementsUtils.TYPES_PATH, AUDIT_TIME_TYPE_NAME],
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
  })
  const lastAuditTime = await getLastAuditTime(client)
  const instance = new InstanceElement(
    ElemID.CONFIG_NAME,
    auditTimeType,
    {
      time: lastAuditTime,
    },
    undefined,
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )
  return [auditTimeType, instance]
}

const filterCreator: FilterCreator = ({ elementsSource, client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const newTimeElements = await createTimeElements(client)
    elements.push(...newTimeElements)
    // add update at for all the elements
    // find prev time instance
    // check for elements that are not in guide and have changed after the time in the element source
  },
})
export default filterCreator
