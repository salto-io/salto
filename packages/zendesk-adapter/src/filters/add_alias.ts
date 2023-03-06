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
import {
  CORE_ANNOTATIONS,
  Element, InstanceElement,
  isInstanceElement, isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from './dynamic_content'
import {
  APP_OWNED_TYPE_NAME,
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME, ARTICLE_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  BRAND_LOGO_TYPE_NAME,
  BRAND_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME, CATEGORY_TYPE_NAME,
  CUSTOM_ROLE_TYPE_NAME,
  CUSTOM_STATUS_TYPE_NAME,
  GROUP_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, GUIDE_SETTINGS_TYPE_NAME,
  MACRO_TYPE_NAME,
  ORG_FIELD_TYPE_NAME, PERMISSION_GROUP_TYPE_NAME,
  ROUTING_ATTRIBUTE_VALUE_TYPE,
  SECTION_ORDER_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME, SECTION_TYPE_NAME,
  SUPPORT_ADDRESS_TYPE_NAME,
  TARGET_TYPE_NAME,
  TICKET_FIELD_CUSTOM_FIELD_OPTION,
  TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME, USER_FIELD_TYPE_NAME, USER_SEGMENT_TYPE_NAME, WEBHOOK_TYPE_NAME,
} from '../constants'
import { FETCH_CONFIG } from '../config'

const log = logger(module)

const CATEGORY_ORDER = 'Category Order'
const SECTION_ORDER = 'Section Order'
const ARTICLE_ORDER = 'Article Order'
const LANGUAGE_SETTINGS = 'language settings'
const SETTINGS = 'Settings'

type AliasComponent = {
  fieldName: string
  referenceFieldName?: string
}

type ConstantComponent = {
  constant: string
}

type AliasData = {
  aliasComponents: (AliasComponent | ConstantComponent)[]
  separator?: string
}

const SECOND_ITERATION_TYPES = [
  DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
  ARTICLE_ATTACHMENT_TYPE_NAME,
]

const aliasMap: Record<string, AliasData> = {
  app_installation: {
    aliasComponents: [{
      fieldName: 'settings.name',
    }],
  },
  [APP_OWNED_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [AUTOMATION_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  [BRAND_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [BRAND_LOGO_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'filename',
    }],
  },
  business_hours_schedule: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  business_hours_schedule_holiday: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  channel: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [CUSTOM_ROLE_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [CUSTOM_STATUS_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'agent_label',
    }],
  },
  dynamic_content_item: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  dynamic_content_item__variants: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        fieldName: 'locale_id',
        referenceFieldName: 'locale',
      },
    ],
    separator: ' - ',
  },
  [GROUP_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  locale: {
    aliasComponents: [{
      fieldName: 'presentation_name',
    }],
  },
  [MACRO_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  macro_attachment: {
    aliasComponents: [{
      fieldName: 'filename',
    }],
  },
  oauth_client: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [ORG_FIELD_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  organization_field__custom_field_options: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  routing_attribute: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [ROUTING_ATTRIBUTE_VALUE_TYPE]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  sla_policy: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  [SUPPORT_ADDRESS_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  tag: { // should we add alias? there is only id
    aliasComponents: [{
      fieldName: 'id',
    }],
  },
  [TARGET_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  [TICKET_FIELD_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  [TICKET_FIELD_CUSTOM_FIELD_OPTION]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [TICKET_FORM_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  trigger: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  trigger_category: { // should we add alias? there is only name
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [USER_FIELD_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  user_field__custom_field_options: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  view: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  [WEBHOOK_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  workspace: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  [CATEGORY_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [CATEGORY_TRANSLATION_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'locale',
        referenceFieldName: 'locale',
      },
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' - ',
  },
  [CATEGORY_ORDER_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        constant: CATEGORY_ORDER,
      },
    ],
  },
  [SECTION_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [SECTION_TRANSLATION_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'locale',
        referenceFieldName: 'locale',
      },
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' - ',
  },
  [SECTION_ORDER_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        constant: SECTION_ORDER,
      },
    ],
  },
  [ARTICLE_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  [ARTICLE_TRANSLATION_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'locale',
        referenceFieldName: 'locale',
      },
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' - ',
  },
  [ARTICLE_ORDER_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        constant: ARTICLE_ORDER,
      },
    ],
  },
  [ARTICLE_ATTACHMENT_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'file_name',
      },
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' - ',
  },
  [GUIDE_LANGUAGE_SETTINGS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'brand',
        referenceFieldName: '_alias',
      },
      {
        fieldName: 'locale',
      },
      {
        constant: LANGUAGE_SETTINGS,
      },
    ],
  },
  [GUIDE_SETTINGS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'brand',
        referenceFieldName: '_alias',
      },
      {
        constant: SETTINGS,
      },
    ],
  },
  [PERMISSION_GROUP_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  [USER_SEGMENT_TYPE_NAME]: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
}

const isAnnotation = (field: string): boolean => Object.values(CORE_ANNOTATIONS).includes(field?.split('.')[0])

const isValidAlias = (aliasParts: (string|undefined)[], instance: InstanceElement): boolean =>
  aliasParts.every((val, index) => {
    if (val === undefined) {
      log.debug(`for instance ${instance.elemID.getFullName()}, component number ${index} in the alias map resulted in undefined`)
      return false
    }
    return true
  })

const getFieldVal = ({ instance, component, field, instById }:{
  instance: InstanceElement
  component: AliasComponent
  field: 'value'|'annotations'
  instById: Record<string, InstanceElement>
}): string | undefined => {
  const potentialRef = _.get(instance[field], component.fieldName)
  if (component.referenceFieldName === undefined) {
    return potentialRef
  }
  if (!isReferenceExpression(potentialRef)) {
    log.error(`${component.fieldName} is treated as a reference expression but it is not`)
    return undefined
  }
  const referencedInstance = instById[potentialRef.elemID.getFullName()]
  if (referencedInstance === undefined) {
    log.error(`could not find ${potentialRef.elemID.getFullName()} in instById`)
    return undefined
  }
  return isAnnotation(component.referenceFieldName)
    ? _.get(referencedInstance.annotations, component.referenceFieldName)
    : _.get(referencedInstance.value, component.referenceFieldName)
}

const calculateAlias = (
  instance: InstanceElement, instById: Record<string, InstanceElement>,
): string | undefined => {
  const currentType = instance.elemID.typeName
  const { aliasComponents } = aliasMap[currentType]
  const separator = aliasMap[currentType].separator ?? ' '
  const aliasParts = aliasComponents
    .map(component => {
      if ('constant' in component) {
        return component.constant
      }
      if (('fieldName' in component) && isAnnotation(component.fieldName)) {
        return getFieldVal({ instance, component, field: 'annotations', instById })
      }
      return getFieldVal({ instance, component, field: 'value', instById })
    })
  if (!isValidAlias(aliasParts, instance)) {
    return undefined
  }
  return aliasParts.join(separator)
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config[FETCH_CONFIG].addAlias === false) {
      log.info('not running addAlias filter as addAlias in the config is false')
      return
    }
    const instances = elements.filter(isInstanceElement)
    const elementById = _.keyBy(instances, elem => elem.elemID.getFullName())
    const relevantInstancesByType = _.groupBy(
      instances.filter(inst => aliasMap[inst.elemID.typeName] !== undefined),
      inst => inst.elemID.typeName
    )

    const addAlias = (typeName: string): void => {
      relevantInstancesByType[typeName].forEach(inst => {
        const alias = calculateAlias(inst, elementById)
        if (alias !== undefined) {
          inst.annotations[CORE_ANNOTATIONS.ALIAS] = alias
        }
      })
    }
    const [firstIterationTypes, secondIterationTypes] = _.partition(
      Object.keys(relevantInstancesByType),
      typeName => !SECOND_ITERATION_TYPES.includes(typeName)
    )
    // first iteration
    firstIterationTypes.forEach(addAlias)

    // second iteration
    secondIterationTypes.forEach(addAlias)
  },
})

export default filterCreator
