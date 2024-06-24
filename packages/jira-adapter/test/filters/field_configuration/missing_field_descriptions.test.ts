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
import { filterUtils } from '@salto-io/adapter-components'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, JIRA } from '../../../src/constants'
import missingFieldDescriptionsFilter from '../../../src/filters/field_configuration/missing_field_descriptions'
import { getFilterParams, mockClient } from '../../utils'

describe('missingFieldDescriptionsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let type: ObjectType
  let fieldType: ObjectType
  let instance: InstanceElement
  let fieldInstance: InstanceElement

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = missingFieldDescriptionsFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter

    type = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME),
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
    })

    fieldInstance = new InstanceElement('fieldInstance', fieldType, {
      description: 'fieldDesc',
    })

    instance = new InstanceElement('instance', type, {
      id: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
      description: '',
    })
  })

  describe('onFetch', () => {
    it('should add description from field when empty', async () => {
      await filter.onFetch([instance])
      expect(instance.value.description).toBe('fieldDesc')
    })

    it('should add empty description from when no field description', async () => {
      delete fieldInstance.value.description
      await filter.onFetch([instance])
      expect(instance.value.description).toBe('')
    })

    it('should not add description when there is description', async () => {
      instance.value.description = 'desc'
      await filter.onFetch([instance])
      expect(instance.value.description).toBe('desc')
    })
  })
})
