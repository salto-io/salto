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
import { Element, InstanceElement, isInstanceElement, isTemplateExpression, ReferenceExpression, TemplateExpression, TemplatePart } from '@salto-io/adapter-api'
import { extractTemplate, resolvePath } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, POLICY_RULE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../constants'

const log = logger(module)

const USER_SCHEMA_REGEX = /(user\.[a-zA-Z]+)/g // pattern: user.someString
const USER_SCHEMA_IE_REGEX = /(user\.profile\.[a-zA-Z]+)/g // pattern: user.profile.someString
const ID_REGEX = /(["'][a-zA-Z0-9]+?['"])/g // pattern: "someId" or 'someId'
const USER_SCHEMA_PREFIX = 'user.'
const USER_SCHEMA_IE_PREFIX = 'user.profile.'

type expressionDetails = {
  pathToContainer: string[]
  fieldName: string
  patterns: RegExp[]
}

const TYPE_TO_EXPRESSIONS: Record<string, expressionDetails> = {
  [GROUP_RULE_TYPE_NAME]: {
    pathToContainer: ['conditions', 'expression'],
    fieldName: 'value',
    patterns: [USER_SCHEMA_REGEX, ID_REGEX],
  },
  [POLICY_RULE_TYPE_NAME]: {
    pathToContainer: ['conditions', 'additionalProperties', 'elCondition'],
    fieldName: 'condition',
    patterns: [ID_REGEX, USER_SCHEMA_IE_REGEX],
  },
}

const getUserSchemaReferences = (
  userAttribute: string,
  userSchemaInstance: InstanceElement,
): TemplatePart | TemplatePart[] | undefined => {
  const customPath = ['definitions', 'custom', 'properties', 'additionalProperties', userAttribute]
  const basePath = ['definitions', 'base', 'properties', userAttribute]
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
          return getUserSchemaReferences(userAttribute, userSchemaInstance) ?? expression
        }
        const userAttribute = expression.replace(USER_SCHEMA_PREFIX, '')
        return getUserSchemaReferences(userAttribute, userSchemaInstance) ?? expression
      }
      return expression
    },
  )
  return template
}

const replaceExpressionsWithTemplates = (instances: InstanceElement[]): void => {
  instances
    .filter(instance => Object.keys(TYPE_TO_EXPRESSIONS).includes(instance.elemID.typeName))
    .forEach(instance => {
      const { pathToContainer, fieldName, patterns } = TYPE_TO_EXPRESSIONS[instance.elemID.typeName]
      const container = resolvePath(instance, instance.elemID.createNestedID(...pathToContainer))
      const expressionValue = container?.[fieldName]
      if (_.isString(expressionValue)) {
        const template = stringToTemplate(expressionValue, patterns, instances)
        if (isTemplateExpression(template)) {
          _.set(container, fieldName, template)
        }
      }
    })
}

/**
 * Create template expressions for okta expression language references
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => log.time(() => {
    replaceExpressionsWithTemplates(elements.filter(isInstanceElement))
  }, 'Expression language filter'),
})

export default filter
