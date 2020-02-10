/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  ObjectType, Field, BuiltinTypes, CORE_ANNOTATIONS, RESTRICTION_ANNOTATIONS,
} from 'adapter-api'
import filterCreator, { FLOW_METADATA_TYPE_ID } from '../../src/filters/flow'

describe('flow filter', () => {
  const filter = filterCreator()
  const elemID = FLOW_METADATA_TYPE_ID
  const values = ['ObjectType', 'TriggerType', 'ObjectVariable', 'OldObjectVariable',
    'RecursiveCountVariable', 'EventType']
  const mockFlow = new ObjectType({
    elemID,
    fields: {
      name: new Field(elemID, 'name', BuiltinTypes.STRING,
        {
          [CORE_ANNOTATIONS.VALUES]: values,
        }),
    },
  })

  it('remove restriction values from flow_metadata_value.name', () => {
    filter.onFetch([mockFlow])
    expect(mockFlow.fields.name.annotations[CORE_ANNOTATIONS.VALUES]).toEqual(values)
    expect(mockFlow.fields.name
      .annotations[CORE_ANNOTATIONS.RESTRICTION][RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]).toBe(false)
  })
})
