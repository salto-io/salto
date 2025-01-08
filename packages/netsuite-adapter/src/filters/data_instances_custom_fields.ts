/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  Value,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { TransformFuncSync, transformValuesSync } from '@salto-io/adapter-utils'
import { PLATFORM_CORE_CUSTOM_FIELD, PLATFORM_CORE_VALUE } from '../client/suiteapp_client/constants'
import { LocalFilterCreator } from '../filter'
import { isCustomFieldName, isDataObjectType, removeCustomFieldPrefix, toCustomFieldName } from '../types'
import { castFieldValue, getSoapType } from '../data_elements/custom_fields'
import { XSI_TYPE } from '../client/constants'
import { getDifferentKeys } from './data_instances_diff'
import { CUSTOM_FIELD, CUSTOM_FIELD_LIST, SOAP_SCRIPT_ID } from '../constants'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const VALUE_ATTRIBUTE = 'value'

const toCustomFieldItem = (fieldScriptId: string, fieldValue: Value): Value => ({
  attributes: {
    [SOAP_SCRIPT_ID]: fieldScriptId,
    [XSI_TYPE]: getSoapType(fieldValue),
  },
  [PLATFORM_CORE_VALUE]: fieldValue,
})

const transformNestedCustomFieldLists = (instance: InstanceElement): void => {
  const transformFunc: TransformFuncSync = ({ value, field }) => {
    if (
      _.isPlainObject(value) &&
      _.isArray(value[CUSTOM_FIELD]) &&
      field !== undefined &&
      field.name === CUSTOM_FIELD_LIST &&
      field.refType.elemID.typeName === CUSTOM_FIELD_LIST
    ) {
      return {
        [PLATFORM_CORE_CUSTOM_FIELD]: value[CUSTOM_FIELD].map(item =>
          toCustomFieldItem(item[SOAP_SCRIPT_ID], item[VALUE_ATTRIBUTE]),
        ),
      }
    }
    return value
  }

  instance.value = transformValuesSync({
    values: instance.value,
    type: instance.getTypeSync(),
    transformFunc,
    strict: false,
  })
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'dataInstancesCustomFields',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async instance => isDataObjectType(await instance.getType()))
      .forEach(async instance => {
        const type = await instance.getType()
        const customFields = Object.fromEntries(
          await awu(makeArray(instance.value[CUSTOM_FIELD_LIST]?.[CUSTOM_FIELD]))
            .map(async value => {
              const fieldName = toCustomFieldName(value[SOAP_SCRIPT_ID])
              const field = type.fields[fieldName]
              return [fieldName, await castFieldValue(value[VALUE_ATTRIBUTE], field)]
            })
            .toArray(),
        )
        _.assign(instance.value, customFields)
        delete instance.value[CUSTOM_FIELD_LIST]
      })
  },

  preDeploy: async changes => {
    await awu(changes).forEach(async change => {
      const differentKeys =
        isModificationChange(change) && isInstanceChange(change) ? getDifferentKeys(change) : undefined
      await awu(Object.values(change.data))
        .filter(isInstanceElement)
        .filter(async instance => isDataObjectType(await instance.getType()))
        .forEach(instance => {
          transformNestedCustomFieldLists(instance)

          const customFields = _(instance.value)
            .pickBy((_value, key) => isCustomFieldName(key))
            .entries()
            .sortBy(([key]) => key)
            .filter(([key]) => !differentKeys || differentKeys.has(key))
            .map(([key, value]) => toCustomFieldItem(removeCustomFieldPrefix(key), value))
            .value()

          instance.value = {
            ..._.omitBy(instance.value, (_value, key) => isCustomFieldName(key)),
            ...(!_.isEmpty(customFields)
              ? { [CUSTOM_FIELD_LIST]: { [PLATFORM_CORE_CUSTOM_FIELD]: customFields } }
              : {}),
          }
        })
    })
  },
})

export default filterCreator
