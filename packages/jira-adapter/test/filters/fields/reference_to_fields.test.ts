/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  InstanceElement,
  isReferenceExpression,
  isTemplateExpression,
  ReferenceExpression,
  Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { createEmptyType } from '../../utils'
import { addFieldsTemplateReferences } from '../../../src/filters/fields/reference_to_fields'

describe('addFieldsTemplateReferences', () => {
  const fieldsMap = new Map(
    _.range(5).map(index => {
      const id = `customfield_${index + 1}`
      return [id, new InstanceElement(`field_${index + 1}`, createEmptyType('Field'), { id })]
    }),
  )
  it('should make a reference to a custom field', async () => {
    const value: Value = {
      script: 'abc customfield_2 def',
    }
    addFieldsTemplateReferences(fieldsMap, false)(value, 'script')
    expect(isTemplateExpression(value.script)).toBeTruthy()
    expect(value.script.parts.length).toEqual(3)
    expect(value.script.parts[0]).toEqual('abc ')
    expect(value.script.parts[1]).toEqual(
      new ReferenceExpression(fieldsMap.get('customfield_2')!.elemID, fieldsMap.get('customfield_2')!),
    )
    expect(value.script.parts[2]).toEqual(' def')
  })
  it('should make several references in the same string', async () => {
    const value: Value = {
      script: 'abc customfield_2 def customfield_3',
    }
    addFieldsTemplateReferences(fieldsMap, false)(value, 'script')
    expect(isTemplateExpression(value.script)).toBeTruthy()
    expect(value.script.parts.length).toEqual(4)
    expect(value.script.parts[1]).toEqual(
      new ReferenceExpression(fieldsMap.get('customfield_2')!.elemID, fieldsMap.get('customfield_2')),
    )
    expect(value.script.parts[3]).toEqual(
      new ReferenceExpression(fieldsMap.get('customfield_3')!.elemID, fieldsMap.get('customfield_3')),
    )
  })
  it('should not make a reference when value is not string', async () => {
    const value = {
      script: 1,
    }
    addFieldsTemplateReferences(fieldsMap, false)(value, 'script')
    expect(value.script).toEqual(1)
  })
  it('should not make a reference when the pattern is not found', async () => {
    const value = {
      script: 'abc def',
    }
    addFieldsTemplateReferences(fieldsMap, false)(value, 'script')
    expect(value.script).toEqual('abc def')
  })
  it('should not make a reference when there is no such field', async () => {
    const value = {
      script: 'abc customfield_6 def',
    }
    addFieldsTemplateReferences(fieldsMap, false)(value, 'script')
    expect(value.script).toEqual('abc customfield_6 def')
  })
  it('should make a missing reference when the field is missing', async () => {
    const value: Value = {
      script: 'abc customfield_6 def',
    }
    addFieldsTemplateReferences(fieldsMap, true)(value, 'script')
    expect(isTemplateExpression(value.script)).toBeTruthy()
    expect(value.script.parts.length).toEqual(3)
    expect(value.script.parts[0]).toEqual('abc ')
    expect(isReferenceExpression(value.script.parts[1])).toBeTruthy()
    expect(value.script.parts[1].elemID.getFullName()).toEqual('jira.Field.instance.missing_customfield_6')
    expect(value.script.parts[2]).toEqual(' def')
  })
})
