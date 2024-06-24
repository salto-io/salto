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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { getFilterParams } from '../utils'
import unresolvedParentsFilter from '../../src/filters/unresolved_parents'
import { Filter } from '../../src/filter'
import { JIRA } from '../../src/constants'

describe('unresolvedParentsFilter', () => {
  let filter: Filter
  let type: ObjectType
  beforeEach(async () => {
    filter = unresolvedParentsFilter(getFilterParams({}))

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'someType'),
    })
  })

  describe('onFetch', () => {
    it('should remove instances with unresolved parents', async () => {
      const inst1 = new InstanceElement('inst1', type, {}, [], {
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(new ElemID(JIRA, 'someType', 'instance', 'existingParent')),
        ],
      })

      const parent = new InstanceElement('existingParent', type, {}, [])

      const inst2 = new InstanceElement('inst2', type, {}, [], {
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(new ElemID(JIRA, 'someType', 'instance', 'nonExistingParent')),
        ],
      })

      const elements = [inst1, inst2, parent]
      await filter.onFetch?.(elements)
      expect(elements.map(e => e.elemID.name)).toEqual(['inst1', 'existingParent'])
    })
  })
})
