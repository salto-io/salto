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
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { fieldsHandler } from '../../../src/custom_references/weak_references/fields_references'
import { NETSUITE, SCRIPT_ID, TRANSACTION_FORM } from '../../../src/constants'
import { transactionFormType } from '../../../src/autogen/types/standard_types/transactionForm'

describe('permissions_references', () => {
  let instance1: InstanceElement
  let instance2: InstanceElement
  let instance3: InstanceElement
  let form1: InstanceElement
  let form2: InstanceElement

  const inst1 = new InstanceElement(
    'instance1',
    new ObjectType({
      elemID: new ElemID(NETSUITE, 'instance1'),
    }),
    {
      [SCRIPT_ID]: 'instance1',
    },
  )

  const inst2 = new InstanceElement(
    'instance2',
    new ObjectType({
      elemID: new ElemID(NETSUITE, 'instance2'),
    }),
    {
      [SCRIPT_ID]: 'instance2',
    },
  )

  const inst3 = new InstanceElement(
    'instance3',
    new ObjectType({
      elemID: new ElemID(NETSUITE, 'instance3'),
    }),
    {
      [SCRIPT_ID]: 'instance3',
    },
  )

  const form1Instance = new InstanceElement('form1', transactionFormType().type, {
    [SCRIPT_ID]: 'form1',
    field1: {
      id: new ReferenceExpression(inst1.elemID.createNestedID(SCRIPT_ID), inst1.value.scriptid, inst1),
    },
    stringId: {
      id: 'some string id',
    },
    parentField: {
      field2: {
        id: new ReferenceExpression(inst2.elemID.createNestedID(SCRIPT_ID), inst2.value.scriptid, inst2),
        index: 0,
      },
    },
  })

  const form2Instance = new InstanceElement(
    'form2',
    transactionFormType().type,
    {
      [SCRIPT_ID]: 'form2',
      field1: {
        id: new ReferenceExpression(inst1.elemID.createNestedID(SCRIPT_ID), inst1.value.scriptid, inst1),
      },
      parentField: {
        field2: {
          id: '[type=transactionbodycustomfield, scriptid=instance2]',
          index: 0,
        },
        field3: {
          id: '[type=transactionbodycustomfield, scriptid=instance3]',
          index: 1,
        },
      },
    },
    [NETSUITE, TRANSACTION_FORM, 'form2'],
    {
      [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
        {
          reference: new ReferenceExpression(inst2.elemID.createNestedID(SCRIPT_ID), inst2.value.scriptid, inst2),
        },
        {
          reference: new ReferenceExpression(inst3.elemID.createNestedID(SCRIPT_ID), inst3.value.scriptid, inst3),
        },
        {
          invalid: 'irrelevent generated dependency',
        },
      ],
    },
  )

  const AdapterConfigType = new ObjectType({
    elemID: new ElemID('adapter'),
    isSettings: true,
  })
  const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)

  beforeEach(() => {
    instance1 = inst1.clone()
    instance2 = inst2.clone()
    instance3 = inst3.clone()
    form1 = form1Instance.clone()
    form2 = form2Instance.clone()
  })

  describe('findWeakReferences', () => {
    it('should return weak references for fields', async () => {
      const references = await fieldsHandler.findWeakReferences([form1], adapterConfig)
      expect(references).toEqual([
        {
          source: form1.elemID.createNestedID('field1'),
          target: instance1.elemID.createNestedID(SCRIPT_ID),
          type: 'weak',
        },
        {
          source: form1.elemID.createNestedID('parentField', 'field2'),
          target: instance2.elemID.createNestedID(SCRIPT_ID),
          type: 'weak',
        },
      ])
    })
    it('should return weak references for generated permissions', async () => {
      const references = await fieldsHandler.findWeakReferences([form2], adapterConfig)
      expect(references).toEqual([
        {
          source: form2.elemID.createNestedID('field1'),
          target: instance1.elemID.createNestedID(SCRIPT_ID),
          type: 'weak',
        },
        {
          source: form2.elemID.createNestedID(CORE_ANNOTATIONS.GENERATED_DEPENDENCIES, '0'),
          target: instance2.elemID.createNestedID(SCRIPT_ID),
          type: 'weak',
        },
        {
          source: form2.elemID.createNestedID(CORE_ANNOTATIONS.GENERATED_DEPENDENCIES, '1'),
          target: instance3.elemID.createNestedID(SCRIPT_ID),
          type: 'weak',
        },
      ])
    })
  })

  describe('removeWeakReferences', () => {
    describe('should remove the invalid references and keep valid ones', () => {
      it('should remove top level field reference', async () => {
        const clonedForm1 = form1.clone()
        const elementsSource = buildElementsSourceFromElements([instance2])
        const fixes = await fieldsHandler.removeWeakReferences({ elementsSource })([form1])
        expect(clonedForm1).toEqual(form1)

        expect(fixes.errors.length).toEqual(1)

        expect(fixes.errors).toEqual([
          {
            elemID: form1.elemID,
            severity: 'Info',
            message: 'Deploying without all referenced fields',
            detailedMessage:
              'This form1.field1 is referencing a field that does not exist in the target environment. As a result, it will be deployed without this field.',
          },
        ])

        expect(fixes.fixedElements).toHaveLength(1)
        const fixedElement = fixes.fixedElements[0]
        expect(isInstanceElement(fixedElement) && fixedElement.elemID.typeName === TRANSACTION_FORM).toBeTruthy()
        const fixedForm = fixedElement as InstanceElement
        expect(fixedForm.value.field1).toBeUndefined()
        expect(fixedForm.value.parentField.field2).toEqual(form1.value.parentField.field2)
        expect(fixedForm.value.stringId).toEqual(form1.value.stringId)
      })
      it('should remove inner field reference', async () => {
        const clonedForm1 = form1.clone()
        const elementsSource = buildElementsSourceFromElements([instance1])
        const fixes = await fieldsHandler.removeWeakReferences({ elementsSource })([form1])
        expect(clonedForm1).toEqual(form1)

        expect(fixes.errors.length).toEqual(1)

        expect(fixes.errors).toEqual([
          {
            elemID: form1.elemID,
            severity: 'Info',
            message: 'Deploying without all referenced fields',
            detailedMessage:
              'This form1.parentField.field2 is referencing a field that does not exist in the target environment. As a result, it will be deployed without this field.',
          },
        ])

        expect(fixes.fixedElements).toHaveLength(1)
        const fixedElement = fixes.fixedElements[0]
        expect(isInstanceElement(fixedElement) && fixedElement.elemID.typeName === TRANSACTION_FORM).toBeTruthy()
        const fixedForm = fixedElement as InstanceElement
        expect(fixedForm.value.field1).toEqual(form1.value.field1)
        expect(fixedForm.value.parentField).toEqual({})
        expect(fixedForm.value.stringId).toEqual(form1.value.stringId)
      })
    })
    it('should remove generated references and their related fields', async () => {
      const clonedForm2 = form2.clone()
      const elementsSource = buildElementsSourceFromElements([instance1, instance3])
      const fixes = await fieldsHandler.removeWeakReferences({ elementsSource })([form2])
      expect(clonedForm2).toEqual(form2)

      expect(fixes.errors.length).toEqual(1)

      expect(fixes.errors).toEqual([
        {
          elemID: form2.elemID,
          severity: 'Info',
          message: 'Deploying without all referenced fields',
          detailedMessage:
            'This form2.parentField.field2 is referencing a field that does not exist in the target environment. As a result, it will be deployed without this field.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      const fixedElement = fixes.fixedElements[0]
      expect(isInstanceElement(fixedElement) && fixedElement.elemID.typeName === TRANSACTION_FORM).toBeTruthy()
      const fixedForm = fixedElement as InstanceElement
      expect(fixedForm.value.field1).toEqual(form2.value.field1)
      expect(fixedForm.value.parentField.field2).toBeUndefined()
      expect(fixedForm.value.parentField.field3.id).toEqual(form2.value.parentField.field3.id)
      expect(fixedForm.value.parentField.field3.index).toEqual(0)
      expect(fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].length).toEqual(1)
      expect(fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][0]).toEqual(
        form2.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][1],
      )
    })
    it('should do nothing if all references are valid', async () => {
      const clonedForm2 = form2.clone()
      const elementsSource = buildElementsSourceFromElements([instance1, instance2, instance3])
      const fixes = await fieldsHandler.removeWeakReferences({ elementsSource })([form2])
      expect(clonedForm2).toEqual(form2)

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
