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
import filterCreator from '../../src/filters/data_instances_references'
import NetsuiteClient from '../../src/client/client'
import { NETSUITE } from '../../src/constants'

describe('data_instances_references', () => {
  const firstType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'firstType'),
    fields: {
      internalId: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
    annotations: { source: 'soap' },
  })
  const secondType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'secondType'),
    fields: {
      field: { refType: firstType },
      recordRefList: { refType: new ListType(firstType) },
    },
    annotations: { source: 'soap' },
  })
  it('should replace with reference', async () => {
    const instance = new InstanceElement(
      'instance',
      secondType,
      { field: { internalId: '1' } }
    )

    const referencedInstance = new InstanceElement(
      'referencedInstance',
      firstType,
      { internalId: '1' }
    )

    const onFetchParameters = {
      elements: [instance, referencedInstance],
      client: {} as NetsuiteClient,
      elementsSourceIndex: { getIndex: () => Promise.resolve({}) },
      isPartial: false,
      dataTypeNames: new Set<string>(),
    }
    await filterCreator().onFetch(onFetchParameters)
    expect((instance.value.field as ReferenceExpression).elemID.getFullName())
      .toBe(referencedInstance.elemID.getFullName())
  })

  it('should replace recordRefList references', async () => {
    const instance = new InstanceElement(
      'instance',
      secondType,
      { recordRefList: { recordRef: [{ internalId: '1' }] } }
    )

    const referencedInstance = new InstanceElement(
      'referencedInstance',
      firstType,
      { internalId: '1' }
    )

    const onFetchParameters = {
      elements: [instance, referencedInstance],
      client: {} as NetsuiteClient,
      elementsSourceIndex: { getIndex: () => Promise.resolve({}) },
      isPartial: false,
      dataTypeNames: new Set<string>(),
    }
    await filterCreator().onFetch(onFetchParameters)
    expect((instance.value.recordRefList[0] as ReferenceExpression).elemID.getFullName())
      .toBe(referencedInstance.elemID.getFullName())
  })
})
