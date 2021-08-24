/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/data_types_custom_fields'
import NetsuiteClient from '../../src/client/client'
import { NETSUITE } from '../../src/constants'
import { entitycustomfield } from '../../src/autogen/types/custom_types/entitycustomfield'
import { FilterOpts } from '../../src/filter'

describe('data_types_custom_fields', () => {
  let filterOpts: FilterOpts
  let type: ObjectType
  let instance: InstanceElement

  const Account = new ObjectType({ elemID: new ElemID(NETSUITE, 'Account'), annotations: { source: 'soap' } })

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(NETSUITE, 'Customer'), fields: {}, annotations: { source: 'soap' } })
    instance = new InstanceElement('name', entitycustomfield, { appliestocustomer: true, scriptid: 'someid' })

    filterOpts = {
      client: {} as NetsuiteClient,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve({
          serviceIdsIndex: {},
          internalIdsIndex: {},
          customFieldsIndex: {},
        }),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
    }
  })
  it('should add integer field', async () => {
    instance.value.fieldtype = 'INTEGER'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName())
      .toBe(BuiltinTypes.NUMBER.elemID.getFullName())
  })

  it('should add unknown field', async () => {
    instance.value.fieldtype = 'UNKNOWN'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName())
      .toBe(BuiltinTypes.UNKNOWN.elemID.getFullName())
  })

  it('should add select field', async () => {
    instance.value.fieldtype = 'SELECT'
    instance.value.selectrecordtype = '-112'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName())
      .toBe(Account.elemID.getFullName())
  })

  it('should add multi select field', async () => {
    instance.value.fieldtype = 'MULTISELECT'
    instance.value.selectrecordtype = '-112'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName())
      .toBe(new ListType(Account).elemID.getFullName())
  })

  it('should add multi select with unknown field', async () => {
    instance.value.fieldtype = 'MULTISELECT'
    instance.value.selectrecordtype = '-999'
    await filterCreator(filterOpts).onFetch?.([type, instance, Account])
    expect((await type.fields.custom_someid.getType()).elemID.getFullName())
      .toBe(new ListType(BuiltinTypes.UNKNOWN).elemID.getFullName())
  })

  describe('partial fetch', () => {
    it('should use element index if field instance was not fetched', async () => {
      instance.value.fieldtype = 'INTEGER'
      filterOpts = {
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve({
            serviceIdsIndex: {},
            internalIdsIndex: {},
            customFieldsIndex: { Customer: [instance] },
          }),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: true,
      }
      await filterCreator(filterOpts).onFetch?.([type, Account])
      expect((await type.fields.custom_someid.getType()).elemID.getFullName())
        .toBe(BuiltinTypes.NUMBER.elemID.getFullName())
    })

    it('should not use element index if field instance was fetched', async () => {
      instance.value.fieldtype = 'INTEGER'

      const fetchedInstance = instance.clone()
      fetchedInstance.value.appliestocustomer = false

      filterOpts = {
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve({
            serviceIdsIndex: {},
            internalIdsIndex: {},
            customFieldsIndex: { Customer: [instance] },
          }),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: true,
      }
      await filterCreator(filterOpts).onFetch?.([type, fetchedInstance, Account])
      expect(type.fields.custom_someid).toBeUndefined()
    })
  })
})
