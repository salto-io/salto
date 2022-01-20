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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import { JIRA } from '../../src/constants'
import fieldConfigurationTrashedFieldsFilter from '../../src/filters/field_configuration_trashed_fields'
import { mockClient } from '../utils'


describe('fieldConfigurationTrashedFieldsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldConfigurationType: ObjectType

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = fieldConfigurationTrashedFieldsFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter


    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfiguration'),
      fields: {},
    })
  })

  describe('onFetch', () => {
    it('should remove fields that are not references', async () => {
      const instance = new InstanceElement(
        'instance',
        fieldConfigurationType,
        {
          fields: [
            {
              id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', 'field1')),
            },
            {
              id: '2',
            },
          ],
        }
      )
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        fields: [
          {
            id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', 'field1')),
          },
        ],
      })
    })

    it('should do nothing of there are no fields', async () => {
      const instance = new InstanceElement(
        'instance',
        fieldConfigurationType,
        {
          name: 'name',
        }
      )
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        name: 'name',
      })
    })
  })
})
