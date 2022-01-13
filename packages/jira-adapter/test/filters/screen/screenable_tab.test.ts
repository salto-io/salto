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
import { AdditionChange, BuiltinTypes, ElemID, Field, InstanceElement, ListType, MapType, ModificationChange, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { JIRA } from '../../../src/constants'
import { mockClient } from '../../utils'
import JiraClient from '../../../src/client/client'
import { DEFAULT_CONFIG } from '../../../src/config'
import { deployTabs, transformTabValues } from '../../../src/filters/screen/screenable_tab'

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

describe('screenableTab', () => {
  let screenTabType: ObjectType
  let screenType: ObjectType
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  beforeEach(async () => {
    const { client: cli, connection } = mockClient()
    client = cli
    mockConnection = connection

    screenTabType = new ObjectType({
      elemID: new ElemID(JIRA, 'ScreenableTab'),
      fields: {
        fields: {
          refType: new ListType(BuiltinTypes.STRING),
        },
      },
    })

    screenType = new ObjectType({
      elemID: new ElemID(JIRA, 'Screen'),
      fields: {
        tabs: {
          refType: new MapType(screenTabType),
        },
      },
    })
  })

  describe('transformTabValues', () => {
    it('should convert fields to ids', async () => {
      expect(transformTabValues({
        fields: [
          {
            id: '1',
            name: 'name1',
          },
          {
            id: '2',
            name: 'name2',
          },
        ],
        name: 'name',
      })).toEqual({
        fields: ['1', '2'],
        name: 'name',
      })
    })
  })

  describe('deployTabs', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
      typeof deployment.deployChange
    >

    beforeEach(() => {
      deployChangeMock.mockClear()
    })

    it('if tabs is not a map should throw', async () => {
      screenType.fields.tabs = new Field(screenType, 'tabs', BuiltinTypes.STRING)
      const change = toChange({
        after: new InstanceElement('instance', screenType),
      }) as AdditionChange<InstanceElement>
      await expect(deployTabs(change, client, DEFAULT_CONFIG)).rejects.toThrow()
    })

    it('if tabs inner type is not an object type should throw', async () => {
      screenType.fields.tabs = new Field(screenType, 'tabs', new MapType(BuiltinTypes.STRING))
      const change = toChange({
        after: new InstanceElement('instance', screenType),
      }) as AdditionChange<InstanceElement>
      await expect(deployTabs(change, client, DEFAULT_CONFIG)).rejects.toThrow()
    })

    it('should call deployChange and ignore fields', async () => {
      const change = toChange({
        before: new InstanceElement('instance1', screenType),
        after: new InstanceElement('instance1', screenType, {
          name: 'name2',
          id: 'screenId',
          tabs: {
            tab: {
              name: 'tab',
            },
          },
        }),
      }) as ModificationChange<InstanceElement>
      await deployTabs(change, client, DEFAULT_CONFIG)

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement('tab', screenTabType, {
            name: 'tab',
          }),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.ScreenableTab.deployRequests,
        ['fields', 'position'],
        { screenId: 'screenId' },
      )
    })

    it('should call deployChange and ignore fields and names of were not changed', async () => {
      const instance = new InstanceElement('instance1', screenType, {
        name: 'name2',
        id: 'screenId',
        tabs: {
          tab: {
            name: 'tab',
          },
        },
      })
      const change = toChange({
        before: instance,
        after: instance,
      }) as ModificationChange<InstanceElement>
      await deployTabs(change, client, DEFAULT_CONFIG)

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          before: new InstanceElement('tab', screenTabType, { name: 'tab' }),
          after: new InstanceElement('tab', screenTabType, { name: 'tab' }),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.ScreenableTab.deployRequests,
        ['fields', 'position', 'name'],
        { screenId: 'screenId' },
      )
    })

    it('should remove  automatically created tabs tab on create', async () => {
      const instance = new InstanceElement('instance1', screenType, {
        name: 'name2',
        id: 'screenId',
      })

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: [
          {
            id: 'tabId',
            name: 'fieldTab',
          },
        ],
      })

      const change = toChange({
        after: instance,
      }) as AdditionChange<InstanceElement>
      await deployTabs(change, client, DEFAULT_CONFIG)

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          before: new InstanceElement('fieldTab', screenTabType, { name: 'fieldTab', id: 'tabId' }),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.ScreenableTab.deployRequests,
        ['fields', 'position'],
        { screenId: 'screenId' },
      )
    })

    describe('deploying fields', () => {
      beforeEach(async () => {
        const change = toChange({
          before: new InstanceElement('instance1', screenType, {
            name: 'name2',
            id: 'screenId',
            tabs: {
              tab: {
                id: 'tabId',
                fields: [
                  'id1',
                  'id3',
                ],
              },
            },
          }),
          after: new InstanceElement('instance1', screenType, {
            name: 'name2',
            id: 'screenId',
            tabs: {
              tab: {
                id: 'tabId',
                fields: [
                  'id2',
                  'id1',
                ],
              },
            },
          }),
        }) as ModificationChange<InstanceElement>

        await deployTabs(change, client, DEFAULT_CONFIG)
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
      const instance = new InstanceElement('instance1', screenType, {
        name: 'name2',
        id: 'screenId',
        tabs: {
          tab: {
            id: 'tabId',
            fields: [
              'id1',
              'id2',
            ],
          },
        },
      })
      await deployTabs(
        toChange({ before: instance, after: instance }) as ModificationChange<InstanceElement>,
        client,
        DEFAULT_CONFIG
      )
      expect(mockConnection.post).not.toHaveBeenCalled()
    })
  })
})
