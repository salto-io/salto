/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../src/constants'
import { fieldConfigurationsHandler } from '../../src/weak_references/field_configuration_items'
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'

describe('field_configuration_items', () => {
  let fieldConfigurationItemInstance: InstanceElement
  let instance: InstanceElement
  let elementsSource: ReadOnlyElementsSource

  beforeEach(() => {
    fieldConfigurationItemInstance = new InstanceElement(
      'field1ConfigurationItem1',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
    )

    elementsSource = buildElementsSourceFromElements([fieldConfigurationItemInstance])

    instance = new InstanceElement(
      'inst',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME) }),
      {
        fields: [
          { id: 'field1ConfigurationItem1', description: '', isHidden: false, isRequired: false },
          { id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1ConfigurationItem1')), description: '', isHidden: false, isRequired: false },
          { id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1ConfigurationIte2')), description: '', isHidden: false, isRequired: false },
        ],
      }
    )
  })
  describe('findWeakReferences', () => {
    it('should return weak references field configuration items', async () => {
      const references = await fieldConfigurationsHandler.findWeakReferences([instance])

      expect(references).toEqual([
        { source: instance.elemID.createNestedID('1', 'fieldId'), target: fieldConfigurationItemInstance.elemID, type: 'weak' },
        { source: instance.elemID.createNestedID('2', 'fieldId'), target: new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1ConfigurationIte2'), type: 'weak' },
      ])
    })

    it('should do nothing if received invalid field configurations', async () => {
      instance.value.fields = 'invalid'
      const references = await fieldConfigurationsHandler.findWeakReferences([instance])

      expect(references).toEqual([])
    })

    it('should do nothing if there are no field configuration items', async () => {
      delete instance.value.fields
      const references = await fieldConfigurationsHandler.findWeakReferences([instance])

      expect(references).toEqual([])
    })
  })

  describe('removeWeakReferences', () => {
    it('should remove the invalid field configuration items', async () => {
      const fixes = await fieldConfigurationsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([
        {
          elemID: instance.elemID.createNestedID('fields'),
          severity: 'Info',
          message: 'Deploying field configuration without all attached field configuration items',
          detailedMessage: 'This field configuration is attached to some field configuration items that do not exist in the target environment. It will be deployed without referencing these field configuration items.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      expect((fixes.fixedElements[0] as InstanceElement).value.fields).toEqual([
        { id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1ConfigurationItem1')), description: '', isHidden: false, isRequired: false },
      ])
    })

    it('should do nothing if received invalid fields configurations', async () => {
      instance.value.fields = 'invalid'
      const fixes = await fieldConfigurationsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if there are no field configuration items', async () => {
      delete instance.value.fields
      const fixes = await fieldConfigurationsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if all field configuration items are valid', async () => {
      instance.value.fields = [
        { id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1ConfigurationItem1')), description: '', isHidden: false, isRequired: false },
      ]
      const fixes = await fieldConfigurationsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
