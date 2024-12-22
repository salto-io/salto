/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  CORE_ANNOTATIONS,
  Element,
  getChangeData,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { FilterWith } from './mocks'
import filterCreator, { TRIGGER_TYPES_FIELD_NAME, TriggerType } from '../../src/filters/extend_triggers_metadata'
import { SalesforceClient } from '../../index'
import mockClient from '../client'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { createMetadataObjectType } from '../../src/transformers/transformer'
import { APEX_TRIGGER_METADATA_TYPE, API_NAME, INTERNAL_ID_FIELD } from '../../src/constants'
import { SalesforceRecord } from '../../src/client/types'
import Connection from '../../src/client/jsforce'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('extendTriggersMetadata filter', () => {
  const TRIGGER_API_NAME = 'TestTrigger'
  const TRIGGER_ID = '01qQy000000EmuPIAS'

  const PARENT_OBJECT_API_NAME = 'TestObject__c'
  const PARENT_OBJECT_ID = '01IQy000000zEWgMAM'

  type TableEnumOrId = typeof PARENT_OBJECT_API_NAME | typeof PARENT_OBJECT_ID
  type TriggerRecord = SalesforceRecord & {
    TableEnumOrId: string
  } & {
    [K in TriggerType]: boolean
  }

  const createTriggerRecord = (tableEnumOrId: TableEnumOrId, triggerTypes: Set<TriggerType>): TriggerRecord => ({
    Id: TRIGGER_ID,
    TableEnumOrId: tableEnumOrId,
    UsageBeforeDelete: triggerTypes.has(TriggerType.UsageBeforeDelete),
    UsageAfterDelete: triggerTypes.has(TriggerType.UsageAfterDelete),
    UsageBeforeInsert: triggerTypes.has(TriggerType.UsageBeforeInsert),
    UsageAfterInsert: triggerTypes.has(TriggerType.UsageAfterInsert),
    UsageBeforeUpdate: triggerTypes.has(TriggerType.UsageBeforeUpdate),
    UsageAfterUpdate: triggerTypes.has(TriggerType.UsageAfterUpdate),
    UsageAfterUndelete: triggerTypes.has(TriggerType.UsageAfterUndelete),
  })

  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let triggerInstance: InstanceElement
  let triggerMetadataType: ObjectType
  let parentObject: ObjectType

  beforeEach(() => {
    ;({ client, connection } = mockClient())
    filter = filterCreator({ client, config: defaultFilterContext }) as typeof filter
    triggerMetadataType = createMetadataObjectType({ annotations: { metadataType: APEX_TRIGGER_METADATA_TYPE } })
    triggerInstance = new InstanceElement('test', triggerMetadataType, {
      fullName: TRIGGER_API_NAME,
      [INTERNAL_ID_FIELD]: TRIGGER_ID,
    })
    parentObject = createCustomObjectType(PARENT_OBJECT_API_NAME, {
      annotations: { [API_NAME]: PARENT_OBJECT_API_NAME, [INTERNAL_ID_FIELD]: PARENT_OBJECT_ID },
    })
  })
  describe('onFetch', () => {
    let elements: Element[]
    let triggerTypes: Set<TriggerType>
    beforeEach(() => {
      elements = [triggerMetadataType, triggerInstance, parentObject]
      triggerTypes = new Set([TriggerType.UsageBeforeInsert, TriggerType.UsageAfterDelete])
      filter = filterCreator({
        client,
        config: defaultFilterContext,
      }) as typeof filter
    })
    describe('when parent object is referenced by its API name', () => {
      beforeEach(async () => {
        connection.query.mockResolvedValue({
          records: [createTriggerRecord(PARENT_OBJECT_API_NAME, triggerTypes)],
          done: true,
          totalSize: 1,
        })
        await filter.onFetch(elements)
      })
      it('should extend the trigger instance metadata', () => {
        expect(triggerInstance.value[TRIGGER_TYPES_FIELD_NAME]).toIncludeSameMembers(Array.from(triggerTypes))
        expect(triggerInstance.annotations[CORE_ANNOTATIONS.PARENT]).toEqual([
          new ReferenceExpression(parentObject.elemID, parentObject),
        ])
      })
    })
    describe('when parent object is referenced by its Id', () => {
      beforeEach(async () => {
        connection.query.mockResolvedValue({
          records: [createTriggerRecord(PARENT_OBJECT_ID, triggerTypes)],
          done: true,
          totalSize: 1,
        })
        await filter.onFetch(elements)
      })
      it('should extend the trigger instance metadata', () => {
        expect(triggerInstance.value[TRIGGER_TYPES_FIELD_NAME]).toIncludeSameMembers(Array.from(triggerTypes))
        expect(triggerInstance.annotations[CORE_ANNOTATIONS.PARENT]).toEqual([
          new ReferenceExpression(parentObject.elemID, parentObject),
        ])
      })
    })
    it('should add the triggerTypes field on the metadata type', async () => {
      await filter.onFetch(elements)
      expect(triggerMetadataType.fields[TRIGGER_TYPES_FIELD_NAME]).toBeDefined()
    })
    describe('when ApexTrigger metadata type not found', () => {
      beforeEach(async () => {
        connection.query.mockResolvedValue({
          records: [createTriggerRecord(PARENT_OBJECT_API_NAME, triggerTypes)],
          done: true,
          totalSize: 1,
        })
        await filter.onFetch(elements.filter(e => e.elemID.getFullName() !== triggerMetadataType.elemID.getFullName()))
      })
      it('should not extend the trigger instance metadata', () => {
        expect(triggerInstance.value[TRIGGER_TYPES_FIELD_NAME]).toBeUndefined()
        expect(triggerInstance.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
      })
      it('should not add the triggerTypes field on the metadata type', () => {
        expect(triggerMetadataType.fields[TRIGGER_TYPES_FIELD_NAME]).toBeUndefined()
      })
    })
    describe('when chunk size is configured in the limits config', () => {
      const ANOTHER_TRIGGER_ID = '01BAc000000EmuPBDC'
      let anotherTriggerInstance: InstanceElement
      beforeEach(() => {
        anotherTriggerInstance = new InstanceElement('test2', triggerMetadataType, {
          fullName: 'AnotherTriggerInstance',
          [INTERNAL_ID_FIELD]: ANOTHER_TRIGGER_ID,
        })
        connection.query.mockResolvedValue({
          records: [createTriggerRecord(PARENT_OBJECT_API_NAME, triggerTypes)],
          done: false,
          totalSize: 1,
        })
      })
      describe('when ApexTrigger instances count exceeds the chunk size', () => {
        beforeEach(async () => {
          filter = filterCreator({
            client,
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({
                fetchParams: {
                  limits: { extendTriggersMetadataChunkSize: 1 },
                },
              }),
            },
          }) as typeof filter
          await filter.onFetch(elements.concat(anotherTriggerInstance))
        })
        it('should send multiple queries', () => {
          expect(connection.query).toHaveBeenCalledTimes(2)
        })
      })
      describe('when ApexTrigger instances count does not exceed the chunk size', () => {
        beforeEach(async () => {
          filter = filterCreator({
            client,
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({
                fetchParams: {
                  limits: { extendTriggersMetadataChunkSize: 2 },
                },
              }),
            },
          }) as typeof filter
          await filter.onFetch(elements.concat(anotherTriggerInstance))
        })
        it('should send a single query', () => {
          expect(connection.query).toHaveBeenCalledTimes(1)
        })
      })
    })
  })
  describe('preDeploy and onDeploy', () => {
    let changes: Change<InstanceElement>[]
    beforeEach(() => {
      triggerInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(parentObject.elemID, parentObject),
      ]
      triggerInstance.value[TRIGGER_TYPES_FIELD_NAME] = ['UsageBeforeInsert', 'UsageAfterDelete']
      changes = [{ action: 'add', data: { after: triggerInstance } }]
    })
    it('should remove the triggerTypes field and the parent reference on preDeploy and revert to the original change from onDeploy', async () => {
      await filter.preDeploy(changes)
      const instanceAfterPreDeploy = getChangeData(changes[0])
      expect(instanceAfterPreDeploy.value[TRIGGER_TYPES_FIELD_NAME]).toBeUndefined()
      expect(instanceAfterPreDeploy.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
      await filter.onDeploy(changes)
      const instanceAfterOnDeploy = getChangeData(changes[0])
      expect(instanceAfterOnDeploy.value[TRIGGER_TYPES_FIELD_NAME]).toIncludeSameMembers([
        'UsageBeforeInsert',
        'UsageAfterDelete',
      ])
      expect(instanceAfterOnDeploy.annotations[CORE_ANNOTATIONS.PARENT]).toEqual([
        new ReferenceExpression(parentObject.elemID, parentObject),
      ])
    })
  })
})
