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
import { ElemID, ElemIdGetter, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA, SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE } from '../../../src/constants'
import securitySchemeDcDeployFilter from '../../../src/filters/data_center/security_scheme'

describe('dc_security_scheme', () => {
  let secFilter: filterUtils.FilterWith<'deploy'>
  let schemeInstance: InstanceElement
  let modifySchemeInstance: InstanceElement
  let levelInstanceStandAlone: InstanceElement
  let levelInstance1: InstanceElement
  let levelInstance2: InstanceElement
  let connection: MockInterface<clientUtils.APIConnection>

  beforeEach(() => {
    const elemIdGetter = mockFunction<ElemIdGetter>()
      .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))

    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))

    const { client, paginator, connection: conn } = mockClient(true)
    connection = conn
    secFilter = securitySchemeDcDeployFilter(getFilterParams({
      client,
      paginator,
      config,
      getElemIdFunc: elemIdGetter,
    })) as typeof secFilter

    const schemeType = new ObjectType({
      elemID: new ElemID(JIRA, SECURITY_SCHEME_TYPE),
      fields:
      {
      },
    })

    const levelType = new ObjectType({
      elemID: new ElemID(JIRA, SECURITY_LEVEL_TYPE),
      fields:
      {
      },
    })
    schemeInstance = new InstanceElement(
      'instance',
      schemeType,
      {
        name: 'scheme1',
        description: 'desc1',
      }
    )
    modifySchemeInstance = new InstanceElement(
      'instance',
      schemeType,
      {
        name: 'scheme2',
        description: 'desc2',
        id: 12,
      }
    )
    levelInstanceStandAlone = new InstanceElement(
      'levelInstance',
      levelType,
      {
        name: 'level0',
        description: 'desc10',
      },
      undefined,
      {
        _parent: { value: { value: { id: 12 } } },
      },
    )
    levelInstance1 = new InstanceElement(
      'levelInstance',
      levelType,
      {
        name: 'level1',
        description: 'desc11',
      }
    )
    levelInstance2 = new InstanceElement(
      'levelInstance',
      levelType,
      {
        id: 102,
        name: 'level2',
        description: 'desc12',
      }
    )
    connection.post.mockResolvedValueOnce({
      status: 200,
      data: {
        id: 1,
      },
    })
  })
  it('should deploy scheme only changes', async () => {
    const { deployResult: { errors, appliedChanges }, leftoverChanges } = await secFilter.deploy(
      [toChange({ after: schemeInstance })]
    )
    expect(errors.length).toEqual(0)
    expect(appliedChanges.length).toEqual(1)
    expect(getChangeData(appliedChanges[0]).elemID.typeName).toEqual(SECURITY_SCHEME_TYPE)
    expect(leftoverChanges.length).toEqual(0)
    expect(connection.post).toHaveBeenCalledWith(
      '/rest/salto/1.0/issuesecurityschemes',
      {
        name: 'scheme1',
        description: 'desc1',
      },
      undefined,
    )
  })
  it('should deploy create scheme and level', async () => {
    const { deployResult: { errors, appliedChanges }, leftoverChanges } = await secFilter.deploy(
      [toChange({ after: schemeInstance }), toChange({ after: levelInstance1 })]
    )
    expect(errors.length).toEqual(0)
    expect(appliedChanges.length).toEqual(2)
    expect(getChangeData(appliedChanges[0]).elemID.typeName).toEqual(SECURITY_SCHEME_TYPE)
    expect(getChangeData(appliedChanges[1]).elemID.typeName).toEqual(SECURITY_LEVEL_TYPE)
    expect(leftoverChanges.length).toEqual(0)
    expect(connection.post).toHaveBeenNthCalledWith(
      1,
      '/rest/salto/1.0/issuesecurityschemes',
      {
        name: 'scheme1',
        description: 'desc1',
      },
      undefined,
    )
    expect(connection.post).toHaveBeenNthCalledWith(
      2,
      '/rest/salto/1.0/securitylevel?securitySchemeId=1',
      {
        name: 'level1',
        description: 'desc11',
      },
      undefined,
    )
  })
  it('should deploy modify scheme and level', async () => {
    const { deployResult: { errors, appliedChanges }, leftoverChanges } = await secFilter.deploy(
      [toChange({ before: levelInstance1, after: modifySchemeInstance }),
        toChange({ before: modifySchemeInstance, after: levelInstance2 })]
    )
    expect(errors.length).toEqual(0)
    expect(appliedChanges.length).toEqual(2)
    expect(getChangeData(appliedChanges[0]).elemID.typeName).toEqual(SECURITY_SCHEME_TYPE)
    expect(getChangeData(appliedChanges[1]).elemID.typeName).toEqual(SECURITY_LEVEL_TYPE)
    expect(leftoverChanges.length).toEqual(0)
    expect(connection.put).toHaveBeenNthCalledWith(
      1,
      '/rest/salto/1.0/issuesecurityschemes',
      {
        id: 12,
        name: 'scheme2',
        description: 'desc2',
      },
      undefined,
    )
    expect(connection.put).toHaveBeenNthCalledWith(
      2,
      '/rest/salto/1.0/securitylevel?securitySchemeId=12',
      {
        id: 102,
        name: 'level2',
        description: 'desc12',
      },
      undefined,
    )
  })
  it('should deploy level only changes', async () => {
    const { deployResult: { errors, appliedChanges }, leftoverChanges } = await secFilter.deploy(
      [toChange({ before: levelInstance1, after: levelInstanceStandAlone })]
    )
    expect(errors.length).toEqual(0)
    expect(appliedChanges.length).toEqual(1)
    expect(getChangeData(appliedChanges[0]).elemID.typeName).toEqual(SECURITY_LEVEL_TYPE)
    expect(leftoverChanges.length).toEqual(0)
    expect(connection.put).toHaveBeenCalledWith(
      '/rest/salto/1.0/securitylevel?securitySchemeId=12',
      {
        name: 'level0',
        description: 'desc10',
      },
      undefined,
    )
  })
  it('should not change type on cloud flow', async () => {
    const elemIdGetter = mockFunction<ElemIdGetter>()
      .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    const { client, paginator } = mockClient()
    const cloudFilter = securitySchemeDcDeployFilter(getFilterParams({
      client,
      paginator,
      config,
      getElemIdFunc: elemIdGetter,
    })) as typeof secFilter
    const { deployResult: { errors, appliedChanges }, leftoverChanges } = await cloudFilter.deploy(
      [toChange({ after: schemeInstance }),
        toChange({ after: levelInstance1 })]
    )
    expect(errors.length).toEqual(0)
    expect(appliedChanges.length).toEqual(0)
    expect(leftoverChanges.length).toEqual(2)
  })
  it('should pass leftovers successfully', async () => {
    const otherSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'other'),
      fields:
      {
      },
    })
    const otherSchemeInstance = new InstanceElement(
      'instance',
      otherSchemeType,
      {
        name: 'scheme2',
        description: 'desc2',
        id: 12,
      }
    )
    const { deployResult: { errors, appliedChanges }, leftoverChanges } = await secFilter.deploy(
      [toChange({ after: otherSchemeInstance })]
    )
    expect(errors.length).toEqual(0)
    expect(appliedChanges.length).toEqual(0)
    expect(leftoverChanges.length).toEqual(1)
    expect(getChangeData(leftoverChanges[0]).elemID.typeName).toEqual(otherSchemeInstance.elemID.typeName)
  })
  it('should return error if failed on scheme', async () => {
    connection.post.mockReset()
    connection.post.mockRejectedValueOnce(new Error('Name already exists'))
    const { deployResult: { errors, appliedChanges }, leftoverChanges } = await secFilter.deploy(
      [toChange({ after: schemeInstance }), toChange({ after: levelInstance1 })]
    )
    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Deployment of jira.SecurityScheme.instance.instance failed: Error: Failed to post /rest/api/3/issuesecurityschemes with error: Error: Name already exists')
    expect(appliedChanges.length).toEqual(0)
    expect(leftoverChanges.length).toEqual(0)
  })
})
