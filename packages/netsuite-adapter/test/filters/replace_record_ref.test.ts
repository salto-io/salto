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
import { ContainerType, ElemID, isPrimitiveType, ListType, ObjectType, Element, BuiltinTypes } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/replace_record_ref'
import { OnFetchParameters } from '../../src/filter'
import { NETSUITE } from '../../src/constants'
import NetsuiteClient from '../../src/client/client'

describe('replaceRecordRef', () => {
  const beforeRecordRef = new ObjectType({ elemID: new ElemID(NETSUITE, 'RecordRef') })
  const typeWithRecordRef = new ObjectType({ elemID: new ElemID(NETSUITE, 'typeWithRecordRef'),
    fields: {
      recordRef: { type: beforeRecordRef },
      recordRefList: { type: new ListType(beforeRecordRef) },
      numberField: { type: BuiltinTypes.NUMBER },
    } })
  let onFetchParameters: OnFetchParameters
  let elements: ObjectType[]

  beforeEach(() => {
    elements = [typeWithRecordRef, beforeRecordRef]
    onFetchParameters = {
      elements,
      client: {} as NetsuiteClient,
      elementsSourceIndex: { getIndex: () => Promise.resolve({}) },
      isPartial: false,
    }
  })
  it('should replace all record refs references', () => {
    filterCreator().onFetch(onFetchParameters)
    expect(elements.length).toEqual(2)
    expect(isPrimitiveType(elements[0].fields.recordRef.type)).toBeTruthy()
    expect(
      isPrimitiveType((elements[0].fields.recordRefList.type as ContainerType).innerType)
    ).toBeTruthy()
    expect(isPrimitiveType(elements[1])).toBeTruthy()
  })

  it('should not add RecordRef if there was not one before', () => {
    const noElements: Element[] = []
    onFetchParameters.elements = noElements

    filterCreator().onFetch(onFetchParameters)
    expect(noElements.length).toEqual(0)
  })
})
