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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ListType, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { JIRA } from '../../../src/constants'
import { mockClient } from '../../utils'
import screenableTabFilter from '../../../src/filters/screen/screenable_tab'
import { Filter } from '../../../src/filter'
import JiraClient from '../../../src/client/client'
import { DEFAULT_CONFIG } from '../../../src/config'

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

describe('screenableTabFilter', () => {
  let screenTabType: ObjectType
  let filter: Filter
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  beforeEach(async () => {
    const { client: cli, paginator, connection } = mockClient()
    client = cli
    mockConnection = connection

    filter = screenableTabFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    })
    screenTabType = new ObjectType({
      elemID: new ElemID(JIRA, 'ScreenableTab'),
      fields: {
        fields: {
          refType: new ListType(BuiltinTypes.STRING),
        },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotation to fields', async () => {
      await filter.onFetch?.([screenTabType])
      expect(screenTabType.fields.fields.annotations)
        .toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })
    })

    it('should convert the fields list to a list of ids', async () => {
      const instance = new InstanceElement(
        'instance',
        screenTabType,
        {
          fields: [
            { id: 'id1' },
            { id: 'id2' },
          ],
        },
      )
      await filter.onFetch?.([instance])
      expect(instance.value.fields).toEqual(['id1', 'id2'])
    })
  })

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
      typeof deployment.deployChange
    >
    it('should return irrelevant changes in leftoverChanges', async () => {
      const res = await filter.deploy?.([
        toChange({ after: screenTabType }),
        toChange({ before: new InstanceElement('instance1', screenTabType) }),
        toChange({
          before: new InstanceElement('instance2', new ObjectType({ elemID: new ElemID(JIRA, 'someType') })),
          after: new InstanceElement('instance2', new ObjectType({ elemID: new ElemID(JIRA, 'someType') })),
        }),
      ])
      expect(res?.leftoverChanges).toHaveLength(3)
      expect(res?.deployResult).toEqual({ appliedChanges: [], errors: [] })
    })

    it('should call deployChange and ignore fields', async () => {
      const change = toChange({
        before: new InstanceElement('instance2', screenTabType),
        after: new InstanceElement('instance2', screenTabType, { name: 'name2' }),
      })
      await filter.deploy?.([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        change,
        client,
        DEFAULT_CONFIG.apiDefinitions.types.ScreenableTab.deployRequests,
        ['fields'],
        undefined
      )
    })

    it('should call deployChange and ignore fields and names of were not changed', async () => {
      const change = toChange({
        before: new InstanceElement('instance2', screenTabType),
        after: new InstanceElement('instance2', screenTabType),
      })
      await filter.deploy?.([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        change,
        client,
        DEFAULT_CONFIG.apiDefinitions.types.ScreenableTab.deployRequests,
        ['fields', 'name'],
        undefined
      )
    })

    describe('deploying fields', () => {
      beforeEach(async () => {
        const before = new InstanceElement(
          'instance1',
          screenTabType,
          {
            id: 'tabId',
            fields: [
              'id1',
              'id3',
            ],
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [{ id: 'screenId' }],
          },
        )
        const after = new InstanceElement(
          'instance1',
          screenTabType,
          {
            id: 'tabId',
            fields: [
              'id2',
              'id1',
            ],
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [{ id: 'screenId' }],
          },
        )

        await filter.deploy?.([toChange({ before, after })])
      })
      it('should call endpoints to add fields', async () => {
        expect(mockConnection.post).toHaveBeenCalledWith(
          '/rest/api/3/screens/screenId/tabs/tabId/fields',
          {
            fieldId: 'id2',
          },
          undefined,
        )
      })

      it('should call endpoints to remove fields', async () => {
        expect(mockConnection.delete).toHaveBeenCalledWith(
          '/rest/api/3/screens/screenId/tabs/tabId/fields/id3',
          undefined,
        )
      })

      it('should call endpoints to re-order fields', async () => {
        expect(mockConnection.post).toHaveBeenCalledWith(
          '/rest/api/3/screens/screenId/tabs/tabId/fields/id2/move',
          {
            position: 'First',
          },
          undefined,
        )

        expect(mockConnection.post).toHaveBeenCalledWith(
          '/rest/api/3/screens/screenId/tabs/tabId/fields/id1/move',
          {
            after: 'id2',
          },
          undefined,
        )
      })
    })

    it('should not call re-order if fields were not changed', async () => {
      const instance = new InstanceElement(
        'instance1',
        screenTabType,
        {
          id: 'tabId',
          fields: [
            'id1',
            'id2',
          ],
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: { value: { id: 'screenId' } },
        },
      )

      await filter.deploy?.([toChange({ before: instance, after: instance })])
      expect(mockConnection.post).not.toHaveBeenCalled()
    })
  })
})
