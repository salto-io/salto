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
import _ from 'lodash'
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { addAliasToElements, AliasData } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
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
  PRIORITY_TYPE_NAME,
  QUEUE_TYPE,
  REQUEST_TYPE_NAME,
  SLA_TYPE_NAME,
  STATUS_TYPE_NAME,
} from '../constants'

const log = logger(module)

const aliasMap: Record<string, AliasData> = {
  Field: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  Automation: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  DashboardGadget: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
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
  [OBJECT_SCHEMA_TYPE]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
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
  [STATUS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [PRIORITY_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config.fetch.addAlias === false || config.fetch.addAlias === undefined) {
      log.info('not running addAlias filter as addAlias in the config is false')
      return
    }
    const elementsMap = _.groupBy(elements.filter(isInstanceElement), instance => instance.elemID.typeName)
    addAliasToElements({
      elementsMap,
      aliasMap,
    })
  },
})

export default filterCreator
