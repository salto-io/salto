/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  Field,
  InstanceElement,
  isObjectType,
  ObjectType,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  isAdditionOrModificationChange,
  getChangeData,
  Change,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { applyFunctionToChangeData, inspectValue } from '@salto-io/adapter-utils'
import { RemoteFilterCreator } from '../filter'
import {
  apiNameSync,
  buildElementsSourceForFetch,
  ensureSafeFilterFetch,
  isCustomObjectSync,
  isInstanceOfTypeChangeSync,
  isInstanceOfTypeSync,
} from './utils'
import { APEX_TRIGGER_METADATA_TYPE, INTERNAL_ID_FIELD } from '../constants'
import SalesforceClient from '../client/client'
import { SalesforceRecord } from '../client/types'

const { toArrayAsync, awu } = collections.asynciterable
const log = logger(module)

const ON_DELETE_TRIGGER_TYPES = ['UsageBeforeDelete', 'UsageAfterDelete']

const ON_INSERT_TRIGGER_TYPES = ['UsageBeforeInsert', 'UsageAfterInsert']

const ON_UPDATE_TRIGGER_TYPES = ['UsageBeforeUpdate', 'UsageAfterUpdate']

const TRIGGER_TYPE_FIELDS = [
  ...ON_DELETE_TRIGGER_TYPES,
  ...ON_INSERT_TRIGGER_TYPES,
  ...ON_UPDATE_TRIGGER_TYPES,
  'UsageAfterUndelete',
]

const TRIGGER_TYPE_FIELD = 'triggerType'

// Avoid increasing this value as this may cause the created SOQL query to exceed the max allowed query length
const IDS_CHUNK_SIZE = 500

const queryApexTriggerRecords = async ({
  client,
  chunkSize,
  internalIds,
}: {
  client: SalesforceClient
  chunkSize: number
  internalIds: string[]
}): Promise<SalesforceRecord[]> =>
  _.flatten(
    await Promise.all(
      _.chunk(internalIds, chunkSize).map(async chunk => {
        const query = `SELECT Id, TableEnumOrId, ${TRIGGER_TYPE_FIELDS.join(',')} FROM ApexTrigger WHERE Id IN ('${chunk.join("','")}')`
        return (await toArrayAsync(await client.queryAll(query))).flat()
      }),
    ),
  )

const updateApexTriggerMetadataType = (metadataType: ObjectType): void => {
  metadataType.fields[TRIGGER_TYPE_FIELD] = new Field(metadataType, TRIGGER_TYPE_FIELD, BuiltinTypes.STRING)
}

const extendTriggerMetadataFromRecord = ({
  trigger,
  record,
  customObjectsByInternalId,
  customObjectsByApiName,
}: {
  trigger: InstanceElement
  record: SalesforceRecord
  customObjectsByInternalId: Record<string, ObjectType>
  customObjectsByApiName: Record<string, ObjectType>
}): void => {
  const tableEnumOrId = record.TableEnumOrId
  const parentObject = customObjectsByInternalId[tableEnumOrId] ?? customObjectsByApiName[tableEnumOrId]
  const triggerType = Object.entries(record)
    .filter(([key]) => TRIGGER_TYPE_FIELDS.includes(key))
    .find(([_key, value]) => value === true)?.[0]
  if (parentObject) {
    trigger.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(parentObject.elemID, parentObject)]
  }
  if (triggerType) {
    trigger.annotations[TRIGGER_TYPE_FIELD] = triggerType
  }
}

const filterCreator: RemoteFilterCreator = ({ client, config }) => {
  let originalApexTriggerChangesByElemId: Record<string, Change<InstanceElement>>
  return {
    name: 'extendedTriggersMetadata',
    remote: true,
    onFetch: ensureSafeFilterFetch({
      config,
      filterName: 'extendedTriggersMetadata',
      warningMessage: 'Failed to extend the Metadata on Apex Triggers',
      fetchFilterFunc: async elements => {
        const apexTriggerMetadataType = elements
          .filter(isObjectType)
          .find(type => apiNameSync(type) === APEX_TRIGGER_METADATA_TYPE)
        if (apexTriggerMetadataType === undefined) {
          return
        }
        updateApexTriggerMetadataType(apexTriggerMetadataType)
        const triggersByInternalId: Record<string, InstanceElement> = {}
        elements.filter(isInstanceOfTypeSync(APEX_TRIGGER_METADATA_TYPE)).forEach(trigger => {
          const internalId = trigger.value[INTERNAL_ID_FIELD]
          if (_.isString(internalId)) {
            triggersByInternalId[internalId] = trigger
          }
        })
        const internalIds = Object.keys(triggersByInternalId)
        if (internalIds.length === 0) {
          return
        }
        const recordsById = _.keyBy(
          await queryApexTriggerRecords({ client, chunkSize: IDS_CHUNK_SIZE, internalIds }),
          record => record.Id,
        )
        // Map CustomObjects by both internal Id and API Name
        const customObjectsByInternalId: Record<string, ObjectType> = {}
        const customObjectsByApiName: Record<string, ObjectType> = {}
        await awu(await buildElementsSourceForFetch(elements, config).getAll())
          .filter(isCustomObjectSync)
          .forEach(customObject => {
            const internalId = customObject.annotations[INTERNAL_ID_FIELD]
            const objectApiName = apiNameSync(customObject)
            if (_.isString(internalId)) {
              customObjectsByInternalId[internalId] = customObject
            }
            if (objectApiName) {
              customObjectsByApiName[objectApiName] = customObject
            }
          })
        const triggersWithMissingRecord: string[] = []
        Object.entries(triggersByInternalId).forEach(([internalId, trigger]) => {
          const record = recordsById[internalId]
          if (record) {
            extendTriggerMetadataFromRecord({ trigger, record, customObjectsByInternalId, customObjectsByApiName })
          } else {
            triggersWithMissingRecord.push(apiNameSync(trigger) ?? '')
          }
        })
        log.warn(
          'Failed to extend the following Apex Triggers: %s',
          inspectValue(triggersWithMissingRecord, { maxArrayLength: 100 }),
        )
      },
    }),
    preDeploy: async changes => {
      const relevantApexTriggerChanges = changes
        .filter(isInstanceOfTypeChangeSync(APEX_TRIGGER_METADATA_TYPE))
        .filter(isAdditionOrModificationChange)
      originalApexTriggerChangesByElemId = _.keyBy(
        await awu(relevantApexTriggerChanges)
          .map(change => applyFunctionToChangeData(change, async trigger => trigger.clone()))
          .toArray(),
        change => getChangeData(change).elemID.getFullName(),
      )
      relevantApexTriggerChanges.map(getChangeData).forEach(trigger => {
        delete trigger.value[TRIGGER_TYPE_FIELD]
        delete trigger.annotations[CORE_ANNOTATIONS.PARENT]
      })
    },
    onDeploy: async changes => {
      const appliedApexTriggerChanges = changes
        .filter(isInstanceOfTypeChangeSync(APEX_TRIGGER_METADATA_TYPE))
        .filter(isAdditionOrModificationChange)
      const appliedElemIds = appliedApexTriggerChanges.map(change => getChangeData(change).elemID.getFullName())
      _.pullAll(changes, appliedApexTriggerChanges)
      Object.values(_.pick(originalApexTriggerChangesByElemId, appliedElemIds)).forEach(originalChange => {
        changes.push(originalChange)
      })
    },
  }
}

export default filterCreator
