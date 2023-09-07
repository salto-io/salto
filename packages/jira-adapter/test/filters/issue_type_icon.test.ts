/*
*                      Copyright 2023 Salto Labs Ltd.
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

// import { MockInterface } from '@salto-io/test-utils/src/mock'
import { filterUtils } from '@salto-io/adapter-components'
import { ObjectType, InstanceElement, ElemID, Element, isInstanceElement, StaticFile, CORE_ANNOTATIONS, ReferenceExpression } from '@salto-io/adapter-api'
import { getFilterParams, mockClient } from '../utils'
import JiraClient from '../../src/client/client'
import issueTypeIconFilter from '../../src/filters/issue_type_icon'
import { ISSUE_TYPE_ICON_NAME, JIRA } from '../../src/constants'

describe('issue type icon filter', () => {
  let client: JiraClient
  let mockGet: jest.SpyInstance
  const mockCli = mockClient()
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType
  let elements: Element[]
  const issueTypeType = new ObjectType({ elemID: new ElemID(JIRA, 'IssueType') })
  let issueTypeInstance: InstanceElement
  const content = Buffer.from('test')

  beforeEach(async () => {
    client = mockCli.client
    filter = issueTypeIconFilter(getFilterParams({ client })) as typeof filter
    issueTypeInstance = new InstanceElement(
      'issueType1',
      issueTypeType,
      {
        id: '100',
        name: 'OwnerTest',
        avatarId: 101,
      }
    )
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      elements = [issueTypeType, issueTypeInstance]
      mockGet = jest.spyOn(client, 'getSinglePage')
    })

    it('should add issue type icon to elements', async () => {
      mockGet.mockImplementationOnce(params => {
        if (params.url === '/rest/api/3/universal_avatar/view/type/issuetype/avatar/101?format=png') {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
      await filter.onFetch(elements)
      const iconInstanse = elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_TYPE_ICON_NAME)
      expect(elements).toHaveLength(4)
      expect(iconInstanse).toBeDefined()
      expect(iconInstanse?.value).toEqual(
        {
          contentType: 'png',
          fileName: 'issueType1Icon.png',
          id: 101,
          content: new StaticFile({
            filepath: 'jira/IssueTypeIcon/issueType1Icon.png', encoding: 'binary', content,
          }),
        }
      )
    })
    it('should not add issue layout if it is a bad response', async () => {
      mockGet.mockClear()
      mockGet.mockImplementation(() => ({
        status: 200,
        data: {
        },
      }))
      await filter.onFetch(elements)
      const iconInstanse = elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_TYPE_ICON_NAME)
      expect(iconInstanse).toBeUndefined()
    })
    it('should not add issue layoutif error has been thrown from client', async () => {
      mockGet.mockClear()
      mockGet.mockImplementation(() => {
        throw new Error('Error')
      })
      await filter.onFetch(elements)
      const iconInstanse = elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_TYPE_ICON_NAME)
      expect(iconInstanse).toBeUndefined()
    })
  })
  describe('deploy', () => {
    const issueTypeIconType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_ICON_NAME) })
    let issueTypeIconInstance: InstanceElement
    beforeEach(async () => {
      issueTypeIconInstance = new InstanceElement(
        'issueType1Icon',
        issueTypeIconType,
        {
          id: '11',
          fileName: 'issueType1Icon.png',
          contentType: 'png',
          content: new StaticFile({
            filepath: 'jira/IssueTypeIcon/issueType1Icon.png', encoding: 'binary', content,
          }),
        }
      )
      issueTypeIconInstance.annotate({
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(issueTypeIconInstance.elemID, issueTypeIconInstance)],
      })
    })
    it('should add issue type icon to elements', async () => {
      const res = await filter.deploy([
        { action: 'add', data: { after: issueTypeIconInstance } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
    it('should modify logo instances', async () => {
      const afterIconInstance = issueTypeIconInstance.clone()
      issueTypeIconInstance.value.content = new StaticFile({
        filepath: 'jira/IssueTypeIcon/changed.png',
        encoding: 'binary',
        content: Buffer.from('changes!'),
      })
      const res = await filter.deploy([
        { action: 'modify', data: { before: issueTypeIconInstance, after: afterIconInstance } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'modify', data: { before: issueTypeIconInstance, after: afterIconInstance } }
      )
    })
  })
})
