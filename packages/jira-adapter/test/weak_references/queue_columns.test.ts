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
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JIRA, QUEUE_TYPE } from '../../src/constants'
import { queueFieldsHandler } from '../../src/weak_references/queue_columns'
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'

describe('queue_colmns', () => {
  const fieldType = new ObjectType({
    elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
    },
  })
  let fieldInstance: InstanceElement
  const queueType = new ObjectType({
    elemID: new ElemID('jira', QUEUE_TYPE),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
      columns: {
        refType: new ListType(BuiltinTypes.STRING),
      },
    },
  })
  let queueInstance: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  const AdapterConfigType = new ObjectType({
    elemID: new ElemID('adapter'),
    isSettings: true,
  })
  const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)

  beforeEach(() => {
    fieldInstance = new InstanceElement('field1', fieldType, { id: 'fieldId', name: 'field1' })
    elementsSource = buildElementsSourceFromElements([fieldInstance])

    queueInstance = new InstanceElement('queueInstance', queueType, {
      columns: [
        'col1',
        new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1')),
        new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field2')),
      ],
    })
  })
  describe('findWeakReferences', () => {
    it('should return weak references fields', async () => {
      const references = await queueFieldsHandler.findWeakReferences([queueInstance], adapterConfig)

      expect(references).toEqual([
        { source: queueInstance.elemID.createNestedID('1'), target: fieldInstance.elemID, type: 'weak' },
        {
          source: queueInstance.elemID.createNestedID('2'),
          target: new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field2'),
          type: 'weak',
        },
      ])
    })

    it('should do nothing if received invalid queue', async () => {
      queueInstance.value.columns = 'invalid'
      const references = await queueFieldsHandler.findWeakReferences([queueInstance], adapterConfig)

      expect(references).toEqual([])
    })

    it('should do nothing if there are no columns', async () => {
      delete queueInstance.value.columns
      const references = await queueFieldsHandler.findWeakReferences([queueInstance], adapterConfig)

      expect(references).toEqual([])
    })
  })

  describe('removeWeakReferences', () => {
    it('should remove the invalid fields', async () => {
      const fixes = await queueFieldsHandler.removeWeakReferences({ elementsSource })([queueInstance])

      expect(fixes.errors).toEqual([
        {
          elemID: queueInstance.elemID.createNestedID('columns'),
          severity: 'Info',
          message: 'Queue will be deployed without columns defined on non-existing fields',
          detailedMessage:
            'This queue has columns which use fields which no longer exist. It will be deployed without them.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      expect((fixes.fixedElements[0] as InstanceElement).value.columns).toEqual([
        'col1',
        new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1')),
      ])
    })

    it('should do nothing if received invalid queue', async () => {
      queueInstance.value.columns = 'invalid'
      const fixes = await queueFieldsHandler.removeWeakReferences({ elementsSource })([queueInstance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if there are no columns', async () => {
      delete queueInstance.value.columns
      const fixes = await queueFieldsHandler.removeWeakReferences({ elementsSource })([queueInstance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if all columns are valid', async () => {
      queueInstance.value.columns = [
        'col1',
        new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1')),
      ]
      const fixes = await queueFieldsHandler.removeWeakReferences({ elementsSource })([queueInstance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
