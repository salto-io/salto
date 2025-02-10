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
    const config = { ...defaultFilterContext }
    filter = getFormulaDependencies({ config }) as FilterWith<'onFetch'>
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
    const workFlowRule = createInstanceElement(
      { fullName: 'workflow_rule', formula: 'another_field__c>fullName' },
      mockTypes.WorkflowRule,
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [customObjectTypeMock1],
      },
    )
    instanceElements = [validationRuleInstance, workFlowRule]
  })
  it('should add dependencies to the instances', async () => {
    await filter.onFetch([...instanceElements, ...types])
    // eslint-disable-next-line no-underscore-dangle
    expect(instanceElements[0].annotations._generated_dependencies).toBeDefined()
    // eslint-disable-next-line no-underscore-dangle
    expect(instanceElements[0].annotations._generated_dependencies).toHaveLength(1)
    // eslint-disable-next-line no-underscore-dangle
    expect(instanceElements[0].annotations._generated_dependencies[0].reference.elemID.getFullName()).toBe(
      'salesforce.test_custom_object.field.one_text_field__c',
    )
    // eslint-disable-next-line no-underscore-dangle
    expect(instanceElements[1].annotations._generated_dependencies).toBeDefined()
    // eslint-disable-next-line no-underscore-dangle
    expect(instanceElements[1].annotations._generated_dependencies).toHaveLength(2)
    // eslint-disable-next-line no-underscore-dangle
    expect(instanceElements[1].annotations._generated_dependencies[0].reference.elemID.getFullName()).toBe(
      'salesforce.test_custom_object.field.another_field__c',
    )
    // eslint-disable-next-line no-underscore-dangle
    expect(instanceElements[1].annotations._generated_dependencies[1].reference.elemID.getFullName()).toBe(
      'salesforce.test_custom_object.field.fullName',
    )
  })
})
