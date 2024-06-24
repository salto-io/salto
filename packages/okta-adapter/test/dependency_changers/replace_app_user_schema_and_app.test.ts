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
import { collections } from '@salto-io/lowerdash'
import { OKTA, APP_USER_SCHEMA_TYPE_NAME, APPLICATION_TYPE_NAME } from '../../src/constants'
import { changeDependenciesFromAppUserSchemaToApp } from '../../src/dependency_changers/replace_app_user_schema_and_app'

describe('changeDependenciesFromAppUserSchemaToApp', () => {
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

  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })
  const appUserSchema1 = new InstanceElement(
    'appUserSchema1',
    appUserSchemaType,
    {
      definitions: {
        custom: {
          properties: {
            property1: {},
          },
        },
      },
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)] },
  )
  const appUserSchema2 = new InstanceElement(
    'appUserSchema2',
    appUserSchemaType,
    {
      definitions: {
        custom: {
          properties: {
            property1: {},
          },
        },
      },
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app2.elemID, app2)] },
  )
  it('should replace dependencies from app user schema to app because app changed from INACTIVE to ACTIVE', async () => {
    const appUserSchema1After = appUserSchema1.clone()
    appUserSchema1After.value.definitions.custom.properties.property2 = {}
    const app1After = app1.clone()
    app1After.value.status = 'ACTIVE'
    const inputChanges = new Map([
      [0, toChange({ before: appUserSchema1, after: appUserSchema1After })],
      [1, toChange({ before: app1, after: app1After })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set([0])],
    ])
    dependencyChanges = [...(await changeDependenciesFromAppUserSchemaToApp(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)
    expect(dependencyChanges[1].action).toEqual('remove')
    expect(dependencyChanges[1].dependency.source).toEqual(1)
    expect(dependencyChanges[1].dependency.target).toEqual(0)
  })
  it('should not replace dependencies from app user schema to app because app changed from ACTIVE to INACTIVE', async () => {
    const appUserSchema2After = appUserSchema2.clone()
    appUserSchema2After.value.definitions.custom.properties.property2 = {}
    const app2After = app2.clone()
    app2After.value.status = 'INACTIVE'
    const inputChanges = new Map([
      [0, toChange({ before: appUserSchema2, after: appUserSchema2After })],
      [1, toChange({ before: app2, after: app2After })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set([0])],
    ])
    dependencyChanges = [...(await changeDependenciesFromAppUserSchemaToApp(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
