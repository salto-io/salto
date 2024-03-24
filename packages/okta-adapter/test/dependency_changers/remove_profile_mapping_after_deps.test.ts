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

import { collections } from '@salto-io/lowerdash'
import {
  ObjectType,
  ElemID,
  InstanceElement,
  toChange,
  DependencyChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import {
  OKTA,
  APPLICATION_TYPE_NAME,
  PROFILE_MAPPING_TYPE_NAME,
  IDENTITY_PROVIDER_TYPE_NAME,
  USERTYPE_TYPE_NAME,
} from '../../src/constants'
import { removeProfileMappingAfterDeps } from '../../src/dependency_changers/remove_profile_mapping_after_deps'

describe('removeProfileMappingAfterDeps', () => {
  let dependencyChanges: DependencyChange[]

  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const identityProviderType = new ObjectType({ elemID: new ElemID(OKTA, IDENTITY_PROVIDER_TYPE_NAME) })
  const profileMappingType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_MAPPING_TYPE_NAME) })
  const userTypeType = new ObjectType({ elemID: new ElemID(OKTA, USERTYPE_TYPE_NAME) })

  const app = new InstanceElement('app', appType, { name: 'A', default: false })
  const identityProvider = new InstanceElement('idp', identityProviderType, { name: 'B', default: false })
  const userType = new InstanceElement('user type', userTypeType, { name: 'C', default: false })

  const profileMappingA = new InstanceElement('mappingA', profileMappingType, {
    source: { id: new ReferenceExpression(app.elemID, app) },
    target: { id: new ReferenceExpression(userType.elemID, userType) },
  })

  const profileMappingB = new InstanceElement('mappingB', profileMappingType, {
    source: { id: new ReferenceExpression(userType.elemID, userType) },
    target: { id: new ReferenceExpression(identityProvider.elemID, identityProvider) },
  })

  it('should handle a simple case with one mapping and one dep removal', async () => {
    const inputChanges = new Map([
      ['app', toChange({ before: app })],
      ['mappingA', toChange({ before: profileMappingA })],
    ])
    dependencyChanges = [...(await removeProfileMappingAfterDeps(inputChanges, new Map()))]
    expect(dependencyChanges).toHaveLength(2)
    expect(new Set(dependencyChanges)).toEqual(
      new Set([
        {
          action: 'remove',
          dependency: {
            source: 'app',
            target: 'mappingA',
          },
        },
        {
          action: 'add',
          dependency: {
            source: 'mappingA',
            target: 'app',
          },
        },
      ]),
    )
  })

  it('should handle multiple mappings with shared deps', async () => {
    const inputChanges = new Map([
      ['app', toChange({ before: app })],
      ['user type', toChange({ before: userType })],
      ['mappingA', toChange({ before: profileMappingA })],
      ['mappingB', toChange({ before: profileMappingB })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set([0])],
    ])
    dependencyChanges = [...(await removeProfileMappingAfterDeps(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(6)
    expect(new Set(dependencyChanges)).toEqual(
      new Set([
        {
          action: 'remove',
          dependency: {
            source: 'app',
            target: 'mappingA',
          },
        },
        {
          action: 'add',
          dependency: {
            source: 'mappingA',
            target: 'app',
          },
        },
        {
          action: 'remove',
          dependency: {
            source: 'user type',
            target: 'mappingA',
          },
        },
        {
          action: 'add',
          dependency: {
            source: 'mappingA',
            target: 'user type',
          },
        },
        {
          action: 'remove',
          dependency: {
            source: 'user type',
            target: 'mappingB',
          },
        },
        {
          action: 'add',
          dependency: {
            source: 'mappingB',
            target: 'user type',
          },
        },
      ]),
    )
  })

  it('should ignore modifications', async () => {
    // Note: removing the mapping alone should be block by a separate change validator.
    const inputChanges = new Map([
      ['app', toChange({ before: app, after: app })],
      ['mappingA', toChange({ before: profileMappingA })],
    ])
    dependencyChanges = [...(await removeProfileMappingAfterDeps(inputChanges, new Map()))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
