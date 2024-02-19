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
import { ElemID, Values, ReferenceMap, TypeReference } from '@salto-io/adapter-api'
import _ from 'lodash'
import { TOKEN_TYPES } from '../lexer'
import { ParseContext, ConsumerReturnType } from '../types'
import { positionAtEnd, registerRange, createFieldRefType, addValuePromiseWatcher, positionAtStart } from '../helpers'
import { consumeWords, consumeValue } from './values'
import {
  duplicatedAttribute,
  invalidAttrDefinitionInAnnotationBlock,
  multipleAnnotationBlocks,
  invalidNestedBlock,
  invalidFieldAnnotationBlock,
  multiplFieldDefinitions,
  invalidBlockItem,
} from '../errors'

export const isAttrDef = (defWords: string[], context: ParseContext): boolean =>
  context.lexer.peek()?.type === TOKEN_TYPES.EQUAL && defWords.length === 1

const isAnnotationBlockDef = (idPrefix: ElemID, defWords: string[], context: ParseContext): boolean =>
  context.lexer.peek()?.type === TOKEN_TYPES.OCURLY &&
  _.isEqual(defWords, ['annotations']) &&
  idPrefix.idType !== 'annotation'

const isFieldBlock = (defWords: string[], context: ParseContext): boolean =>
  context.lexer.peek()?.type === TOKEN_TYPES.OCURLY && defWords.length === 2

export const recoverInvalidItemDefinition = (context: ParseContext): void => {
  context.lexer.recover([TOKEN_TYPES.CCURLY, TOKEN_TYPES.EQUAL, TOKEN_TYPES.OCURLY, TOKEN_TYPES.NEWLINE])
  // If we recover to the equal value, we need to consume it and the value it holds...
  if (context.lexer.peek()?.type === TOKEN_TYPES.EQUAL) {
    // Pop the EQ token
    context.lexer.next()
    consumeValue(context)
  } else if (context.lexer.peek()?.type === TOKEN_TYPES.OCURLY) {
    consumeValue(context)
  } else if (context.lexer.peek(false)?.type === TOKEN_TYPES.NEWLINE) {
    context.lexer.next(false)
  }
  // No need to consume if this is a CCURLY as it will be handled by the caller
}

export const consumeBlockBody = (
  context: ParseContext,
  idPrefix: ElemID,
  isAnnotationBlock?: boolean,
): ConsumerReturnType<{
  attrs: Values
  fields: Record<string, { refType: TypeReference; annotations?: Values }>
  annotationRefTypes: ReferenceMap
}> => {
  const attrs: Values = {}
  const fields: Record<string, { refType: TypeReference; annotations?: Values }> = {}
  let annotationRefTypes: ReferenceMap | undefined
  const attrIDPrefix = idPrefix.idType === 'type' ? idPrefix.createNestedID('attr') : idPrefix
  const fieldIDPrefix = idPrefix.idType === 'type' ? idPrefix.createNestedID('field') : idPrefix
  // The position of the OCurly
  const start = positionAtStart(context.lexer.next())
  while (context.lexer.peek() && context.lexer.peek()?.type !== TOKEN_TYPES.CCURLY) {
    const defTokens = consumeWords(context)
    if (isAttrDef(defTokens.value, context)) {
      // Consume Attr!
      const key = defTokens.value[0]
      const attrID = attrIDPrefix.createNestedID(key)
      context.lexer.next() // Process the '=' token (which was checked in the if condition)
      const consumedValue = consumeValue(context, attrID)
      if (isAnnotationBlock && !_.isEmpty(consumedValue.value)) {
        context.errors.push(
          invalidAttrDefinitionInAnnotationBlock({
            start: defTokens.range.start,
            end: consumedValue.range.end,
            filename: context.filename,
          }),
        )
      }
      if (attrs[key] === undefined) {
        attrs[key] = consumedValue.value
      } else {
        context.errors.push(
          duplicatedAttribute(
            {
              start: defTokens.range.start,
              end: consumedValue.range.end,
              filename: context.filename,
            },
            key,
          ),
        )
      }
      addValuePromiseWatcher(context.valuePromiseWatchers, attrs, key)
      registerRange(context, attrID, { start: defTokens.range.start, end: consumedValue.range.end })
    } else if (isAnnotationBlockDef(idPrefix, defTokens.value, context)) {
      const annoBlockID = idPrefix.createNestedID('annotation')
      const consumedBlock = consumeBlockBody(context, annoBlockID, true)
      if (annotationRefTypes === undefined) {
        annotationRefTypes = _.mapValues(consumedBlock.value.fields, fieldData => fieldData.refType)
      } else {
        context.errors.push(
          multipleAnnotationBlocks({
            ...consumedBlock.range,
            filename: context.filename,
          }),
        )
      }
      registerRange(context, annoBlockID, {
        start: defTokens.range.start,
        end: consumedBlock.range.end,
      })
    } else if (isFieldBlock(defTokens.value, context)) {
      const [fieldType, fieldName] = defTokens.value
      const fieldID = fieldIDPrefix.createNestedID(fieldName)
      const consumedBlock = consumeBlockBody(context, fieldID, isAnnotationBlock)
      if (!_.isEmpty(consumedBlock.value.fields)) {
        context.errors.push(
          invalidNestedBlock({
            ...consumedBlock.range,
            filename: context.filename,
          }),
        )
      }
      if (!_.isEmpty(consumedBlock.value.annotationRefTypes)) {
        context.errors.push(
          invalidFieldAnnotationBlock({
            ...consumedBlock.range,
            filename: context.filename,
          }),
        )
      }
      if (!Object.prototype.hasOwnProperty.call(fields, fieldName)) {
        fields[fieldName] = {
          refType: createFieldRefType(context, fieldType, { ...defTokens.range, filename: context.filename }),
          annotations: consumedBlock.value.attrs,
        }
        registerRange(context, fieldID, {
          start: defTokens.range.start,
          end: consumedBlock.range.end,
        })
      } else {
        context.errors.push(
          multiplFieldDefinitions(
            {
              ...consumedBlock.range,
              filename: context.filename,
            },
            fieldName,
          ),
        )
      }
    } else {
      context.errors.push(invalidBlockItem({ ...defTokens.range, filename: context.filename }))
      recoverInvalidItemDefinition(context)
    }
  }

  const end = positionAtEnd(context.lexer.next())
  return {
    value: {
      attrs,
      fields,
      annotationRefTypes: annotationRefTypes ?? {},
    },
    range: { start, end },
  }
}
