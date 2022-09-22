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
import { ZENDESK } from '../../src/constants'
import { nonDefaultBrandElementsValidator } from '../../src/change_validators/non_default_brand_elements'

describe('nonDefaultBrandElementsValidator', () => {
  const articleType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'article'),
  })
  const guideInstance = new InstanceElement(
    'New Article',
    articleType,
    { name: 'article' },
  )
  const groupType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'group'),
  })
  const nonGuideInstance = new InstanceElement(
    'New Group',
    groupType,
    { name: 'bestGroupEver' },
  )
  it('should return an error when deploying changes for a Zendesk Guide type instance', async () => {
    const errors = await nonDefaultBrandElementsValidator(
      [toChange({ after: guideInstance })],
    )
    expect(errors).toEqual([{
      elemID: guideInstance.elemID,
      severity: 'Error',
      message: 'Deploying of non-primary brand elements is not supported.',
      detailedMessage: `Element ${guideInstance.elemID.getFullName()} which related to the brand ${guideInstance.value.brand_id} cannot be deployed.`,
    }])
  })
  it('should not return an error when deploying changes for a non-Zendesk Guide type instance', async () => {
    const errors = await nonDefaultBrandElementsValidator(
      [toChange({ after: nonGuideInstance })],
    )
    expect(errors).toHaveLength(0)
  })
})
