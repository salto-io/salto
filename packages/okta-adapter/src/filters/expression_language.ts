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
import { Element, InstanceElement, isInstanceElement, ReferenceExpression, TemplateExpression, TemplatePart } from '@salto-io/adapter-api'
import { extractTemplate, resolvePath, setPath } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, POLICY_RULE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../constants'

const log = logger(module)

const USER_SCHEMA_REGEX = /(user\.[a-zA-Z]+)/g // pattern: user.someString
const ID_REEGX = /(\(["']['"\s,a-zA-Z0-9]+?['"]\))/g // pattern: ("id1", "Id2")
// Identity engine patterns:
const GROUP_ID_IE_REGEX = /({["']['"\s,a-zA-Z\d]+?["']})/g // pattern: {"iD1", "id2"}
const USER_SCHEMA_IE_REGEX = /(user\.profile\.[a-zA-Z]+)/g // pattern: user.profile.someString
// const id1 = /(\(["'][a-zA-Z0-9]+?['"\s],)/g
// const id2 = /(\(["'][a-zA-Z0-9]+?['"]\))/g

type expressionDetails = {
  path: string[]
  patterns: RegExp[]
}

const TYPE_TO_EXPRESSIONS: Record<string, expressionDetails> = {
  [GROUP_RULE_TYPE_NAME]: {
    path: ['conditions', 'expression', 'value'],
    patterns: [USER_SCHEMA_REGEX, ID_REEGX],
  },
  [POLICY_RULE_TYPE_NAME]: {
    path: ['conditions', 'additionalProperties', 'elCondition', 'condition'],
    patterns: [GROUP_ID_IE_REGEX, USER_SCHEMA_IE_REGEX],
  },
}

/**
 * Gets a string with ids and returns the matching template
 */
const getTemplatePartsFromIds = (
  expression: string,
  instancesByType: Record<string, InstanceElement[]>,
): TemplatePart | TemplatePart[] => {
  const ids = expression.split(', ').map(id => id.replace(/['"]/g, ''))
  const templateParts = ids.map(id => {
    const matchingInstance = instancesByType[GROUP_TYPE_NAME]?.find(instance => instance.value.id === id)
    return matchingInstance !== undefined ? new ReferenceExpression(matchingInstance.elemID, matchingInstance) : `"${id}"`
  })
  return templateParts
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
      userSchemaInstance.value.definitions?.custom?.properties?.additionalProperties?.userFieldName
    )
  }
  const baseValue = resolvePath(userSchemaInstance, userSchemaInstance.elemID.createNestedID(...basePath))
  if (baseValue) {
    return new ReferenceExpression(
      userSchemaInstance.elemID.createNestedID(...basePath),
      userSchemaInstance.value.definitions?.base?.properties?.userFieldName
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
  instancesByType: Record<string, InstanceElement[]>
): string | TemplateExpression => {
  const template = extractTemplate(
    expressionValue,
    patterns,
    expression => {
      if (expression.startsWith('(') && expression.endsWith(')')) {
        const ids = expression.slice(1, -1) // remove brackets to get ids
        return ['(', getTemplatePartsFromIds(ids, instancesByType), ')'].flat()
      }
      if (expression.startsWith('{') && expression.endsWith('}')) {
        const ids = expression.slice(1, -1) // remove curly braces to get ids
        return ['{', getTemplatePartsFromIds(ids, instancesByType), '}'].flat()
      }
      if (expression.startsWith('user.')) {
        const userSchemaInstance = instancesByType[USER_SCHEMA_TYPE_NAME]?.find(instance => instance.elemID.name === 'user')
        if (userSchemaInstance === undefined) {
          return expression
        }
        if (expression.match(USER_SCHEMA_IE_REGEX)) {
          const userAttribute = expression.replace('user.profile.', '')
          return getUserSchemaReferences(userAttribute, userSchemaInstance) ?? expression
        }
        const userAttribute = expression.replace('user.', '')
        return getUserSchemaReferences(userAttribute, userSchemaInstance) ?? expression
      }
      return expression
    },
  )
  return template
}

const replaceFormulasWithTemplates = async (instances: InstanceElement[]): Promise<void> => {
  const instancesByType = _.groupBy(instances, i => i.elemID.typeName)
  instances
    .filter(instance => Object.keys(TYPE_TO_EXPRESSIONS).includes(instance.elemID.typeName))
    .forEach(instance => {
      const { path, patterns } = TYPE_TO_EXPRESSIONS[instance.elemID.typeName]
      const expressionFieldPath = instance.elemID.createNestedID(...path)
      const expressionValue = resolvePath(instance, expressionFieldPath)
      if (_.isString(expressionValue)) {
        // TODO pass just relevant instances
        const template = stringToTemplate(expressionValue, patterns, instancesByType)
        setPath(instance, expressionFieldPath, template)
      }
    })
}


/**
 * Create template expressions for okta expression language references
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => log.time(async () => {
    await replaceFormulasWithTemplates(elements.filter(isInstanceElement))
  }, 'Expression language filter'),
})

export default filter
