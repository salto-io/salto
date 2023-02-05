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
import _ from 'lodash'
import { Change, Element, getChangeData, InstanceElement, isInstanceElement, isTemplateExpression, ReferenceExpression, TemplateExpression, TemplatePart } from '@salto-io/adapter-api'
import { extractTemplate, replaceTemplatesWithValues, resolvePath, resolveTemplates, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, POLICY_RULE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../constants'

const log = logger(module)

const USER_SCHEMA_REGEX = /(user\.[a-zA-Z0-9_]+)/g // pattern: user.someString
const USER_SCHEMA_IE_REGEX = /(user\.profile\.[a-zA-Z0-9_]+)/g // pattern: user.profile.someString
const ID_REGEX = /(["'][a-zA-Z0-9]+?['"])/g // pattern: "someId" or 'someId'
const USER_SCHEMA_PREFIX = 'user.'
const USER_SCHEMA_IE_PREFIX = 'user.profile.'
const USER_SCHEMA_CUSTOM_PATH = ['definitions', 'custom', 'properties', 'additionalProperties']
const USER_SCHEMA_BASE_PATH = ['definitions', 'base', 'properties']

type ExpressionLanguageDef = {
  pathToContainer: string[]
  fieldName: string
  patterns: RegExp[]
  isIdentityEngine: boolean
}

const TYPE_TO_DEF: Record<string, ExpressionLanguageDef> = {
  [GROUP_RULE_TYPE_NAME]: {
    pathToContainer: ['conditions', 'expression'],
    fieldName: 'value',
    patterns: [ID_REGEX, USER_SCHEMA_REGEX],
    isIdentityEngine: false,
  },
  [POLICY_RULE_TYPE_NAME]: {
    pathToContainer: ['conditions', 'additionalProperties', 'elCondition'],
    fieldName: 'condition',
    patterns: [ID_REGEX, USER_SCHEMA_IE_REGEX],
    isIdentityEngine: true,
  },
}

const getUserSchemaReference = (
  userAttribute: string,
  userSchemaInstance: InstanceElement,
): ReferenceExpression | undefined => {
  const customPath = [...USER_SCHEMA_CUSTOM_PATH, userAttribute]
  const basePath = [...USER_SCHEMA_BASE_PATH, userAttribute]
  const customValue = resolvePath(userSchemaInstance, userSchemaInstance.elemID.createNestedID(...customPath))
  if (customValue !== undefined) {
    return new ReferenceExpression(
      userSchemaInstance.elemID.createNestedID(...customPath),
      customValue
    )
  }
  const baseValue = resolvePath(userSchemaInstance, userSchemaInstance.elemID.createNestedID(...basePath))
  if (baseValue) {
    return new ReferenceExpression(
      userSchemaInstance.elemID.createNestedID(...basePath),
      baseValue
    )
  }
  return undefined
}

const createPrepRefFunc = (isIdentityEngine: boolean):(part: ReferenceExpression) => TemplatePart => {
  const prepRef = (part: ReferenceExpression): TemplatePart => {
    if (part.elemID.typeName === USER_SCHEMA_TYPE_NAME) {
      const userSchemaField = part.elemID.getFullNameParts().pop()
      if (!_.isString(userSchemaField)) {
        throw new Error(`Received an invalid value inside a template expression ${part.elemID.getFullName()}: ${safeJsonStringify(part.value)}`)
      }
      return `${isIdentityEngine ? USER_SCHEMA_IE_PREFIX : USER_SCHEMA_PREFIX}${userSchemaField}`
    }
    if (part.elemID.isTopLevel()) {
      return `"${part.value.value.id}"`
    }
    return part
  }
  return prepRef
}

/**
 * This function receives a string in okta expression language and replaces it with salto style templates.
 */
const stringToTemplate = (
  expressionValue: string,
  patterns: RegExp[],
  instances: InstanceElement[]
): string | TemplateExpression => {
  const groupInstances = instances.filter(i => i.elemID.typeName === GROUP_TYPE_NAME)
  const userSchemaInstance = instances.find(i => i.elemID.typeName === USER_SCHEMA_TYPE_NAME && i.elemID.name === 'user')
  const template = extractTemplate(
    expressionValue,
    patterns,
    expression => {
      if (expression.match(/^["'][a-zA-Z0-9]+?['"]$/)) { // check if the string is a potential id
        const id = expression.slice(1, -1)
        const matchingInstance = groupInstances.find(instance => instance.value.id === id)
        return matchingInstance !== undefined
          ? new ReferenceExpression(matchingInstance.elemID, matchingInstance)
          : expression
      }
      if (expression.startsWith(USER_SCHEMA_PREFIX)) {
        if (userSchemaInstance === undefined) {
          return expression
        }
        if (expression.match(USER_SCHEMA_IE_REGEX)) {
          const userAttribute = expression.replace(USER_SCHEMA_IE_PREFIX, '')
          return getUserSchemaReference(userAttribute, userSchemaInstance) ?? expression
        }
        const userAttribute = expression.replace(USER_SCHEMA_PREFIX, '')
        return getUserSchemaReference(userAttribute, userSchemaInstance) ?? expression
      }
      return expression
    },
  )
  return template
}

/**
 * Create template expressions for okta expression language references
 */
const filter: FilterCreator = () => {
  const changeToTemplateMapping: Record<string, TemplateExpression> = {}
  return ({
    name: 'oktaExpressionLanguageFilter',
    onFetch: async (elements: Element[]) => {
      const instances = elements.filter(isInstanceElement)
      const potentialExpressionInstances = instances
        .filter(instance => Object.keys(TYPE_TO_DEF).includes(instance.elemID.typeName))
      const potentialTargetInstances = instances
        .filter(instance => [GROUP_TYPE_NAME, USER_SCHEMA_TYPE_NAME].includes(instance.elemID.typeName))

      potentialExpressionInstances
        .forEach(instance => {
          const { pathToContainer, fieldName, patterns } = TYPE_TO_DEF[instance.elemID.typeName]
          const container = resolvePath(instance, instance.elemID.createNestedID(...pathToContainer))
          const expressionValue = container?.[fieldName]
          if (_.isString(expressionValue)) {
            const template = stringToTemplate(expressionValue, patterns, potentialTargetInstances)
            if (isTemplateExpression(template)) {
              _.set(container, fieldName, template)
            }
          }
        })
    },

    preDeploy: async (changes: Change<InstanceElement>[]) => {
      changes
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => Object.keys(TYPE_TO_DEF).includes(instance.elemID.typeName))
        .forEach(
          async instance => {
            const { pathToContainer, fieldName, isIdentityEngine } = TYPE_TO_DEF[instance.elemID.typeName]
            const container = resolvePath(instance, instance.elemID.createNestedID(...pathToContainer))
            const expressionValue = container?.[fieldName]
            if (isTemplateExpression(expressionValue)) {
              try {
                replaceTemplatesWithValues(
                  { values: [container], fieldName },
                  changeToTemplateMapping,
                  createPrepRefFunc(isIdentityEngine),
                )
              } catch (e) {
                log.error(`Error parsing templates in instance ${instance.elemID.getFullName()} before deployment`, e)
              }
            }
          }
        )
    },


    onDeploy: async (changes: Change<InstanceElement>[]) => {
      changes
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => Object.keys(TYPE_TO_DEF).includes(instance.elemID.typeName))
        .forEach(
          async instance => {
            const { pathToContainer, fieldName } = TYPE_TO_DEF[instance.elemID.typeName]
            const container = resolvePath(instance, instance.elemID.createNestedID(...pathToContainer))
            const expressionValue = container?.[fieldName]
            if (_.isString(expressionValue)) {
              try {
                resolveTemplates({ values: [container], fieldName }, changeToTemplateMapping)
              } catch (e) {
                log.error(`Error restoring templates in instance ${instance.elemID.getFullName()} after deployment`, e)
              }
            }
          }
        )
    },
  })
}

export default filter
