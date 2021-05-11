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
import { ElemID, ObjectType, BuiltinTypes, ListType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/remove_redundant_types'
import { OnFetchParameters } from '../../src/filter'
import { NETSUITE } from '../../src/constants'
import NetsuiteClient from '../../src/client/client'

describe('replaceRecordRef', () => {
  const typeToRemove = new ObjectType({ elemID: new ElemID(NETSUITE, 'NullField') })
  const typeWithFieldToRemove = new ObjectType({ elemID: new ElemID(NETSUITE, 'typeWithFieldToRemove'),
    fields: {
      fieldToRemove: { type: typeToRemove },
      listToRemove: { type: new ListType(typeToRemove) },
      numberField: { type: BuiltinTypes.NUMBER },
    } })
  let onFetchParameters: OnFetchParameters
  let elements: ObjectType[]

  beforeEach(() => {
    elements = [typeToRemove, typeWithFieldToRemove]
    onFetchParameters = {
      elements,
      client: {} as NetsuiteClient,
      elementsSourceIndex: { getIndex: () => Promise.resolve({}) },
      isPartial: false,
    }
  })
  it('should remove the types and the fields', () => {
    filterCreator().onFetch(onFetchParameters)
    expect(elements.length).toEqual(1)
    expect(typeWithFieldToRemove.fields.fieldToRemove).toBeUndefined()
    expect(typeWithFieldToRemove.fields.listToRemove).toBeUndefined()
    expect(typeWithFieldToRemove.fields.numberField).toBeDefined()
  })
})
