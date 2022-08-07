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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange, ReferenceExpression, getChangeData, getAllChangeData } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../../utils'
import statusDeploymentFilter from '../../../src/filters/statuses/status_deployment'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, STATUS_TYPE_NAME } from '../../../src/constants'
import JiraClient from '../../../src/client/client'

describe('statusDeploymentFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let type: ObjectType
  let config: JiraConfig
  let client: JiraClient
  let statusInstance: InstanceElement
  let statusCategoryType: ObjectType
  let statusCategoryInstance: InstanceElement
  let modifiedInstance: InstanceElement

  beforeEach(async () => {
    const { client: cli, paginator, connection } = mockClient()
    mockConnection = connection
    client = cli

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = statusDeploymentFilter(getFilterParams({
      client,
      paginator,
      config,
    })) as filterUtils.FilterWith<'onFetch' | 'deploy'>

    type = new ObjectType({
      elemID: new ElemID(JIRA, STATUS_TYPE_NAME),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        statusCategory: { refType: BuiltinTypes.STRING },
      },
    })

    statusCategoryType = new ObjectType({
      elemID: new ElemID(JIRA, 'Status Category'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        name: { refType: BuiltinTypes.STRING },
      },
    })

    statusCategoryInstance = new InstanceElement(
      'Done',
      statusCategoryType,
      {
        id: 3,
        name: 'Done',
      }
    )

    statusInstance = new InstanceElement(
      'statusInstance',
      type,
      {
        name: 'status',
        description: 'a new status',
        statusCategory: new ReferenceExpression(
          statusCategoryInstance.elemID.createNestedID('id'), 3
        ),
      }
    )

    modifiedInstance = statusInstance.clone()
    modifiedInstance.value.description = 'new description'
  })

  describe('onFetch', () => {
    it('should replace status category with id', async () => {
      const instances = [new InstanceElement(
        'instance',
        type,
        { statusCategory: 'TODO' }
      ),
      new InstanceElement(
        'instance',
        type,
        { statusCategory: 'IN_PROGRESS' }
      ),
      new InstanceElement(
        'instance',
        type,
        { statusCategory: 'DONE' }
      )]

      await filter.onFetch?.([...instances, type])
      expect(instances[0].value).toEqual({
        statusCategory: 2,
      })
      expect(instances[1].value).toEqual({
        statusCategory: 4,
      })
      expect(instances[2].value).toEqual({
        statusCategory: 3,
      })
    })

    it('should do nothing if the status category is different', async () => {
      const instance = new InstanceElement(
        'instance',
        type,
        {
          statusCategory: 'NEW',
        },
      )
      await filter.onFetch?.([instance, type])
      expect(instance.value.statusCategory).toEqual('NEW')
    })

    it('should add deployment annotations', async () => {
      await filter.onFetch?.([type])
      expect(type.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      })

      expect(type.fields.id.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(type.fields.name.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(type.fields.description.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(type.fields.statusCategory.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should do nothing when usePrivateAPI config is off', async () => {
      config.client.usePrivateAPI = false

      await filter.onFetch?.([type])

      expect(type.annotations).toEqual({})
      expect(type.fields.id.annotations).toEqual({})
      expect(type.fields.name.annotations).toEqual({})
      expect(type.fields.description.annotations).toEqual({})
      expect(type.fields.statusCategory.annotations).toEqual({})
    })
  })

  describe('preDeploy', () => {
    it('should replace instance references with values for modification changes', async () => {
      const changes = [toChange({ before: statusInstance, after: modifiedInstance })]
      await filter.preDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.statusCategory).toEqual('DONE')
      expect(after.value.statusCategory).toEqual('DONE')
    })

    it('should replace instance references with values for addition changes', async () => {
      const changes = [toChange({ after: modifiedInstance })]
      await filter.preDeploy(changes)
      const after = getChangeData(changes[0])
      expect(after.value.statusCategory).toEqual('DONE')
    })
  })

  describe('deploy statuses', () => {
    beforeEach(async () => {
      mockConnection.post.mockClear()
    })

    it('should return applied changes with no errors', async () => {
      const additionInstance = new InstanceElement(
        'newInstance',
        type,
        {
          name: 'status 2',
          description: 'a new status',
          statusCategory: new ReferenceExpression(
            statusCategoryInstance.elemID.createNestedID('id'), 3
          ),
        }
      )
      const changes = [
        toChange({ before: statusInstance, after: modifiedInstance }),
        toChange({ after: additionInstance }),
      ]
      await filter.preDeploy(changes)
      const { deployResult } = await filter.deploy(changes)
      expect(deployResult.appliedChanges).toHaveLength(2)
      expect(getChangeData(deployResult.appliedChanges[0]).elemID.getFullName())
        .toEqual('jira.Status.instance.statusInstance')
      expect(getChangeData(deployResult.appliedChanges[1]).elemID.getFullName())
        .toEqual('jira.Status.instance.newInstance')
      expect(deployResult.errors).toHaveLength(0)
    })

    it('should return error if deploy fails', async () => {
      mockConnection.post.mockRejectedValue(new Error('failed'))
      const nonDeployableInstance = new InstanceElement(
        'nonDeployable',
        type,
        {
          name: 'nonDeployable',
          description: 'a category',
        }
      )
      const changes = [toChange({ after: nonDeployableInstance })]
      const { deployResult } = await filter.deploy(changes)
      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(deployResult.errors).toHaveLength(1)
    })

    it('should return status deletion changes as leftover changes', async () => {
      const changes = [toChange({ before: statusInstance })]
      const { deployResult, leftoverChanges } = await filter.deploy(changes)
      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(deployResult.errors).toHaveLength(0)
      expect(leftoverChanges).toHaveLength(1)
      expect(getChangeData(leftoverChanges[0]).elemID.getFullName())
        .toEqual('jira.Status.instance.statusInstance')
    })
  })

  describe('onDeploy', () => {
    it('should restore changes references', async () => {
      const changes = [toChange({ before: statusInstance, after: modifiedInstance })]
      await filter.preDeploy?.(changes)
      await filter.onDeploy?.(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.statusCategory).toBeInstanceOf(ReferenceExpression)
      expect(after.value.statusCategory).toBeInstanceOf(ReferenceExpression)
    })
  })
})
