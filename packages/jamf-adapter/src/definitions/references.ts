/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, references as referenceUtils } from '@salto-io/adapter-components'
import { ReferenceContextStrategies, CustomReferenceSerializationStrategyName, Options } from './types'
import {
  CATEGORY_TYPE_NAME,
  CLASS_TYPE_NAME,
  DISK_ENCRYPTION_CONFIGURATION_TYPE_NAME,
  MAC_APPLICATION_TYPE_NAME,
  MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME,
  OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
  PACKAGE_TYPE_NAME,
  POLICY_TYPE_NAME,
  SCRIPT_TYPE_NAME,
  SITE_TYPE_NAME,
} from '../constants'

const addGeneralToTypes = (types: string[]): string[] => types.map(type => `${type}__general`)

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  {
    src: { field: 'categoryId', parentTypes: [PACKAGE_TYPE_NAME, SCRIPT_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: CATEGORY_TYPE_NAME },
  },
  {
    src: { field: 'disk_encryption_configuration_id', parentTypes: ['policy__disk_encryption'] },
    serializationStrategy: 'id',
    target: { type: DISK_ENCRYPTION_CONFIGURATION_TYPE_NAME },
  },
  // idAndNameObject must come before id strategy, we need idAndNameObject for resolution
  {
    src: {
      field: 'site',
      parentTypes: [
        CLASS_TYPE_NAME,
        ...addGeneralToTypes([
          MAC_APPLICATION_TYPE_NAME,
          OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
          MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME,
          POLICY_TYPE_NAME,
        ]),
      ],
    },
    serializationStrategy: 'idAndNameObject',
    target: { type: SITE_TYPE_NAME },
  },
  {
    src: {
      field: 'site',
      parentTypes: [
        CLASS_TYPE_NAME,
        ...addGeneralToTypes([
          MAC_APPLICATION_TYPE_NAME,
          OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
          MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME,
          POLICY_TYPE_NAME,
        ]),
      ],
    },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: { type: SITE_TYPE_NAME },
  },
  // idAndNameObject must come before id strategy, we need idAndNameObject for resolution
  {
    src: {
      field: 'category',
      parentTypes: addGeneralToTypes([
        MAC_APPLICATION_TYPE_NAME,
        OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
        MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME,
        POLICY_TYPE_NAME,
      ]),
    },
    serializationStrategy: 'idAndNameObject',
    target: { type: CATEGORY_TYPE_NAME },
  },
  {
    src: {
      field: 'category',
      parentTypes: addGeneralToTypes([
        MAC_APPLICATION_TYPE_NAME,
        OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
        MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME,
        POLICY_TYPE_NAME,
      ]),
    },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: { type: CATEGORY_TYPE_NAME },
  },
  {
    src: { field: 'name', parentTypes: ['policy__scripts'] },
    serializationStrategy: 'name',
    target: { type: SCRIPT_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['policy__package_configuration__packages'] },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: { type: PACKAGE_TYPE_NAME },
  },
]

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  serializationStrategyLookup: {
    idAndNameObject: {
      serialize: async ({ ref }) => ({ name: ref.value.value.name, id: ref.value.value.id }),
      lookup: referenceUtils.basicLookUp,
    },
  },
  fieldsToGroupBy: ['id', 'name'],
}
