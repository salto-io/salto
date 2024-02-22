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
import { mockClient, getFilterParams } from '../utils'
import fieldConfigurationsSchemeFilter from '../../src/filters/field_configurations_scheme'
import { Filter } from '../../src/filter'
import JiraClient from '../../src/client/client'

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

describe('field_configurations_scheme', () => {
  let fieldConfigSchemeType: ObjectType
  let fieldConfigIssueTypeItemType: ObjectType
  let filter: Filter
  let mockConnection: MockInterface<clientUtils.APIConnection>
  beforeEach(async () => {
    const { client, paginator, connection } = mockClient()
    mockConnection = connection

    filter = fieldConfigurationsSchemeFilter(getFilterParams({ client, paginator }))

    fieldConfigIssueTypeItemType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfigurationIssueTypeItem'),
      fields: {
        issueTypeId: { refType: BuiltinTypes.STRING },
        fieldConfigurationId: { refType: BuiltinTypes.STRING },
      },
    })

    fieldConfigSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfigurationScheme'),
      fields: {
        items: { refType: new ListType(fieldConfigIssueTypeItemType) },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations to FieldConfigurationScheme', async () => {
      await filter.onFetch?.([fieldConfigSchemeType])
      expect(fieldConfigSchemeType.fields.items.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should add deployment annotations to FieldConfigurationIssueTypeItem', async () => {
      await filter.onFetch?.([fieldConfigIssueTypeItemType])
      expect(fieldConfigIssueTypeItemType.fields.issueTypeId.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      await filter.onFetch?.([fieldConfigIssueTypeItemType])
      expect(fieldConfigIssueTypeItemType.fields.fieldConfigurationId.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
  })

  describe('deploy', () => {
    it('should return irrelevant changes in leftoverChanges', async () => {
      const res = await filter.deploy?.([
        toChange({ after: fieldConfigSchemeType }),
        toChange({ before: new InstanceElement('instance1', fieldConfigSchemeType) }),
        toChange({ after: new InstanceElement('instance1', fieldConfigIssueTypeItemType) }),
      ])
      expect(res?.leftoverChanges).toHaveLength(3)
      expect(res?.deployResult).toEqual({ appliedChanges: [], errors: [] })
    })

    describe('When deploying a change', () => {
      const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>
      let change: Change<InstanceElement>

      beforeEach(async () => {
        const beforeInstance = new InstanceElement('instance', fieldConfigSchemeType, {
          name: 'name',
          items: [
            {
              issueTypeId: '1',
              fieldConfigurationId: '1',
            },
            {
              issueTypeId: '2',
              fieldConfigurationId: '2',
            },
          ],
        })

        const afterInstance = new InstanceElement('instance', fieldConfigSchemeType, {
          id: '1',
          name: 'name',
          items: [
            {
              issueTypeId: '1',
              fieldConfigurationId: '1',
            },
            {
              issueTypeId: '3',
              fieldConfigurationId: '3',
            },
          ],
        })

        change = toChange({ before: beforeInstance, after: afterInstance })

        await filter.deploy?.([change])
      })
      it('should call deployChange and ignore items', () => {
        expect(deployChangeMock).toHaveBeenCalledWith({
          change,
          client: expect.any(JiraClient),
          endpointDetails: expect.any(Object),
          fieldsToIgnore: ['items'],
        })
      })

      it('should call the endpoint to add the new items', () => {
        expect(mockConnection.put).toHaveBeenCalledWith(
          '/rest/api/3/fieldconfigurationscheme/1/mapping',
          {
            mappings: [
              {
                issueTypeId: '1',
                fieldConfigurationId: '1',
              },
              {
                issueTypeId: '3',
                fieldConfigurationId: '3',
              },
            ],
          },
          undefined,
        )
      })

      it('should call the endpoint to remove the removed items', () => {
        expect(mockConnection.post).toHaveBeenCalledWith(
          '/rest/api/3/fieldconfigurationscheme/1/mapping/delete',
          {
            issueTypeIds: ['2'],
          },
          undefined,
        )
      })
    })

    it('should not call the new items endpoint of there are no new items', async () => {
      const beforeInstance = new InstanceElement('instance', fieldConfigSchemeType, {
        items: [
          {
            issueTypeId: '1',
            fieldConfigurationId: '1',
          },
          {
            issueTypeId: '2',
            fieldConfigurationId: '2',
          },
        ],
      })

      const afterInstance = new InstanceElement('instance', fieldConfigSchemeType)

      await filter.deploy?.([toChange({ before: beforeInstance, after: afterInstance })])
      expect(mockConnection.put).not.toHaveBeenCalledWith()
    })

    it('should not call the remove items endpoint of there are no removed items', async () => {
      const beforeInstance = new InstanceElement('instance', fieldConfigSchemeType)

      const afterInstance = new InstanceElement('instance', fieldConfigSchemeType, {
        items: [
          {
            issueTypeId: '1',
            fieldConfigurationId: '1',
          },
          {
            issueTypeId: '2',
            fieldConfigurationId: '2',
          },
          {
            issueTypeId: '3',
            fieldConfigurationId: '3',
          },
        ],
      })

      await filter.deploy?.([toChange({ before: beforeInstance, after: afterInstance })])
      expect(mockConnection.post).not.toHaveBeenCalledWith()
    })
  })
})
