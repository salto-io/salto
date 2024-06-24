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
import { ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createFilterCreatorParams } from '../utils'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/deploy_branded_guide_types'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('deployBrandedGuideTypes filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const brandInstnace = new InstanceElement('BrandTest', new ObjectType({ elemID: new ElemID(ZENDESK, 'brand') }), {
    id: 1337,
    subdomain: 'bestBrand',
  })
  const articleInstance = new InstanceElement('Article', new ObjectType({ elemID: new ElemID(ZENDESK, 'article') }), {
    id: 2,
    author_id: 'its.me@mar.io',
    comments_disabled: false,
    draft: true,
    promoted: false,
    position: 0,
    name: 'ArticleName',
    title: 'Artitle',
    brand: new ReferenceExpression(brandInstnace.elemID, brandInstnace),
  })
  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('deploy', () => {
    it('should pass the correct params to deployChange on create', async () => {
      const id = 2
      const clonedArticle = articleInstance.clone()
      mockDeployChange.mockImplementation(async () => ({ article: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedArticle } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedArticle } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['brand'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: articleInstance } }])
    })
    it('should pass the correct params to deployChange on update', async () => {
      const id = 2
      const clonedArticleBefore = articleInstance.clone()
      const clonedArticleAfter = articleInstance.clone()
      clonedArticleBefore.value.id = id
      clonedArticleAfter.value.id = id
      clonedArticleAfter.value.draft = false
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedArticleBefore, after: clonedArticleAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedArticleBefore, after: clonedArticleAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['brand'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedArticleBefore, after: clonedArticleAfter },
        },
      ])
    })
    it('should ignore non guide branded types', async () => {
      const nonGuideInstance = new InstanceElement(
        'nonGuide',
        new ObjectType({ elemID: new ElemID(ZENDESK, 'anotherType') }),
        {
          id: 1337,
          subdomain: 'bestBrand',
        },
      )
      const id = 2
      const clonedInstBefore = nonGuideInstance.clone()
      const clonedInstAfter = nonGuideInstance.clone()
      clonedInstBefore.value.id = id
      clonedInstAfter.value.id = id
      clonedInstAfter.value.draft = false
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedInstBefore, after: clonedInstAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
    })
  })
})
