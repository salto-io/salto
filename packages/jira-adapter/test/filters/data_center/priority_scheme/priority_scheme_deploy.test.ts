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
import { ElemID, InstanceElement, ObjectType, CORE_ANNOTATIONS, BuiltinTypes, toChange } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../../utils'
import prioritySchemeDeployFilter from '../../../../src/filters/data_center/priority_scheme/priority_scheme_deploy'
import { JIRA, PRIORITY_SCHEME_TYPE_NAME } from '../../../../src/constants'
import JiraClient from '../../../../src/client/client'

describe('prioritySchemeDeployFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let type: ObjectType
  let instance: InstanceElement
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient(true)
    client = cli
    connection = conn

    filter = prioritySchemeDeployFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as filterUtils.FilterWith<'onFetch' | 'deploy'>

    type = new ObjectType({
      elemID: new ElemID(JIRA, PRIORITY_SCHEME_TYPE_NAME),
      fields: {
        name: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    instance = new InstanceElement('instance', type, {
      name: 'someName',
      description: 'desc',
      optionIds: [1, 2],
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations', async () => {
      await filter.onFetch([type])

      expect(type.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      })

      expect(type.fields.name.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should not add deployment annotations if not data center', async () => {
      const { client: cli, paginator, connection: conn } = mockClient(false)
      client = cli
      connection = conn

      filter = prioritySchemeDeployFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as filterUtils.FilterWith<'onFetch' | 'deploy'>

      await filter.onFetch([type])

      expect(type.annotations).toEqual({})
      expect(type.fields.name.annotations).toEqual({})
    })

    it('should not add deployment annotations if type not found', async () => {
      const otherType = new ObjectType({
        elemID: new ElemID(JIRA, 'other'),
        fields: {
          name: {
            refType: BuiltinTypes.STRING,
          },
        },
      })
      await filter.onFetch([otherType])
      expect(otherType.annotations).toEqual({})
    })
  })

  describe('deploy', () => {
    beforeEach(() => {
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          id: 2,
        },
      })
    })

    it('should create priority scheme', async () => {
      await filter.deploy([toChange({ after: instance })])

      expect(instance.value.id).toBe(2)

      expect(connection.post).toHaveBeenCalledWith(
        '/rest/api/2/priorityschemes',
        {
          name: 'someName',
          description: 'desc',
          optionIds: [1, 2],
        },
        undefined,
      )
    })

    it('should throw if received invalid response from create', async () => {
      connection.post.mockResolvedValue({
        status: 200,
        data: {},
      })
      const { deployResult } = await filter.deploy([toChange({ after: instance })])
      expect(deployResult.errors).toHaveLength(1)
    })

    it('should delete priority scheme', async () => {
      instance.value.id = 2
      await filter.deploy([toChange({ before: instance })])

      expect(connection.delete).toHaveBeenCalledWith('/rest/api/2/priorityschemes/2', undefined)
    })

    it('should modify priority scheme', async () => {
      instance.value.id = 2
      await filter.deploy([toChange({ before: instance, after: instance })])

      expect(connection.put).toHaveBeenCalledWith(
        '/rest/api/2/priorityschemes/2',
        {
          id: 2,
          name: 'someName',
          description: 'desc',
          optionIds: [1, 2],
        },
        undefined,
      )
    })

    it('should skip default scheme if there were changes only in optionIds', async () => {
      instance.value.id = 2
      instance.value.defaultScheme = true
      const after = instance.clone()
      after.value.optionIds = [1]
      await filter.deploy([toChange({ before: instance, after })])

      expect(connection.put).not.toHaveBeenCalled()
    })

    it('should not skip default scheme if there were other changes besides optionIds', async () => {
      instance.value.id = 2
      instance.value.defaultScheme = true
      const after = instance.clone()
      after.value.optionIds = [1]
      after.value.description = 'desc2'
      await filter.deploy([toChange({ before: instance, after })])

      expect(connection.put).toHaveBeenCalledWith(
        '/rest/api/2/priorityschemes/2',
        {
          id: 2,
          name: 'someName',
          description: 'desc2',
          optionIds: [1],
          defaultScheme: true,
        },
        undefined,
      )
    })
  })
})
