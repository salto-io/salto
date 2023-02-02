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
import { InstanceElement, ReferenceExpression, TemplateExpression, TemplatePart } from '@salto-io/adapter-api'
import _ from 'lodash'
import { walkAST, JastBuilder, Operand, ValueOperand, TerminalClause, Field as JqlField, Position } from '@atlassianlabs/jql-ast'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { ISSUE_TYPE_NAME, PRIORITY_TYPE_NAME, PROJECT_TYPE, RESOLUTION_TYPE_NAME, STATUS_TYPE_NAME, STATUS_CATEGORY_TYPE_NAME } from '../../constants'
import { FIELD_TYPE_NAME } from '../fields/constants'

// e.g., cf[1234]
const CUSTOM_FIELD_PATTERN = /^cf\[(\d+)\]$/
const JQL_CUSTOM_FIELD_PREFIX = 'cf['
const JQL_CUSTOM_FIELD_SUFFIX = ']'

// e.g. fieldNumber[Number]
const FIELD_WITH_TYPE_PATTERN = /^(.*[^\\])\[.+\]$/
const CUSTOM_FIELD_PREFIX = 'customfield_'

const log = logger(module)

type TokenPosition = {
  start: number
  end: number
}

type JqlToken = {
  reference: ReferenceExpression
  position: TokenPosition
}

type FieldInfo = {
  instance: InstanceElement
  position: TokenPosition
  identifier: 'id' | 'name'
}

export type JqlContext = {
  typeToInstancesByField: Record<string, Record<string, InstanceElement[]>>
  typeToInstanceById: Record<string, Record<string, InstanceElement>>
}

const CONTEXT_TYPE_TO_FIELD: Record<string, string> = {
  [FIELD_TYPE_NAME]: 'name',
  [PROJECT_TYPE]: 'key',
  [STATUS_TYPE_NAME]: 'name',
  [RESOLUTION_TYPE_NAME]: 'name',
  [PRIORITY_TYPE_NAME]: 'name',
  [ISSUE_TYPE_NAME]: 'name',
  [STATUS_CATEGORY_TYPE_NAME]: 'name',
}

export const removeCustomFieldPrefix = (id: string): string => (
  id.startsWith(CUSTOM_FIELD_PREFIX) ? id.slice(CUSTOM_FIELD_PREFIX.length) : id
)

export const generateJqlContext = (
  instances: InstanceElement[],
): JqlContext => ({
  typeToInstancesByField: _(instances)
    .filter(instance => instance.elemID.typeName in CONTEXT_TYPE_TO_FIELD)
    .groupBy(instance => instance.elemID.typeName)
    .mapValues(
      (instanceGroup, typeName) => {
        const fieldName = CONTEXT_TYPE_TO_FIELD[typeName]
        return _.groupBy(instanceGroup, instance => instance.value[fieldName].toLowerCase())
      }
    )
    .value(),

  typeToInstanceById: _(instances)
    .filter(instance => instance.elemID.typeName in CONTEXT_TYPE_TO_FIELD)
    .groupBy(instance => instance.elemID.typeName)
    .mapValues(
      instanceGroup =>
        _.keyBy(
          instanceGroup.filter(instance => instance.value.id !== undefined),
          instance => removeCustomFieldPrefix(instance.value.id.toString())
        )
    )
    .value(),
})

const getValueOperands = (operand: Operand): ValueOperand[] => {
  if (operand.operandType === 'value') {
    return [operand]
  }

  if (operand.operandType === 'list') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return operand.values.flatMap(getValueOperands)
  }

  // The other options are builtin jql functions and keyword
  // and we don't care about those
  return []
}

/**
 * This function is to get the real position of the `value`
 * since `position` is the position of the text
 * `text` is the string as it is written in the jql (with quotation marks and escaping characters)
 * and `value` is the real value cleaned of the syntax differences
 */
type JqlNode = {
  // The position of the `text`
  position: Position
  // The string as it is written in the jql (with quotation marks and escaping characters)
  text: string
  // The real value cleaned of the syntax differences
  value: string
}

const getValuePosition = (node: JqlNode)
  : TokenPosition | undefined => {
  const valueIndex = node.text.indexOf(node.value)
  // This might happen if node.text contains escaping characters.
  // We don't currently support that case but it is pretty rare to put characters
  // that require escaping the field names
  if (valueIndex === -1) {
    return undefined
  }
  const start = node.position[0] + valueIndex
  return {
    start,
    end: start + node.value.length,
  }
}

const getFieldInfo = (
  field: JqlField,
  jqlContext: JqlContext,
): {
  fieldInfo?: FieldInfo
  error?: 'ambiguous'
 } => {
  let fieldIdentifier = field.value.toLowerCase()

  const position = getValuePosition(field)

  if (position === undefined) {
    return { fieldInfo: undefined }
  }

  // Custom fields can be addressed in jql by id using `cf[...]` syntax, e.g., `cf[12345]`
  const customFieldMatch = CUSTOM_FIELD_PATTERN.exec(fieldIdentifier)
  if (customFieldMatch !== null) {
    // eslint-disable-next-line prefer-destructuring
    fieldIdentifier = customFieldMatch[1]
    position.start += JQL_CUSTOM_FIELD_PREFIX.length
    position.end -= JQL_CUSTOM_FIELD_SUFFIX.length
  }

  // Fields can be written with their type, e.g, `fieldName[number]`
  const fieldWithTypeMatch = FIELD_WITH_TYPE_PATTERN.exec(fieldIdentifier)
  if (fieldWithTypeMatch !== null) {
    // eslint-disable-next-line prefer-destructuring
    fieldIdentifier = fieldWithTypeMatch[1]
    position.end = position.start + fieldIdentifier.length
  }

  if (Object.prototype.hasOwnProperty.call(jqlContext.typeToInstanceById[FIELD_TYPE_NAME], fieldIdentifier)) {
    return {
      fieldInfo: {
        instance: jqlContext.typeToInstanceById[FIELD_TYPE_NAME][fieldIdentifier],
        position,
        identifier: 'id',
      },
    }
  }

  if (!Object.prototype.hasOwnProperty.call(
    jqlContext.typeToInstancesByField[FIELD_TYPE_NAME],
    fieldIdentifier
  )) {
    return { fieldInfo: undefined }
  }

  if (jqlContext.typeToInstancesByField[FIELD_TYPE_NAME][fieldIdentifier].length > 1) {
    return { fieldInfo: undefined, error: 'ambiguous' }
  }

  return {
    fieldInfo: {
      instance: jqlContext.typeToInstancesByField[FIELD_TYPE_NAME][fieldIdentifier][0],
      position,
      identifier: 'name',
    },
  }
}

const getValueInfo = (
  fieldToInstances: Record<string, InstanceElement[]>,
  idToInstance: Record<string, InstanceElement>,
  typeName: string,
  operand: ValueOperand
): undefined | {
  identifier: string
  instances: InstanceElement[]
} => {
  const valueIdentifier = operand.value.toLowerCase()

  if (Object.prototype.hasOwnProperty.call(idToInstance, valueIdentifier)) {
    return {
      identifier: 'id',
      instances: [idToInstance[valueIdentifier]],
    }
  }

  if (Object.prototype.hasOwnProperty.call(fieldToInstances, valueIdentifier)) {
    return {
      identifier: CONTEXT_TYPE_TO_FIELD[typeName],
      instances: fieldToInstances[valueIdentifier],
    }
  }

  return undefined
}

const getValueTokens = (
  clause: TerminalClause,
  jqlContext: JqlContext,
  fieldInstance: InstanceElement
): {
  tokens: JqlToken[]
  ambiguousTokens: Set<string>
 } => {
  const ambiguousTokens = new Set<string>()
  if (clause.operand === undefined) {
    return { tokens: [], ambiguousTokens }
  }

  // A heuristic that works for the types in CONTEXT_TYPE_TO_FIELD
  // to convert a field name to its values' type
  const typeName = fieldInstance.value.name.replace(/\s+/g, '')
  const fieldToInstances = Object.prototype.hasOwnProperty.call(
    jqlContext.typeToInstancesByField, typeName
  ) ? jqlContext.typeToInstancesByField[typeName]
    : {}

  const idToInstance = Object.prototype.hasOwnProperty.call(
    jqlContext.typeToInstanceById, typeName
  ) ? jqlContext.typeToInstanceById[typeName]
    : {}

  const tokens = getValueOperands(clause.operand)
    .map(operand => {
      const valueInfo = getValueInfo(fieldToInstances, idToInstance, typeName, operand)

      const position = getValuePosition(operand)
      if (valueInfo === undefined || position === undefined) {
        return undefined
      }

      if (valueInfo.instances.length > 1) {
        ambiguousTokens.add(operand.value)
        return undefined
      }

      return {
        reference: valueInfo.identifier !== 'id'
          ? new ReferenceExpression(
            valueInfo.instances[0].elemID.createNestedID(valueInfo.identifier),
            valueInfo.instances[0].value[valueInfo.identifier]
          )
          : new ReferenceExpression(
            valueInfo.instances[0].elemID,
            valueInfo.instances[0]
          ),
        position,
      }
    })
    .filter(values.isDefined)

  return {
    tokens,
    ambiguousTokens,
  }
}

const fieldInfoToJqlToken = (fieldInfo: FieldInfo): JqlToken => ({
  reference: fieldInfo.identifier === 'id'
    ? new ReferenceExpression(
      fieldInfo.instance.elemID,
      fieldInfo.instance,
    )
    : new ReferenceExpression(
      fieldInfo.instance.elemID.createNestedID(fieldInfo.identifier),
      fieldInfo.instance.value[fieldInfo.identifier],
    ),
  position: fieldInfo.position,
})

const createJqlTemplate = (jql: string, tokens: JqlToken[]): TemplateExpression => {
  const templateParts: Array<TemplatePart> = []
  const sortedTokens = _.sortBy(tokens, token => token.position.start)
  templateParts.push(jql.slice(0, sortedTokens[0].position.start))

  _.zip(tokens, tokens.slice(1)).forEach(([current, next]) => {
    if (current === undefined) {
      return
    }

    templateParts.push(current.reference)

    const start = current.position.end
    const end = next?.position.start ?? jql.length

    templateParts.push(jql.slice(start, end))
  })

  return createTemplateExpression({
    parts: templateParts.filter(part => !_.isEmpty(part)),
  })
}

export const generateTemplateExpression = (
  jql: string,
  jqlContext: JqlContext
): {
  template: TemplateExpression | undefined
  ambiguousTokens: Set<string>
} => {
  const parsedJql = new JastBuilder().build(jql)
  const jqlTokens: JqlToken[] = []

  const ambiguousTokens = new Set<string>()

  try {
    walkAST(
      {
        // A terminal clause is a clause of the form `<field> <operator> <value>`,
        // e.g., `status = Done`, as opposed to compound clause which is of the
        // form (<clause> AND/OR <anotherClaus>...)
        enterTerminalClause: clause => {
          const { fieldInfo, error } = getFieldInfo(clause.field, jqlContext)

          if (error === 'ambiguous') {
            ambiguousTokens.add(clause.field.value)
          }

          if (fieldInfo === undefined) {
            return
          }
          jqlTokens.push(fieldInfoToJqlToken(fieldInfo))

          const { tokens, ambiguousTokens: valueAmbiguousTokens } = getValueTokens(
            clause,
            jqlContext,
            fieldInfo.instance
          )

          tokens.forEach(token => jqlTokens.push(token))
          valueAmbiguousTokens.forEach(token => ambiguousTokens.add(token))
        },

        // For the order by part in the JQL, e.g. `ORDER BY field ASC`
        enterOrderByField: orderBy => {
          const { fieldInfo, error } = getFieldInfo(orderBy.field, jqlContext)

          if (error === 'ambiguous') {
            ambiguousTokens.add(orderBy.field.value)
          }

          if (fieldInfo === undefined) {
            return
          }
          jqlTokens.push(fieldInfoToJqlToken(fieldInfo))
        },
      },
      parsedJql
    )

    if (_.isEmpty(jqlTokens)) {
      return {
        template: undefined,
        ambiguousTokens,
      }
    }

    return {
      template: createJqlTemplate(jql, jqlTokens),
      ambiguousTokens,
    }
  } catch (e) {
    log.warn(`Failed parsing jql ${jql}: ${e}`)
    return {
      template: undefined,
      ambiguousTokens,
    }
  }
}
