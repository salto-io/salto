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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../../utils'
import { JIRA } from '../../../src/constants'
import fieldsTypeReferencesFilter, { getFieldsLookUpName } from '../../../src/filters/fields/field_type_references_filter'
import { FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('fields_references', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldContextType: ObjectType
  beforeEach(() => {
    filter = fieldsTypeReferencesFilter(getFilterParams()) as typeof filter

    fieldContextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })
  })
  it('should add references to options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        options: {
          a1: {
            id: '1',
            value: 'a1',
            cascadingOptions: {
              c1: {
                id: '3',
                value: 'c1',
              },
            },
          },
        },
        defaultValue: {
          type: 'option.cascading',
          optionId: '1',
          cascadingOptionId: '3',
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue.optionId).toBeInstanceOf(ReferenceExpression)
    expect(instance.value.defaultValue.optionId.elemID.getFullName()).toBe('jira.CustomFieldContext.instance.instance.options.a1')
    expect(instance.value.defaultValue.cascadingOptionId)
      .toBeInstanceOf(ReferenceExpression)
    expect(instance.value.defaultValue.cascadingOptionId.elemID.getFullName()).toBe('jira.CustomFieldContext.instance.instance.options.a1.cascadingOptions.c1')
  })
  it('should add references to multiple options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        options: {
          a1: {
            id: '1',
            value: 'a1',
          },
          b1: {
            id: '2',
            value: 'b1',
          },
        },
        defaultValue: {
          type: 'option.multiple',
          optionIds: ['1', '2'],
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue.optionIds).toHaveLength(2)
    expect(instance.value.defaultValue.optionIds[0]).toBeInstanceOf(ReferenceExpression)
    expect(instance.value.defaultValue.optionIds[1]).toBeInstanceOf(ReferenceExpression)
    expect(instance.value.defaultValue.optionIds[0].elemID.getFullName()).toBe('jira.CustomFieldContext.instance.instance.options.a1')
    expect(instance.value.defaultValue.optionIds[1].elemID.getFullName()).toBe('jira.CustomFieldContext.instance.instance.options.b1')
  })

  it('should only change optionId if cascadingOptionId cannot be found', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        options: {
          a1: {
            id: '1',
            value: 'a1',
          },
        },
        defaultValue: {
          type: 'option.cascading',
          optionId: '1',
          cascadingOptionId: '3',
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue.optionId).toBeInstanceOf(ReferenceExpression)
    expect(instance.value.defaultValue.optionId.elemID.getFullName()).toBe('jira.CustomFieldContext.instance.instance.options.a1')
    expect(instance.value.defaultValue.cascadingOptionId).toBe('3')
  })
  it('should do nothing if optionId reference cannot be found', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        defaultValue: {
          type: 'option.cascading',
          optionId: '1',
          cascadingOptionId: '3',
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue.optionId).toBe('1')
    expect(instance.value.defaultValue.cascadingOptionId).toBe('3')
  })

  it('should do nothing if all the optionIds references cannot be found - multiple options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        defaultValue: {
          type: 'option.multiple',
          optionIds: ['3', '2'],
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue.optionIds).toHaveLength(2)
    expect(instance.value.defaultValue.optionIds[0]).toBe('3')
    expect(instance.value.defaultValue.optionIds[1]).toBe('2')
  })

  it('should convert only the optionIds that found to references - multiple options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        options: {
          a1: {
            id: '1',
            value: 'a1',
          },
        },
        defaultValue: {
          type: 'option.multiple',
          optionIds: ['1', '2'],
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue.optionIds).toHaveLength(2)
    expect(instance.value.defaultValue.optionIds[0]).toBeInstanceOf(ReferenceExpression)
    expect(instance.value.defaultValue.optionIds[0].elemID.getFullName()).toBe('jira.CustomFieldContext.instance.instance.options.a1')
    expect(instance.value.defaultValue.optionIds[1]).toBe('2')
  })

  it('should do nothing if there is no options - multiple options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        defaultValue: {
          type: 'option.multiple',
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue.optionIds).toBeUndefined()
  })

  it('should do nothing if there is no default optionsIds - multiple options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        options: {
          a1: {
            id: '1',
            value: 'a1',
          },
        },
        defaultValue: {
          type: 'option.multiple',
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue.optionIds).toBeUndefined()
  })

  it('should do nothing if there is no default optionsIds - cascading options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        options: {
          a1: {
            id: '1',
            value: 'a1',
          },
        },
        defaultValue: {
          type: 'option.cascading',
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue.optionIds).toBeUndefined()
  })
  it('should do nothing if there is no defaultValue', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
        options: {
          a1: {
            id: '1',
            value: 'a1',
          },
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.defaultValue).toBeUndefined()
    expect(instance.value.options.a1)
      .toEqual({
        id: '1',
        value: 'a1',
      },)
  })

  it('Should do nothing when there are no contexts', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
      },
    )

    await filter.onFetch([instance])

    expect(instance.value).toEqual({})
  })

  it('Should do nothing when there are no options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldContextType,
      {
        name: 'name',
      },
    )

    await filter.onFetch([instance])

    expect(instance.value).toEqual({
      name: 'name',
    })
  })

  it('should replace the reference field context types', async () => {
    const optionType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContextOption') })
    const defaultValueType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContextDefaultValue') })

    await filter.onFetch([fieldContextType, optionType, defaultValueType])

    expect(await defaultValueType.fields.optionId.getType()).toBe(optionType)
    expect(await defaultValueType.fields.cascadingOptionId.getType()).toBe(optionType)
  })

  it('getFieldsLookUpName should resolve the references', async () => {
    expect(await getFieldsLookUpName({
      path: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'name', 'options', 'c1', 'optionId'),
      ref: new ReferenceExpression(
        new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'name', 'options', 'a1'),
        { value: 'a1', id: '1' },
      ),
      element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
    })).toBe('1')

    expect(await getFieldsLookUpName({
      path: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'name', 'defaultValue', 'optionId'),
      ref: new ReferenceExpression(
        new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'name', 'options', 'a1'),
        { value: 'a1', id: '1' },
      ),
      element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
    })).toBe('1')

    expect(await getFieldsLookUpName({
      path: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'name', 'defaultValue', 'cascadingOptionId'),
      ref: new ReferenceExpression(
        new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'name', 'options', 'c1'),
        { value: 'c1', id: '3' },
      ),
      element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
    })).toBe('3')

    expect(await getFieldsLookUpName({
      path: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'name', 'defaultValue', 'other'),
      ref: new ReferenceExpression(
        new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'name', 'options', 'c1'),
        { value: 'c1', id: '3' },
      ),
      element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
    })).toBeInstanceOf(ReferenceExpression)
  })
})
