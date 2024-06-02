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
import {
  Element,
  PrimitiveType,
  PrimitiveTypes,
  ObjectType,
  ElemID,
  InstanceElement,
  Variable,
  INSTANCE_ANNOTATIONS,
  TypeReference,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { Keywords } from '../../../language'
import { ParseContext, ConsumerReturnType } from '../types'
import { SourceRange } from '../../types'
import {
  unknownPrimitiveTypeError,
  invalidFieldsInPrimitiveType,
  invalidBlocksInInstance,
  invalidVarDefinition,
  missingLabelsError,
  missingBlockOpen,
  invalidDefinition,
} from '../errors'
import {
  primitiveType,
  registerRange,
  positionAtStart,
  positionAtEnd,
  parseTopLevelID,
  INVALID_ELEM_ID,
} from '../helpers'
import { consumeBlockBody, recoverInvalidItemDefinition, isAttrDef } from './blocks'
import { TOKEN_TYPES } from '../lexer'
import { consumeWords, consumeValue } from './values'

const INSTANCE_ANNOTATIONS_ATTRS: string[] = Object.values(INSTANCE_ANNOTATIONS)

const getElementIfValid = <T extends Element>(element: T, typeID?: ElemID): T | undefined =>
  (typeID ?? element.elemID).isEqual(INVALID_ELEM_ID) ? undefined : element

const consumeType = (
  context: ParseContext,
  labels: ConsumerReturnType<string[]>,
): ConsumerReturnType<PrimitiveType | ObjectType | undefined> => {
  // We know the labels are in one of the following formats:
  // * type <name>
  // * settings <name>
  // * type <name> is <type category>
  const isSettings = labels.value[0] === Keywords.SETTINGS_DEFINITION
  const typeName = labels.value[1]
  const baseType = labels.value[3] ?? Keywords.TYPE_OBJECT
  const range = { ...labels.range, filename: context.filename }

  const elemID = parseTopLevelID(context, typeName, range)
  const consumedBlock = consumeBlockBody(context, elemID)
  if (baseType === Keywords.TYPE_OBJECT) {
    return {
      value: getElementIfValid(
        new ObjectType({
          elemID,
          fields: consumedBlock.value.fields,
          annotationRefsOrTypes: consumedBlock.value.annotationRefTypes,
          annotations: consumedBlock.value.attrs,
          isSettings,
        }),
      ),
      range: consumedBlock.range,
    }
  }

  let primitive = primitiveType(baseType)

  // If the base type token can't be resolved to a specific primitive type, we will
  // just treat the type as unknown and add an error.
  // No need to recover since structure is unharmed.
  if (primitive === undefined) {
    context.errors.push(unknownPrimitiveTypeError(range, baseType))
    primitive = PrimitiveTypes.UNKNOWN
  }

  // You can't define fields on a primitive type. But no need to recover
  // we just ignore the fields.
  if (!_.isEmpty(consumedBlock.value.fields)) {
    context.errors.push(
      invalidFieldsInPrimitiveType({
        ...consumedBlock.range,
        filename: context.filename,
      }),
    )
  }
  return {
    value: getElementIfValid(
      new PrimitiveType({
        elemID,
        primitive,
        annotationRefsOrTypes: consumedBlock.value.annotationRefTypes,
        annotations: consumedBlock.value.attrs,
      }),
    ),
    range: consumedBlock.range,
  }
}

const consumeInstanceElement = (
  context: ParseContext,
  instanceType: string,
  range: SourceRange,
  instanceName: string = ElemID.CONFIG_NAME,
): ConsumerReturnType<InstanceElement | undefined> => {
  let typeID = parseTopLevelID(context, instanceType, range)
  if (_.isEmpty(typeID.adapter) && typeID.name.length > 0) {
    // In this case if there is just a single name we have to assume it is actually the adapter
    typeID = new ElemID(typeID.name)
  }
  const instance = new InstanceElement(instanceName, new TypeReference(typeID))
  const consumedBlockBody = consumeBlockBody(context, instance.elemID)

  // You can't define a block inside an instance. Blocks will be ignored.
  const { attrs, fields, annotationRefTypes } = consumedBlockBody.value
  if (!_.isEmpty(annotationRefTypes) || !_.isEmpty(fields)) {
    context.errors.push(invalidBlocksInInstance({ ...consumedBlockBody.range, filename: context.filename }))
  }

  // Using pick to get the instance annotations since they are defined as regular
  // attributes (see spec)
  const annotations = _.pick(attrs, INSTANCE_ANNOTATIONS_ATTRS)

  // Using unset instead of the more standard _.omit since we need to make sure
  // attrs is mutable in order for the valuePromiseReplacers to have an effect
  // (They will change the original. Invoking omit which will trigger a copy will
  // leave us with the promises.)
  INSTANCE_ANNOTATIONS_ATTRS.forEach(annoAttr => _.unset(attrs, annoAttr))
  instance.annotations = annotations
  instance.value = attrs
  return {
    value: getElementIfValid(instance, typeID),
    range: consumedBlockBody.range,
  }
}

export const consumeVariableBlock = (context: ParseContext): ConsumerReturnType<Variable[]> => {
  const variables: Variable[] = []
  // We only get here if the first token is var - so we can just process the token
  // and move forward...
  context.lexer.next()

  const nextToken = context.lexer.next()
  if (nextToken.type !== TOKEN_TYPES.OCURLY) {
    context.errors.push(
      missingBlockOpen({
        start: positionAtStart(nextToken),
        end: positionAtEnd(nextToken),
        filename: context.filename,
      }),
    )
  }
  const start = positionAtStart(nextToken)

  while (context.lexer.peek() && context.lexer.peek()?.type !== TOKEN_TYPES.CCURLY) {
    const defTokens = consumeWords(context)
    if (isAttrDef(defTokens.value, context)) {
      // We know that the next token is an equal mark, so we can consume it.
      context.lexer.next()
      const key = defTokens.value[0]
      const varID = new ElemID(ElemID.VARIABLES_NAMESPACE, key)
      const consumedValue = consumeValue(context)
      variables.push(new Variable(varID, consumedValue.value))
      registerRange(context, varID, { start: defTokens.range.start, end: consumedValue.range.end })
    } else {
      // If this is not an attribute token we need to recover out of it
      recoverInvalidItemDefinition(context)
      context.errors.push(invalidVarDefinition({ ...defTokens.range, filename: context.filename }))
    }
  }
  const end = positionAtEnd(context.lexer.next())
  return {
    value: variables,
    range: { start, end },
  }
}

// Type or settings.
// Settings can only have a name, types can also be of the form "type <name> is <meta type>".
const isTypeDef = (elementType: string, elementLabels: string[]): boolean =>
  (elementType === Keywords.SETTINGS_DEFINITION && elementLabels.length === 1) ||
  (elementType === Keywords.TYPE_DEFINITION && elementLabels.length === 1) ||
  (elementType === Keywords.TYPE_DEFINITION &&
    elementLabels.length === 3 &&
    elementLabels[1] === Keywords.TYPE_INHERITANCE_SEPARATOR)

// No labels is allowed to support config instances
const isInstanceTypeDef = (elementType: string, elementLabels: string[]): boolean =>
  elementType !== undefined && elementLabels.length <= 1

export const consumeElement = (context: ParseContext): ConsumerReturnType<Element | undefined> => {
  const consumedLabels = consumeWords(context)
  const nextToken = context.lexer.peek()
  if (nextToken && consumedLabels.value.length === 0) {
    context.errors.push(
      missingLabelsError(
        {
          start: positionAtStart(nextToken),
          end: positionAtEnd(nextToken),
          filename: context.filename,
        },
        nextToken?.value ?? 'EOF',
      ),
    )
  }

  if (nextToken?.type !== TOKEN_TYPES.OCURLY) {
    context.errors.push(
      missingBlockOpen({
        start: nextToken ? positionAtStart(nextToken) : consumedLabels.range.end,
        end: nextToken ? positionAtEnd(nextToken) : consumedLabels.range.end,
        filename: context.filename,
      }),
    )
  }
  const [elementType, ...elementLabels] = consumedLabels.value
  let consumedElement: ConsumerReturnType<Element | undefined>
  if (isTypeDef(elementType, elementLabels)) {
    consumedElement = consumeType(context, consumedLabels)
  } else if (isInstanceTypeDef(elementType, elementLabels)) {
    consumedElement = consumeInstanceElement(
      context,
      elementType,
      { ...consumedLabels.range, filename: context.filename },
      elementLabels[0],
    )
  } else {
    context.errors.push(
      invalidDefinition({ ...consumedLabels.range, filename: context.filename }, consumedLabels.value),
    )

    // When the definition is invalid we want to ignore the block, so we consume it in order
    // to continue on the next block.
    // If this is not a block (we expect it to be a block since we only support blocks
    // as top level element), the consumeBlockBody method will generate the proper errors.
    const blockToIgnore = consumeBlockBody(context, INVALID_ELEM_ID)
    const range = {
      start: consumedLabels.range.start,
      end: blockToIgnore.range.end,
    }
    consumedElement = {
      range,
      value: undefined,
    }
  }
  const range = { start: consumedLabels.range.start, end: consumedElement.range.end }
  if (consumedElement.value) {
    registerRange(context, consumedElement.value.elemID, range)
  }
  return {
    value: consumedElement.value,
    range,
  }
}
