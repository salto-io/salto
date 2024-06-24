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
import _ from 'lodash'
import { ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { OKTA, PROFILE_ENROLLMENT_RULE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../../src/constants'
import profileEnrollmentAttributeFilter from '../../src/filters/profile_enrollment_attributes'
import { getFilterParams } from '../utils'

describe('profileEnrollmentAttributeFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  const schemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })
  const profileEnrollType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_ENROLLMENT_RULE_TYPE_NAME) })

  const schemaInst = new InstanceElement('user', schemaType, {
    name: 'user',
    definitions: {
      custom: {
        properties: {
          saltoDepartment: {
            title: 'salto',
            type: 'string',
          },
        },
      },
      base: {
        properties: {
          department: {
            title: 'Department',
            type: 'string',
          },
        },
      },
    },
  })
  const departmentRef = new ReferenceExpression(
    schemaInst.elemID.createNestedID('definitions', 'base', 'properties', 'department'),
    _.get(schemaInst.value, ['definitions', 'base', 'properties', 'department']),
  )
  const saltoDepRef = new ReferenceExpression(
    schemaInst.elemID.createNestedID('definitions', 'custom', 'properties', 'saltoDepartment'),
    _.get(schemaInst.value, ['definitions', 'custom', 'properties', 'saltoDepartment']),
  )
  const profileInst = new InstanceElement('profile', profileEnrollType, {
    name: 'someRule',
    actions: {
      profileEnrollment: {
        profileAttributes: [
          { name: 'saltoDepartment', label: 'salto' },
          { name: 'department', label: 'salto' },
        ],
      },
    },
  })
  beforeEach(() => {
    filter = profileEnrollmentAttributeFilter(getFilterParams()) as typeof filter
  })

  describe('onFetch', () => {
    it('should replace profile enrollment attributes with references to user schema attributes', async () => {
      const profile = profileInst.clone()
      await filter.onFetch?.([schemaInst, schemaType, profileEnrollType, profile])
      const atts = profile.value.actions?.profileEnrollment?.profileAttributes
      expect(atts).toEqual([
        { name: saltoDepRef, label: 'salto' },
        { name: departmentRef, label: 'salto' },
      ])
    })
    it('should skip the filter for a rule with no profile attributes', async () => {
      const profileNoAtt = new InstanceElement('missing', profileEnrollType, {
        name: 'someRule',
        actions: {
          profileEnrollment: {
            targetGroupIds: ['123', '234'],
            unknownUserAction: 'DENY',
          },
        },
      })
      await filter.onFetch?.([schemaInst, schemaType, profileEnrollType, profileNoAtt])
      expect(profileNoAtt.value).toEqual({
        name: 'someRule',
        actions: {
          profileEnrollment: {
            targetGroupIds: ['123', '234'],
            unknownUserAction: 'DENY',
          },
        },
      })
    })
  })
})
