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

import { filterUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import {
  CORE_ANNOTATIONS,
  InstanceElement,
  ReferenceExpression,
  isInstanceElement,
  isObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../../src/config/config'
import assetsObjectTypeOrderFilter from '../../../src/filters/assets/assets_object_type_order'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE, OBJECT_TYPE_ORDER_TYPE, JIRA } from '../../../src/constants'
import JiraClient from '../../../src/client/client'

const createAssetsObjectTypeInstance = (
  id: number,
  suffix: string,
  assetSchema: InstanceElement,
  parentObjectTypeInstance: InstanceElement,
): InstanceElement =>
  new InstanceElement(
    `assetsObjectType${suffix}`,
    createEmptyType(OBJECT_TYPE_TYPE),
    {
      id,
      name: `assetsObjectType${suffix}`,
      position: id - 1,
      parentObjectTypeId: new ReferenceExpression(parentObjectTypeInstance.elemID, parentObjectTypeInstance),
    },
    [
      JIRA,
      elementUtils.RECORDS_PATH,
      OBJECT_SCHEMA_TYPE,
      'assetsSchema',
      'assetsObjectTypes',
      'parentObjectTypeInstance',
      `assetsObjectType${suffix}`,
      `assetsObjectType${suffix}`,
    ],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchema.elemID, assetSchema)],
    },
  )

describe('assetsObjectTypeOrderFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
  let filter: FilterType
  let client: JiraClient
  const assetSchema = new InstanceElement(
    'assetsSchema',
    createEmptyType(OBJECT_SCHEMA_TYPE),
    {
      name: 'AssetsSchema',
    },
    [JIRA, elementUtils.RECORDS_PATH, OBJECT_SCHEMA_TYPE, 'assetsSchema'],
  )
  const parentObjectTypeInstance = new InstanceElement(
    'parent_Object_Type_Instance@uuu',
    createEmptyType(OBJECT_TYPE_TYPE),
    {
      id: 'p1',
      name: 'AssetsObjectTypeP1',
      parentObjectTypeId: new ReferenceExpression(assetSchema.elemID, assetSchema),
    },
    [
      JIRA,
      elementUtils.RECORDS_PATH,
      OBJECT_SCHEMA_TYPE,
      'assetsSchema',
      'assetsObjectTypes',
      'parentObjectTypeInstance',
      'parentObjectTypeInstance',
    ],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchema.elemID, assetSchema)],
    },
  )
  const assetsObjectTypeInstanceOne = createAssetsObjectTypeInstance(1, 'One', assetSchema, parentObjectTypeInstance)
  const assetsObjectTypeInstanceTwo = createAssetsObjectTypeInstance(2, 'Two', assetSchema, parentObjectTypeInstance)
  const assetsObjectTypeInstanceThree = createAssetsObjectTypeInstance(
    3,
    'Three',
    assetSchema,
    parentObjectTypeInstance,
  )
  describe('fetch', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = assetsObjectTypeOrderFilter(getFilterParams({ config, client })) as typeof filter
    })
    it('should add assetsObjectTypeOrderInstance and type to the elements', async () => {
      const elements = [
        parentObjectTypeInstance,
        assetsObjectTypeInstanceOne,
        assetsObjectTypeInstanceTwo,
        assetsObjectTypeInstanceThree,
        assetSchema,
      ]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(8)
      const orderInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === OBJECT_TYPE_ORDER_TYPE)
      expect(orderInstances[1]).toBeDefined()
      expect(orderInstances[1].elemID.name).toEqual('parent_Object_Type_Instance_childOrder')
      expect(orderInstances[1].value.objectTypes).toEqual([
        new ReferenceExpression(assetsObjectTypeInstanceOne.elemID, assetsObjectTypeInstanceOne),
        new ReferenceExpression(assetsObjectTypeInstanceTwo.elemID, assetsObjectTypeInstanceTwo),
        new ReferenceExpression(assetsObjectTypeInstanceThree.elemID, assetsObjectTypeInstanceThree),
      ])
      const orderType = elements.filter(isObjectType).find(e => e.elemID.typeName === OBJECT_TYPE_ORDER_TYPE)
      expect(orderType).toBeDefined()
      expect(orderInstances[0].path).toEqual([
        JIRA,
        elementUtils.RECORDS_PATH,
        'ObjectSchema',
        'objectTypes',
        'assetsSchema_childOrder',
      ])
    })
    it('should do nothing for instnaces without parentObjectTypeId', async () => {
      const elements = [
        parentObjectTypeInstance,
        assetsObjectTypeInstanceOne,
        assetsObjectTypeInstanceTwo,
        assetsObjectTypeInstanceThree,
      ]
      delete parentObjectTypeInstance.value.parentObjectTypeId
      await filter.onFetch(elements)
      expect(elements).toHaveLength(6)
    })
  })
  describe('deploy', () => {
    let connection: MockInterface<clientUtils.APIConnection>
    let assetsObjectTypeOrderInstance: InstanceElement
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJSMPremium = true
      const { client: cli, connection: conn } = mockClient(false)
      client = cli
      connection = conn
      filter = assetsObjectTypeOrderFilter(getFilterParams({ config, client })) as typeof filter
      assetsObjectTypeOrderInstance = new InstanceElement(
        'assetsObjectTypeOrderInstance',
        createEmptyType(OBJECT_TYPE_ORDER_TYPE),
        {
          objectTypes: [
            new ReferenceExpression(assetsObjectTypeInstanceOne.elemID, assetsObjectTypeInstanceOne),
            new ReferenceExpression(assetsObjectTypeInstanceTwo.elemID, assetsObjectTypeInstanceTwo),
            new ReferenceExpression(assetsObjectTypeInstanceThree.elemID, assetsObjectTypeInstanceThree),
          ],
          assetSchema: new ReferenceExpression(assetSchema.elemID, assetSchema),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [
            new ReferenceExpression(parentObjectTypeInstance.elemID, parentObjectTypeInstance),
          ],
        },
      )
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
        throw new Error('Unexpected url')
      })
      connection.post.mockResolvedValueOnce({ status: 200, data: {} })
    })
    it('should apply order when adding assetsObjectTypeOrderInstance', async () => {
      const changes = [toChange({ after: assetsObjectTypeOrderInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(3)
    })
    it('should call API only for changed positions when modifing', async () => {
      const assetsObjectTypeOrderInstanceAfer = assetsObjectTypeOrderInstance.clone()
      assetsObjectTypeOrderInstanceAfer.value.objectTypes = [
        new ReferenceExpression(assetsObjectTypeInstanceOne.elemID, assetsObjectTypeInstanceOne),
        new ReferenceExpression(assetsObjectTypeInstanceThree.elemID, assetsObjectTypeInstanceThree),
        new ReferenceExpression(assetsObjectTypeInstanceTwo.elemID, assetsObjectTypeInstanceTwo),
      ]
      const changes = [toChange({ before: assetsObjectTypeOrderInstance, after: assetsObjectTypeOrderInstanceAfer })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(2)
    })
    it('should return error when workspaceId is undefined', async () => {
      connection.get.mockResolvedValueOnce({ status: 200, data: {} })
      const changes = [toChange({ after: assetsObjectTypeOrderInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        'The following changes were not deployed, due to error with the workspaceId: jira.ObjectTypeOrder.instance.assetsObjectTypeOrderInstance',
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(connection.post).toHaveBeenCalledTimes(0)
    })
    it('should change order for roots object types', async () => {
      assetsObjectTypeOrderInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(assetSchema.elemID, assetSchema),
      ]
      const changes = [toChange({ after: assetsObjectTypeOrderInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(3)
    })
    it('should change order when adding another assetsObjectType and change order', async () => {
      const assetsObjectTypeInstanceFour = createAssetsObjectTypeInstance(
        4,
        'Four',
        assetSchema,
        parentObjectTypeInstance,
      )
      const assetsObjectTypeOrderInstanceAfer = assetsObjectTypeOrderInstance.clone()
      assetsObjectTypeOrderInstanceAfer.value.objectTypes = [
        new ReferenceExpression(assetsObjectTypeInstanceOne.elemID, assetsObjectTypeInstanceOne),
        new ReferenceExpression(assetsObjectTypeInstanceFour.elemID, assetsObjectTypeInstanceFour),
        new ReferenceExpression(assetsObjectTypeInstanceTwo.elemID, assetsObjectTypeInstanceTwo),
        new ReferenceExpression(assetsObjectTypeInstanceThree.elemID, assetsObjectTypeInstanceThree),
      ]
      const changes = [toChange({ before: assetsObjectTypeOrderInstance, after: assetsObjectTypeOrderInstanceAfer })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(3)
    })
  })
})
