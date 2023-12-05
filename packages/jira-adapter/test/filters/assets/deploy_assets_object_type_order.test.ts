/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../../src/config/config'
import deployAssetsObjectTypeOrderFilter from '../../../src/filters/assets/deploy_assets_object_type_order'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { ASSESTS_SCHEMA_TYPE, ASSETS_OBJECT_TYPE, ASSETS_OBJECT_TYPE_ORDER_TYPE } from '../../../src/constants'
import JiraClient from '../../../src/client/client'

const createAssetsObjectTypeInstance = (id: string, suffix: string, assetSchema: InstanceElement):
InstanceElement => new InstanceElement(
  `assetsObjectType${suffix}`,
  createEmptyType(ASSETS_OBJECT_TYPE),
  {
    id,
    name: `assetsObjectType${suffix}`,
  },
  undefined,
  {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchema.elemID, assetSchema)],
  }
)

describe('deployAttributesFilter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  const assetSchema = new InstanceElement(
    'assetsSchema',
    createEmptyType(ASSESTS_SCHEMA_TYPE),
    {
      name: 'AssetsSchema',
    },
  )
  const parentObjectTypeInstance = new InstanceElement(
    'parentObjectTypeInstance',
    createEmptyType(ASSETS_OBJECT_TYPE),
    {
      id: 'p1',
      name: 'AssetsObjectTypeP1',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchema.elemID, assetSchema)],
    }
  )
  const assetsObjectTypeInstanceOne = createAssetsObjectTypeInstance('1', 'One', assetSchema)
  const assetsObjectTypeInstanceTwo = createAssetsObjectTypeInstance('2', 'Two', assetSchema)
  const assetsObjectTypeInstanceThree = createAssetsObjectTypeInstance('3', 'Three', assetSchema)
  let assetsObjectTypeOrderInstance: InstanceElement
  describe('deploy', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      const { client: cli, connection: conn } = mockClient(false)
      client = cli
      connection = conn
      filter = deployAssetsObjectTypeOrderFilter(getFilterParams({ config, client })) as typeof filter
      assetsObjectTypeOrderInstance = new InstanceElement(
        'assetsObjectTypeOrderInstance',
        createEmptyType(ASSETS_OBJECT_TYPE_ORDER_TYPE),
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
          [CORE_ANNOTATIONS.PARENT]:
          [new ReferenceExpression(parentObjectTypeInstance.elemID, parentObjectTypeInstance)],
        }
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
      const changes = [
        toChange({ after: assetsObjectTypeOrderInstance }),
      ]
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
      const changes = [
        toChange({ before: assetsObjectTypeOrderInstance, after: assetsObjectTypeOrderInstanceAfer }),
      ]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(2)
    })
    it('should return error when workspaceId is undefined', async () => {
      connection.get.mockResolvedValueOnce({ status: 200, data: {} })
      const changes = [
        toChange({ after: assetsObjectTypeOrderInstance }),
      ]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        'The following changes were not deployed, due to error with the workspaceId: jira.AssetsObjectTypeOrder.instance.assetsObjectTypeOrderInstance'
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(connection.post).toHaveBeenCalledTimes(0)
    })
    it('should change order for roots object types', async () => {
      assetsObjectTypeOrderInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(assetSchema.elemID, assetSchema),
      ]
      const changes = [
        toChange({ after: assetsObjectTypeOrderInstance }),
      ]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(3)
    })
    it('should change order when adding another assetsObjectType and change order', async () => {
      const assetsObjectTypeInstanceFour = createAssetsObjectTypeInstance('4', 'Four', assetSchema)
      const assetsObjectTypeOrderInstanceAfer = assetsObjectTypeOrderInstance.clone()
      assetsObjectTypeOrderInstanceAfer.value.objectTypes = [
        new ReferenceExpression(assetsObjectTypeInstanceOne.elemID, assetsObjectTypeInstanceOne),
        new ReferenceExpression(assetsObjectTypeInstanceFour.elemID, assetsObjectTypeInstanceFour),
        new ReferenceExpression(assetsObjectTypeInstanceTwo.elemID, assetsObjectTypeInstanceTwo),
        new ReferenceExpression(assetsObjectTypeInstanceThree.elemID, assetsObjectTypeInstanceThree),
      ]
      const changes = [
        toChange({ before: assetsObjectTypeOrderInstance, after: assetsObjectTypeOrderInstanceAfer }),
      ]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(3)
    })
  })
})
