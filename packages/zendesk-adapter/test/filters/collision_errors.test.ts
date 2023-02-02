/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createFilterCreatorParams } from '../utils'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/collision_errors'
import { FilterResult } from '../../src/filter'

describe('collision errors', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy', FilterResult>
  let filter: FilterType
  const objType = new ObjectType({ elemID: new ElemID(ZENDESK, 'obj') })
  const inst = new InstanceElement('inst1', objType, { name: 'test', position: 1 })
  const collidedInst = new InstanceElement('inst1', objType, { name: 'test', position: 2 })
  const differentInst = new InstanceElement('inst2', objType, { name: 'test2', position: 3 })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should return the correct message if there is a collision', async () => {
      const elements = [inst, collidedInst, differentInst]
      const filterResult = await filter.onFetch(elements) as FilterResult
      expect(filterResult.errors).toHaveLength(1)
      expect(filterResult.errors?.[0]).toEqual({
        severity: 'Warning',
        message: `Omitted 2 instances of obj due to Salto ID collisions.
Current Salto ID configuration for obj is defined as [name].

Breakdown per colliding Salto ID:
- inst1:
\t* Instance with Id - inst1
\t* Instance with Id - inst1

To resolve these collisions please take one of the following actions and fetch again:
\t1. Change obj's idFields to include all fields that uniquely identify the type's instances.
\t2. Delete duplicate instances from your zendesk account.

Alternatively, you can exclude obj from the service configuration in zendesk.nacl

Learn more at: https://help.salto.io/en/articles/6927157-salto-id-collisions`,
      })
    })
    it('should return no errors if there were no collisions', async () => {
      const elements = [inst, differentInst]
      const filterResult = await filter.onFetch(elements) as FilterResult
      expect(filterResult.errors).toHaveLength(0)
    })
  })
})
