/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Element, isInstanceElement, InstanceElement, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import _ from 'lodash'
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
} from '../constants'

export const GUIDE_PATH = ['zendesk', 'Records', 'guide']
const FIRST_LEVEL_TYPES = [USER_SEGMENT_TYPE_NAME, PERMISSION_GROUP_TYPE_NAME]
const BRAND_SECOND_LEVEL = [CATEGORY_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
]
const PARENTS = [CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ARTICLE_TYPE_NAME]
const TRANSLATIONS = [CATEGORY_TRANSLATION_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME]

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
}

/**
 * gives a path which is not related to a specific brand
 */
const pathForFirstLevel = (instance: InstanceElement): void => {
  const curPath = instance.path
  if (curPath === undefined) {
    return
  }
  instance.path = [
    ...GUIDE_PATH,
    GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName],
    curPath[curPath.length - 1],
  ]
}

/**
 * gives a path which is related to a specific brand and does not have a parent
 */
const pathForSecondLevel = (instance: InstanceElement): void => {
  const curPath = instance.path
  const brandName = instance.value.brand?.value.value.name
  if (curPath === undefined) {
    return
  }
  const newPath = [
    ...GUIDE_PATH,
    'brands',
    brandName,
    GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName],
    curPath[curPath.length - 1],
  ]
  if (instance.elemID.typeName === CATEGORY_TYPE_NAME) { // each category has a folder of its own
    newPath.push(curPath[curPath.length - 1])
  }
  instance.path = newPath
}

/**
 * gives a path which is related to a specific brand and has a parent.
 */
const pathForOtherLevels = (
  instance: InstanceElement,
  needTypeDirectory: boolean,
  needOwnFolder: boolean,
  parent: InstanceElement
): void => {
  const curPath = instance.path
  const parentPath = parent.path
  if (curPath === undefined || parentPath === undefined) {
    return
  }
  const newPath = [...(_.slice(parentPath, 0, parentPath.length - 1))]
  if (needTypeDirectory) {
    newPath.push(GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName])
  }
  if (needOwnFolder) {
    newPath.push(curPath[curPath.length - 1])
  }
  newPath.push(curPath[curPath.length - 1])
  instance.path = newPath
}

const getId = (instance: InstanceElement): number =>
  instance.value.id

/**
 * This filter arranges the paths for guide elements.
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const guideInstances = elements
      .filter(isInstanceElement)
      .filter(obj => Object.keys(GUIDE_ELEMENT_DIRECTORY).includes(obj.elemID.typeName))

    const parents = guideInstances.filter(instance => PARENTS.includes(instance.elemID.typeName))
    const parentsById = _.keyBy(parents, getId)

    // user_segments and permission_groups
    guideInstances
      .filter(instance => FIRST_LEVEL_TYPES.includes(instance.elemID.typeName))
      .forEach(pathForFirstLevel)

    // category, settings, language_settings
    guideInstances
      .filter(instance => BRAND_SECOND_LEVEL.includes(instance.elemID.typeName))
      .forEach(pathForSecondLevel)

    // sections under category
    guideInstances
      .filter(instance => instance.elemID.typeName === SECTION_TYPE_NAME)
      .filter(instance => instance.value.direct_parent_type === CATEGORY_TYPE_NAME)
      .forEach(instance => {
        const parentId = instance.value.direct_parent_id.value.value.id
        pathForOtherLevels(instance, true, true, parentsById[parentId])
      })

    // sections under section
    guideInstances
      .filter(instance => instance.elemID.typeName === SECTION_TYPE_NAME)
      .filter(instance => instance.value.direct_parent_type === SECTION_TYPE_NAME)
      .forEach(instance => {
        const parentId = instance.value.direct_parent_id.value.value.id
        pathForOtherLevels(instance, false, true, parentsById[parentId])
      })

    // articles
    guideInstances
      .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
      .forEach(instance => {
        const parentId = instance.value.section_id.value.value.id
        pathForOtherLevels(instance, true, true, parentsById[parentId])
      })

    // others (translations, article attachments, order?)
    guideInstances
      .filter(instance => TRANSLATIONS.includes(instance.elemID.typeName))
      .forEach(instance => {
        const parentId = instance.annotations[CORE_ANNOTATIONS.PARENT][0].value.value.id
        pathForOtherLevels(instance, true, false, parentsById[parentId])
      })
  },
})

export default filterCreator
