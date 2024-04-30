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
  toChange,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { credentialsType } from '../src/auth'
import { DEFAULT_CONFIG } from '../src/config'
import { ADAPTER_NAME } from '../src/constants'
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
    mockAxiosAdapter
      .onGet('https://admin.googleapis.com/admin/directory/v1/customers/my_customer')
      .reply(200, { customerDomain: 'localhost' })
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
              accessToken: '1234',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'building',
          'domain',
          'feature',
          'group',
          'orgUnit',
          'role',
          'roleAssignment',
          'room',
          'schema',
        ])
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'google_workspace.building',
          'google_workspace.building.instance.salto_office@s',
          'google_workspace.domain',
          'google_workspace.domain.instance.localhost',
          'google_workspace.domain__domainAliases',
          'google_workspace.feature',
          'google_workspace.feature.instance.macabi',
          'google_workspace.group',
          'google_workspace.group.instance.blabla',
          'google_workspace.group__groupSettings',
          'google_workspace.orgUnit',
          'google_workspace.orgUnit.instance._@d',
          'google_workspace.orgUnit.instance._uri@d',
          'google_workspace.role',
          'google_workspace.role.instance._SEED_ADMIN_ROLE',
          'google_workspace.roleAssignment',
          'google_workspace.roleAssignment.instance.65643247212429314_blabla',
          'google_workspace.role__rolePrivileges',
          'google_workspace.room',
          'google_workspace.room.instance.zoom_room@s',
          'google_workspace.room__featureInstances',
          'google_workspace.room__featureInstances__feature',
          'google_workspace.schema',
          'google_workspace.schema.instance.uri',
          'google_workspace.schema__fields',
        ])
        expect(
          Object.fromEntries(
            elements
              .filter(isInstanceElement)
              .filter(e => e.elemID.typeName === 'orgUnit')
              .map(e => [e.elemID.name, e.path]),
          ),
        ).toEqual({
          '_@d': ['google_workspace', 'Records', 'orgUnit', 'Salto_Neta_test1', 'Salto_Neta_test1'],
          '_uri@d': ['google_workspace', 'Records', 'orgUnit', 'Salto_Neta_test1', 'uri', 'uri'],
        })
        expect(
          elements
            .filter(isInstanceElement)
            .find(e => e.elemID.getFullName() === 'google_workspace.orgUnit.instance._@d')?.value,
        ).toEqual({
          name: 'Salto Neta test1',
          description: 'Salto Neta test1',
          orgUnitId: 'id:03ph8a2z2dk12tm',
          orgUnitPath: '/',
        })
        expect(
          elements
            .filter(isInstanceElement)
            .find(e => e.elemID.getFullName() === 'google_workspace.schema.instance.uri')?.value,
        ).toEqual({
          displayName: 'uri',
          fields: {
            roles: {
              displayName: 'roles',
              fieldId: 'K_6NO6yeQcO3VrkTubW6SQ==',
              fieldName: 'roles',
              fieldType: 'STRING',
              multiValued: true,
              readAccessType: 'ALL_DOMAIN_USERS',
            },
          },
          schemaId: 'aKR62Yy0Q4K4PkhgTIlz7g==',
          schemaName: 'uri',
        })
        expect(
          elements
            .filter(isInstanceElement)
            .find(e => e.elemID.getFullName() === 'google_workspace.role.instance._SEED_ADMIN_ROLE')?.value
            .rolePrivileges.length,
        ).toEqual(7)
      })
    })
  })
  describe('deploy', () => {
    let operations: AdapterOperations
    let buildingType: ObjectType
    let orgUnitType: ObjectType
    let featureType: ObjectType
    let building1: InstanceElement
    let orgUnit1: InstanceElement
    let feature1: InstanceElement

    beforeEach(() => {
      buildingType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'building') })
      featureType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'feature') })
      orgUnitType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'orgUnit') })
      building1 = new InstanceElement('building1', buildingType, {
        buildingId: 'salto-office',
        buildingName: 'salto office',
        description: 'wow',
        floorNames: ['21'],
      })
      orgUnit1 = new InstanceElement('besides', orgUnitType, {
        name: 'top',
        description: 'forreal',
        orgUnitPath: '/uri/neta/top',
        orgUnitId: 'id:03ph8a2z4exfoz5',
      })
      feature1 = new InstanceElement('macabi', featureType, { name: 'macabi' })

      operations = adapter.operations({
        credentials: new InstanceElement('config', credentialsType, {
          accessToken: '1234',
        }),
        config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
        elementsSource: buildElementsSourceFromElements([buildingType, orgUnitType, building1, featureType]),
      })
    })

    it('should return the applied changes', async () => {
      const results: DeployResult[] = []

      const updatedBuilding1 = building1.clone()
      updatedBuilding1.value.description = 'new desc'
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'building',
            changes: [
              toChange({
                before: building1,
                after: updatedBuilding1,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'orgUnit1',
            changes: [toChange({ after: orgUnit1 })],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'orgUnit2',
            changes: [toChange({ before: orgUnit1 })],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'feature1',
            changes: [toChange({ after: feature1 })],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      expect(results.map(res => res.appliedChanges.length)).toEqual([1, 1, 1, 1])
      expect(results.map(res => res.errors.length)).toEqual([0, 0, 0, 0])
      const modify = results[0].appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(modify).value.description).toEqual('new desc')
      const add = results[1].appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(add).value.orgUnitPath).toEqual('/uri/neta/top')
    })
  })
})
