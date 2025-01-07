/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element } from '@salto-io/adapter-api'
import { AliasData } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import {
  CALENDAR_TYPE,
  FORM_TYPE,
  OBJECT_SCHEMA_STATUS_TYPE,
  OBJECT_SCHEMA_TYPE,
  OBJECT_TYPE_ATTRIBUTE_TYPE,
  OBJECT_TYPE_TYPE,
  PORTAL_GROUP_TYPE,
  PORTAL_SETTINGS_TYPE_NAME,
  QUEUE_TYPE,
  REQUEST_TYPE_NAME,
  SLA_TYPE_NAME,
} from '../constants'
import { addAlias } from './add_alias'

// Add aliases for elements that need references in order to calculate aliases, and for JSM elements
const aliasTypeMap: Record<string, AliasData> = {
  CustomFieldContext: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        constant: 'context in',
      },
      {
        fieldName: 'name',
      },
    ],
  },
  FieldConfigurationItem: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'id',
        referenceFieldName: '_alias',
      },
    ],
    separator: ':',
  },
  ProjectComponent: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [QUEUE_TYPE]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [REQUEST_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [SLA_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [PORTAL_SETTINGS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [PORTAL_GROUP_TYPE]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [CALENDAR_TYPE]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [FORM_TYPE]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [OBJECT_SCHEMA_STATUS_TYPE]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [OBJECT_TYPE_TYPE]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [OBJECT_TYPE_ATTRIBUTE_TYPE]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [OBJECT_SCHEMA_TYPE]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'addAliasExtended',
  onFetch: async (elements: Element[]): Promise<void> => {
    await addAlias(config, elements, aliasTypeMap)
  },
})

export default filterCreator
