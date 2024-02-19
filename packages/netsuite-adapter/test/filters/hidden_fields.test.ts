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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/hidden_fields'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('hidden_fields', () => {
  it('should hide requested fields', async () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'someType'),
      fields: {
        internalId: { refType: BuiltinTypes.STRING },
        otherField: { refType: BuiltinTypes.STRING },
      },
      annotations: { source: 'soap' },
    })
    await filterCreator({} as LocalFilterOpts).onFetch?.([type])
    expect(type.fields.internalId.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toBeTruthy()
    expect(type.fields.otherField.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toBeUndefined()
  })
})
