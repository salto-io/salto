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
  Element,
  isInstanceElement,
  InstanceElement,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { getParent, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { DAG } from '@salto-io/dag'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  USER_SEGMENT_TYPE_NAME,
  PERMISSION_GROUP_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  ZENDESK, GUIDE, BRAND_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  ARTICLE_ATTACHMENT_TYPE_NAME, TRANSLATION_TYPE_NAMES,
} from '../constants'

const { RECORDS_PATH } = elementsUtils
const log = logger(module)
const { awu } = collections.asynciterable


export const UNSORTED = 'unsorted'
export const GUIDE_PATH = [ZENDESK, RECORDS_PATH, GUIDE]
const FIRST_LEVEL_TYPES = [USER_SEGMENT_TYPE_NAME, PERMISSION_GROUP_TYPE_NAME]
const BRAND_SECOND_LEVEL = [
  CATEGORY_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME,
]
const PARENTS = [CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ARTICLE_TYPE_NAME]

const ORDER_TYPES = [
  SECTION_ORDER_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
]

const OTHER_TYPES = [
  ...TRANSLATION_TYPE_NAMES,
  ARTICLE_ATTACHMENT_TYPE_NAME,
]

const NO_VALUE_DEFAULT = 'unknown'

export const GUIDE_ELEMENT_DIRECTORY: Record<string, string> = {
  [ARTICLE_TRANSLATION_TYPE_NAME]: 'translations',
  [ARTICLE_TYPE_NAME]: 'articles',
  [CATEGORY_TYPE_NAME]: 'categories',
  [SECTION_TYPE_NAME]: 'sections',
  [SECTION_TRANSLATION_TYPE_NAME]: 'translations',
  [CATEGORY_TRANSLATION_TYPE_NAME]: 'translations',
  [GUIDE_SETTINGS_TYPE_NAME]: 'settings',
  [USER_SEGMENT_TYPE_NAME]: 'user_segments',
  [PERMISSION_GROUP_TYPE_NAME]: 'permission_groups',
  [GUIDE_LANGUAGE_SETTINGS_TYPE_NAME]: 'language_settings',
  [CATEGORY_ORDER_TYPE_NAME]: 'category_order',
  [SECTION_ORDER_TYPE_NAME]: 'section_order',
  [ARTICLE_ORDER_TYPE_NAME]: 'article_order',
  [ARTICLE_ATTACHMENT_TYPE_NAME]: 'article_attachment',
}

const getReferencedLocale = (localeRef: ReferenceExpression | string | undefined)
  : string | undefined => (isReferenceExpression(localeRef)
  ? localeRef.value.value?.locale
  : localeRef)

const getTranslationLocale = (instance?: InstanceElement): string =>
  getReferencedLocale(instance?.value.locale) ?? NO_VALUE_DEFAULT

const getNameFromName = (instance?: InstanceElement): string => instance?.value.name ?? NO_VALUE_DEFAULT

const getNameFromTitle = (instance?: InstanceElement): string => instance?.value.title ?? NO_VALUE_DEFAULT


const GUIDE_ELEMENT_NAME: Record<string, (instance?: InstanceElement) => string> = {
  [CATEGORY_ORDER_TYPE_NAME]: () => 'category_order',
  [SECTION_ORDER_TYPE_NAME]: () => 'section_order',
  [ARTICLE_ORDER_TYPE_NAME]: () => 'article_order',
  [GUIDE_SETTINGS_TYPE_NAME]: () => 'brand_settings',
  [GUIDE_LANGUAGE_SETTINGS_TYPE_NAME]: (instance?: InstanceElement) => instance?.value.locale ?? NO_VALUE_DEFAULT,
  [ARTICLE_TRANSLATION_TYPE_NAME]: getTranslationLocale,
  [SECTION_TRANSLATION_TYPE_NAME]: getTranslationLocale,
  [CATEGORY_TRANSLATION_TYPE_NAME]: getTranslationLocale,
  [ARTICLE_TYPE_NAME]: getNameFromTitle,
  [CATEGORY_TYPE_NAME]: getNameFromName,
  [SECTION_TYPE_NAME]: getNameFromName,
  [ARTICLE_ATTACHMENT_TYPE_NAME]: (instance?: InstanceElement) => instance?.value.file_name ?? NO_VALUE_DEFAULT,
}


const getName = (instance: InstanceElement): string =>
  (GUIDE_ELEMENT_NAME[instance.elemID.typeName] === undefined
    ? pathNaclCase(naclCase((instance.elemID.name)))
    : pathNaclCase(naclCase(GUIDE_ELEMENT_NAME[instance.elemID.typeName](instance))))

/**
 * calculates a path which is not related to a specific brand
 */
const pathForGlobalTypes = (instance: InstanceElement): readonly string[] | undefined =>
  [
    ...GUIDE_PATH,
    GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName],
    pathNaclCase(naclCase(instance.elemID.name)),
  ]


/**
 * calculates a path which is related to a specific brand and does not have a parent
 */
const pathForBrandSpecificRootElements = (
  instance: InstanceElement,
  brandName: string | undefined,
  needTypeDirectory: boolean
)
: readonly string[] => {
  if (brandName === undefined) {
    log.error('brandName was not found for instance %s.', instance.elemID.getFullName())
    return [
      ...GUIDE_PATH,
      UNSORTED,
      GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName],
      pathNaclCase(naclCase(instance.elemID.name)),
    ]
  }
  const newPath = [
    ...GUIDE_PATH,
    'brands',
    brandName,
  ]
  const name = getName(instance)

  if (needTypeDirectory) {
    newPath.push(GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName])
  }
  if (instance.elemID.typeName === CATEGORY_TYPE_NAME) { // each category has a folder of its own
    newPath.push(name)
  }
  newPath.push(name)
  return newPath
}

/**
 * calculates a path which is related to a specific brand and has a parent.
 */
const pathForOtherLevels = ({
  instance,
  needTypeDirectory,
  needOwnFolder,
  parent,
} :{
  instance: InstanceElement
  needTypeDirectory: boolean
  needOwnFolder: boolean
  parent: InstanceElement | undefined
}): readonly string[] | undefined => {
  const parentPath = parent?.path
  if (parent === undefined || parentPath === undefined) {
    return [
      ...GUIDE_PATH,
      UNSORTED,
      GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName],
      pathNaclCase(naclCase((instance.elemID.name))),
    ]
  }
  const name = getName(instance)
  const newPath = parentPath.slice(0, parentPath.length - 1)
  if (needTypeDirectory) {
    newPath.push(GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName])
  }
  if (needOwnFolder) {
    newPath.push(name)
  }
  newPath.push(name)
  return newPath
}

const getId = (instance: InstanceElement): number => instance.value.id
const getFullName = (instance: InstanceElement): string => instance.elemID.getFullName()

/**
 * This filter arranges the paths for guide elements.
 */
const filterCreator: FilterCreator = () => ({
  name: 'guideArrangePaths',
  onFetch: async (elements: Element[]): Promise<void> => {
    const guideInstances = elements
      .filter(isInstanceElement)
      .filter(inst => Object.keys(GUIDE_ELEMENT_DIRECTORY).includes(inst.elemID.typeName))
    const guideGrouped = _.groupBy(guideInstances, inst => inst.elemID.typeName)

    const parents = guideInstances
      .filter(instance => PARENTS.includes(instance.elemID.typeName))
      .filter(parent => getId(parent) !== undefined)
    const parentsById = _.keyBy(parents, getId)
    const instanceByName = _.keyBy(parents, getFullName)
    const nameByIdParents = _.mapValues(_.keyBy(parents, getFullName), getId)

    const brands = elements
      .filter(elem => elem.elemID.typeName === BRAND_TYPE_NAME)
      .filter(isInstanceElement)
      .filter(brand => brand.value.name !== undefined)
    const fullNameByNameBrand = _.mapValues(_.keyBy(brands, getFullName), 'value.name')

    // user_segments and permission_groups
    FIRST_LEVEL_TYPES
      .flatMap(type => guideGrouped[type])
      .filter(instance => instance !== undefined)
      .forEach(instance => {
        instance.path = pathForGlobalTypes(instance)
      })

    // category, settings, language_settings, category_order
    BRAND_SECOND_LEVEL
      .flatMap(type => guideGrouped[type])
      .filter(instance => instance !== undefined)
      .forEach(instance => {
        const brandElemId = instance.value.brand?.elemID.getFullName()
        const needTypeDirectory = [
          CATEGORY_TYPE_NAME,
          GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
          CATEGORY_ORDER_TYPE_NAME,
          GUIDE_SETTINGS_TYPE_NAME,
        ].includes(instance.elemID.typeName)
        instance.path = pathForBrandSpecificRootElements(instance, fullNameByNameBrand[brandElemId], needTypeDirectory)
      })

    // sections under category
    const [sectionWithCategoryParent, sectionsWithSectionParent] = _.partition(
      guideGrouped[SECTION_TYPE_NAME] ?? [],
      inst => inst.value.direct_parent_type === CATEGORY_TYPE_NAME
    )
    sectionWithCategoryParent
      .forEach(instance => {
        const nameLookup = instance.value.direct_parent_id?.elemID.getFullName()
        const parent = nameLookup ? parentsById[nameByIdParents[nameLookup]] : undefined
        instance.path = pathForOtherLevels({
          instance,
          needTypeDirectory: true,
          needOwnFolder: true,
          parent,
        })
      })

    const sectionsWithSectionParentNames = new Set(sectionsWithSectionParent
      .map(section => section.elemID.getFullName()))

    // sort sections by dependencies
    const graph = new DAG<InstanceElement>()
    sectionsWithSectionParent
      .forEach(section => {
        graph.addNode(
          section.elemID.getFullName(),
          (sectionsWithSectionParentNames.has(section.value.direct_parent_id?.elemID.getFullName()))
            ? [section.value.direct_parent_id.elemID.getFullName()]
            : [],
          section,
        )
      })
    const sortedSections = await awu(graph.evaluationOrder())
      .map(name => instanceByName[name])
      .toArray()

    // sections under section
    sortedSections
      .forEach(instance => {
        const nameLookup = instance.value.direct_parent_id?.elemID.getFullName()
        const parent = nameLookup ? parentsById[nameByIdParents[nameLookup]] : undefined
        instance.path = pathForOtherLevels({
          instance,
          needTypeDirectory: false,
          needOwnFolder: true,
          parent,
        })
      })

    // articles
    const articles = guideGrouped[ARTICLE_TYPE_NAME] ?? []
    articles
      .forEach(instance => {
        const parentId = nameByIdParents[instance.value.section_id?.elemID.getFullName()]
        instance.path = pathForOtherLevels({
          instance,
          needTypeDirectory: true,
          needOwnFolder: true,
          parent: parentsById[parentId],
        })
      })

    // others (translations, article attachments)
    OTHER_TYPES
      .flatMap(type => guideGrouped[type])
      .filter(instance => instance !== undefined)
      .forEach(instance => {
        const parentId = getParent(instance).value.id
        instance.path = pathForOtherLevels({
          instance,
          needTypeDirectory: true,
          needOwnFolder: false,
          parent: parentsById[parentId],
        })
      })

    ORDER_TYPES
      .flatMap(type => guideGrouped[type])
      .filter(instance => instance !== undefined)
      .forEach(instance => {
        const parentId = getParent(instance).value.id
        instance.path = pathForOtherLevels({
          instance,
          needTypeDirectory: true,
          needOwnFolder: false,
          parent: parentsById[parentId],
        })
      })
  },
})

export default filterCreator
