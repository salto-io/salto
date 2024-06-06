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
import { createObjectIdListElements } from '../../../src/scriptid_list'

describe('fields references', () => {
  let instance1: InstanceElement
  let instance2: InstanceElement
  let generatedDependency1: InstanceElement
  let generatedDependency2: InstanceElement
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

  const generatedDependency1Instance = new InstanceElement(
    'generated_dependency_1',
    new ObjectType({
      elemID: new ElemID(NETSUITE, 'generated_dependency_1'),
    }),
    {
      [SCRIPT_ID]: 'generated_dependency_1',
    },
  )
  const generatedDependency2Instance = new InstanceElement(
    'generated_dependency_2',
    new ObjectType({
      elemID: new ElemID(NETSUITE, 'generated_dependency_2'),
    }),
    {
      [SCRIPT_ID]: 'generated_dependency_2',
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
        string_field: {
          id: 'some string id',
          index: 0,
        },
        generated_dependency_1: {
          id: '[type=transactionbodycustomfield, scriptid=generated_dependency_1]',
          index: 1,
        },
        generated_dependency_2: {
          id: '[type=transactionbodycustomfield, scriptid=generated_dependency_2]',
          index: 2,
        },
        netsuite_reference_1: {
          id: '[scriptid=netsuite_reference_1]',
          index: 3,
        },
        netsuite_reference_2: {
          id: '[scriptid=netsuite_reference_2]',
          index: 4,
        },
      },
    },
    [NETSUITE, TRANSACTION_FORM, 'form2'],
    {
      [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
        {
          reference: new ReferenceExpression(
            generatedDependency1Instance.elemID.createNestedID(SCRIPT_ID),
            generatedDependency1Instance.value.scriptid,
            generatedDependency1Instance,
          ),
        },
        {
          reference: new ReferenceExpression(
            generatedDependency2Instance.elemID.createNestedID(SCRIPT_ID),
            generatedDependency2Instance.value.scriptid,
            generatedDependency2Instance,
          ),
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
    generatedDependency1 = generatedDependency1Instance.clone()
    generatedDependency2 = generatedDependency2Instance.clone()
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
          target: generatedDependency1.elemID.createNestedID(SCRIPT_ID),
          type: 'weak',
        },
        {
          source: form2.elemID.createNestedID(CORE_ANNOTATIONS.GENERATED_DEPENDENCIES, '1'),
          target: generatedDependency2.elemID.createNestedID(SCRIPT_ID),
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
              'This form references fields that do not exist in the target environment. As a result, this form will be deployed without these fields: field1',
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
              'This form references fields that do not exist in the target environment. As a result, this form will be deployed without these fields: parentField.field2',
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
    it('should remove unresolved generated references and their related fields if not in the scriptid list', async () => {
      // Remove the invalid reference
      delete form2.value.parentField.netsuite_reference_1
      delete form2.value.parentField.netsuite_reference_2

      const clonedForm2 = form2.clone()
      const elementsSource = buildElementsSourceFromElements([instance1, generatedDependency2])
      const fixes = await fieldsHandler.removeWeakReferences({ elementsSource })([form2])
      expect(clonedForm2).toEqual(form2)

      expect(fixes.errors.length).toEqual(1)

      expect(fixes.errors).toEqual([
        {
          elemID: form2.elemID,
          severity: 'Info',
          message: 'Deploying without all referenced fields',
          detailedMessage:
            'This form references fields that do not exist in the target environment. As a result, this form will be deployed without these fields: parentField.generated_dependency_1',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      const fixedElement = fixes.fixedElements[0]
      expect(isInstanceElement(fixedElement) && fixedElement.elemID.typeName === TRANSACTION_FORM).toBeTruthy()
      const fixedForm = fixedElement as InstanceElement

      expect(fixedForm.value.field1).toEqual(form2.value.field1)
      expect(fixedForm.value.parentField).toEqual({
        string_field: {
          id: 'some string id',
          index: 0,
        },
        generated_dependency_2: {
          id: '[type=transactionbodycustomfield, scriptid=generated_dependency_2]',
          index: 1,
        },
      })

      expect(fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].length).toEqual(1)
      expect(fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][0]).toEqual(
        form2.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][1],
      )
    })
    it('should remove unresolved netsuite references if not in the scriptid list', async () => {
      const clonedForm2 = form2.clone()
      const elementsSource = buildElementsSourceFromElements([instance1, generatedDependency1, generatedDependency2])
      const fixes = await fieldsHandler.removeWeakReferences({ elementsSource })([form2])
      expect(clonedForm2).toEqual(form2)

      expect(fixes.errors.length).toEqual(1)

      expect(fixes.errors).toEqual([
        {
          elemID: form2.elemID,
          severity: 'Info',
          message: 'Deploying without all referenced fields',
          detailedMessage:
            'This form references fields that do not exist in the target environment. As a result, this form will be deployed without these fields: parentField.netsuite_reference_1, parentField.netsuite_reference_2',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      const fixedElement = fixes.fixedElements[0]
      expect(isInstanceElement(fixedElement) && fixedElement.elemID.typeName === TRANSACTION_FORM).toBeTruthy()
      const fixedForm = fixedElement as InstanceElement

      expect(fixedForm.value.field1).toEqual(form2.value.field1)
      expect(fixedForm.value.parentField).toEqual({
        string_field: {
          id: 'some string id',
          index: 0,
        },
        generated_dependency_1: {
          id: '[type=transactionbodycustomfield, scriptid=generated_dependency_1]',
          index: 1,
        },
        generated_dependency_2: {
          id: '[type=transactionbodycustomfield, scriptid=generated_dependency_2]',
          index: 2,
        },
      })
      expect(fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].length).toEqual(2)
      expect(fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][0]).toEqual(
        form2.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][0],
      )
      expect(fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][1]).toEqual(
        form2.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][1],
      )
    })

    it('should keep unresolved references if in the scriptid list', async () => {
      const scriptidListInstances = createObjectIdListElements([
        {
          type: 'someType',
          instanceId: 'generated_dependency_1',
        },
        {
          type: 'someType',
          instanceId: 'netsuite_reference_1',
        },
      ])
      const clonedForm2 = form2.clone()
      const elementsSource = buildElementsSourceFromElements([
        instance1,
        generatedDependency1,
        ...scriptidListInstances,
      ])
      const fixes = await fieldsHandler.removeWeakReferences({ elementsSource })([form2])
      expect(clonedForm2).toEqual(form2)

      expect(fixes.errors.length).toEqual(1)

      expect(fixes.errors).toEqual([
        {
          elemID: form2.elemID,
          severity: 'Info',
          message: 'Deploying without all referenced fields',
          detailedMessage:
            'This form references fields that do not exist in the target environment. As a result, this form will be deployed without these fields: parentField.generated_dependency_2, parentField.netsuite_reference_2',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      const fixedElement = fixes.fixedElements[0]
      expect(isInstanceElement(fixedElement) && fixedElement.elemID.typeName === TRANSACTION_FORM).toBeTruthy()
      const fixedForm = fixedElement as InstanceElement

      expect(fixedForm.value.field1).toEqual(form2.value.field1)
      expect(fixedForm.value.parentField).toEqual({
        string_field: {
          id: 'some string id',
          index: 0,
        },
        generated_dependency_1: {
          id: '[type=transactionbodycustomfield, scriptid=generated_dependency_1]',
          index: 1,
        },
        netsuite_reference_1: {
          id: '[scriptid=netsuite_reference_1]',
          index: 2,
        },
      })
      expect(fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].length).toEqual(1)
      expect(fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][0]).toEqual(
        form2.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][0],
      )
    })

    it('should do nothing if all references are valid', async () => {
      // Remove the invalid reference
      delete form2.value.parentField.netsuite_reference_1
      delete form2.value.parentField.netsuite_reference_2

      const clonedForm2 = form2.clone()

      const elementsSource = buildElementsSourceFromElements([instance1, generatedDependency1, generatedDependency2])
      const fixes = await fieldsHandler.removeWeakReferences({ elementsSource })([form2])
      expect(clonedForm2).toEqual(form2)

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
