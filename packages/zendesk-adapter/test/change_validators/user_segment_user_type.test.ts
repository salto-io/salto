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
import { USER_SEGMENT_TYPE_NAME, ZENDESK } from '../../src/constants'
import { userSegmentUserTypeValidator } from '../../src/change_validators'
import { VALID_USER_TYPE } from '../../src/change_validators/user_segment_user_type'

describe('userSegmentUserTypeValidator', () => {
  const userSegmentType = new ObjectType({
    elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME),
  })
  it('should return an error when user_type is not valid', async () => {
    const invalidUserSegment = new InstanceElement(
      'invalid',
      userSegmentType,
      {
        user_type: 'invalid',
        built_in: true,
        name: 'Agents and admins',
      }
    )
    const errors = await userSegmentUserTypeValidator(
      [toChange({ after: invalidUserSegment })]
    )
    expect(errors).toEqual([{
      elemID: invalidUserSegment.elemID,
      severity: 'Error',
      message: `Invalid value for user_type in ${invalidUserSegment.elemID.getFullName()}`,
      detailedMessage: `Invalid value for user_type in ${invalidUserSegment.elemID.getFullName()}. The user_type attribute must take one of the following values: ${VALID_USER_TYPE}`,
    }])
  })
  it('should not return an error when user_type is valid', async () => {
    const validUserSegment = new InstanceElement(
      'invalid',
      userSegmentType,
      {
        user_type: 'staff',
        built_in: true,
        name: 'Agents and admins',
      }
    )
    const errors = await userSegmentUserTypeValidator(
      [toChange({ after: validUserSegment })]
    )
    expect(errors).toHaveLength(0)
  })
})
