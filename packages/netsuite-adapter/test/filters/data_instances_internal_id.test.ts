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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ListType, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/data_instances_internal_id'
import NetsuiteClient from '../../src/client/client'
import { NETSUITE } from '../../src/constants'

describe('data_instances_internal_id', () => {
  const recordRefType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'RecordRef'),
    fields: {
      internalId: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
  })
  it('should add account specific value to record refs', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'type'), fields: { recordRef: { refType: recordRefType } }, annotations: { source: 'soap' } }),
      { recordRef: {} }
    )

    const onFetchParameters = {
      elements: [instance],
      client: {} as NetsuiteClient,
      elementsSourceIndex: { getIndex: () => Promise.resolve({}) },
      isPartial: false,
      dataTypeNames: new Set<string>(),
    }
    await filterCreator().onFetch(onFetchParameters)
    expect(instance.value.recordRef.id).toEqual('[ACCOUNT_SPECIFIC_VALUE]')
  })

  it('should extract list items with internal id', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'type'), fields: { someList: { refType: new ListType(recordRefType) } }, annotations: { source: 'soap' } }),
      { someList: [{ internalId: '1' }, { internalId: '1' }] }
    )

    const elements = [instance]
    const onFetchParameters = {
      elements,
      client: {} as NetsuiteClient,
      elementsSourceIndex: { getIndex: () => Promise.resolve({}) },
      isPartial: false,
      dataTypeNames: new Set<string>(),
    }

    await filterCreator().onFetch(onFetchParameters)
    expect(elements[1].elemID.name).toBe('type_someList_1')
    expect((instance.value.someList[0] as ReferenceExpression).elemID.getFullName())
      .toBe(elements[1].elemID.getFullName())
    expect(elements.length).toBe(2)
  })
})
