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
  invalidPrimitiveTypeDef,
  unknownPrimitiveTypeError,
  invalidFieldsInPrimitiveType,
  invalidBlocksInInstance,
  invalidVarDefinition,
  missingLabelsError,
  missingBlockOpen,
  ambiguousBlock,
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

const consumePrimitive = (
  context: ParseContext,
  labels: ConsumerReturnType<string[]>,
): ConsumerReturnType<PrimitiveType | undefined> => {
  // Note - this method is called *only* if labels has 4 tokens (the first of which
  // is 'type' which we can ignore
  const [typeName, kw, baseType] = labels.value.slice(1)
  const elemID = parseTopLevelID(context, typeName, { ...labels.range, filename: context.filename })

  // We create an error if some other token is used instead of the 'is' keyword.
  // We don't need to recover. We'll just pretend the wrong word is 'is' (hihi)
  // and parse as usual.
  if (kw !== Keywords.TYPE_INHERITANCE_SEPARATOR) {
    context.errors.push(
      invalidPrimitiveTypeDef(
        {
          ...labels.range,
          filename: context.filename,
        },
        kw,
      ),
    )
  }

  let primitive = primitiveType(baseType)

  // If the base type token can not be resolved to a specific primitive type, we will
  // just treat the type as unknown and add an error. Again - no need to recover since
  // structre is unharmed.
  if (primitive === undefined) {
    context.errors.push(
      unknownPrimitiveTypeError(
        {
          ...labels.range,
          filename: context.filename,
        },
        baseType,
      ),
    )
    primitive = PrimitiveTypes.UNKNOWN
  }

  const consumedBlock = consumeBlockBody(context, elemID)

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

const consumeObjectType = (
  context: ParseContext,
  typeName: string,
  range: SourceRange,
  isSettings: boolean,
): ConsumerReturnType<ObjectType | undefined> => {
  const elemID = parseTopLevelID(context, typeName, range)
  const consumedBlock = consumeBlockBody(context, elemID)
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

// We consider a block def with 2 labels to be a primitive type def with the 'is'
// keyword missing, since in all other block types there is only 1 legal label.
// the primitive type consumer handles the missing 'is'.
const isPrimitiveTypeDef = (elementType: string, elementLabels: string[]): boolean =>
  elementType === Keywords.TYPE_DEFINITION && elementLabels.length >= 2 && elementLabels.length < 4

const isObjectTypeDef = (elementType: string, elementLabels: string[], isSettings: boolean): boolean =>
  (elementType === Keywords.TYPE_DEFINITION || isSettings) && elementLabels.length === 1

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
  const isSettings = elementType === Keywords.SETTINGS_DEFINITION
  // Primitive type def actually needs 3 labels, but we assume that 2 labels
  // is a primitive type def with no inheritance operator
  if (isPrimitiveTypeDef(elementType, elementLabels)) {
    consumedElement = consumePrimitive(context, consumedLabels)
  } else if (isObjectTypeDef(elementType, elementLabels, isSettings)) {
    consumedElement = consumeObjectType(
      context,
      elementLabels[0],
      { ...consumedLabels.range, filename: context.filename },
      isSettings,
    )
  } else if (isInstanceTypeDef(elementType, elementLabels)) {
    consumedElement = consumeInstanceElement(
      context,
      elementType,
      { ...consumedLabels.range, filename: context.filename },
      elementLabels[0],
    )
  } else {
    // If we don't know which type of block is defined here, we need to ignore
    // the block. So we consume it in order to continue on the next block. If
    // this is not a block (we expect it to be a block since we only support blocks
    // as top level element), the consumeBlockBody method will generate the proper errors
    const blockToIgnore = consumeBlockBody(context, INVALID_ELEM_ID)
    const range = {
      start: consumedLabels.range.start,
      end: blockToIgnore.range.end,
    }
    context.errors.push(ambiguousBlock({ ...range, filename: context.filename }))
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
