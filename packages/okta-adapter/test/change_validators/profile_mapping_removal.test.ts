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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { profileMappingRemovalValidator } from '../../src/change_validators/profile_mapping_removal'
import {
  OKTA,
  APPLICATION_TYPE_NAME,
  IDENTITY_PROVIDER_TYPE_NAME,
  PROFILE_MAPPING_TYPE_NAME,
  USERTYPE_TYPE_NAME,
} from '../../src/constants'

describe('profileMappingRemovalValidator', () => {
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const identityProviderType = new ObjectType({ elemID: new ElemID(OKTA, IDENTITY_PROVIDER_TYPE_NAME) })
  const profileMappingType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_MAPPING_TYPE_NAME) })
  const userTypeType = new ObjectType({ elemID: new ElemID(OKTA, USERTYPE_TYPE_NAME) })

  const app = new InstanceElement('app', appType, { name: 'A', default: false })
  const identityProvider = new InstanceElement('idp', identityProviderType, { name: 'B', default: false })
  const userType = new InstanceElement('user type', userTypeType, { name: 'C', default: false })

  const profileMappingA = new InstanceElement('mappingA', profileMappingType, {
    source: new ReferenceExpression(app.elemID, app),
    target: new ReferenceExpression(userType.elemID, userType),
  })

  const profileMappingB = new InstanceElement('mappingB', profileMappingType, {
    source: new ReferenceExpression(userType.elemID, userType),
    target: new ReferenceExpression(identityProvider.elemID, identityProvider),
  })

  it('should return an error when ProfileMapping is deleted without its parent Application', async () => {
    const changeErrors = await profileMappingRemovalValidator([
      toChange({ before: profileMappingA }),
      toChange({ before: profileMappingB }),
    ])
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: profileMappingA.elemID,
        severity: 'Error',
        message: 'Cannot remove profile mapping if neither its source nor target are also removed',
        detailedMessage:
          'In order to remove mappingA, either its source (instance app of type Application) or target (instance user type of type UserType) must be removed as well.',
      },
      {
        elemID: profileMappingB.elemID,
        severity: 'Error',
        message: 'Cannot remove profile mapping if neither its source nor target are also removed',
        detailedMessage:
          'In order to remove mappingB, either its source (instance user type of type UserType) or target (instance idp of type IdentityProvider) must be removed as well.',
      },
    ])
  })
  it('should not return an error when ProfileMapping is deleted with its source', async () => {
    const changeErrors = await profileMappingRemovalValidator([
      toChange({ before: profileMappingA }),
      toChange({ before: app }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return an error when ProfileMapping is deleted with its target', async () => {
    const changeErrors = await profileMappingRemovalValidator([
      toChange({ before: profileMappingA }),
      toChange({ before: userType }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
