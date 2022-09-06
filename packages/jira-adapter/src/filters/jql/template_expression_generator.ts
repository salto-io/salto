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
import { InstanceElement, ReferenceExpression, TemplateExpression, TemplatePart } from '@salto-io/adapter-api'
import _ from 'lodash'
import { walkAST, JastBuilder, Operand, ValueOperand, TerminalClause, Field as JqlField, Position } from '@atlassianlabs/jql-ast'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ISSUE_TYPE_NAME, PRIORITY_TYPE_NAME, PROJECT_TYPE, RESOLUTION_TYPE_NAME, STATUS_TYPE_NAME, STATUS_CATEGORY_TYPE_NAME } from '../../constants'
import { FIELD_TYPE_NAME } from '../fields/constants'

// e.g., cf[1234]
const CUSTOM_FIELD_PATTEN = /^cf\[(.*)\]$/
// e.g. fieldNumber[Number]
const FIELD_WITH_TYPE_PATTEN = /^(.*[^\\])\[.+\]$/
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
  typeToInstances: Record<string, Record<string, InstanceElement>>
  fieldsById: Record<string, InstanceElement>
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
  typeToInstances: _(instances)
    .filter(instance => instance.elemID.typeName in CONTEXT_TYPE_TO_FIELD)
    .groupBy(instance => instance.elemID.typeName)
    .mapValues(instanceGroup => Object.fromEntries(instanceGroup
      .map(instance => {
        const fieldName = CONTEXT_TYPE_TO_FIELD[instance.elemID.typeName]
        return [instance.value[fieldName].toLowerCase(), instance]
      })
      .filter(([key]) => _.isString(key))))
    .value(),

  fieldsById: _(instances)
    .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
    .filter(instance => _.isString(instance.value.id))
    .keyBy(instance => removeCustomFieldPrefix(instance.value.id))
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
  // `text` is the string as it is written in the jql (with quotation marks and escaping characters)
  text: string
  // `value` is the real value cleaned of the syntax differences
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
): FieldInfo | undefined => {
  let fieldIdentifier = field.value.toLowerCase()

  const position = getValuePosition(field)

  if (position === undefined) {
    return undefined
  }

  // Custom fields can be addressed in jql by id using `cf[...]` syntax, e.g., `cf[12345]`
  const customFieldMatch = CUSTOM_FIELD_PATTEN.exec(fieldIdentifier)
  if (customFieldMatch !== null) {
    // eslint-disable-next-line prefer-destructuring
    fieldIdentifier = customFieldMatch[1]
    position.start += 3
    position.end -= 1
  }

  // Fields can be written with therr type, e.g, `fieldName[number]`
  const fieldWithTypeMatch = FIELD_WITH_TYPE_PATTEN.exec(fieldIdentifier)
  if (fieldWithTypeMatch !== null) {
    // eslint-disable-next-line prefer-destructuring
    fieldIdentifier = fieldWithTypeMatch[1]
    position.end = position.start + fieldIdentifier.length
  }

  if (jqlContext.fieldsById[fieldIdentifier] !== undefined) {
    return {
      instance: jqlContext.fieldsById[fieldIdentifier],
      position,
      identifier: 'id',
    }
  }

  if (jqlContext.typeToInstances[FIELD_TYPE_NAME]?.[fieldIdentifier] !== undefined) {
    return {
      instance: jqlContext.typeToInstances[FIELD_TYPE_NAME][fieldIdentifier],
      position,
      identifier: 'name',
    }
  }

  return undefined
}

const getValueTokens = (
  clause: TerminalClause,
  jqlContext: JqlContext,
  fieldInstance: InstanceElement
): JqlToken[] => {
  if (clause.operand === undefined) {
    return []
  }

  // A heuristic that works for the types in CONTEXT_TYPE_TO_FIELD
  // to convert a field name to its values' type
  const typeName = fieldInstance.value.name.replace(/\s+/g, '')
  const identifierToInstance = jqlContext.typeToInstances[typeName]
  return getValueOperands(clause.operand)
    .map(operand => {
      const valueInstance = identifierToInstance?.[operand.value.toLowerCase()]

      const identifier = CONTEXT_TYPE_TO_FIELD[typeName]
      const position = getValuePosition(operand)
      if (valueInstance === undefined || identifier === undefined || position === undefined) {
        return undefined
      }
      return {
        reference: new ReferenceExpression(
          valueInstance.elemID.createNestedID(identifier),
          valueInstance.value[identifier]
        ),
        position,
      }
    })
    .filter(values.isDefined)
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

  return new TemplateExpression({
    parts: templateParts.filter(part => !_.isEmpty(part)),
  })
}

export const generateTemplateExpression = (
  jql: string,
  jqlContext: JqlContext
): TemplateExpression | undefined => {
  const parsedJql = new JastBuilder().build(jql)
  const jqlTokens: JqlToken[] = []

  try {
    walkAST(
      {
        // A terminal clause is a clause of the form `<field> <operator> <value>`,
        // e.g., `status = Done`, as opposed to compound clause with is of the
        // form (<clause> AND/OR <anotherClaus>...)
        enterTerminalClause: clause => {
          const fieldInfo = getFieldInfo(clause.field, jqlContext)

          if (fieldInfo === undefined) {
            return
          }
          jqlTokens.push(fieldInfoToJqlToken(fieldInfo))

          getValueTokens(clause, jqlContext, fieldInfo.instance)
            .forEach(token => jqlTokens.push(token))
        },

        // For the order by part in the JQL, e.g. `ORDER BY field ASC`
        enterOrderByField: orderBy => {
          const fieldInfo = getFieldInfo(orderBy.field, jqlContext)

          if (fieldInfo === undefined) {
            return
          }
          jqlTokens.push(fieldInfoToJqlToken(fieldInfo))
        },
      },
      parsedJql
    )

    if (_.isEmpty(jqlTokens)) {
      return undefined
    }

    return createJqlTemplate(jql, jqlTokens)
  } catch (e) {
    log.warn(`Failed parsing jql ${jql}: ${e}`)
    return undefined
  }
}
