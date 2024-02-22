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
import { Change, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils, deployment } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { JIRA } from '../../../src/constants'
import fieldConfigurationDeploymentFilter from '../../../src/filters/field_configuration/field_configuration_deployment'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'
import { getFilterParams, mockClient } from '../../utils'

const { deployChange } = deployment

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

describe('fieldConfigurationDeploymentFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let fieldConfigurationType: ObjectType
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator, connection } = mockClient()
    mockConnection = connection

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = fieldConfigurationDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter

    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfiguration'),
    })
  })

  describe('deploy', () => {
    const supportedFields = _.range(0, 150).map(i => ({
      id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', `supported${i}`), {
        value: {
          id: `supported${i}`,
        },
      }),
    }))

    let instance: InstanceElement
    let change: Change<InstanceElement>

    beforeEach(async () => {
      ;(deployChange as jest.Mock).mockClear()
      instance = new InstanceElement('instance', fieldConfigurationType, {
        name: 'name',
        id: 1,
        fields: [
          {
            id: 'notSupported1',
          },
          ...supportedFields,
        ],
      })

      const beforeInstance = instance.clone()
      beforeInstance.value.description = 'before'

      change = toChange({ before: beforeInstance, after: instance })
    })

    it('should deploy regular fields using deployChange in modification', async () => {
      await filter.deploy([change])
      expect(deployChange).toHaveBeenCalled()
    })

    it('should deploy regular fields using deployChange in creation', async () => {
      await filter.deploy([toChange({ after: instance })])
      expect(deployChange).toHaveBeenCalled()
    })

    it('should not deploy regular fields if is default and change is modification', async () => {
      instance.value.isDefault = true
      await filter.deploy([change])
      expect(deployChange).not.toHaveBeenCalled()
    })

    it('should deploy supported fields configuration in chunks', async () => {
      await filter.deploy([change])
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfiguration/1/fields',
        {
          fieldConfigurationItems: supportedFields
            .slice(0, 100)
            .map(field => ({ ...field, id: field.id.value.value.id })),
        },
        undefined,
      )
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfiguration/1/fields',
        {
          fieldConfigurationItems: supportedFields
            .slice(100, supportedFields.length)
            .map(field => ({ ...field, id: field.id.value.value.id })),
        },
        undefined,
      )
    })

    it('should not deploy fields configuration if empty', async () => {
      delete instance.value.fields
      await filter.deploy([change])
      expect(mockConnection.put).not.toHaveBeenCalledWith()
    })

    it('should not deploy if splitFieldConfiguration is true', async () => {
      config.fetch.splitFieldConfiguration = true
      const res = await filter.deploy([change])
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
    })
  })
})
