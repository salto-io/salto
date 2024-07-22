/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  ObjectType,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  getRestriction,
  createRestriction,
} from '@salto-io/adapter-api'
import filterCreator, { FLOW_METADATA_TYPE_ID } from '../../src/filters/flow'
import { defaultFilterContext } from '../utils'

describe('flow filter', () => {
  const filter = filterCreator({ config: defaultFilterContext })
  const elemID = FLOW_METADATA_TYPE_ID
  const values = [
    'ObjectType',
    'TriggerType',
    'ObjectVariable',
    'OldObjectVariable',
    'RecursiveCountVariable',
    'EventType',
  ]
  const mockFlow = new ObjectType({
    elemID,
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values }),
        },
      },
    },
  })

  it('remove restriction values from flow_metadata_value.name', async () => {
    await filter.onFetch?.([mockFlow])
    expect(getRestriction(mockFlow.fields.name).values).toEqual(values)
    expect(getRestriction(mockFlow.fields.name).enforce_value).toBe(false)
  })
})
