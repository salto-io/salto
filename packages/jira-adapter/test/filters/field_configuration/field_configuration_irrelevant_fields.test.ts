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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { JIRA } from '../../../src/constants'
import fieldConfigurationIrrelevantFields from '../../../src/filters/field_configuration/field_configuration_irrelevant_fields'
import { getFilterParams } from '../../utils'

describe('fieldConfigurationIrrelevantFields', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldConfigurationType: ObjectType
  let fieldInstance: InstanceElement

  beforeEach(async () => {
    filter = fieldConfigurationIrrelevantFields(getFilterParams()) as typeof filter

    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfiguration'),
      fields: {},
    })

    fieldInstance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }), {})
  })

  describe('onFetch', () => {
    it('should remove fields that are not references with values', async () => {
      const instance = new InstanceElement('instance', fieldConfigurationType, {
        fields: [
          {
            id: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
          },
          {
            id: '2',
          },
          {
            id: new ReferenceExpression(fieldInstance.elemID),
          },
        ],
      })
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        fields: [
          {
            id: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
          },
        ],
      })
    })

    it('should remove locked fields', async () => {
      fieldInstance.value.isLocked = true

      const instance = new InstanceElement('instance', fieldConfigurationType, {
        fields: [
          {
            id: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
          },
        ],
      })
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        fields: [],
      })
    })

    it('should do nothing of fields are not fetched', async () => {
      const query = elementUtils.query.createMockQuery()
      query.isTypeMatch.mockImplementation(typeName => typeName !== FIELD_TYPE_NAME)

      filter = fieldConfigurationIrrelevantFields(
        getFilterParams({
          fetchQuery: query,
        }),
      ) as typeof filter

      const instance = new InstanceElement('instance', fieldConfigurationType, {
        fields: [
          {
            id: '2',
          },
        ],
      })
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        fields: [
          {
            id: '2',
          },
        ],
      })
    })

    it('should do nothing of there are no fields', async () => {
      const instance = new InstanceElement('instance', fieldConfigurationType, {
        name: 'name',
      })
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        name: 'name',
      })
    })
  })
})
