/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/data_types_custom_fields'
import { NETSUITE } from '../../src/constants'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import { LocalFilterOpts } from '../../src/filter'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import { getTypesToInternalId } from '../../src/data_elements/types'

describe('data_types_custom_fields', () => {
  let filterOpts: LocalFilterOpts
  let type: ObjectType
  let instance: InstanceElement

  const Account = new ObjectType({ elemID: new ElemID(NETSUITE, 'account'), annotations: { source: 'soap' } })
  const { typeToInternalId, internalIdToTypes } = getTypesToInternalId([])

  beforeEach(async () => {
    type = new ObjectType({ elemID: new ElemID(NETSUITE, 'customer'), fields: {}, annotations: { source: 'soap' } })
    instance = new InstanceElement('name', entitycustomfieldType().type, {
      appliestocustomer: true,
      scriptid: 'someid',
    })

    filterOpts = {
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      typeToInternalId,
      internalIdToTypes,
    }
  })
  it('should add integer field', async () => {
    instance.value.fieldtype = 'INTEGER'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName()).toBe(
      BuiltinTypes.NUMBER.elemID.getFullName(),
    )
  })

  it('should add unknown field', async () => {
    instance.value.fieldtype = 'UNKNOWN'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName()).toBe(
      BuiltinTypes.UNKNOWN.elemID.getFullName(),
    )
  })

  it('should add select field', async () => {
    instance.value.fieldtype = 'SELECT'
    instance.value.selectrecordtype = '-112'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName()).toBe(Account.elemID.getFullName())
  })

  it('should add multi select field', async () => {
    instance.value.fieldtype = 'MULTISELECT'
    instance.value.selectrecordtype = '-112'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName()).toBe(
      new ListType(Account).elemID.getFullName(),
    )
  })

  it('should add multi select with unknown field', async () => {
    instance.value.fieldtype = 'MULTISELECT'
    instance.value.selectrecordtype = '-999'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName()).toBe(
      new ListType(BuiltinTypes.UNKNOWN).elemID.getFullName(),
    )
  })

  describe('partial fetch', () => {
    it('should use element index if field instance was not fetched', async () => {
      instance.value.fieldtype = 'INTEGER'
      filterOpts = {
        elementsSourceIndex: {
          getIndexes: () =>
            Promise.resolve({
              ...createEmptyElementsSourceIndexes(),
              customFieldsIndex: { customer: [instance] },
            }),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: true,
        config: await getDefaultAdapterConfig(),
        typeToInternalId,
        internalIdToTypes,
      }
      await filterCreator(filterOpts).onFetch?.([type, Account])
      expect((await type.fields.custom_someid.getType()).elemID.getFullName()).toBe(
        BuiltinTypes.NUMBER.elemID.getFullName(),
      )
    })

    it('should not use element index if field instance was fetched', async () => {
      instance.value.fieldtype = 'INTEGER'

      const fetchedInstance = instance.clone()
      fetchedInstance.value.appliestocustomer = false

      filterOpts = {
        elementsSourceIndex: {
          getIndexes: () =>
            Promise.resolve({
              ...createEmptyElementsSourceIndexes(),
              customFieldsIndex: { Customer: [instance] },
            }),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: true,
        config: await getDefaultAdapterConfig(),
        typeToInternalId,
        internalIdToTypes,
      }
      await filterCreator(filterOpts).onFetch?.([type, fetchedInstance, Account])
      expect(type.fields.custom_someid).toBeUndefined()
    })
  })
})
