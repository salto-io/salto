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
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  MapType,
  ObjectType,
  ReferenceExpression,
  UnresolvedReference,
  toChange,
} from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { JIRA } from '../../../src/constants'
import { getFilterParams, mockClient } from '../../utils'
import screenFilter from '../../../src/filters/screen/screen'
import { Filter } from '../../../src/filter'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig } from '../../../src/config/config'

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
    mockConnection.get.mockResolvedValue({ status: 200, data: [] })

    filter = screenFilter(
      getFilterParams({
        client,
        paginator,
      }),
    )
    screenTabType = new ObjectType({
      elemID: new ElemID(JIRA, 'ScreenableTab'),
    })
    screenType = new ObjectType({
      elemID: new ElemID(JIRA, 'Screen'),
      fields: {
        tabs: { refType: new MapType(screenTabType) },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotation to tabs', async () => {
      await filter.onFetch?.([screenType, screenTabType])
      expect(screenType.fields.tabs.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(screenTabType.fields.fields.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
      expect(screenTabType.fields.originalFieldsIds.annotations).toEqual({
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      })
    })

    it('should convert the tabs to a map', async () => {
      const instance = new InstanceElement('instance', screenType, {
        tabs: [
          { name: 'tab1', fields: [{ id: '1' }] },
          { name: 'tab2', fields: [{ id: '2' }] },
        ],
      })
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        tabs: {
          tab1: { name: 'tab1', position: 0, fields: ['1'], originalFieldsIds: { ids: ['1'] } },
          tab2: { name: 'tab2', position: 1, fields: ['2'], originalFieldsIds: { ids: ['2'] } },
        },
      })
    })
  })
  describe('preDeploy', () => {
    let fieldType: ObjectType
    let fieldInstance1: InstanceElement
    let fieldInstance2: InstanceElement
    let fieldReference: ReferenceExpression
    let fieldUnresolvedReference: UnresolvedReference
    let screenInstance: InstanceElement
    beforeEach(() => {
      fieldType = new ObjectType({ elemID: new ElemID(JIRA, 'field') })
      fieldInstance1 = new InstanceElement('instance', fieldType, { id: '1' })
      fieldInstance2 = new InstanceElement('instance', fieldType, { id: '2' })
      fieldReference = new ReferenceExpression(fieldInstance1.elemID)
      fieldUnresolvedReference = new UnresolvedReference(fieldInstance2.elemID)
      screenInstance = new InstanceElement('instance', screenType, {
        tabs: {
          tab1: {
            name: 'tab1',
            position: 0,
            fields: [fieldReference, fieldUnresolvedReference],
            originalFieldsIds: { ids: ['1', '2'] },
          },
        },
      })
    })
    it('should convert the field references to their original ids', async () => {
      const afterInstance = screenInstance.clone()
      afterInstance.value.description = 'desc'
      await filter.preDeploy?.([toChange({ before: screenInstance, after: afterInstance })])
      expect(screenInstance.value).toEqual({
        tabs: {
          tab1: { name: 'tab1', position: 0, fields: ['1', '2'], originalFieldsIds: { ids: ['1', '2'] } },
        },
      })
    })
    it('should not convert the field references to their original ids when the ids are not exist ', async () => {
      screenInstance.value.tabs.tab1.originalFieldsIds = { ids: undefined }
      const afterInstance = screenInstance.clone()
      afterInstance.value.description = 'desc'
      await filter.preDeploy?.([toChange({ before: screenInstance, after: afterInstance })])
      expect(screenInstance.value).toEqual({
        tabs: {
          tab1: {
            name: 'tab1',
            position: 0,
            fields: [fieldReference, fieldUnresolvedReference],
            originalFieldsIds: { ids: undefined },
          },
        },
      })
    })
    it('should do nothing if the screenTab has no fields', async () => {
      screenInstance.value.tabs.tab1.fields = undefined
      screenInstance.value.tabs.tab1.originalFieldsIds = undefined
      const afterInstance = screenInstance.clone()
      afterInstance.value.description = 'desc'
      await filter.preDeploy?.([toChange({ before: screenInstance, after: afterInstance })])
      expect(screenInstance.value).toEqual({
        tabs: {
          tab1: { name: 'tab1', position: 0 },
        },
      })
    })
    it('should do nothing if the screenTab has no originalFieldsIds', async () => {
      screenInstance.value.tabs.tab1.originalFieldsIds = undefined
      const afterInstance = screenInstance.clone()
      afterInstance.value.description = 'desc'
      await filter.preDeploy?.([toChange({ before: screenInstance, after: afterInstance })])
      expect(screenInstance.value).toEqual({
        tabs: {
          tab1: { name: 'tab1', position: 0, fields: [fieldReference, fieldUnresolvedReference] },
        },
      })
    })
  })

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>
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

      expect(deployChangeMock).toHaveBeenCalledWith({
        change,
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Screen.deployRequests,
        fieldsToIgnore: ['tabs'],
      })
    })

    it('should call deployChange and ignore tabs and names if were not changed', async () => {
      const change = toChange({
        before: new InstanceElement('instance2', screenType, { description: 'desc' }),
        after: new InstanceElement('instance2', screenType),
      })
      await filter.deploy?.([change])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change,
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Screen.deployRequests,
        fieldsToIgnore: ['tabs', 'name'],
      })
    })

    it('should call endpoints to reorder tabs', async () => {
      const after = new InstanceElement('instance1', screenType, {
        id: 'screenId',
        tabs: {
          tab1: {
            name: 'tab1',
            id: 'id1',
            position: 1,
          },
          tab2: {
            name: 'tab2',
            id: 'id2',
            position: 0,
          },
        },
      })

      const change = toChange({ after })
      await filter.deploy?.([change])
      expect(mockConnection.post).toHaveBeenCalledWith('/rest/api/3/screens/screenId/tabs/id2/move/0', {}, undefined)

      expect(mockConnection.post).toHaveBeenCalledWith('/rest/api/3/screens/screenId/tabs/id1/move/1', {}, undefined)
    })

    it('should not call re-order endpoints if tabs were not changed', async () => {
      const instance = new InstanceElement('instance1', screenType, {
        id: 'screenId',
        tabs: {
          tab1: {
            name: 'tab1',
            id: 'id1',
          },
          tab2: {
            name: 'tab2',
            id: 'id2',
          },
        },
      })

      const change = toChange({ before: instance, after: instance })
      await filter.deploy?.([change])
      expect(mockConnection.post).not.toHaveBeenCalled()
    })
  })
  describe('onDeploy', () => {
    let fieldType: ObjectType
    let fieldInstance: InstanceElement
    let fieldReference: ReferenceExpression
    let screenInstance: InstanceElement
    beforeEach(() => {
      fieldType = new ObjectType({ elemID: new ElemID(JIRA, 'field') })
      fieldInstance = new InstanceElement('instance', fieldType, { id: '1' })
      fieldReference = new ReferenceExpression(fieldInstance.elemID, {
        value: {
          id: '1',
        },
      })
      screenInstance = new InstanceElement('instance', screenType, {
        tabs: {
          tab1: {
            name: 'tab1',
            position: 0,
            fields: [fieldReference, 'notReferenceFieldId'],
            originalFieldsIds: { ids: undefined },
          },
        },
      })
    })
    it('should populate original ids with the updated ids', async () => {
      await filter.onDeploy?.([toChange({ after: screenInstance })])
      expect(screenInstance.value).toEqual({
        tabs: {
          tab1: {
            name: 'tab1',
            position: 0,
            fields: [fieldReference, 'notReferenceFieldId'],
            originalFieldsIds: { ids: ['1', 'notReferenceFieldId'] },
          },
        },
      })
    })
    it('should delete original ids when there are no fields', async () => {
      screenInstance.value.tabs.tab1.originalFieldsIds = { ids: ['1'] }
      const afterInstance = screenInstance.clone()
      afterInstance.value.tabs.tab1.fields = []
      await filter.onDeploy?.([toChange({ before: screenInstance, after: afterInstance })])
      expect(afterInstance.value).toEqual({
        tabs: {
          tab1: { name: 'tab1', position: 0, fields: [], originalFieldsIds: { ids: [] } },
        },
      })
    })
  })
})
