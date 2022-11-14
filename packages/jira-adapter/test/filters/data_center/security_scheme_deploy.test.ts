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
import { BuiltinTypes, Change, ChangeDataType, ElemID, ElemIdGetter, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA } from '../../../src/constants'
import dcSecuritySchemeDeployFilter from '../../../src/filters/data_center/security_scheme_deploy'

const verifyElement = (appliedChanges: readonly Change[], num: number):void => {
  expect(appliedChanges.length).toEqual(1)
  const afterChange = (appliedChanges[0].data as { after: ChangeDataType })
    .after as InstanceElement
  expect(afterChange.value.id).toEqual(num)
  expect(afterChange.value.name).toEqual(`name${num}`)
  expect(afterChange.value.description).toEqual(`description${num}`)
}

describe('security_scheme_deploy', () => {
  let filter: filterUtils.FilterWith<'deploy'>
  let instances: InstanceElement[]

  beforeEach(() => {
    const elemIdGetter = mockFunction<ElemIdGetter>()
      .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))

    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))

    const { client, paginator, connection } = mockClient(true)
    filter = dcSecuritySchemeDeployFilter(getFilterParams({
      client,
      paginator,
      config,
      getElemIdFunc: elemIdGetter,
    })) as typeof filter

    const objectType = new ObjectType({
      elemID: new ElemID(JIRA, 'SecurityScheme'),
      fields:
      {
        str: { refType: BuiltinTypes.STRING }, // wrong structure
      },
    })
    const levelObjectType = new ObjectType({
      elemID: new ElemID(JIRA, 'SecurityLevel'),
      fields:
      {
        str: { refType: BuiltinTypes.STRING }, // wrong structure
      },
    })
    const wrongObjectType = new ObjectType({
      elemID: new ElemID(JIRA, 'PermissionScheme'),
      fields:
      {
        str: { refType: BuiltinTypes.STRING }, // wrong structure
      },
    })

    instances = []
    instances[0] = new InstanceElement(
      'instance1',
      objectType,
      {
        name: 'name1',
        description: 'description1',
      }
    )

    instances[1] = new InstanceElement(
      'instance2',
      objectType,
      {
        name: 'name2',
        description: 'description2',
      }
    )

    instances[2] = new InstanceElement(
      'instance3',
      wrongObjectType,
      {
        name: 'name3',
        description: 'description3',
      }
    )
    instances[3] = new InstanceElement(
      'instance4',
      levelObjectType,
      {
        name: 'name4',
        description: 'description4',
      }
    )

    connection.post.mockImplementation(async url => {
      if (url === 'rest/salto/1.0/issuesecurityschemes?name=name1&description=description1') {
        return {
          status: 200,
          data: {
            id: 1,
            name: 'name1',
            description: 'description1',
          },
        }
      }
      if (url === 'rest/salto/1.0/issuesecurityschemes?name=name2&description=description2') {
        return {
          status: 200,
          data: {
            id: 2,
            name: 'name2',
            description: 'description2',
          },
        }
      }
      throw new Error(`Unexpected url ${url}`)
    })
  })
  describe('security scheme', async () => {
    it('should successfully add and update id', async () => {
      const res = await filter.deploy([toChange({ after: instances[0] })])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toEqual([])
      verifyElement(res.deployResult.appliedChanges, 1)
    })
    it('should move un-relevant changes correctly', async () => {
      const res = await filter.deploy(
        [toChange({ after: instances[1] }),
          toChange({ after: instances[2] })]
      )
      expect(res.leftoverChanges).toHaveLength(1)
      const leftOver = (res.leftoverChanges[0].data as { after: ChangeDataType })
        .after as InstanceElement
      expect(leftOver.value.name).toEqual('name3')
      expect(res.deployResult.errors).toEqual([])
      verifyElement(res.deployResult.appliedChanges, 2)
    })
    it('should not change elements in the cloud', async () => {
      const { client, paginator } = mockClient(false)
      const elemIdGetter = mockFunction<ElemIdGetter>()
        .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      filter = dcSecuritySchemeDeployFilter(getFilterParams({
        client,
        paginator,
        config,
        getElemIdFunc: elemIdGetter,
      })) as typeof filter

      const res = await filter.deploy(
        [toChange({ after: instances[0] }),
          toChange({ after: instances[2] }),
          toChange({ after: instances[1] })]
      )
      expect(res.leftoverChanges).toHaveLength(3)
      expect(res.deployResult.appliedChanges.length).toEqual(0)
    })
  })
  describe('security level', async () => {
    it('should successfully add and update id', async () => {
      const res = await filter.deploy([toChange({ after: instances[0] })])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toEqual([])
      verifyElement(res.deployResult.appliedChanges, 1)
    })
  })
})
