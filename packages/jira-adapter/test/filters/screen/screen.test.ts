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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ListType, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { JIRA } from '../../../src/constants'
import { mockClient } from '../../utils'
import screenFilter from '../../../src/filters/screen/screen'
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

describe('screenFilter', () => {
  let screenType: ObjectType
  let screenTabType: ObjectType
  let filter: Filter
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  beforeEach(async () => {
    const { client: cli, paginator, connection } = mockClient()
    client = cli
    mockConnection = connection

    filter = screenFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    })
    screenTabType = new ObjectType({
      elemID: new ElemID(JIRA, 'ScreenableTab'),
    })
    screenType = new ObjectType({
      elemID: new ElemID(JIRA, 'Screen'),
      fields: {
        tabs: { refType: new ListType(screenTabType) },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotation to tabs', async () => {
      await filter.onFetch?.([screenType])
      expect(screenType.fields.tabs.annotations)
        .toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })
    })

    it('should convert the available fields list to a list of ids', async () => {
      const instance = new InstanceElement(
        'instance',
        screenType,
        {
          availableFields: [
            { id: 'id1' },
            { id: 'id2' },
          ],
        },
      )
      await filter.onFetch?.([instance])
      expect(instance.value.availableFields).toEqual(['id1', 'id2'])
    })
  })

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
      typeof deployment.deployChange
    >
    it('should return irrelevant changes in leftoverChanges', async () => {
      const res = await filter.deploy?.([
        toChange({ after: screenType }),
        toChange({ before: new InstanceElement('instance1', screenType) }),
        toChange({
          before: new InstanceElement('instance2', new ObjectType({ elemID: new ElemID(JIRA, 'someType') })),
          after: new InstanceElement('instance2', new ObjectType({ elemID: new ElemID(JIRA, 'someType') })),
        }),
      ])
      expect(res?.leftoverChanges).toHaveLength(3)
      expect(res?.deployResult).toEqual({ appliedChanges: [], errors: [] })
    })

    it('should call deployChange and ignore tabs', async () => {
      const change = toChange({
        before: new InstanceElement('instance2', screenType),
        after: new InstanceElement('instance2', screenType, { name: 'name2' }),
      })
      await filter.deploy?.([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        change,
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Screen.deployRequests,
        ['tabs'],
        undefined
      )
    })

    it('should call deployChange and ignore tabs and names of were not changed', async () => {
      const change = toChange({
        before: new InstanceElement('instance2', screenType),
        after: new InstanceElement('instance2', screenType),
      })
      await filter.deploy?.([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        change,
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Screen.deployRequests,
        ['tabs', 'name'],
        undefined
      )
    })

    it('should call endpoints to reorder tabs', async () => {
      const after = new InstanceElement(
        'instance1',
        screenType,
        {
          tabs: [
            new ReferenceExpression(
              screenTabType.elemID.createNestedID('instance', 'inst2'),
              new InstanceElement('inst2', screenTabType, { id: 'id2' }),
            ),
            new ReferenceExpression(
              screenTabType.elemID.createNestedID('instance', 'inst1'),
              new InstanceElement('inst1', screenTabType, { id: 'id1' }),
            ),
          ],
        }
      )
      deployChangeMock.mockResolvedValue({ id: 'screenId' })

      const change = toChange({ after })
      await filter.deploy?.([change])
      expect(mockConnection.post).toHaveBeenCalledWith(
        '/rest/api/3/screens/screenId/tabs/id2/move/0',
        {},
        undefined,
      )

      expect(mockConnection.post).toHaveBeenCalledWith(
        '/rest/api/3/screens/screenId/tabs/id1/move/1',
        {},
        undefined,
      )
    })

    it('should not call re-order endpoints if tabs were not changed', async () => {
      const instance = new InstanceElement(
        'instance1',
        screenType,
        {
          tabs: [
            new ReferenceExpression(
              screenTabType.elemID.createNestedID('instance', 'inst1'),
              new InstanceElement('inst1', screenTabType, { id: 'id1' }),
            ),
            new ReferenceExpression(
              screenTabType.elemID.createNestedID('instance', 'inst2'),
              new InstanceElement('inst2', screenTabType, { id: 'id2' }),
            ),
          ],
        }
      )

      const change = toChange({ before: instance, after: instance })
      await filter.deploy?.([change])
      expect(mockConnection.post).not.toHaveBeenCalled()
    })
  })
})
