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
import { ElemID, InstanceElement, ObjectType, toChange, ReferenceExpression } from '@salto-io/adapter-api'
import { ZENDESK, BRAND_TYPE_NAME } from '../../src/constants'
import { zendeskGuideElementsDeploymentValidator } from '../../src/change_validators/zendesk_guide_elements_deployment'

describe('zendeskGuideElementsDeploymentValidator', () => {
  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })
  const brandInstance = new InstanceElement(
    'testBrand',
    brandType,
    { name: 'test', subdomain: 'subdomain_test' },
  )
  const articleType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'article'),
  })
  const guideInstance = new InstanceElement(
    'New Article',
    articleType,
    { name: 'article', brand_id: new ReferenceExpression(brandInstance.elemID, brandInstance) },
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
    const errors = await zendeskGuideElementsDeploymentValidator(
      [toChange({ after: guideInstance })],
    )
    expect(errors).toEqual([{
      elemID: guideInstance.elemID,
      severity: 'Error',
      message: 'Deployment of Zendesk Guide elements is not supported.',
      detailedMessage: `Element ${guideInstance.elemID.getFullName()} which related to the brand zendesk.brand.instance.testBrand cannot be deployed.`,
    }])
  })
  it('should not return an error when deploying changes for a non-Zendesk Guide type instance', async () => {
    const errors = await zendeskGuideElementsDeploymentValidator(
      [toChange({ after: nonGuideInstance })],
    )
    expect(errors).toHaveLength(0)
  })
})
