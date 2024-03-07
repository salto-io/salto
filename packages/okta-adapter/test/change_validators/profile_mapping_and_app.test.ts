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
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { profileMappingAndAppValidator } from '../../src/change_validators/profile_mapping_and_app'
import { OKTA, APPLICATION_TYPE_NAME, PROFILE_MAPPING_TYPE_NAME } from '../../src/constants'

describe('appAndmappingValidator', () => {
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const profileMappingType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_MAPPING_TYPE_NAME) })
  const appA = new InstanceElement('appA', appType, { name: 'A', default: false })
  const appB = new InstanceElement('appB', appType, { name: 'B', default: false })
  const profileMappingA = new InstanceElement('mappingA', profileMappingType, { name: 'A', definitions: {} }, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appA.elemID, appA)],
  })
  const profileMappingB = new InstanceElement('mappingB', profileMappingType, { name: 'B', definitions: {} }, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appB.elemID, appB)],
  })

  it('should return an error when ProfileMapping is deleted without its parent Application', async () => {
    const changeErrors = await profileMappingAndAppValidator([
      toChange({ before: profileMappingA }),
      toChange({ before: profileMappingB }),
    ])
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: profileMappingA.elemID,
        severity: 'Error',
        message: 'Cannot remove profile mapping without its parent application',
        detailedMessage: 'In order to remove mappingA, the instance appA of type Application must be removed as well.',
      },
      {
        elemID: profileMappingB.elemID,
        severity: 'Error',
        message: 'Cannot remove profile mapping without its parent application',
        detailedMessage: 'In order to remove mappingB, the instance appB of type Application must be removed as well.',
      },
    ])
  })
  it('should not return an error when ProfileMapping is deleted with its parent Application', async () => {
    const changeErrors = await profileMappingAndAppValidator([
      toChange({ before: profileMappingA }),
      toChange({ before: appA }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
