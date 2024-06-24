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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard, getParent } from '@salto-io/adapter-utils'
import moment from 'moment-timezone'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import {
  APP_INSTALLATION_TYPE_NAME,
  APP_OWNED_TYPE_NAME,
  AUDIT_TIME_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  BRAND_TYPE_NAME,
  BUSINESS_HOUR_SCHEDULE,
  BUSINESS_HOUR_SCHEDULE_HOLIDAY,
  CUSTOM_OBJECT_TYPE_NAME,
  CUSTOM_ROLE_TYPE_NAME,
  CUSTOM_STATUS_TYPE_NAME,
  GROUP_TYPE_NAME,
  LOCALE_TYPE_NAME,
  MACRO_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  SLA_POLICY_TYPE_NAME,
  SUPPORT_ADDRESS_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  TRANSLATION_TYPE_NAMES,
  TRIGGER_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  VIEW_TYPE_NAME,
  ZENDESK,
} from '../constants'
import ZendeskClient from '../client/client'
import { getIdByName } from '../user_utils'
import { FETCH_CONFIG, GUIDE_GLOBAL_TYPES, GUIDE_TYPES_TO_HANDLE_BY_BRAND } from '../config'

const log = logger(module)
const { awu } = collections.asynciterable

export const AUDIT_TIME_TYPE_ID = new ElemID(ZENDESK, AUDIT_TIME_TYPE_NAME)
const TYPE_TO_SOURCE_TYPE: Record<string, string> = {
  [TICKET_FORM_TYPE_NAME]: 'ticket_form',
  [SLA_POLICY_TYPE_NAME]: 'sla/policy',
  [USER_FIELD_TYPE_NAME]: 'custom_field/field',
  [ORG_FIELD_TYPE_NAME]: 'custom_field/field',
  [TICKET_FIELD_TYPE_NAME]: 'ticket_field',
  [VIEW_TYPE_NAME]: 'view',
  [CUSTOM_STATUS_TYPE_NAME]: 'custom_status',
  [SUPPORT_ADDRESS_TYPE_NAME]: 'recipient_address',
  [BUSINESS_HOUR_SCHEDULE]: 'zendesk/business_hours/workweek',
  [BUSINESS_HOUR_SCHEDULE_HOLIDAY]: 'zendesk/business_hours/holiday',
  [MACRO_TYPE_NAME]: 'macro',
  [AUTOMATION_TYPE_NAME]: 'rule',
  [APP_INSTALLATION_TYPE_NAME]: 'zendesk/app_market/installation',
  [APP_OWNED_TYPE_NAME]: 'zendesk/app_market/app',
  [BRAND_TYPE_NAME]: 'brand',
  [CUSTOM_ROLE_TYPE_NAME]: 'permission_set',
  [GROUP_TYPE_NAME]: 'group',
  [LOCALE_TYPE_NAME]: 'account',
  [TRIGGER_TYPE_NAME]: 'trigger',
}
const AUDIT_TIME_INSTANCE_ID = AUDIT_TIME_TYPE_ID.createNestedID('instance', ElemID.CONFIG_NAME)
const ELEMENTS_WITH_PARENTS = [
  'ticket_field__custom_field_options',
  'user_field__custom_field_options',
  'organization_field__custom_field_options',
  'business_hours_schedule_holiday',
]
const GUIDE_ELEMENTS = new Set([...GUIDE_TYPES_TO_HANDLE_BY_BRAND, ...Object.keys(GUIDE_GLOBAL_TYPES)])
export const DELETED_USER = 'deleted user'

type ValidAuditRes = {
  // eslint-disable-next-line camelcase
  audit_logs: { created_at: string; actor_name: string }[]
}

type ValidAuditResWithCount = {
  count: number
}

const AUDIT_SCHEMA = Joi.object({
  audit_logs: Joi.array()
    .items(
      Joi.object({
        created_at: Joi.string().required(),
        actor_name: Joi.string().required().not(''),
      }).unknown(true),
    )
    .required(),
})
  .unknown(true)
  .required()

const isValidAuditRes = createSchemeGuard<ValidAuditRes>(
  AUDIT_SCHEMA,
  'Received an invalid value for audit_logs response',
)

const isValidAuditResWithCount = (res: unknown): res is ValidAuditResWithCount => _.isObject(res) && 'count' in res

const getLastAuditTime = async (client: ZendeskClient): Promise<string | undefined> => {
  try {
    const res = (
      await client.get({
        url: '/api/v2/audit_logs',
        queryParams: {
          'page[size]': '1',
          // this is the log creation time and not when the source was created
          sort: '-created_at',
        },
      })
    ).data
    if (isValidAuditRes(res)) {
      return res.audit_logs[0].created_at
    }
  } catch (e) {
    log.error(`could not get the last audit_log, get returned an error'. error: ${e}`)
  }
  log.error('could not get the last audit_log, the result of get was not valid.')
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

const getChangedByName = async ({
  instance,
  client,
  start,
  end,
}: {
  instance: InstanceElement
  client: ZendeskClient
  start: string
  end: string
}): Promise<string | undefined> => {
  const { id } = instance.value
  if (id === undefined) {
    log.error(`the instance ${instance.elemID.getFullName()} does not have an id`)
    return undefined
  }
  try {
    const sourceType = TYPE_TO_SOURCE_TYPE[instance.elemID.typeName]
    const queryParams: Record<string, string | string[]> =
      sourceType !== undefined
        ? {
            'page[size]': '1',
            // this is the log creation time and not when the source was created
            sort: '-created_at',
            'filter[source_id]': id,
            'filter[created_at]': [start, end],
            'filter[source_type]': sourceType,
          }
        : {
            'page[size]': '1',
            // this is the log creation time and not when the source was created
            sort: '-created_at',
            'filter[source_id]': id,
            'filter[created_at]': [start, end],
          }
    const res = (
      await client.get({
        url: '/api/v2/audit_logs',
        queryParams,
      })
    ).data
    if (isValidAuditRes(res)) {
      if (_.isEmpty(res.audit_logs)) {
        log.debug(
          `there was no change for instance ${instance.elemID.getFullName()} with id ${id} between the times ${start} and ${end}`,
        )
        return undefined
      }
      return res.audit_logs[0].actor_name
    }
    log.error(
      `could not get the audit_log for instance ${instance.elemID.getFullName()} with id ${id}, the result of get was not valid.`,
    )
  } catch (e) {
    log.error(
      `could not get the audit_log for instance ${instance.elemID.getFullName()} with id ${id}, get returned an error'. error: ${e}`,
    )
  }
  return undefined
}

const addChangedAt = (instances: InstanceElement[], idByInstance: Record<string, InstanceElement>): void => {
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
        if (child.annotations[CORE_ANNOTATIONS.CHANGED_AT] === undefined) {
          const parent = idByInstance[getParent(child).elemID.getFullName()]
          child.annotations[CORE_ANNOTATIONS.CHANGED_AT] = parent.annotations[CORE_ANNOTATIONS.CHANGED_AT]
        }
        // eslint-disable-next-line no-empty
      } catch (e) {
        log.warn(`getParent returned an error: ${e}`)
      }
    })
}

const addPrevChangedBy = async (
  elementsSource: ReadOnlyElementsSource,
  idByInstance: Record<string, InstanceElement>,
): Promise<void> => {
  const prevInstances = await awu(await elementsSource.getAll())
    .filter(isInstanceElement)
    .toArray()
  prevInstances
    .filter(inst => !GUIDE_ELEMENTS.has(inst.elemID.typeName))
    .forEach(prevInst => {
      if (prevInst.annotations[CORE_ANNOTATIONS.CHANGED_BY] !== undefined) {
        const id = prevInst.elemID.getFullName()
        if (idByInstance[id] !== undefined) {
          idByInstance[id].annotations[CORE_ANNOTATIONS.CHANGED_BY] = prevInst.annotations[CORE_ANNOTATIONS.CHANGED_BY]
        }
      }
    })
}

const addChangedByUsingUpdatedById = (instances: InstanceElement[], idToName: Record<string, string>): void => {
  const addChangedBy = (instance: InstanceElement, field: string): void => {
    const id = instance.value[field]
    if (id === undefined) {
      log.warn(`${field} for the ${instance.elemID.getFullName()} is undefined`)
      return
    }
    const name = idToName[id]
    if (name === undefined) {
      instance.annotations[CORE_ANNOTATIONS.CHANGED_BY] = DELETED_USER
      log.debug(`could not find user with id ${id} for instance ${instance.elemID.getFullName()}`)
    } else {
      instance.annotations[CORE_ANNOTATIONS.CHANGED_BY] = name
    }
  }
  // updated_by for translations which have updated_by_id field in the instance are not dependent on newLastAuditTime
  instances
    .filter(elem => TRANSLATION_TYPE_NAMES.includes(elem.elemID.typeName))
    .forEach(elem => addChangedBy(elem, 'updated_by_id'))

  instances
    .filter(elem => elem.elemID.typeName === CUSTOM_OBJECT_TYPE_NAME)
    .forEach(elem => addChangedBy(elem, 'updated_by_user_id'))
}

const calculateLogNumber = async (client: ZendeskClient): Promise<string> => {
  // we do not use cursor base pagination as the field 'count' would not exist
  try {
    const res = (
      await client.get({
        url: '/api/v2/audit_logs',
      })
    ).data
    if (isValidAuditResWithCount(res)) {
      return res.count.toString()
    }
    return 'unknown'
  } catch (e) {
    log.error(`could not get amount of audit_log. error: ${e}`)
    return 'unknown'
  }
}

const addChangedByUsingAuditLog = async ({
  instances,
  newLastAuditTime,
  auditTimeInstance,
  client,
}: {
  instances: InstanceElement[]
  newLastAuditTime: string
  auditTimeInstance: InstanceElement
  client: ZendeskClient
}): Promise<void> => {
  const newLastAuditTimeMoment = moment.utc(newLastAuditTime)
  const prevLastAuditTimeMoment = moment.utc(auditTimeInstance.value.time)
  const updatedInstances = instances
    // we get the changed_at from the instance itself before
    .filter(inst => inst.annotations[CORE_ANNOTATIONS.CHANGED_AT] !== undefined)
    .filter(inst => {
      const instTime = moment.utc(inst.annotations[CORE_ANNOTATIONS.CHANGED_AT])
      const isAfterPrevFetch = instTime.isAfter(prevLastAuditTimeMoment)
      const isBeforeNewFetch = instTime.isSameOrBefore(newLastAuditTimeMoment)
      if (!isBeforeNewFetch) {
        // can happen for changes in ticket_fields, routing_attribute(_value), and user_fields for example
        log.debug(
          `There is a change that happened after the last audit time received for instance ${inst.elemID.getFullName()}`,
        )
        inst.annotations[CORE_ANNOTATIONS.CHANGED_BY] = undefined
      }
      return isAfterPrevFetch && isBeforeNewFetch
    })
  if (_.isEmpty(updatedInstances)) {
    return
  }
  const logNumber = await calculateLogNumber(client)
  log.debug(
    `about to update changed_by for ${updatedInstances.length} instances, the amount of audit_logs is ${logNumber}`,
  )

  // updated_by for everything else (some types are not supported by zendesk - listed above)
  await awu(updatedInstances)
    .filter(inst => !GUIDE_ELEMENTS.has(inst.elemID.typeName))
    .forEach(async inst => {
      const name = await getChangedByName({
        instance: inst,
        client,
        start: prevLastAuditTimeMoment.format(),
        end: newLastAuditTimeMoment.format(),
      })
      if (name === undefined) {
        // error was logged earlier
        inst.annotations[CORE_ANNOTATIONS.CHANGED_BY] = undefined
        return
      }
      inst.annotations[CORE_ANNOTATIONS.CHANGED_BY] = name
    })
}

const addNewChangedBy = async ({
  instances,
  idToName,
  newLastAuditTime,
  auditTimeInstance,
  client,
}: {
  instances: InstanceElement[]
  idToName: Record<string, string>
  newLastAuditTime: string
  auditTimeInstance: InstanceElement
  client: ZendeskClient
}): Promise<void> => {
  addChangedByUsingUpdatedById(instances, idToName)
  await addChangedByUsingAuditLog({ instances, newLastAuditTime, auditTimeInstance, client })
}

/**
 * this filter adds changed_at and changed_by annotations
 */
const filterCreator: FilterCreator = ({ elementsSource, client, paginator, config }) => ({
  name: 'changeByAndChangedAt',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (elementsSource === undefined) {
      log.error('Failed to run changeByAndChangedAt filter because no element source was provided')
      return
    }
    // add update at for all the elements
    const instances = elements.filter(isInstanceElement)
    const idByInstance = _.keyBy(instances, inst => inst.elemID.getFullName())
    addChangedAt(instances, idByInstance)

    // create time elements
    // zendesk returns the time in UTC form so there is no need to convert by time zone
    const newLastAuditTime = await getLastAuditTime(client)
    if (newLastAuditTime === undefined) {
      // error logged earlier
      return
    }
    const newTimeElements = await createTimeElements(newLastAuditTime)
    elements.push(...newTimeElements)

    if (config[FETCH_CONFIG].includeAuditDetails === false) {
      log.info('not running changeByAndChangedAt filter as includeAuditDetails in the config is false')
      return
    }

    // if this is a second fetch the elementSource should have the time instance already
    const auditTimeInstance = await elementsSource.get(AUDIT_TIME_INSTANCE_ID)
    if (auditTimeInstance === undefined) {
      log.debug(
        'could not find audit time instance in elementSource so this is likely a first fetch, not populating changed-by information',
      )
      return
    }
    await addPrevChangedBy(elementsSource, idByInstance)

    const idToName = await getIdByName(paginator, config[FETCH_CONFIG].resolveUserIDs)
    await addNewChangedBy({ instances, idToName, newLastAuditTime, auditTimeInstance, client })
  },
})
export default filterCreator
