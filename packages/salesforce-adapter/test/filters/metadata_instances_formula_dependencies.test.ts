/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, CORE_ANNOTATIONS, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { FilterWith } from './mocks'
import { createInstanceElement } from '../../src/transformers/transformer'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import getFormulaDependencies from '../../src/filters/metadata_instances_formula_dependencies'
import { mockTypes } from '../mock_elements'
import { CUSTOM_OBJECT } from '../../src/constants'

describe('metadataInstancesFormulaDependencies', () => {
  let filter: FilterWith<'onFetch'>
  let instanceElements: InstanceElement[]
  let types: ObjectType[]
  beforeEach(() => {
    filter = getFormulaDependencies({ config: defaultFilterContext }) as FilterWith<'onFetch'>
    const customObjectTypeMock1 = createCustomObjectType('test_custom_object', {
      annotations: {
        metadataType: CUSTOM_OBJECT,
      },
      fields: {
        fullName: { refType: BuiltinTypes.STRING },
        one_text_field__c: { refType: BuiltinTypes.STRING },
        another_field__c: { refType: BuiltinTypes.NUMBER },
      },
    })
    types = [customObjectTypeMock1]
    const validationRuleInstance = createInstanceElement(
      { fullName: 'test_validation_rule', errorConditionFormula: 'one_text_field__c>0' },
      mockTypes.ValidationRule,
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [customObjectTypeMock1],
      },
    )
    const workflowRuleInstance = createInstanceElement(
      { fullName: 'workflow_rule', formula: 'another_field__c>fullName' },
      mockTypes.WorkflowRule,
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [customObjectTypeMock1],
      },
    )
    instanceElements = [validationRuleInstance, workflowRuleInstance]
  })
  it('should add dependencies to the instances', async () => {
    await filter.onFetch([...instanceElements, ...types])
    expect(instanceElements[0].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
    expect(instanceElements[0].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(1)
    expect(
      instanceElements[0].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][0].reference.elemID.getFullName(),
    ).toBe('salesforce.test_custom_object.field.one_text_field__c')
    expect(instanceElements[1].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
    expect(instanceElements[1].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(2)
    expect(
      instanceElements[1].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][0].reference.elemID.getFullName(),
    ).toBe('salesforce.test_custom_object.field.another_field__c')
    expect(
      instanceElements[1].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][1].reference.elemID.getFullName(),
    ).toBe('salesforce.test_custom_object.field.fullName')
  })
})
