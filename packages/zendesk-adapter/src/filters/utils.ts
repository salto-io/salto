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
import Joi from 'joi'
import {
  Change,
  ChangeDataType,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  ReferenceExpression,
  TemplatePart,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData, createSchemeGuard, getParents, references } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import wu from 'wu'
import { references as referencesUtils, resolveChangeElement } from '@salto-io/adapter-components'
import { lookupFunc } from './field_references'
import { ZendeskFetchConfig } from '../config'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_ATTACHMENTS_FIELD,
  ARTICLE_TYPE_NAME,
  ARTICLES_FIELD,
  BRAND_TYPE_NAME,
  CATEGORIES_FIELD,
  CATEGORY_TYPE_NAME,
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  SECTION_TYPE_NAME,
  SECTIONS_FIELD,
  TICKET_FORM_TYPE_NAME,
  ZENDESK,
} from '../constants'

const { isDefined } = lowerDashValues
const { createMissingInstance } = referencesUtils
const { awu } = collections.asynciterable
const log = logger(module)
const { isArrayOfRefExprToInstances } = references
export type Condition = {
  field: string | ReferenceExpression
  value?: unknown
}
export type SubjectCondition = {
  subject: string | ReferenceExpression
  value?: unknown
}

const TYPES_WITH_SUBJECT_CONDITIONS = ['routing_attribute_value']
export const DOMAIN_REGEX = /(https:\/\/[^/]+)/

export const applyforInstanceChangesOfType = async (
  changes: Change<ChangeDataType>[],
  typeNames: string[],
  func: (arg: InstanceElement) => Promise<InstanceElement> | InstanceElement,
): Promise<void> => {
  await awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => typeNames.includes(getChangeData(change).elemID.typeName))
    .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(change, func))
}

export const createAdditionalParentChanges = async (
  childrenChanges: Change<InstanceElement>[],
  shouldResolve = true,
): Promise<Change<InstanceElement>[] | undefined> => {
  const childrenInstance = getChangeData(childrenChanges[0])
  const parents = getParents(childrenInstance)
  if (_.isEmpty(parents) || !isArrayOfRefExprToInstances(parents)) {
    log.error(
      `Failed to update the following ${
        childrenInstance.elemID.typeName
      } instances since they have no valid parent: ${childrenChanges
        .map(getChangeData)
        .map(e => e.elemID.getFullName())}`,
    )
    return undefined
  }
  const changes = parents.map(parent =>
    toChange({
      before: parent.value.clone(),
      after: parent.value.clone(),
    }),
  )
  return shouldResolve
    ? awu(changes)
        .map(change => resolveChangeElement(change, lookupFunc))
        .toArray()
    : changes
}

const CONDITION_SCHEMA = Joi.array()
  .items(
    Joi.object({
      field: [Joi.string().required(), Joi.object().required()],
      value: Joi.optional(),
    }).unknown(true),
  )
  .required()

const CONDITION_SUBJECT_SCHEMA = Joi.array()
  .items(
    Joi.object({
      subject: [Joi.string().required(), Joi.object().required()],
      value: Joi.optional(),
    }).unknown(true),
  )
  .required()

export const isConditions = createSchemeGuard<Condition[]>(CONDITION_SCHEMA, 'Found invalid values for conditions')
export const isSubjectConditions = createSchemeGuard<SubjectCondition[]>(
  CONDITION_SUBJECT_SCHEMA,
  'Found invalid values for subject conditions',
)
export const conditionFieldValue = (
  condition: Condition | SubjectCondition,
  typeName: string,
): string | ReferenceExpression =>
  TYPES_WITH_SUBJECT_CONDITIONS.includes(typeName)
    ? (condition as SubjectCondition).subject
    : (condition as Condition).field
export const isCorrectConditions = (value: unknown, typeName: string): value is (Condition | SubjectCondition)[] =>
  TYPES_WITH_SUBJECT_CONDITIONS.includes(typeName) ? isSubjectConditions(value) : isConditions(value)

const getBrandsForFilter = (
  elements: InstanceElement[],
  fetchConfig: ZendeskFetchConfig,
  filter: 'brands' | 'themesForBrands' | 'themes.brands',
): InstanceElement[] => {
  const brandsRegexList: string[] = _.get(fetchConfig.guide, filter, [])
  return elements
    .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
    .filter(brandInstance => brandInstance.value.has_help_center)
    .filter(brandInstance => brandsRegexList.some(regex => new RegExp(regex).test(brandInstance.value.name)))
}

export const getBrandsForGuide = (elements: InstanceElement[], fetchConfig: ZendeskFetchConfig): InstanceElement[] =>
  getBrandsForFilter(elements, fetchConfig, 'brands')

export const getBrandsForGuideThemes = (
  elements: InstanceElement[],
  fetchConfig: ZendeskFetchConfig,
): InstanceElement[] => {
  const themesSelector = fetchConfig.guide?.themesForBrands ? 'themesForBrands' : 'themes.brands'
  return getBrandsForFilter(elements, fetchConfig, themesSelector)
}

export const matchBrand = (url: string, brands: Record<string, InstanceElement>): InstanceElement | undefined => {
  const urlSubdomain = url.match(DOMAIN_REGEX)?.pop()
  const urlBrand = urlSubdomain ? brands[urlSubdomain] : undefined
  if (urlBrand !== undefined) {
    return urlBrand
  }
  return undefined
}

export const matchBrandSubdomainFunc = (
  instances: InstanceElement[],
  fetchConfig: ZendeskFetchConfig,
): ((url: string) => InstanceElement | undefined) => {
  const brandsByUrl = _.keyBy(
    instances.filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME),
    brand => _.toString(brand.value.brand_url),
  )

  const brandsIncludingGuide = getBrandsForGuide(instances, fetchConfig)
  return (url: string) => {
    const urlBrandInstance = matchBrand(url, brandsByUrl)
    if (urlBrandInstance === undefined) {
      return undefined
    }
    if (!brandsIncludingGuide.includes(urlBrandInstance)) {
      log.info('Brand is excluded in found url %o, not creating references. %o', url, urlBrandInstance)
      return undefined
    }
    return urlBrandInstance
  }
}

type CustomFieldOption = {
  // eslint-disable-next-line camelcase
  raw_name: string
  name?: string
}

const isCustomFieldOption = (value: Value): value is CustomFieldOption =>
  _.isPlainObject(value) && _.isString(value.raw_name)

// Get all the custom field options from the changes, including the ones nested inside the children of the parent
export const getCustomFieldOptionsFromChanges = (
  parentTypeName: string,
  childTypeName: string,
  changes: Change[],
): CustomFieldOption[] => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => [parentTypeName, childTypeName].includes(instance.elemID.typeName))

  const [parentInstances, childrenInstances] = _.partition(
    relevantInstances,
    instance => instance.elemID.typeName === parentTypeName,
  )

  return childrenInstances
    .map(instance => instance.value)
    .concat(parentInstances.map(instance => instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] ?? []))
    .flat()
    .filter(isCustomFieldOption)
}

export const ELEMENTS_REGEXES = [
  [CATEGORIES_FIELD, CATEGORY_TYPE_NAME],
  [SECTIONS_FIELD, SECTION_TYPE_NAME],
  [ARTICLES_FIELD, ARTICLE_TYPE_NAME],
  [ARTICLE_ATTACHMENTS_FIELD, ARTICLE_ATTACHMENT_TYPE_NAME],
]
  .map(([field, type]) => ({
    type,
    urlRegex: new RegExp(`(\\/${field}\\/\\d+)`),
    idRegex: new RegExp(`(?<url>/${field}/)(?<id>\\d+)`),
  }))
  .concat({
    type: TICKET_FORM_TYPE_NAME,
    urlRegex: /(ticket_form_id=\d+)/,
    idRegex: /(?<url>ticket_form_id=)(?<id>\d+)/,
  })

// Attempt to match the regex to an element and create a reference to that element
const createInstanceReference = ({
  urlPart,
  brandOfInstance,
  instancesById,
  idRegex,
  type,
  enableMissingReferences,
}: {
  urlPart: string
  brandOfInstance?: InstanceElement
  instancesById: Record<string, InstanceElement>
  idRegex: RegExp
  type: string
  enableMissingReferences?: boolean
}): TemplatePart[] | undefined => {
  const { url, id } = urlPart.match(idRegex)?.groups ?? {}
  if (url !== undefined && id !== undefined) {
    const referencedInstance = instancesById[id]
    if (referencedInstance) {
      // We want to keep the original url and replace just the id
      return [url, new ReferenceExpression(referencedInstance.elemID, referencedInstance)]
    }
    // if could not find a valid instance, create a MissingReferences.
    if (enableMissingReferences) {
      // If we know the brand that the instance belongs to, we can create a MissingReference with the brand name
      const missingInstanceId = brandOfInstance ? `${brandOfInstance.value.name}_${id}` : id
      const missingInstance = createMissingInstance(ZENDESK, type, missingInstanceId)
      missingInstance.value.id = id
      return [url, new ReferenceExpression(missingInstance.elemID, missingInstance)]
    }
  }
  return undefined
}

// Receives a url part (e.g. /categories/123) and attempts to replace the number with a reference to the element
export const transformReferenceUrls = ({
  urlPart,
  brandOfInstance,
  instancesById,
  enableMissingReferences,
}: {
  urlPart: string
  brandOfInstance?: InstanceElement
  instancesById: Record<string, InstanceElement>
  enableMissingReferences?: boolean
}): TemplatePart[] => {
  // Attempt to match other instances, stop on the first result
  const result = wu(ELEMENTS_REGEXES)
    .map(({ idRegex, type }) =>
      createInstanceReference({
        urlPart,
        brandOfInstance,
        instancesById,
        idRegex,
        type,
        enableMissingReferences,
      }),
    )
    .find(isDefined)

  // If nothing matched, return the original url
  return result ?? [urlPart]
}
