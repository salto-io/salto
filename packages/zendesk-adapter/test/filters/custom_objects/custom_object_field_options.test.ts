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
import { elements as elementsUtils, filterUtils } from '@salto-io/adapter-components'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import filterCreator, {
  customObjectFieldOptionType,
} from '../../../src/filters/custom_field_options/custom_object_field_options'
import { createFilterCreatorParams } from '../../utils'
import {
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  ZENDESK,
} from '../../../src/constants'

const { RECORDS_PATH } = elementsUtils
type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy' | 'onDeploy'>

const createOptionsValue = (id: number, value?: string): Value => ({
  id,
  name: id.toString(),
  raw_name: id.toString().repeat(2),
  value: value ?? id.toString().repeat(3),
})

const createOptionInstance = ({ id, value }: { id: number; value: string }): InstanceElement => {
  const test = pathNaclCase(naclCase(`customObjectField__${value.toString()}`))
  return new InstanceElement(
    naclCase(`customObjectField__${value.toString()}`),
    customObjectFieldOptionType,
    createOptionsValue(id, value),
    [ZENDESK, RECORDS_PATH, CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME, test],
  )
}

describe('customObjectFieldOptionsFilter', () => {
  const customObjectFieldOptionsFilter = filterCreator(createFilterCreatorParams({})) as FilterType
  it('should create option instances from custom object field', async () => {
    const customObjectField = new InstanceElement(
      'customObjectField',
      new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_TYPE_NAME) }),
      {
        [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [createOptionsValue(1, '!!'), createOptionsValue(2), createOptionsValue(3)],
      },
    )
    const invalidCustomObjectField = customObjectField.clone()
    invalidCustomObjectField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME][2].id = 'invalid'

    const elements = [customObjectField, invalidCustomObjectField]
    await customObjectFieldOptionsFilter.onFetch(elements)
    expect(elements).toHaveLength(5)
    expect(elements[0]).toMatchObject(customObjectField)
    expect(elements[1]).toMatchObject(invalidCustomObjectField)
    expect(elements[2]).toMatchObject(createOptionInstance(createOptionsValue(1, '!!')))
    expect(elements[3]).toMatchObject(createOptionInstance(createOptionsValue(2)))
    expect(elements[4]).toMatchObject(createOptionInstance(createOptionsValue(3)))
    expect(elements[2].annotations[CORE_ANNOTATIONS.PARENT][0]).toMatchObject(
      new ReferenceExpression(customObjectField.elemID, customObjectField),
    )
  })
  it('should put raw_name in name on preDeploy', async () => {
    const customObjectFieldOption = createOptionInstance({ id: 1, value: 'value' })
    customObjectFieldOption.value.raw_name = 'test'
    await customObjectFieldOptionsFilter.preDeploy([toChange({ after: customObjectFieldOption })])
    expect(customObjectFieldOption.value.name).toEqual(customObjectFieldOption.value.raw_name)
  })
  it('should delete name on onDeploy', async () => {
    const customObjectFieldOption = createOptionInstance({ id: 1, value: 'value' })
    customObjectFieldOption.value.name = 'test'
    await customObjectFieldOptionsFilter.onDeploy([toChange({ after: customObjectFieldOption })])
    expect(customObjectFieldOption.value.name).toBeUndefined()
  })
})
