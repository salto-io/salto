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
import { ElemID, ElemIdGetter, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { mockFunction } from '@salto-io/test-utils'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockClient } from '../../utils'
import { DEFAULT_CONFIG, JiraConfig } from '../../../src/config'
import { JIRA } from '../../../src/constants'
import fieldNameFilter from '../../../src/filters/fields/field_name_filter'

describe('field_name_filter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldType: ObjectType
  let elemIdGetter: jest.MockedFunction<ElemIdGetter>
  let config: JiraConfig
  beforeEach(() => {
    elemIdGetter = mockFunction<ElemIdGetter>()
      .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))

    config = _.cloneDeep(DEFAULT_CONFIG)

    const { client, paginator } = mockClient()
    filter = fieldNameFilter({
      client,
      paginator,
      config,
      getElemIdFunc: elemIdGetter,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as typeof filter

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, 'Field'),
    })
  })
  it('should add __c to custom fields', async () => {
    const custom = new InstanceElement(
      'custom',
      fieldType,
      {
        name: 'custom',
        schema: {
          custom: 'someType',
        },
      }
    )
    const standard = new InstanceElement(
      'standard',
      fieldType,
      {},
    )

    const elements = [custom, standard]
    await filter.onFetch(elements)
    expect(elements.map(e => e.elemID.name)).toEqual([
      'standard',
      'custom__c',
    ])
  })

  it('should use elem id getter', async () => {
    const custom = new InstanceElement(
      'custom',
      fieldType,
      {
        id: '1',
        name: 'custom',
        schema: {
          custom: 'someType',
        },
      }
    )

    elemIdGetter.mockReturnValue(new ElemID(JIRA, 'custom__c2'))

    const elements = [custom]
    await filter.onFetch(elements)
    expect(elemIdGetter).toHaveBeenCalledWith(
      JIRA,
      { id: '1', object_service_id: 'object_name,jira.Field' },
      'custom__c',
    )
    expect(elements.map(e => e.elemID.name)).toEqual([
      'custom__c2',
    ])
  })

  it('should use the default name when there is not service ids config', async () => {
    delete config.apiDefinitions.typeDefaults.transformation.serviceIdField

    elemIdGetter.mockReturnValue(new ElemID(JIRA, 'custom__c2'))

    const custom = new InstanceElement(
      'custom',
      fieldType,
      {
        name: 'custom',
        schema: {
          custom: 'someType',
        },
      }
    )

    elemIdGetter.mockReturnValue(new ElemID(JIRA, 'custom__c'))

    const elements = [custom]
    await filter.onFetch(elements)
    expect(elements.map(e => e.elemID.name)).toEqual([
      'custom__c',
    ])
  })

  it('should use the default name when elemIdGetter was not passed', async () => {
    const { client, paginator } = mockClient()
    filter = fieldNameFilter({
      client,
      paginator,
      config,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as typeof filter

    const custom = new InstanceElement(
      'custom',
      fieldType,
      {
        name: 'custom',
        schema: {
          custom: 'someType',
        },
      }
    )

    elemIdGetter.mockReturnValue(new ElemID(JIRA, 'custom__c'))

    const elements = [custom]
    await filter.onFetch(elements)
    expect(elements.map(e => e.elemID.name)).toEqual([
      'custom__c',
    ])
  })

  it('should use current name if ids fields are undefined', async () => {
    const custom = new InstanceElement(
      'custom2',
      fieldType,
      {
        schema: {
          custom: 'someType',
        },
      }
    )

    const elements = [custom]
    await filter.onFetch(elements)
    expect(elements.map(e => e.elemID.name)).toEqual([
      'custom2',
    ])
  })
})
