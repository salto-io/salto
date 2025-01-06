/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { CORE_ANNOTATIONS, ObjectType, isObjectType } from '@salto-io/adapter-api'
import { ImportantValues, toImportantValues } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { isCustomRecordType, netsuiteSupportedTypes } from '../types'
import { BUNDLE, CUSTOM_RECORD_TYPE, INACTIVE_FIELDS, IS_LOCKED, NAME_FIELD, SCRIPT_ID } from '../constants'

const { IMPORTANT_VALUES, SELF_IMPORTANT_VALUES } = CORE_ANNOTATIONS

const HIGHLIGHTED_FIELD_NAMES = [NAME_FIELD, 'label', 'description', SCRIPT_ID]
const HIGHLIGHTED_AND_INDEXED_FIELD_NAMES = [...Object.values(INACTIVE_FIELDS), BUNDLE]

const addCustomRecordTypeImportantValues = (type: ObjectType, customRecordType: ObjectType | undefined): void => {
  const customRecordInstancesImportantValues: ImportantValues = [
    {
      value: NAME_FIELD,
      highlighted: true,
      indexed: false,
    },
    {
      value: SCRIPT_ID,
      highlighted: true,
      indexed: false,
    },
    {
      value: INACTIVE_FIELDS.isInactive,
      highlighted: true,
      indexed: true,
    },
    {
      value: BUNDLE,
      highlighted: true,
      indexed: true,
    },
  ]

  const customRecordTypeImportantValues: ImportantValues = Array.from(
    customRecordType?.annotations[IMPORTANT_VALUES] ?? [],
  )

  if (type.annotations[IS_LOCKED]) {
    customRecordTypeImportantValues.push({
      value: IS_LOCKED,
      highlighted: true,
      indexed: true,
    })
  }

  type.annotations[SELF_IMPORTANT_VALUES] = customRecordTypeImportantValues
  type.annotations[IMPORTANT_VALUES] = customRecordInstancesImportantValues
}

const getImportantValues = (type: ObjectType): ImportantValues => [
  ...toImportantValues(type, HIGHLIGHTED_FIELD_NAMES, { highlighted: true }),
  ...toImportantValues(type, HIGHLIGHTED_AND_INDEXED_FIELD_NAMES, { indexed: true, highlighted: true }),
]

const filterCreator: LocalFilterCreator = () => ({
  name: 'addImportantValues',
  onFetch: async elements => {
    const [customRecordTypes, types] = _.partition(elements.filter(isObjectType), isCustomRecordType)

    const netsuiteSupportedTypesSet = new Set(netsuiteSupportedTypes)
    types
      .filter(type => netsuiteSupportedTypesSet.has(type.elemID.name) && !type.isSettings)
      .forEach(type => {
        const importantValues = getImportantValues(type)
        if (importantValues.length > 0) {
          type.annotations[IMPORTANT_VALUES] = importantValues
        }
      })

    const customRecordType = types.find(type => type.elemID.name === CUSTOM_RECORD_TYPE)
    customRecordTypes.forEach(type => {
      addCustomRecordTypeImportantValues(type, customRecordType)
    })
  },
})

export default filterCreator
