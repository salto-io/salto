/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  AdditionChange,
  BuiltinTypes,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  MapType,
  ModificationChange,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { JIRA } from '../../../src/constants'
import { mockClient } from '../../utils'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { deployTabs } from '../../../src/filters/screen/screenable_tab'

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

  describe('deployTabs', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>

    beforeEach(() => {
      deployChangeMock.mockClear()
    })

    it('if tabs is not a map should throw', async () => {
      screenType.fields.tabs = new Field(screenType, 'tabs', BuiltinTypes.STRING)
      const change = toChange({
        after: new InstanceElement('instance', screenType),
      }) as AdditionChange<InstanceElement>
      await expect(deployTabs(change, client, getDefaultConfig({ isDataCenter: false }))).rejects.toThrow()
    })

    it('if tabs inner type is not an object type should throw', async () => {
      screenType.fields.tabs = new Field(screenType, 'tabs', new MapType(BuiltinTypes.STRING))
      const change = toChange({
        after: new InstanceElement('instance', screenType),
      }) as AdditionChange<InstanceElement>
      await expect(deployTabs(change, client, getDefaultConfig({ isDataCenter: false }))).rejects.toThrow()
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
      await deployTabs(change, client, getDefaultConfig({ isDataCenter: false }))

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          after: new InstanceElement('tab', screenTabType, {
            name: 'tab',
          }),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.ScreenableTab.deployRequests,
        fieldsToIgnore: ['fields', 'position'],
        additionalUrlVars: { screenId: 'screenId' },
      })
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
      const instanceBefore = instance.clone()
      instanceBefore.value.tabs.tab.description = 'desc'
      const change = toChange({
        before: instanceBefore,
        after: instance,
      }) as ModificationChange<InstanceElement>
      await deployTabs(change, client, getDefaultConfig({ isDataCenter: false }))

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          before: new InstanceElement('tab', screenTabType, { name: 'tab', description: 'desc' }),
          after: new InstanceElement('tab', screenTabType, { name: 'tab' }),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.ScreenableTab.deployRequests,
        fieldsToIgnore: ['fields', 'position', 'name'],
        additionalUrlVars: { screenId: 'screenId' },
      })
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
      await deployTabs(change, client, getDefaultConfig({ isDataCenter: false }))

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          before: new InstanceElement('fieldTab', screenTabType, { name: 'fieldTab', id: 'tabId' }),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.ScreenableTab.deployRequests,
        fieldsToIgnore: ['fields', 'position'],
        additionalUrlVars: { screenId: 'screenId' },
      })
    })

    describe('deploying fields', () => {
      let change: ModificationChange<InstanceElement>
      let config: JiraConfig
      beforeEach(async () => {
        config = getDefaultConfig({ isDataCenter: false })
        change = toChange({
          before: new InstanceElement('instance1', screenType, {
            name: 'name2',
            id: 'screenId',
            tabs: {
              tab: {
                id: 'tabId',
                fields: ['id1', 'id3'],
              },
            },
          }),
          after: new InstanceElement('instance1', screenType, {
            name: 'name2',
            id: 'screenId',
            tabs: {
              tab: {
                id: 'tabId',
                fields: ['id2', 'id1'],
              },
            },
          }),
        }) as ModificationChange<InstanceElement>
      })
      it('should call endpoints to add fields', async () => {
        await deployTabs(change, client, config)
        expect(mockConnection.post).toHaveBeenCalledWith(
          '/rest/api/3/screens/screenId/tabs/tabId/fields',
          {
            fieldId: 'id2',
          },
          undefined,
        )
      })

      it('should call endpoints to remove fields', async () => {
        await deployTabs(change, client, config)
        expect(mockConnection.delete).toHaveBeenCalledWith(
          '/rest/api/3/screens/screenId/tabs/tabId/fields/id3',
          undefined,
        )
      })

      it('should call endpoints to re-order fields', async () => {
        await deployTabs(change, client, config)
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
      it('should not throw if the field is already in the screen', async () => {
        mockConnection.post.mockRejectedValueOnce(
          new clientUtils.HTTPError('message', {
            status: 400,
            data: {
              errors: { fieldId: 'The field with id customfield_10834 already exists on the screen.' },
            },
          }),
        )
        await expect(deployTabs(change, client, config)).resolves.not.toThrow()
      })

      it('should throw if the error is not about the field already existing', async () => {
        mockConnection.post.mockRejectedValueOnce(
          new clientUtils.HTTPError('message', {
            status: 400,
            data: {
              errors: { fieldId: 'Some other error' },
            },
          }),
        )
        await expect(deployTabs(change, client, config)).rejects.toThrow()
      })
    })

    it('should not call re-order if fields were not changed', async () => {
      const instance = new InstanceElement('instance1', screenType, {
        name: 'name2',
        id: 'screenId',
        tabs: {
          tab: {
            id: 'tabId',
            fields: ['id1', 'id2'],
          },
        },
      })
      await deployTabs(
        toChange({ before: instance, after: instance }) as ModificationChange<InstanceElement>,
        client,
        getDefaultConfig({ isDataCenter: false }),
      )
      expect(mockConnection.post).not.toHaveBeenCalled()
    })
  })
})
