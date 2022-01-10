/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { mockClient } from '../../utils'
import { DEFAULT_CONFIG } from '../../../src/config'
import { JIRA } from '../../../src/constants'
import fieldsReferencesFilter, { getFieldsLookUpName } from '../../../src/filters/fields/field_references'

describe('fields_references', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldType: ObjectType
  beforeEach(() => {
    const { client, paginator } = mockClient()
    filter = fieldsReferencesFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, 'Field'),
    })
  })
  it('should add references to options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        contexts: {
          name: {
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
              optionId: '1',
              cascadingOptionId: '3',
            },
          },
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value.contexts.name.defaultValue.optionId).toBeInstanceOf(ReferenceExpression)
    expect(instance.value.contexts.name.defaultValue.optionId.elemID.getFullName()).toBe('jira.Field.instance.instance.contexts.name.options.a1')
    expect(instance.value.contexts.name.defaultValue.cascadingOptionId)
      .toBeInstanceOf(ReferenceExpression)
    expect(instance.value.contexts.name.defaultValue.cascadingOptionId.elemID.getFullName()).toBe('jira.Field.instance.instance.contexts.name.options.a1.cascadingOptions.c1')
  })

  it('Should do nothing when there are no contexts', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
      },
    )

    await filter.onFetch([instance])

    expect(instance.value).toEqual({})
  })

  it('Should do nothing when there are no options', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        contexts: {
          name: {
            name: 'name',
          },
        },
      },
    )

    await filter.onFetch([instance])

    expect(instance.value).toEqual({
      contexts: {
        name: {
          name: 'name',
        },
      },
    })
  })

  it('should replace the reference field types', async () => {
    const optionType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContextOption') })
    const defaultValueType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContextDefaultValue') })

    await filter.onFetch([fieldType, optionType, defaultValueType])

    expect(await defaultValueType.fields.optionId.getType()).toBe(optionType)
    expect(await defaultValueType.fields.cascadingOptionId.getType()).toBe(optionType)
  })

  it('getFieldsLookUpName should resolve the references', async () => {
    expect(await getFieldsLookUpName({
      path: new ElemID(JIRA, 'Field', 'instance', 'instance', 'contexts', 'name', 'options', 'c1', 'optionId'),
      ref: new ReferenceExpression(
        new ElemID(JIRA, 'Field', 'instance', 'instance', 'contexts', 'name', 'options', 'a1'),
        { value: 'a1', id: '1' },
      ),
    })).toBe('1')

    expect(await getFieldsLookUpName({
      path: new ElemID(JIRA, 'Field', 'instance', 'instance', 'contexts', 'name', 'defaultValue', 'optionId'),
      ref: new ReferenceExpression(
        new ElemID(JIRA, 'Field', 'instance', 'instance', 'contexts', 'name', 'options', 'a1'),
        { value: 'a1', id: '1' },
      ),
    })).toBe('1')

    expect(await getFieldsLookUpName({
      path: new ElemID(JIRA, 'Field', 'instance', 'instance', 'contexts', 'name', 'defaultValue', 'cascadingOptionId'),
      ref: new ReferenceExpression(
        new ElemID(JIRA, 'Field', 'instance', 'instance', 'contexts', 'name', 'options', 'c1'),
        { value: 'c1', id: '3' },
      ),
    })).toBe('3')

    expect(await getFieldsLookUpName({
      path: new ElemID(JIRA, 'Field', 'instance', 'instance', 'contexts', 'name', 'defaultValue', 'other'),
      ref: new ReferenceExpression(
        new ElemID(JIRA, 'Field', 'instance', 'instance', 'contexts', 'name', 'options', 'c1'),
        { value: 'c1', id: '3' },
      ),
    })).toBeInstanceOf(ReferenceExpression)
  })
})
