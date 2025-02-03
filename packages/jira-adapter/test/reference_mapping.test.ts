/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Field, InstanceElement, Element, ElemID, ObjectType } from '@salto-io/adapter-api'
import { collections, multiIndex } from '@salto-io/lowerdash'
import { contextStrategyLookup } from '../src/reference_mapping'
import { createEmptyType } from './utils'

const { awu } = collections.asynciterable

describe('contextStrategyLookup parentSelectedFieldType', () => {
  let field: Field
  let elemByElemID: multiIndex.Index<[string], Element>
  let instance: InstanceElement
  let fieldPath: ElemID
  let type: ObjectType
  beforeEach(async () => {
    type = createEmptyType('Type')
    field = new Field(type, 'field', type)
    const indexer = multiIndex.buildMultiIndex<Element>().addIndex({
      name: 'elemByElemID',
      key: elem => [elem.elemID.getFullName()],
    })
    elemByElemID = (await indexer.process(awu([]))).elemByElemID
  })
  describe('parentSelectedFieldType', () => {
    beforeEach(() => {
      instance = new InstanceElement('Issue', type, {
        selectedFieldType: 'name',
        compareFieldValue: {
          value: 'val',
        },
      })
      fieldPath = instance.elemID.createNestedID('compareFieldValue', 'value')
    })
    it('should return the selectedFieldType capitalized', async () => {
      fieldPath = instance.elemID.createNestedID('compareFieldValue', 'value')
      expect(await contextStrategyLookup.parentSelectedFieldType({ instance, field, elemByElemID, fieldPath })).toEqual(
        'Name',
      )
    })
    it('should return correctly issue type', async () => {
      instance.value.selectedFieldType = 'issuetype'
      fieldPath = instance.elemID.createNestedID('compareFieldValue', 'value')
      expect(await contextStrategyLookup.parentSelectedFieldType({ instance, field, elemByElemID, fieldPath })).toEqual(
        'IssueType',
      )
    })
    it('should return correctly request type', async () => {
      instance.value.selectedFieldType = 'com.atlassian.servicedesk:vp-origin'
      fieldPath = instance.elemID.createNestedID('compareFieldValue', 'value')
      expect(await contextStrategyLookup.parentSelectedFieldType({ instance, field, elemByElemID, fieldPath })).toEqual(
        'RequestType',
      )
    })
  })
  describe('statusByNeighborFactorKey', () => {
    beforeEach(() => {
      instance = new InstanceElement('Issue', type, {
        factoryKey: 'status-sla-condition-factory',
        conditionId: 'val2',
      })
      fieldPath = instance.elemID.createNestedID('conditionId')
    })
    it('should return the neighbor factorKey capitalized', async () => {
      expect(
        await contextStrategyLookup.statusByNeighborFactorKey({ instance, field, elemByElemID, fieldPath }),
      ).toEqual('Status')
    })
    it('should return undefined for unknown factoryKey', async () => {
      instance.value.factoryKey = 'unknown'
      expect(
        await contextStrategyLookup.statusByNeighborFactorKey({ instance, field, elemByElemID, fieldPath }),
      ).toBeUndefined()
    })
  })
})
