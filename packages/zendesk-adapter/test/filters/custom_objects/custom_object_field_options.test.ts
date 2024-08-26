/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { elements as elementsUtils, filterUtils } from '@salto-io/adapter-components'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import filterCreator from '../../../src/filters/custom_field_options/custom_object_field_options'
import { createFilterCreatorParams } from '../../utils'
import {
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  ZENDESK,
} from '../../../src/constants'

const { RECORDS_PATH } = elementsUtils
type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy' | 'onDeploy'>

const createOptionsValue = (id: number | 'newOption', value?: string): Value => ({
  id: id === 'newOption' ? undefined : id,
  name: id.toString(),
  raw_name: id.toString().repeat(2),
  value: value ?? id.toString().repeat(3),
})

const customObjectFieldOptionType = new ObjectType({
  elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME),
  fields: {
    id: {
      refType: BuiltinTypes.SERVICE_ID_NUMBER,
      annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
    },
    // name is not added because it's not needed
    raw_name: { refType: BuiltinTypes.STRING },
    value: { refType: BuiltinTypes.STRING },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const createOptionInstance = ({ id, value }: { id: number | 'newOption'; value: string }): InstanceElement => {
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

    const elements = [customObjectField, invalidCustomObjectField, customObjectFieldOptionType]
    await customObjectFieldOptionsFilter.onFetch(elements)
    expect(elements).toHaveLength(6)
    expect(elements[0]).toMatchObject(customObjectField)
    expect(elements[1]).toMatchObject(invalidCustomObjectField)
    expect(elements[3]).toMatchObject(createOptionInstance(createOptionsValue(1, '!!')))
    expect(elements[4]).toMatchObject(createOptionInstance(createOptionsValue(2)))
    expect(elements[5]).toMatchObject(createOptionInstance(createOptionsValue(3)))
    expect(elements[3].annotations[CORE_ANNOTATIONS.PARENT][0]).toMatchObject(
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
  describe('when deploying new option', () => {
    describe('when id does not return on the deployed option', () => {
      it('should set null id on preDeploy and omit the id on onDeploy', async () => {
        const newOptionInstance = createOptionInstance({ id: 'newOption', value: 'newOptionValue' })
        const changes = [toChange({ after: newOptionInstance })]

        await customObjectFieldOptionsFilter.preDeploy(changes)
        expect(newOptionInstance.value.id).toBeNull()

        await customObjectFieldOptionsFilter.onDeploy(changes)
        expect(newOptionInstance.value.id).toBeUndefined()
      })
    })
    describe('when id returns on the deployed option', () => {
      const NEW_OPTION_ID = 1
      it('should set null id on preDeploy and keep the id on onDeploy', async () => {
        const newOptionInstance = createOptionInstance({ id: 'newOption', value: 'newOptionValue' })
        const changes = [toChange({ after: newOptionInstance })]

        await customObjectFieldOptionsFilter.preDeploy(changes)
        expect(newOptionInstance.value.id).toBeNull()

        newOptionInstance.value.id = NEW_OPTION_ID

        await customObjectFieldOptionsFilter.onDeploy(changes)
        expect(newOptionInstance.value.id).toEqual(NEW_OPTION_ID)
      })
    })
  })
})
