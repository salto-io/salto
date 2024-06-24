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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/data_instances_null_fields'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('data_instances_null_fields', () => {
  it('preDeploy should remove identical fields', async () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'Customer'),
      annotations: { source: 'soap' },
    })
    const beforeInstance = new InstanceElement('name', type, {
      notRemoved: 1,
      removed: 2,
      custom_custremoved: 3,
    })

    const afterInstance = new InstanceElement('name', type, {
      notRemoved: 1,
    })
    await filterCreator({} as LocalFilterOpts).preDeploy?.([
      toChange({ before: beforeInstance, after: afterInstance }),
      toChange({ before: type, after: type }),
    ])
    expect(afterInstance.value).toEqual({
      notRemoved: 1,
      'platformCore:nullFieldList': {
        'platformCore:name': ['removed', 'custremoved'],
      },
    })
  })
})
