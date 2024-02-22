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
import {
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { JIRA } from '../../src/constants'
import { getFilterParams, mockClient } from '../utils'
import issueTypeScreenSchemeFilter from '../../src/filters/issue_type_screen_scheme'
import { Filter } from '../../src/filter'
import JiraClient from '../../src/client/client'
import { getDefaultConfig } from '../../src/config/config'

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

describe('issueTypeScreenScheme', () => {
  let issueTypeScreenSchemeType: ObjectType
  let issueTypeScreenSchemeItemType: ObjectType
  let filter: Filter
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  beforeEach(async () => {
    const { client: cli, paginator, connection } = mockClient()
    client = cli
    mockConnection = connection

    filter = issueTypeScreenSchemeFilter(
      getFilterParams({
        client,
        paginator,
      }),
    )
    issueTypeScreenSchemeItemType = new ObjectType({
      elemID: new ElemID(JIRA, 'IssueTypeScreenSchemeItem'),
      fields: {
        issueTypeId: { refType: BuiltinTypes.STRING },
        screenSchemeId: { refType: BuiltinTypes.STRING },
      },
    })
    issueTypeScreenSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'IssueTypeScreenScheme'),
      fields: {
        issueTypeMappings: { refType: new ListType(issueTypeScreenSchemeItemType) },
      },
    })
  })

  describe('onFetch', () => {
    it('add the deployment annotation to issueTypeMappings', async () => {
      await filter.onFetch?.([issueTypeScreenSchemeType])
      expect(issueTypeScreenSchemeType.fields.issueTypeMappings.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('add the deployment annotation to issueTypeScreenSchemeItemType', async () => {
      await filter.onFetch?.([issueTypeScreenSchemeItemType])
      expect(issueTypeScreenSchemeItemType.fields.issueTypeId.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
      expect(issueTypeScreenSchemeItemType.fields.screenSchemeId.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
  })

  describe('deploy', () => {
    it('should return irrelevant changes in leftoverChanges', async () => {
      const res = await filter.deploy?.([
        toChange({ after: issueTypeScreenSchemeType }),
        toChange({ after: new InstanceElement('instance1', issueTypeScreenSchemeType) }),
        toChange({
          before: new InstanceElement('instance2', new ObjectType({ elemID: new ElemID(JIRA, 'someType') })),
          after: new InstanceElement('instance2', new ObjectType({ elemID: new ElemID(JIRA, 'someType') })),
        }),
      ])
      expect(res?.leftoverChanges).toHaveLength(3)
      expect(res?.deployResult).toEqual({ appliedChanges: [], errors: [] })
    })

    describe('When deploying a change', () => {
      const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>
      let change: Change<InstanceElement>

      beforeEach(async () => {
        const beforeInstance = new InstanceElement('instance', issueTypeScreenSchemeType, {
          name: 'name1',
          id: 'id',
          issueTypeMappings: [
            { issueTypeId: 'default', screenSchemeId: 'screenSchemeDefaultId' },
            { issueTypeId: 'issueTypeId1', screenSchemeId: 'screenSchemeId1' },
            { issueTypeId: 'issueTypeId2', screenSchemeId: 'screenSchemeId2' },
          ],
        })

        const afterInstance = new InstanceElement('instance', issueTypeScreenSchemeType, {
          name: 'name2',
          id: 'id',
          issueTypeMappings: [
            { issueTypeId: 'default', screenSchemeId: 'screenSchemeDefaultId2' },
            { issueTypeId: 'issueTypeId1', screenSchemeId: 'screenSchemeId12' },
            { issueTypeId: 'issueTypeId3', screenSchemeId: 'screenSchemeId3' },
          ],
        })

        change = toChange({ before: beforeInstance, after: afterInstance })

        await filter.deploy?.([change])
      })
      it('should call deployChange and ignore issueTypeMappings', () => {
        expect(deployChangeMock).toHaveBeenCalledWith({
          change,
          client,
          endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.IssueTypeScreenScheme
            .deployRequests,
          fieldsToIgnore: ['issueTypeMappings'],
        })
      })

      it('should call the endpoint to remove the removed and modified items', () => {
        expect(mockConnection.post).toHaveBeenCalledWith(
          '/rest/api/3/issuetypescreenscheme/id/mapping/remove',
          {
            issueTypeIds: ['issueTypeId1', 'issueTypeId2'],
          },
          undefined,
        )
      })

      it('should call the endpoint to add the added and modified items', () => {
        expect(mockConnection.put).toHaveBeenCalledWith(
          '/rest/api/3/issuetypescreenscheme/id/mapping',
          {
            issueTypeMappings: [
              { issueTypeId: 'issueTypeId1', screenSchemeId: 'screenSchemeId12' },
              { issueTypeId: 'issueTypeId3', screenSchemeId: 'screenSchemeId3' },
            ],
          },
          undefined,
        )
      })

      it('should call the endpoint to update the default item', () => {
        expect(mockConnection.put).toHaveBeenCalledWith(
          '/rest/api/3/issuetypescreenscheme/id/mapping/default',
          {
            screenSchemeId: 'screenSchemeDefaultId2',
          },
          undefined,
        )
      })
    })

    it('should not call the new items endpoint if there are no new or modified items', async () => {
      const beforeInstance = new InstanceElement('instance', issueTypeScreenSchemeType, {
        name: 'name1',
        id: 'id',
        issueTypeMappings: [
          { issueTypeId: 'default', screenSchemeId: 'screenSchemeDefaultId' },
          { issueTypeId: 'issueTypeId1', screenSchemeId: 'screenSchemeId1' },
          { issueTypeId: 'issueTypeId2', screenSchemeId: 'screenSchemeId2' },
        ],
      })

      const afterInstance = new InstanceElement('instance', issueTypeScreenSchemeType, {
        name: 'name2',
        id: 'id',
        issueTypeMappings: [
          { issueTypeId: 'default', screenSchemeId: 'screenSchemeDefaultId' },
          { issueTypeId: 'issueTypeId1', screenSchemeId: 'screenSchemeId1' },
        ],
      })

      await filter.deploy?.([toChange({ before: beforeInstance, after: afterInstance })])
      expect(mockConnection.put).not.toHaveBeenCalled()
    })

    it('should not call the remove items endpoint if there are no removed or modified items', async () => {
      const beforeInstance = new InstanceElement('instance', issueTypeScreenSchemeType, {
        name: 'name1',
        id: 'id',
        issueTypeMappings: [
          { issueTypeId: 'default', screenSchemeId: 'screenSchemeDefaultId' },
          { issueTypeId: 'issueTypeId1', screenSchemeId: 'screenSchemeId1' },
        ],
      })

      const afterInstance = new InstanceElement('instance', issueTypeScreenSchemeType, {
        name: 'name2',
        id: 'id',
        issueTypeMappings: [
          { issueTypeId: 'default', screenSchemeId: 'screenSchemeDefaultId' },
          { issueTypeId: 'issueTypeId1', screenSchemeId: 'screenSchemeId1' },
          { issueTypeId: 'issueTypeId2', screenSchemeId: 'screenSchemeId2' },
        ],
      })

      await filter.deploy?.([toChange({ before: beforeInstance, after: afterInstance })])
      expect(mockConnection.post).not.toHaveBeenCalled()
    })

    it('should throw an error if no default item exist', async () => {
      const instance = new InstanceElement('instance', issueTypeScreenSchemeType, {
        name: 'name2',
        id: 'id',
        issueTypeMappings: [
          { issueTypeId: 'issueTypeId1', screenSchemeId: 'screenSchemeId1' },
          { issueTypeId: 'issueTypeId2', screenSchemeId: 'screenSchemeId2' },
        ],
      })

      const result = await filter.deploy?.([toChange({ before: instance, after: instance })])
      expect(result?.deployResult?.appliedChanges).toEqual([])
      expect(result?.deployResult?.errors).toHaveLength(1)
    })
  })
})
