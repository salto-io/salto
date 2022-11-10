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
import {
  ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS, ReferenceExpression, toChange,
  getChangeData,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { createFilterCreatorParams } from '../utils'
import ZendeskClient from '../../src/client/client'
import { ARTICLE_TYPE_NAME, USER_SEGMENT_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator, { createEveryoneUserSegmentInstance } from '../../src/filters/article'

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

describe('article filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy' | 'onDeploy'>
  let filter: FilterType
  let everyoneUserSegmentInstance: InstanceElement
  const userSegmentInstance = new InstanceElement(
    'notEveryone',
    new ObjectType({ elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME) }),
    {
      user_type: 'Everyone',
      built_in: true,
      name: 'Everyone',
    }
  )
  const articleInstance = new InstanceElement(
    'testArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      author_id: 'author@salto.io',
      comments_disabled: false,
      draft: false,
      promoted: false,
      position: 0,
      section_id: '12345',
      source_locale: 'en-us',
      locale: 'en-us',
      outdated: false,
      permission_group_id: '666',
      brand: '1',
    }
  )
  const anotherArticleInstance = new InstanceElement(
    'userSegmentArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      author_id: 'author@salto.io',
      comments_disabled: false,
      draft: false,
      promoted: false,
      position: 0,
      section_id: '12345',
      source_locale: 'en-us',
      locale: 'en-us',
      outdated: false,
      permission_group_id: '666',
      brand: '1',
      user_segment_id: new ReferenceExpression(userSegmentInstance.elemID, userSegmentInstance),
    }
  )
  const articleTranslationInstance = new InstanceElement(
    'testArticleTranslation',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'article_translation') }),
    {
      locale: { id: 'en-us' },
      title: 'The title of the article',
      draft: false,
      brand: '1',
      body: '<p>ppppp</p>',
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]:
        [new ReferenceExpression(articleInstance.elemID, articleInstance)] },
  )
  articleInstance.value.translations = [
    new ReferenceExpression(articleTranslationInstance.elemID, articleTranslationInstance),
  ]

  const generateElements = (): (InstanceElement | ObjectType)[] => ([
    articleInstance, anotherArticleInstance, userSegmentInstance,
  ]).map(element => element.clone())

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'brandWithHC' },
    })
    everyoneUserSegmentInstance = createEveryoneUserSegmentInstance(
      new ObjectType({ elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME) }),
    )
    const elementsSource = buildElementsSourceFromElements([everyoneUserSegmentInstance])
    filter = filterCreator(createFilterCreatorParams({ client, elementsSource })) as FilterType
  })


  describe('onFetch', () => {
    let elements: (InstanceElement | ObjectType)[]

    beforeAll(() => {
      elements = generateElements()
    })

    it('should add Everyone user_segment', async () => {
      await filter.onFetch(elements)
      const fetchedArticle = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'testArticle')
      expect(fetchedArticle?.value).toEqual({
        ...articleInstance.value,
        user_segment_id: new ReferenceExpression(
          everyoneUserSegmentInstance.elemID,
          everyoneUserSegmentInstance
        ),
      })
    })
    it('should not edit existing user_segment', async () => {
      await filter.onFetch(elements)
      const fetchedArticle = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'userSegmentArticle')
      expect(fetchedArticle?.value).toEqual(anotherArticleInstance.value)
    })
  })

  describe('preDeploy', () => {
    it('should add the title and the body to the article instance from its translation', async () => {
      const clonedArticle = articleInstance.clone()
      const clonedTranslation = articleTranslationInstance.clone()
      const articleAddition = toChange({ after: clonedArticle })
      const TranslationAddition = toChange({ after: clonedTranslation })

      expect(clonedArticle.value.title).toBeUndefined()
      expect(clonedArticle.value.body).toBeUndefined()
      await filter.preDeploy([
        articleAddition,
        TranslationAddition,
      ])
      const filteredArticle = getChangeData(articleAddition)
      expect(filteredArticle.value.title).toBe('The title of the article')
      expect(filteredArticle.value.body).toBe('<p>ppppp</p>')
      expect(getChangeData(TranslationAddition)).toBe(clonedTranslation)
    })
  })

  describe('deploy', () => {
    it('should pass the correct params to deployChange on create', async () => {
      const id = 2
      mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: articleInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: articleInstance } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([{ action: 'add', data: { after: articleInstance } }])
    })

    it('should pass the correct params to deployChange on update', async () => {
      const id = 2
      const clonedArticleBefore = articleInstance.clone()
      const clonedArticleAfter = articleInstance.clone()
      clonedArticleBefore.value.id = id
      clonedArticleAfter.value.id = id
      clonedArticleAfter.value.title = 'newTitle!'
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter
        .deploy([{ action: 'modify', data: { before: clonedArticleBefore, after: clonedArticleAfter } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedArticleBefore, after: clonedArticleAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([
          {
            action: 'modify',
            data: { before: clonedArticleBefore, after: clonedArticleAfter },
          },
        ])
    })

    it('should pass the correct params to deployChange on remove', async () => {
      const id = 2
      const clonedArticle = articleInstance.clone()
      clonedArticle.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: clonedArticle } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if deployChange failed', async () => {
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: articleInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: articleInstance } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })

  describe('onDeploy', () => {
    it('should omit the title and the body from the article instance', async () => {
      const clonedArticle = articleInstance.clone()
      const clonedTranslation = articleTranslationInstance.clone()
      const articleAddition = toChange({ after: clonedArticle })
      const TranslationAddition = toChange({ after: clonedTranslation })

      clonedArticle.value.title = 'title'
      clonedArticle.value.body = 'body'
      await filter.onDeploy([
        articleAddition,
        TranslationAddition,
      ])
      const filteredArticle = getChangeData(articleAddition)
      expect(filteredArticle.value.title).toBeUndefined()
      expect(filteredArticle.value.body).toBeUndefined()
      expect(getChangeData(TranslationAddition)).toBe(clonedTranslation)
    })
  })
})
