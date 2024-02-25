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
  toChange,
  DependencyChange,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { OKTA, APPLICATION_TYPE_NAME, APP_GROUP_ASSIGNMENT_TYPE_NAME } from '../../src/constants'
import { addAppGroupToAppDependency } from '../../src/dependency_changers/app_group_assignment_to_app'

describe('addAppGroupToAppDependency', () => {
  let dependencyChanges: DependencyChange[]
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const app1 = new InstanceElement('app1', appType, {
    id: '1',
    label: 'app1',
    status: 'INACTIVE',
  })
  const app2 = new InstanceElement('app2', appType, {
    id: '2',
    label: 'app2',
    status: 'ACTIVE',
  })
  const appGroupType = new ObjectType({ elemID: new ElemID(OKTA, APP_GROUP_ASSIGNMENT_TYPE_NAME) })
  const appGroupInst = new InstanceElement('appGroup1', appGroupType, { id: 'ab', priority: 0 }, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)],
  })
  it('should add dependency from ApplicationGroupAssignment change to Application modification change', async () => {
    const inputChanges = new Map([
      ['appGroup', toChange({ after: appGroupInst })],
      ['app1', toChange({ before: app1, after: app1 })],
      ['app2', toChange({ before: app2, after: app2 })],
    ])
    dependencyChanges = [...(await addAppGroupToAppDependency(inputChanges, new Map()))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual('appGroup')
    expect(dependencyChanges[0].dependency.target).toEqual('app1')
  })
})
