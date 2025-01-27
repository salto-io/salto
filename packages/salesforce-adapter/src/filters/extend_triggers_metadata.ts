/*
 * Copyright 2025 Salto Labs Ltd.
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
  ListType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { inspectValue } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
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

export enum TriggerType {
  UsageBeforeDelete = 'UsageBeforeDelete',
  UsageAfterDelete = 'UsageAfterDelete',
  UsageBeforeInsert = 'UsageBeforeInsert',
  UsageAfterInsert = 'UsageAfterInsert',
  UsageBeforeUpdate = 'UsageBeforeUpdate',
  UsageAfterUpdate = 'UsageAfterUpdate',
  UsageAfterUndelete = 'UsageAfterUndelete',
}
const TRIGGER_TYPE_FIELDS = Object.values(TriggerType)

export const TRIGGER_TYPES_FIELD_NAME = 'triggerTypes'

// Avoid increasing this value as this may cause the created SOQL query to exceed the max allowed query length
const DEFAULT_CHUNK_SIZE = 1000

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
  metadataType.fields[TRIGGER_TYPES_FIELD_NAME] = new Field(
    metadataType,
    TRIGGER_TYPES_FIELD_NAME,
    new ListType(BuiltinTypes.STRING),
  )
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
  // The value of TableEnumOrId is either the CustomObject API name or its internal Id.
  const parentObject = customObjectsByInternalId[tableEnumOrId] ?? customObjectsByApiName[tableEnumOrId]
  const triggerTypes = Object.entries(record)
    .filter(([key]) => (TRIGGER_TYPE_FIELDS as ReadonlyArray<string>).includes(key))
    .filter(([_key, value]) => value === true)
    .map(([key]) => key)
  if (parentObject) {
    trigger.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(parentObject.elemID, parentObject)]
  } else {
    log.warn(
      'Failed to find parent object for Apex Trigger %s with TableEnumOrId %s',
      apiNameSync(trigger) ?? '',
      tableEnumOrId,
    )
  }
  if (triggerTypes.length > 0) {
    trigger.value[TRIGGER_TYPES_FIELD_NAME] = triggerTypes
  }
}

type ValuesToRestoreOnDeploy = {
  [TRIGGER_TYPES_FIELD_NAME]?: unknown
  parent?: unknown
}

const filterCreator: FilterCreator = ({ client, config }) => {
  const valuesToRestoreByElemId: Record<string, ValuesToRestoreOnDeploy> = {}
  return {
    name: 'extendTriggersMetadata',
    onFetch: ensureSafeFilterFetch({
      config,
      warningMessage: 'Failed to extend the Metadata on Apex Triggers',
      fetchFilterFunc: async elements => {
        if (client === undefined) {
          return
        }

        const apexTriggerMetadataType = elements
          .filter(isObjectType)
          .find(type => apiNameSync(type) === APEX_TRIGGER_METADATA_TYPE)
        if (apexTriggerMetadataType === undefined) {
          log.debug('ApexTrigger MetadataType not found. Skipping filter')
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
          await queryApexTriggerRecords({
            client,
            chunkSize: config.fetchProfile.limits?.extendTriggersMetadataChunkSize ?? DEFAULT_CHUNK_SIZE,
            internalIds,
          }),
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
      relevantApexTriggerChanges.map(getChangeData).forEach(trigger => {
        const valuesToRestore: ValuesToRestoreOnDeploy = {}
        if (trigger.value[TRIGGER_TYPES_FIELD_NAME]) {
          valuesToRestore[TRIGGER_TYPES_FIELD_NAME] = trigger.value[TRIGGER_TYPES_FIELD_NAME]
          delete trigger.value[TRIGGER_TYPES_FIELD_NAME]
        }
        if (trigger.annotations[CORE_ANNOTATIONS.PARENT]) {
          valuesToRestore.parent = trigger.annotations[CORE_ANNOTATIONS.PARENT]
          delete trigger.annotations[CORE_ANNOTATIONS.PARENT]
        }
        if (valuesToRestore[TRIGGER_TYPES_FIELD_NAME] || valuesToRestore.parent) {
          valuesToRestoreByElemId[trigger.elemID.getFullName()] = valuesToRestore
        }
      })
    },
    onDeploy: async changes => {
      changes
        .filter(isInstanceOfTypeChangeSync(APEX_TRIGGER_METADATA_TYPE))
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .forEach(trigger => {
          const valuesToRestore = valuesToRestoreByElemId[trigger.elemID.getFullName()]
          if (valuesToRestore) {
            if (valuesToRestore[TRIGGER_TYPES_FIELD_NAME]) {
              trigger.value[TRIGGER_TYPES_FIELD_NAME] = valuesToRestore[TRIGGER_TYPES_FIELD_NAME]
            }
            if (valuesToRestore.parent) {
              trigger.annotations[CORE_ANNOTATIONS.PARENT] = valuesToRestore.parent
            }
          }
        })
    },
  }
}

export default filterCreator
