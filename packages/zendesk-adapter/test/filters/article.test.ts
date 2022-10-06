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
  ObjectType, ElemID, InstanceElement, ReferenceExpression, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/article'

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
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const brand = new InstanceElement(
    'myBrand',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'brand') }),
    { name: 'myBrand' },
  )
  const translation = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'article_translation') }),
    {
      name: 'Test',
      title: 'Test',
      body: 'Test text',
      brand_id: new ReferenceExpression(brand.elemID, brand),
      locale: 'en-us',
    }
  )
  const article = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'article') }),
    {
      name: 'Test',
      title: 'Test',
      body: 'Test text',
      brand_id: new ReferenceExpression(brand.elemID, brand),
      translations: [new ReferenceExpression(translation.elemID, translation)],
    }
  )
  translation.annotations[CORE_ANNOTATIONS.PARENT] = [article]

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        ...DEFAULT_CONFIG,
        [FETCH_CONFIG]: {
          ...DEFAULT_CONFIG[FETCH_CONFIG],
          enableGuide: true,
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  it('should pass the correct params to deployChange and client on create', async () => {
    const id = 2
    const clonedArticle = article.clone()
    mockDeployChange.mockImplementation(async () => ({ article: { id } }))
    const res = await filter.deploy([{ action: 'add', data: { after: clonedArticle } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'add', data: { after: clonedArticle } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['translations'],
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([{ action: 'add', data: { after: clonedArticle } }])
  })
  it('should pass the correct params to deployChange and client on modify', async () => {
    const id = 2
    const clonedBeforeArticle = article.clone()
    const clonedAfterArticle = article.clone()
    delete clonedBeforeArticle.value.intervals
    clonedAfterArticle.value.timezone = 'Alaska'
    clonedBeforeArticle.value.id = id
    clonedAfterArticle.value.id = id
    mockDeployChange.mockImplementation(async () => ({ article: { id } }))
    const res = await filter.deploy(
      [{ action: 'modify', data: { before: clonedBeforeArticle, after: clonedAfterArticle } }]
    )
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'modify', data: { before: clonedBeforeArticle, after: clonedAfterArticle } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['translations'],
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([
        { action: 'modify', data: { before: clonedBeforeArticle, after: clonedAfterArticle } },
      ])
  })
  it('should pass the correct params to deployChange and client on remove', async () => {
    const id = 2
    const clonedArticle = article.clone()
    clonedArticle.value.id = id
    mockDeployChange.mockImplementation(async () => ({ article: { id } }))
    const res = await filter.deploy([{ action: 'remove', data: { before: clonedArticle } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'remove', data: { before: clonedArticle } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['translations'],
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([{ action: 'remove', data: { before: clonedArticle } }])
  })
  it('should return error if deployChange failed', async () => {
    const clonedArticle = article.clone()
    mockDeployChange.mockImplementation(async () => { throw new Error('err') })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedArticle } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'add', data: { after: clonedArticle } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['translations'],
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
})
