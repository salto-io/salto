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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  AdapterOperations,
  Change,
  DeployResult,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ProgressReporter,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { credentialsType } from '../src/auth'
import { DEFAULT_CONFIG } from '../src/config'
import { ADAPTER_NAME, BLOG_POST_TYPE_NAME, PAGE_TYPE_NAME, SPACE_TYPE_NAME } from '../src/constants'
import fetchMockReplies from './fetch_mock_replies.json'
import deployMockReplies from './deploy_mock_replies.json'

const nullProgressReporter: ProgressReporter = {
  reportProgress: () => '',
}

type MockReply = {
  url: string
  method: definitions.HTTPMethod
  params?: Record<string, string>
  response: unknown
}

const getMockFunction = (method: definitions.HTTPMethod, mockAxiosAdapter: MockAdapter): MockAdapter['onAny'] => {
  switch (method.toLowerCase()) {
    case 'get':
      return mockAxiosAdapter.onGet
    case 'put':
      return mockAxiosAdapter.onPut
    case 'post':
      return mockAxiosAdapter.onPost
    case 'patch':
      return mockAxiosAdapter.onPatch
    case 'delete':
      return mockAxiosAdapter.onDelete
    case 'head':
      return mockAxiosAdapter.onHead
    case 'options':
      return mockAxiosAdapter.onOptions
    default:
      return mockAxiosAdapter.onGet
  }
}

describe('adapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet('/wiki/rest/api/space').replyOnce(200)
    ;([...fetchMockReplies, ...deployMockReplies] as MockReply[]).forEach(({ url, method, params, response }) => {
      const mock = getMockFunction(method, mockAxiosAdapter).bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      handler.replyOnce(200, response)
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    describe('full', () => {
      it('should generate the right elements on fetch', async () => {
        expect(adapter.configType).toBeDefined()
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', credentialsType, {
              email: 'user',
              token: 'pass',
              subdomain: 'subdomain',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          BLOG_POST_TYPE_NAME,
          PAGE_TYPE_NAME,
          SPACE_TYPE_NAME,
        ])
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'confluence.blog_post',
          'confluence.blog_post.instance.65539_Hey__I_m_am_a_first_blog_post@ulstsssss',
          'confluence.blog_post.instance.Omri_Farkash_This_is_My_super_blog@sussss',
          'confluence.blog_post__body',
          'confluence.blog_post__version',
          'confluence.global_template',
          'confluence.page',
          'confluence.page.instance.Omri_Farkash_Getting_started_in_Confluence@susss',
          'confluence.page.instance.Omri_Farkash_Overview@su',
          'confluence.page.instance.Omri_Farkash_This_is_my_page_yay@sussss',
          'confluence.page__body',
          'confluence.page__restriction',
          'confluence.page__restriction__restrictions',
          'confluence.page__version',
          'confluence.space',
          'confluence.space.instance.My_first_space@s',
          'confluence.space.instance.Omri_Farkash@s',
          'confluence.space__permissionInternalIdMap',
          'confluence.space__permissions',
        ])
        expect(
          Object.fromEntries(
            elements
              .filter(isInstanceElement)
              .filter(e => e.elemID.typeName === 'page')
              .map(e => [e.elemID.name, e.path]),
          ),
        ).toEqual({
          'Omri_Farkash_Overview@su': [
            'confluence',
            'Records',
            'space',
            'Omri_Farkash',
            'pages',
            'Overview',
            'Overview',
          ],
          'Omri_Farkash_This_is_my_page_yay@sussss': [
            'confluence',
            'Records',
            'space',
            'Omri_Farkash',
            'pages',
            'Overview',
            'This_is_my_page_yay',
            'This_is_my_page_yay',
          ],
          'Omri_Farkash_Getting_started_in_Confluence@susss': [
            'confluence',
            'Records',
            'space',
            'Omri_Farkash',
            'pages',
            'Overview',
            'This_is_my_page_yay',
            'Getting_started_in_Confluence',
            'Getting_started_in_Confluence',
          ],
        })
        expect(
          elements
            .filter(isInstanceElement)
            .find(
              e => e.elemID.getFullName() === 'confluence.blog_post.instance.Omri_Farkash_This_is_My_super_blog@sussss',
            )?.value,
        ).toEqual({
          authorId: 'mockId22',
          createdAt: '2024-03-20T10:30:12.473Z',
          id: '22',
          spaceId: expect.any(ReferenceExpression),
          status: 'current',
          title: 'This is My super blog',
          version: {
            authorId: 'mockId22',
            createdAt: '2024-03-20T10:30:12.815Z',
            message: '',
            minorEdit: false,
            number: 1,
          },
        })
      })
    })
  })
  describe('deploy', () => {
    let operations: AdapterOperations
    let spaceType: ObjectType
    let pageType: ObjectType
    let space1: InstanceElement
    let page1: InstanceElement
    let page2: InstanceElement

    beforeEach(() => {
      spaceType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'space') })
      pageType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'page') })
      // globalTemplateType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'global_template') })
      space1 = new InstanceElement('space1', spaceType, { name: 'space1', key: 'spaceKey', id: 11 })
      page1 = new InstanceElement('My_page@s', pageType, {
        title: 'My page',
        id: '22',
        spaceId: new ReferenceExpression(space1.elemID),
      })
      page2 = new InstanceElement('page2', pageType, {
        title: 'page2',
        id: '33',
        spaceId: new ReferenceExpression(space1.elemID),
      })

      operations = adapter.operations({
        credentials: new InstanceElement('config', credentialsType, {
          email: 'user123',
          token: 'pwd456',
          subdomain: 'subdomain',
        }),
        config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
        elementsSource: buildElementsSourceFromElements([spaceType, pageType, space1, page1, page2]),
      })
    })

    it('should return the applied changes', async () => {
      const results: DeployResult[] = []
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'page',
            changes: [
              toChange({ after: new InstanceElement('new_page@s', pageType, { title: 'new page', id: '1212' }) }),
            ],
          },
          progressReporter: nullProgressReporter,
        }),
      )
      const updatedSpace1 = space1.clone()
      updatedSpace1.value.name = 'new name'
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: SPACE_TYPE_NAME,
            changes: [
              toChange({
                before: space1,
                after: updatedSpace1,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: PAGE_TYPE_NAME,
            changes: [
              toChange({
                before: page2,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      expect(results.map(res => res.appliedChanges.length)).toEqual([1, 1, 1])
      expect(results.map(res => res.errors.length)).toEqual([0, 0, 0])
      const addRes = results[0].appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(addRes).value.id).toEqual('12345')
    })
  })
})
