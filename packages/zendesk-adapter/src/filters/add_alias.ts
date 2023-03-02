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
  isInstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'

const { isDefined } = lowerdashValues
const log = logger(module)

const STRING_SIGN = '$'
const CATEGORY_ORDER = `${STRING_SIGN}Category Order${STRING_SIGN}`
const SECTION_ORDER = `${STRING_SIGN}Section Order${STRING_SIGN}`
const ARTICLE_ORDER = `${STRING_SIGN}Article Order${STRING_SIGN}`
const LANGUAGE_SETTINGS = `${STRING_SIGN}language settings${STRING_SIGN}`
const SETTINGS = `${STRING_SIGN}Settings${STRING_SIGN}`


type AliasData = {
  aliasFields: string[]
  separator?: string
}

type AliasMap = Record<string, AliasData>

const SECOND_ITERATION_TYPES = [
  'dynamic_content_item__variants',
  'category_order',
  'category_translation',
  'section_translation',
  'section_order',
  'article_translation',
  'article_order',
  'article_attachment',
]

const aliasMap: AliasMap = {
  app_installation: {
    aliasFields: ['settings.name'],
  },
  app_owned: {
    aliasFields: ['name'],
  },
  automation: {
    aliasFields: ['title'],
  },
  brand: {
    aliasFields: ['name'],
  },
  brand_logo: {
    aliasFields: ['filename'],
  },
  business_hours_schedule: {
    aliasFields: ['name'],
  },
  business_hours_schedule_holiday: {
    aliasFields: ['name'],
  },
  channel: {
    aliasFields: ['name'],
  },
  custom_role: {
    aliasFields: ['name'],
  },
  custom_status: {
    aliasFields: ['agent_label'],
  },
  dynamic_content_item: {
    aliasFields: ['name'],
  },
  dynamic_content_item__variants: {
    aliasFields: ['_parent.0._alias', 'locale_id.value.value.locale'],
    separator: ' - ',
  },
  group: {
    aliasFields: ['name'],
  },
  locale: {
    aliasFields: ['presentation_name'],
  },
  macro: {
    aliasFields: ['title'],
  },
  macro_attachment: {
    aliasFields: ['filename'],
  },
  oauth_client: {
    aliasFields: ['name'],
  },
  organization_field: {
    aliasFields: ['title'],
  },
  organization_field__custom_field_options: {
    aliasFields: ['name'],
  },
  routing_attribute: {
    aliasFields: ['name'],
  },
  routing_attribute_value: {
    aliasFields: ['name'],
  },
  sla_policy: {
    aliasFields: ['title'],
  },
  support_address: {
    aliasFields: ['name'],
  },
  tag: { // should we add alias? there is only id
    aliasFields: ['id'],
  },
  target: {
    aliasFields: ['title'],
  },
  ticket_field: {
    aliasFields: ['title'],
  },
  ticket_field__custom_field_options: {
    aliasFields: ['name'],
  },
  ticket_form: {
    aliasFields: ['name'],
  },
  trigger: {
    aliasFields: ['title'],
  },
  trigger_category: { // should we add alias? there is only name
    aliasFields: ['name'],
  },
  user_field: {
    aliasFields: ['title'],
  },
  user_field__custom_field_options: {
    aliasFields: ['name'],
  },
  view: {
    aliasFields: ['title'],
  },
  webhook: {
    aliasFields: ['name'],
  },
  workspace: {
    aliasFields: ['title'],
  },
  category: {
    aliasFields: ['name'], // in notion default language title (if the name is removed from the instance)
  },
  category_translation: {
    aliasFields: ['locale.value.value.locale', '_parent.0._alias'], // in notion default language title (if the name is removed from the instance)
    separator: ' - ',
  },
  category_order: {
    aliasFields: ['_parent.0._alias', CATEGORY_ORDER],
  },
  section: {
    aliasFields: ['name'], // in notion default language title (if the name is removed from the instance)
  },
  section_translation: {
    aliasFields: ['locale.value.value.locale', '_parent.0._alias'], // in notion default language title (if the name is removed from the instance)
    separator: ' - ',
  },
  section_order: {
    aliasFields: ['_parent.0._alias', SECTION_ORDER],
  },
  article: {
    aliasFields: ['title'],
  },
  article_translation: {
    aliasFields: ['locale.value.value.locale', '_parent.0._alias'], // in notion default language title (if the name is removed from the instance)
    separator: ' - ',
  },
  article_order: {
    aliasFields: ['_parent.0._alias', ARTICLE_ORDER],
  },
  article_attachment: {
    aliasFields: ['file_name', '_parent.0._alias'],
    separator: ' - ',
  },
  guide_language_settings: {
    aliasFields: ['brand.value.value.name', 'locale', LANGUAGE_SETTINGS],
  },
  guide_settings: {
    aliasFields: ['brand.value.value.name', SETTINGS],
  },
  permission_group: {
    aliasFields: ['name'],
  },
  user_segment: {
    aliasFields: ['name'],
  },
}

const calculateAlias = (
  instance: InstanceElement, instById: Record<string, InstanceElement>,
): string | undefined => {
  const currentType = instance.elemID.typeName
  const { aliasFields } = aliasMap[currentType]
  const separator = aliasMap[currentType].separator ?? ' '
  const aliasParts = aliasFields
    .map(field => {
      if (field.startsWith(STRING_SIGN) && field.endsWith(STRING_SIGN)) {
        return field.slice(1, -1)
      }
      if (field.startsWith(CORE_ANNOTATIONS.PARENT)) {
        const route = field.split('.')
        const parentNum = Number(route[1])
        if (parentNum === undefined) {
          log.error('a parent number was not given in the aliasFields')
          return undefined
        }
        const parentId = getParents(instance)[parentNum]?.elemID.getFullName()
        const parentInstance = instById[parentId]
        if (parentInstance === undefined) {
          log.error(`the parent of ${instance.elemID.getFullName()} was not found `)
          return undefined
        }
        const parentRoute = route.slice(2).join('.')
        if (parentRoute.startsWith(CORE_ANNOTATIONS.ALIAS)) {
          return parentInstance.annotations[CORE_ANNOTATIONS.ALIAS]
        }
        return _.get(parentInstance.value, parentRoute)
      }
      return _.get(instance.value, field)
    })
  if (!aliasParts.every(isDefined)) {
    return undefined
  }
  return aliasParts.join(separator)
}

const filterCreator: FilterCreator = () => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    const instances = elements.filter(isInstanceElement)
    const elementById = _.keyBy(instances, elem => elem.elemID.getFullName())
    const relevantInstancesByType = _.groupBy(instances
      .filter(inst => Object.keys(aliasMap).includes(inst.elemID.typeName)),
    inst => inst.elemID.typeName)

    const addAlias = (key: string): void => {
      relevantInstancesByType[key].forEach(inst => {
        const alias = calculateAlias(inst, elementById)
        if (alias !== undefined) {
          inst.annotations[CORE_ANNOTATIONS.ALIAS] = alias
        }
      })
    }
    // first iteration
    Object.keys(relevantInstancesByType)
      .filter(typeName => Object.keys(aliasMap).includes(typeName))
      .filter(typeName => !SECOND_ITERATION_TYPES.includes(typeName))
      .forEach(addAlias)

    // second iteration
    Object.keys(relevantInstancesByType)
      .filter(typeName => SECOND_ITERATION_TYPES.includes(typeName))
      .forEach(addAlias)
  },
})

export default filterCreator
