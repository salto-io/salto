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
import filterCreator from '../../../src/filters/internal_ids/suite_app_internal_ids'
import { NETSUITE } from '../../../src/constants'
import { LocalFilterOpts } from '../../../src/filter'

describe('suite app internal ids filter tests', () => {
  it('should add the internal id to new instances', async () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'type'),
      annotations: { source: 'soap' },
    })

    const instance = new InstanceElement('instance', type)

    await filterCreator({} as LocalFilterOpts).onDeploy?.([toChange({ after: instance })], {
      elemIdToInternalId: { [instance.elemID.getFullName()]: '2' },
      appliedChanges: [],
      errors: [],
    })
    expect(instance.value).toEqual({ internalId: '2' })
  })
})
