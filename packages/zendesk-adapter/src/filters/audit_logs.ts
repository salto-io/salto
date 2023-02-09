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
  ObjectType, ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard, getParent } from '@salto-io/adapter-utils'
import moment from 'moment-timezone'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { AUDIT_TIME_TYPE_NAME, TRANSLATIONS, ZENDESK } from '../constants'
import ZendeskClient from '../client/client'
import { getIdByName } from '../user_utils'
import { FETCH_CONFIG } from '../config'

const log = logger(module)
const { awu } = collections.asynciterable

export const AUDIT_TIME_TYPE_ID = new ElemID(ZENDESK, AUDIT_TIME_TYPE_NAME)
const AUDIT_TIME_INSTANCE_ID = new ElemID(ZENDESK, AUDIT_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)
const ELEMENTS_WITH_PARENTS = [
  'ticket_field__custom_field_options',
  'user_field__custom_field_options',
  'organization_field__custom_field_options',
  'business_hours_schedule_holiday',
  // brand_logo, macro_attachment? not sure should have the same changed_at as parent or at all
]

type ValidAuditRes = {
  // eslint-disable-next-line camelcase
  audit_logs: { created_at: string; actor_name: string }[]
}

const AUDIT_SCHEMA = Joi.object({
  audit_logs: Joi.array().items(Joi.object({
    created_at: Joi.string().required(),
    actor_name: Joi.string().required(),
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

const getUpdatedByName = async (instance: InstanceElement, client: ZendeskClient): Promise<string | undefined> => {
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
      return res.audit_logs[0].actor_name
    }
  } catch (e) {
    log.error(`could not get the audit_log for ${id}, getSinglePage returned an error'. error: ${e}`)
  }
  log.error(`could not get the audit_log for ${id}, the result of getSinglePage was not valid.`)
  return undefined
}

const addChangedAt = (instances: InstanceElement[]): void => {
  // add update at for all the elements
  instances.forEach(elem => {
    if (elem.value.updated_at !== undefined) {
      elem.annotations[CORE_ANNOTATIONS.CHANGED_AT] = elem.value.updated_at
    }
  })
  // update for elements with parent to be exactly like their parents
  instances
    .filter(inst => ELEMENTS_WITH_PARENTS.includes(inst.elemID.typeName))
    .forEach(child => {
      try {
        child.annotations[CORE_ANNOTATIONS.CHANGED_AT] = getParent(child).annotations[CORE_ANNOTATIONS.CHANGED_AT]
        // eslint-disable-next-line no-empty
      } catch (e) {}// in case the 'getParent' doesn't work
    })
}

const addPrevChangedBy = async (elementsSource: ReadOnlyElementsSource, instances: InstanceElement[])
  : Promise<void> => {
  const idByInstance = _.keyBy(instances, inst => inst.elemID.getFullName())
  const prevInstances = await (awu(await elementsSource.getAll()).filter(isInstanceElement).toArray())
  prevInstances.forEach(prevInst => {
    if (prevInst.annotations[CORE_ANNOTATIONS.CHANGED_BY] !== undefined) {
      const id = prevInst.elemID.getFullName()
      if (idByInstance[id] !== undefined) {
        idByInstance[id].annotations[CORE_ANNOTATIONS.CHANGED_BY] = prevInst.annotations[CORE_ANNOTATIONS.CHANGED_BY]
      }
    }
  })
}

/**
 * this filter adds changed_at and changed_by annotations
 */
const filterCreator: FilterCreator = ({ elementsSource, client, paginator, config }) => ({
  name: 'changeByAndChangedAt',
  onFetch: async (elements: Element[]): Promise<void> => {
    // add update at for all the elements
    const instances = elements.filter(isInstanceElement)
    addChangedAt(instances)

    // create time elements
    // zendesk returns the time in UTC form so there is no need to convert by time zone
    const newLastAuditTime = await getLastAuditTime(client)
    if (newLastAuditTime === undefined) {
      // error logged earlier
      return
    }
    const newTimeElements = await createTimeElements(newLastAuditTime)
    elements.push(...newTimeElements)

    if (config[FETCH_CONFIG].enableAudit === false) {
      return
    }
    if (elementsSource === undefined) {
      log.error('Failed to run changeByAndChangedAt filter because no element source was provided')
      return
    }
    await addPrevChangedBy(elementsSource, instances)
    // if this is a second fetch the elementSource should have the time instance already
    const auditTimeInstance = await elementsSource.get(AUDIT_TIME_INSTANCE_ID)
    if (auditTimeInstance === undefined) {
      log.debug('could not find audit time instance in elementSource')
      return
    }
    const newLastAuditTimeMoment = moment.utc(newLastAuditTime)
    const prevLastAuditTimeMoment = moment.utc(auditTimeInstance.value.time)
    const updatedInstances = instances
      .filter(inst => {
        const instTime = moment.utc(inst.annotations[CORE_ANNOTATIONS.CHANGED_AT])
        const isAfter = instTime.isAfter(prevLastAuditTimeMoment)
        const isBefore = instTime.isSameOrBefore(newLastAuditTimeMoment)
        if (!isBefore) {
          // can happen for changes in ticket_fields, routing_attribute(_value), and user_fields for example
          log.error('There is a change that happened after the last audit time received ')
        }
        return isAfter && isBefore
      })
    if (_.isEmpty(updatedInstances)) {
      return
    }
    const idToName = await getIdByName(paginator)
    // updated_by for translations which have updated_by_id field in the instance
    updatedInstances
      .filter(elem => TRANSLATIONS.includes(elem.elemID.typeName))
      .forEach(elem => {
        const name = idToName[elem.value.updated_by_id]
        if (name === undefined) {
          elem.annotations[CORE_ANNOTATIONS.CHANGED_BY] = 'deleted user'
          log.error(`could not find user with id ${elem.value.updated_by_id} `)
        }
        elem.annotations[CORE_ANNOTATIONS.CHANGED_BY] = idToName[elem.value.updated_by_id]
      })
    // updated_by for everything else (some types are not supported by zendesk - listed above)
    await awu(updatedInstances).forEach(async inst => {
      const name = await getUpdatedByName(inst, client)
      if (name === undefined) {
        // error was logged earlier
        return
      }
      inst.annotations[CORE_ANNOTATIONS.CHANGED_BY] = name
    })
  },
})
export default filterCreator
