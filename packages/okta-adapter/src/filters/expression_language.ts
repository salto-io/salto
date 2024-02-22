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
import {
  Change,
  createSaltoElementError,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  isTemplateExpression,
  ReferenceExpression,
  SaltoElementError,
  TemplateExpression,
  TemplatePart,
} from '@salto-io/adapter-api'
import { extractTemplate, replaceTemplatesWithValues, resolvePath, resolveTemplates } from '@salto-io/adapter-utils'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FETCH_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import {
  ACCESS_POLICY_RULE_TYPE_NAME,
  BEHAVIOR_RULE_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  GROUP_TYPE_NAME,
  OKTA,
  USER_SCHEMA_TYPE_NAME,
} from '../constants'

const log = logger(module)
const { createMissingInstance } = referenceUtils

const USER_SCHEMA_REGEX = /(user\.[a-zA-Z0-9_]+)/g // pattern: user.someString
const USER_SCHEMA_IE_REGEX = /(user\.profile\.[a-zA-Z0-9_]+)/g // pattern: user.profile.someString
const ID_REGEX = /(["'][a-zA-Z0-9]+?['"])/g // pattern: "someId" or 'someId'
const BEHAVIOR_REGEX = /(security\.behaviors\.contains\(.+?\))/g // pattern: security.behaviors.contains(someString)
const USER_SCHEMA_PREFIX = 'user.'
const USER_SCHEMA_IE_PREFIX = 'user.profile.'
const BEHAVIOR_EXPRESSION_PREFIX = 'security.behaviors.contains'
const USER_SCHEMA_CUSTOM_PATH = ['definitions', 'custom', 'properties']
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
  [ACCESS_POLICY_RULE_TYPE_NAME]: {
    pathToContainer: ['conditions', 'elCondition'],
    fieldName: 'condition',
    patterns: [ID_REGEX, USER_SCHEMA_IE_REGEX, BEHAVIOR_REGEX],
    isIdentityEngine: true,
  },
}

export const getUserSchemaReference = (
  userAttribute: string,
  userSchemaInstance: InstanceElement,
): ReferenceExpression | undefined => {
  const customPath = [...USER_SCHEMA_CUSTOM_PATH, userAttribute]
  const basePath = [...USER_SCHEMA_BASE_PATH, userAttribute]
  const customValue = resolvePath(userSchemaInstance, userSchemaInstance.elemID.createNestedID(...customPath))
  if (customValue !== undefined) {
    return new ReferenceExpression(userSchemaInstance.elemID.createNestedID(...customPath), customValue)
  }
  const baseValue = resolvePath(userSchemaInstance, userSchemaInstance.elemID.createNestedID(...basePath))
  if (baseValue) {
    return new ReferenceExpression(userSchemaInstance.elemID.createNestedID(...basePath), baseValue)
  }
  return undefined
}

export const resolveUserSchemaRef = (ref: ReferenceExpression): string | undefined => {
  const topLevelParentId = ref.elemID.createTopLevelParentID().parent
  const parentId = ref.elemID.createParentID()
  if (
    topLevelParentId.createNestedID(...USER_SCHEMA_CUSTOM_PATH).isEqual(parentId) ||
    topLevelParentId.createNestedID(...USER_SCHEMA_BASE_PATH).isEqual(parentId)
  ) {
    return ref.elemID.name
  }
  log.error(`Received an invalid reference for ${USER_SCHEMA_TYPE_NAME} attribute: ${ref.elemID.getFullName()}`)
  return undefined
}

const createPrepRefFunc = (isIdentityEngine: boolean): ((part: ReferenceExpression) => TemplatePart) => {
  const prepRef = (part: ReferenceExpression): TemplatePart => {
    if (part.elemID.typeName === USER_SCHEMA_TYPE_NAME) {
      const userSchemaField = resolveUserSchemaRef(part)
      if (userSchemaField !== undefined) {
        return `${isIdentityEngine ? USER_SCHEMA_IE_PREFIX : USER_SCHEMA_PREFIX}${userSchemaField}`
      }
    }
    if (part.elemID.typeName === BEHAVIOR_RULE_TYPE_NAME) {
      // references to BehaviorRule are by name
      const { name } = part.value?.value
      if (name !== undefined) {
        return `"${name}"`
      }
    }
    if (part.elemID.isTopLevel()) {
      const { id } = part.value.value
      if (id !== undefined) {
        return `"${id}"`
      }
    }
    throw new Error(`Could not resolve reference to: ${part.elemID.getFullName()}`)
  }
  return prepRef
}

/**
 * This function receives a string in okta expression language and replaces it with salto style templates.
 */
const stringToTemplate = (
  expressionValue: string,
  patterns: RegExp[],
  instances: InstanceElement[],
  enableMissingReferences?: boolean,
): string | TemplateExpression => {
  const groupInstances = instances.filter(i => i.elemID.typeName === GROUP_TYPE_NAME)
  const userSchemaInstance = instances.find(
    i => i.elemID.typeName === USER_SCHEMA_TYPE_NAME && i.elemID.name === 'user',
  )
  const behaviorInstances = instances.filter(i => i.elemID.typeName === BEHAVIOR_RULE_TYPE_NAME)
  const template = extractTemplate(expressionValue, patterns, expression => {
    if (expression.match(/^["'][a-zA-Z0-9]+?['"]$/)) {
      // check if the string is a potential id
      const id = expression.slice(1, -1)
      const matchingInstance = groupInstances.find(instance => instance.value.id === id)
      if (matchingInstance !== undefined) {
        return new ReferenceExpression(matchingInstance.elemID, matchingInstance)
      }
      // hack to verify this is a group id, because group ids in okta starts with '00g'
      if (enableMissingReferences && id.startsWith('00g') && id.length > 10) {
        // create missing reference for group
        const missingInstance = createMissingInstance(OKTA, GROUP_TYPE_NAME, id)
        return new ReferenceExpression(missingInstance.elemID, missingInstance)
      }
      return expression
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
    if (expression.startsWith(BEHAVIOR_EXPRESSION_PREFIX)) {
      // extract BehaviorRule name between the quotes
      const behaviorName = expression.match(/(["'].+?['"])/)?.[0]?.slice(1, -1)
      if (_.isString(behaviorName)) {
        const matchingBehavior = behaviorInstances.find(instance => instance.value.name === behaviorName)
        return matchingBehavior !== undefined
          ? [BEHAVIOR_EXPRESSION_PREFIX, '(', new ReferenceExpression(matchingBehavior.elemID, matchingBehavior), ')']
          : expression
      }
    }
    return expression
  })
  return template
}

/**
 * Create template expressions for okta expression language references
 */
const filter: FilterCreator = ({ config }) => {
  const changeToTemplateMapping: Record<string, TemplateExpression> = {}
  const ErrorByChangeId: Record<string, SaltoElementError> = {}
  return {
    name: 'oktaExpressionLanguageFilter',
    onFetch: async (elements: Element[]) => {
      const { enableMissingReferences } = config[FETCH_CONFIG]
      const instances = elements.filter(isInstanceElement)
      const potentialExpressionInstances = instances.filter(instance =>
        Object.keys(TYPE_TO_DEF).includes(instance.elemID.typeName),
      )
      const potentialTargetTypes = new Set([GROUP_TYPE_NAME, USER_SCHEMA_TYPE_NAME, BEHAVIOR_RULE_TYPE_NAME])
      const potentialTargetInstances = instances.filter(instance => potentialTargetTypes.has(instance.elemID.typeName))

      potentialExpressionInstances.forEach(instance => {
        const { pathToContainer, fieldName, patterns } = TYPE_TO_DEF[instance.elemID.typeName]
        const container = resolvePath(instance, instance.elemID.createNestedID(...pathToContainer))
        const expressionValue = container?.[fieldName]
        if (_.isString(expressionValue)) {
          const template = stringToTemplate(
            expressionValue,
            patterns,
            potentialTargetInstances,
            enableMissingReferences,
          )
          if (isTemplateExpression(template)) {
            _.set(container, fieldName, template)
          }
        }
      })
    },

    preDeploy: async (changes: Change<InstanceElement>[]) => {
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => Object.keys(TYPE_TO_DEF).includes(instance.elemID.typeName))
        .forEach(async instance => {
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
            } catch (error) {
              log.error(
                `Error parsing templates in instance ${instance.elemID.getFullName()} before deployment: ${error.message}`,
              )
              ErrorByChangeId[instance.elemID.getFullName()] = createSaltoElementError({
                severity: 'Error',
                message: 'Error parsing Okta expression language expression',
                elemID: instance.elemID,
              })
            }
          }
        })
    },

    deploy: async changes => {
      // Return deploy errors for changes with template expressions we chould not resolve during 'preDeploy'
      const leftoverChanges = changes.filter(
        change => ErrorByChangeId[getChangeData(change).elemID.getFullName()] === undefined,
      )
      return {
        leftoverChanges,
        deployResult: { appliedChanges: [], errors: Object.values(ErrorByChangeId) },
      }
    },

    onDeploy: async (changes: Change<InstanceElement>[]) => {
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => Object.keys(TYPE_TO_DEF).includes(instance.elemID.typeName))
        .forEach(async instance => {
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
        })
    },
  }
}

export default filter
