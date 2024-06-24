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

import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'
import deployAttributesFilter from '../../../src/filters/assets/attribute_deploy_filter'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_TYPE, JIRA } from '../../../src/constants'
import JiraClient from '../../../src/client/client'

describe('deployAttributesFilter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  const assetsObjectTypeInstance = new InstanceElement('assetsObjectType', createEmptyType(OBJECT_TYPE_TYPE), {
    id: '11111',
    name: 'ObjectType',
  })
  const attributeType = new ObjectType({
    elemID: new ElemID(JIRA, OBJECT_TYPE_ATTRIBUTE_TYPE),
    fields: {
      objectType: { refType: BuiltinTypes.STRING },
    },
  })
  let attributesInstance: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  describe('deploy', () => {
    let config: JiraConfig
    beforeEach(() => {
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      const { client: cli, connection: conn } = mockClient(false)
      client = cli
      connection = conn
      elementsSource = buildElementsSourceFromElements([assetsObjectTypeInstance])
      filter = deployAttributesFilter(getFilterParams({ config, client, elementsSource })) as typeof filter
      attributesInstance = new InstanceElement('attributesInstance', attributeType, {
        id: '11',
        name: 'attributesInstance',
        objectType: new ReferenceExpression(assetsObjectTypeInstance.elemID, assetsObjectTypeInstance),
        type: 0,
        defaultTypeId: 0,
        description: 'description',
        uniqueAttribute: false,
        additionalValue: 'additionalValue',
      })
      connection.get.mockImplementation(async url => {
        if (url === '/rest/servicedeskapi/assets/workspace') {
          return {
            status: 200,
            data: {
              values: [
                {
                  workspaceId: 'workspaceId',
                },
              ],
            },
          }
        }
        if (url === '/gateway/api/jsm/assets/workspace/workspaceId/v1/objecttype/11111/attributes') {
          return {
            status: 200,
            data: [
              {
                name: 'Key',
                id: '1',
                editable: false,
              },
              {
                name: 'Name',
                id: '2',
                editable: true,
              },
            ],
          }
        }
        throw new Error('Unexpected url')
      })
      connection.post.mockImplementation(async url => {
        if (url === '/gateway/api/jsm/assets/workspace/workspaceId/v1/objecttypeattribute/11111') {
          return { status: 200, data: {} }
        }
        throw new Error('Unexpected url')
      })
      connection.put.mockResolvedValueOnce({ status: 200, data: {} })
    })
    it('should add attribute', async () => {
      const changes = [toChange({ after: attributesInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        'gateway/api/jsm/assets/workspace/workspaceId/v1/objecttypeattribute/11/configure',
        {
          name: 'attributesInstance',
          type: 0,
          id: '11',
          defaultTypeId: 0,
          description: 'description',
          uniqueAttribute: false,
        },
        undefined,
      )
    })
    it('should modify attribute when changing values for first api', async () => {
      const attributesInstanceAfter = attributesInstance.clone()
      attributesInstanceAfter.value.description = 'new description'
      const changes = [toChange({ before: attributesInstance, after: attributesInstanceAfter })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(0)
      expect(connection.put).toHaveBeenCalledTimes(2)
    })
    it('should modify attribute when changing values for second api', async () => {
      const attributesInstanceAfter = attributesInstance.clone()
      attributesInstanceAfter.value.uniqueAttribute = true
      const changes = [toChange({ before: attributesInstance, after: attributesInstanceAfter })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(0)
      expect(connection.put).toHaveBeenCalledTimes(2)
      expect(connection.put).toHaveBeenCalledWith(
        'gateway/api/jsm/assets/workspace/workspaceId/v1/objecttypeattribute/11/configure',
        {
          name: 'attributesInstance',
          type: 0,
          id: '11',
          defaultTypeId: 0,
          description: 'description',
          uniqueAttribute: true,
        },
        undefined,
      )
    })
    it('should remove attribute', async () => {
      const changes = [toChange({ before: attributesInstance })]
      elementsSource = buildElementsSourceFromElements([assetsObjectTypeInstance])
      filter = deployAttributesFilter(getFilterParams({ config, client, elementsSource })) as typeof filter
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(0)
      expect(connection.put).toHaveBeenCalledTimes(0)
      expect(connection.delete).toHaveBeenCalledTimes(1)
    })
    it('should return error when workspaceId is undefined', async () => {
      connection.get.mockResolvedValueOnce({ status: 200, data: { values: [] } })
      const changes = [toChange({ after: attributesInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(connection.post).toHaveBeenCalledTimes(0)
      expect(connection.put).toHaveBeenCalledTimes(0)
    })
    it('should add an editable default attribute', async () => {
      const defaultAttributeInstance = attributesInstance.clone()
      defaultAttributeInstance.value.name = 'Name'
      const changes = [toChange({ after: defaultAttributeInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(0)
      expect(connection.put).toHaveBeenCalledTimes(2)
    })
    it('should not call deploy request on a non editable default attribute', async () => {
      const defaultAttributeInstance = attributesInstance.clone()
      defaultAttributeInstance.value.name = 'Key'
      const changes = [toChange({ after: defaultAttributeInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(0)
      expect(connection.put).toHaveBeenCalledTimes(0)
    })
  })
})
