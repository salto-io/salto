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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, InstanceElement, ListType, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils, deployment } from '@salto-io/adapter-components'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { getLookUpName } from '../../src/references'
import JiraClient from '../../src/client/client'
import { DEFAULT_CONFIG } from '../../src/config'
import { JIRA } from '../../src/constants'
import fieldConfigurationFilter from '../../src/filters/field_configuration'
import { mockClient } from '../utils'

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

describe('fieldConfigurationFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let fieldConfigurationType: ObjectType
  let fieldConfigurationItemType: ObjectType
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let mockCli: JiraClient

  beforeEach(async () => {
    const { client, paginator, connection } = mockClient()
    mockConnection = connection
    mockCli = client

    filter = fieldConfigurationFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter

    fieldConfigurationItemType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfigurationItem'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        description: { refType: BuiltinTypes.STRING },
        isHidden: { refType: BuiltinTypes.BOOLEAN },
        isRequired: { refType: BuiltinTypes.BOOLEAN },
        renderer: { refType: BuiltinTypes.STRING },
      },
    })

    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfiguration'),
      fields: {
        fields: { refType: new ListType(fieldConfigurationItemType) },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations to FieldConfiguration', async () => {
      await filter.onFetch([fieldConfigurationType])
      expect(fieldConfigurationType.fields.fields.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should add deployment annotations to FieldConfigurationItem', async () => {
      await filter.onFetch([fieldConfigurationItemType])
      expect(fieldConfigurationItemType.fields.id.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(fieldConfigurationItemType.fields.description.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(fieldConfigurationItemType.fields.isHidden.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(fieldConfigurationItemType.fields.isRequired.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(fieldConfigurationItemType.fields.renderer.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
  })

  describe('deploy', () => {
    const supportedFields = _.range(0, 150).map(i => ({
      id: new ReferenceExpression(
        new ElemID(JIRA, 'Field', 'instance', `supported${i}`),
        {
          value: {
            id: `supported${i}`,
          },
        }
      ),
    }))

    let instance: InstanceElement
    let change: Change<InstanceElement>

    beforeEach(async () => {
      instance = new InstanceElement(
        'instance',
        fieldConfigurationType,
        {
          name: 'name',
          id: 1,
          fields: [
            {
              id: 'notSupported1',
            },
            {
              id: new ReferenceExpression(
                new ElemID(JIRA, 'Field', 'instance', 'notSupported2'),
                {
                  value: {
                    id: 'notSupported2',
                    isLocked: true,
                  },
                }
              ),
            },
            ...supportedFields,
          ],
        }
      )

      change = toChange({ before: instance, after: instance })
    })

    it('should deploy regular fields using deployChange', async () => {
      await filter.deploy([change])
      expect(deployChange).toHaveBeenCalledWith(
        await resolveChangeElement(change, getLookUpName),
        mockCli,
        DEFAULT_CONFIG.apiDefinitions.types.FieldConfiguration.deployRequests,
        ['fields'],
        undefined,
      )
    })

    it('should deploy supported fields configuration in chunks', async () => {
      await filter.deploy([change])
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfiguration/1/fields',
        {
          fieldConfigurationItems: supportedFields.slice(0, 100)
            .map(field => ({ ...field, id: field.id.value.value.id })),
        },
        undefined,
      )
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfiguration/1/fields',
        {
          fieldConfigurationItems: supportedFields.slice(100, supportedFields.length)
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
  })
})
