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
  ElemID,
  InstanceElement,
  ReadOnlyElementsSource,
  toChange,
  getChangeData,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JIRA, ISSUE_TYPE_NAME } from '../../src/constants'
import { getAccountInfoInstance, getFilterParams } from '../utils'
import issueTypeHierarchyFilter from '../../src/filters/issue_type_hierarchy_filter'

describe('issue Type Hierarchy Filter', () => {
  const issueTypeType = new ObjectType({
    elemID: new ElemID(JIRA, ISSUE_TYPE_NAME),
  })
  const accountInfoInstanceFree = getAccountInfoInstance(true)
  const accountInfoInstancePaid = getAccountInfoInstance(false)
  let issueTypeInstanceLevelTwo: InstanceElement
  let issueTypeInstanceLevelZero: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let filter: FilterType

  beforeEach(() => {
    issueTypeInstanceLevelTwo = new InstanceElement('issueTypeInstance', issueTypeType, {
      hierarchyLevel: 2,
      description: 'test',
    })
    issueTypeInstanceLevelZero = new InstanceElement('issueTypeInstanceTwo', issueTypeType, {
      hierarchyLevel: 0,
      description: 'test',
    })
  })

  describe('preDeploy', () => {
    it('should convert hierarchy level to 0 only if it is paid account and adding issue type that has hierarchy level greater than 0', async () => {
      elementsSource = buildElementsSourceFromElements([accountInfoInstancePaid])
      filter = issueTypeHierarchyFilter(getFilterParams({ elementsSource })) as FilterType
      const changes = [toChange({ after: issueTypeInstanceLevelTwo }), toChange({ after: issueTypeInstanceLevelZero })]
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.hierarchyLevel).toEqual(0)
      expect(getChangeData(changes[1]).value.hierarchyLevel).toEqual(0)
    })
    it('should not convert hierarchy level to 0 if it has hierarchy level -1', async () => {
      elementsSource = buildElementsSourceFromElements([accountInfoInstancePaid])
      filter = issueTypeHierarchyFilter(getFilterParams({ elementsSource })) as FilterType
      issueTypeInstanceLevelTwo.value.hierarchyLevel = -1
      const changes = [toChange({ after: issueTypeInstanceLevelTwo })]
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.hierarchyLevel).toEqual(-1)
    })
    it('should not convert hierarchy level to 0 if it is free account', async () => {
      elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
      filter = issueTypeHierarchyFilter(getFilterParams({ elementsSource })) as FilterType
      const changes = [toChange({ after: issueTypeInstanceLevelTwo })]
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.hierarchyLevel).toEqual(2)
    })
    it('should not convert hierarchy level to 0 if it is free account without account info', async () => {
      elementsSource = buildElementsSourceFromElements([])
      filter = issueTypeHierarchyFilter(getFilterParams({ elementsSource })) as FilterType
      const changes = [toChange({ after: issueTypeInstanceLevelTwo })]
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.hierarchyLevel).toEqual(2)
    })
  })
  describe('onDeploy', () => {
    it('should restore hierarchy level to original value', async () => {
      elementsSource = buildElementsSourceFromElements([accountInfoInstancePaid])
      filter = issueTypeHierarchyFilter(getFilterParams({ elementsSource })) as FilterType
      const changes = [toChange({ after: issueTypeInstanceLevelTwo })]
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      expect(getChangeData(changes[0]).value.hierarchyLevel).toEqual(2)
    })
  })
})
