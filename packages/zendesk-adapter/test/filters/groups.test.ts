/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { filterUtils } from '@salto-io/adapter-components'
import { GROUP_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import groupsFilter from '../../src/filters/groups'

const mockDeployChanges = jest.fn().mockResolvedValue({ appliedChanges: [], errors: [] })
jest.mock('../../src/deployment', () => {
  const actual = jest.requireActual('../../src/deployment')
  return {
    ...actual,
    deployChanges: jest.fn((...args) => mockDeployChanges(...args)),
  }
})

describe('groupsFilter', () => {
  const groupInstance = new InstanceElement('group', new ObjectType({ elemID: new ElemID(ZENDESK, GROUP_TYPE_NAME) }))
  const filter = groupsFilter(createFilterCreatorParams({ })) as filterUtils.FilterWith<'deploy'>

  it('should deploy removal changes last', async () => {
    const modificationChange = toChange({ before: groupInstance, after: groupInstance })
    const additionChange = toChange({ after: groupInstance })
    const removalChange = toChange({ before: groupInstance })
    const changes = [
      additionChange,
      removalChange,
      modificationChange,
    ]

    await filter.deploy(changes)
    expect(mockDeployChanges).toHaveBeenNthCalledWith(1, [additionChange, modificationChange], expect.anything())
    expect(mockDeployChanges).toHaveBeenNthCalledWith(2, [removalChange], expect.anything())
  })
})
