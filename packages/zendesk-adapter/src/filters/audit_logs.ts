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
import moment from 'moment-timezone'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { AUDIT_TIME_TYPE_NAME, TRANSLATIONS, ZENDESK } from '../constants'
import ZendeskClient from '../client/client'
import { getIdByEmail } from '../user_utils'
import { FETCH_CONFIG, GUIDE_GLOBAL_TYPES, GUIDE_TYPES_TO_HANDLE_BY_BRAND } from '../config'

const log = logger(module)
const { awu } = collections.asynciterable

const AUDIT_TIME_TYPE_ID = new ElemID(ZENDESK, AUDIT_TIME_TYPE_NAME)
const AUDIT_TIME_INSTANCE_ID = new ElemID(ZENDESK, AUDIT_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)

type ValidAuditRes = {
  // eslint-disable-next-line camelcase
  audit_logs: { created_at: string; actor_id: number }[]
}

const AUDIT_SCHEMA = Joi.object({
  audit_logs: Joi.array().items(Joi.object({
    created_at: Joi.string().required(),
    actor_id: Joi.number().required(),
  }).unknown(true).required()),
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
        // this is the log creation time and not when the source was created
        sort: '-created_at',
      },
    })).data
    if (isValidAuditRes(res)) {
      return res.audit_logs[0].created_at
    }
  } catch (e) {
    log.error(`could not get the last audit_log, getSinglePage returned an error'. error: ${e}`)
  }
  log.error('could not get the last audit_log, the result of getSinglePage was not valid.')
  return undefined
}

const createTimeElements = async (lastAuditTime: string): Promise<Element[]> => {
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

const getUpdatedByID = async (instance: InstanceElement, client: ZendeskClient): Promise<number | undefined> => {
  const { id } = instance.value
  if (id === undefined) {
    log.error(`the instance ${instance.elemID.getFullName()}, does not have an id`)
    return undefined
  }
  try {
    const res = (await client.getSinglePage({
      url: '/api/v2/audit_logs',
      queryParams: {
        'page[size]': '1',
        // this is the log creation time and not when the source was created
        sort: '-created_at',
        'filter[source_id]': id,
      },
    })).data
    if (isValidAuditRes(res)) {
      return res.audit_logs[0].actor_id
    }
  } catch (e) {
    log.error(`could not get the audit_log for ${id}, getSinglePage returned an error'. error: ${e}`)
  }
  log.error(`could not get the audit_log for ${id}, the result of getSinglePage was not valid.`)
  return undefined
}

// this filter adds changed_at and changed_by annotations
const filterCreator: FilterCreator = ({ elementsSource, client, paginator, config }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    // add update at for all the elements
    const instances = elements.filter(isInstanceElement)
    instances.forEach(elem => { elem.annotations[CORE_ANNOTATIONS.CHANGED_AT] = elem.value.updated_at })
    if (config[FETCH_CONFIG].enableAudit === false) {
      return
    }
    // zendesk returns the time in UTC form so there is no need to convert by time zone
    const newLastAuditTime = await getLastAuditTime(client)
    if (newLastAuditTime === undefined) {
      // error logged earlier
      return
    }
    const newTimeElements = await createTimeElements(newLastAuditTime)
    elements.push(...newTimeElements)
    // if this is a second fetch the elementSource should have the time instance already
    const auditTimeInstance = await elementsSource.get(AUDIT_TIME_INSTANCE_ID)
    if (auditTimeInstance === undefined) {
      log.debug('could not find audit time instance in elementSource')
      return
    }
    const newLastAuditTimeMoment = moment.utc(newLastAuditTime)
    const prevLastAuditTimeMoment = moment.utc(auditTimeInstance.value.time)
    const updatedInstances = instances
      // guide elements do not appear in the audit logs
      .filter(inst =>
        ![...GUIDE_TYPES_TO_HANDLE_BY_BRAND, ...Object.keys(GUIDE_GLOBAL_TYPES)].includes(inst.elemID.typeName))
      .filter(inst => {
        const instTime = moment.utc(inst.annotations[CORE_ANNOTATIONS.CHANGED_AT])
        const isAfter = instTime.isAfter(prevLastAuditTimeMoment)
        const isBefore = instTime.isSameOrBefore(newLastAuditTimeMoment)
        if (!isBefore) {
          // I think this can happen for changes in tickets for example
          log.error('There is a change that happened after the last audit time received ')
        }
        return isAfter && isBefore
      })
    if (_.isEmpty(updatedInstances)) {
      return
    }
    const idToEmail = await getIdByEmail(paginator)
    // updated_by for translations
    instances
      .filter(elem => TRANSLATIONS.includes(elem.elemID.typeName))
      .forEach(elem => { elem.annotations[CORE_ANNOTATIONS.CHANGED_BY] = idToEmail[elem.value.updated_by_id] })
    // updated_by for everything else
    await awu(updatedInstances).forEach(async inst => {
      const id = await getUpdatedByID(inst, client)
      if (id === undefined) {
        // error was logged earlier
        return
      }
      inst.annotations[CORE_ANNOTATIONS.CHANGED_BY] = idToEmail[id]
    })
  },
})
export default filterCreator
