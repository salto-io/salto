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
import { everyoneUserSegmentValidator } from '../../src/change_validators/everyone_user_segment'
import { EVERYONE_USER_SEGMENT_INSTANCE } from '../../src/filters/article'

describe('everyoneUserSegmentValidator', () => {
  const userSegmentType = new ObjectType({
    elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME),
  })
  const userSegmentInstance = new InstanceElement(
    'justATypicalUserSegment',
    userSegmentType,
    {
      user_type: 'userType',
      built_in: true,
      name: 'name',
    }
  )
  it('should return an error if everyone user_segment has been modified', async () => {
    const clonedAfterUserSegment = EVERYONE_USER_SEGMENT_INSTANCE.clone()
    clonedAfterUserSegment.value.name = 'notEveryoneAnymore'
    const errors = await everyoneUserSegmentValidator(
      [toChange({ before: EVERYONE_USER_SEGMENT_INSTANCE, after: clonedAfterUserSegment })],
    )
    expect(errors).toEqual([{
      elemID: EVERYONE_USER_SEGMENT_INSTANCE.elemID,
      severity: 'Error',
      message: 'Everyone user segment failed to change',
      detailedMessage: 'Everyone user_segment is a fixed instance, and cannot be changed',
    }])
  })
  it('should return an error if everyone user_segment has been removed', async () => {
    const errors = await everyoneUserSegmentValidator(
      [toChange({ before: EVERYONE_USER_SEGMENT_INSTANCE })],
    )
    expect(errors).toEqual([{
      elemID: EVERYONE_USER_SEGMENT_INSTANCE.elemID,
      severity: 'Error',
      message: 'Everyone user segment failed to change',
      detailedMessage: 'Everyone user_segment is a fixed instance, and cannot be changed',
    }])
  })
  it('should not return an error if other user_segment has been changed', async () => {
    const clonedBeforeUserSegment = userSegmentInstance.clone()
    const clonedAfterUserSegment = userSegmentInstance.clone()
    clonedAfterUserSegment.value.name = 'editedName'
    const errors = await everyoneUserSegmentValidator(
      [toChange({ before: clonedBeforeUserSegment, after: clonedAfterUserSegment })],
    )
    expect(errors).toHaveLength(0)
  })
})
