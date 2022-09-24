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
  const guideInstanceWithBrand = new InstanceElement(
    'New Article',
    articleType,
    { name: 'article', brand_id: new ReferenceExpression(brandInstance.elemID, brandInstance) },
  )
  const guideInstanceWithoutBrand = new InstanceElement(
    'New Article',
    articleType,
    { name: 'article' },
  )
  it('should return an error when deploying changes for a Zendesk Guide type instance without a brand_id field', async () => {
    const errors = await zendeskGuideElementsDeploymentValidator(
      [toChange({ after: guideInstanceWithoutBrand })],
    )
    expect(errors).toEqual([{
      elemID: guideInstanceWithoutBrand.elemID,
      severity: 'Error',
      message: `Element ${guideInstanceWithoutBrand.elemID.getFullName()} cannot be deployed.`,
      detailedMessage: `Element ${guideInstanceWithoutBrand.elemID.getFullName()} is a Zendesk Guide element which isn't related to a brand, and therefore cannot be deployed.`,
    }])
  })
  it('should not return an error when deploying changes for a Zendesk Guide type instance with a brand_id field', async () => {
    const errors = await zendeskGuideElementsDeploymentValidator(
      [toChange({ after: guideInstanceWithBrand })],
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when deploying changes for a non-Zendesk Guide type instance', async () => {
    const errors = await zendeskGuideElementsDeploymentValidator(
      [toChange({ after: brandInstance })],
    )
    expect(errors).toHaveLength(0)
  })
})
