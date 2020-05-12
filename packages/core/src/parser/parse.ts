/*
*                      Copyright 2020 Salto Labs Ltd.
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
  TypeElement, ElemID, ObjectType, PrimitiveType, PrimitiveTypes, Values,
  Element, InstanceElement, SaltoError, INSTANCE_ANNOTATIONS, ListType, Variable, Value,
} from '@salto-io/adapter-api'
import { collections, promises } from '@salto-io/lowerdash'
import { flattenElementStr } from '@salto-io/adapter-utils'
import {
  SourceRange as InternalSourceRange, SourceMap as SourceMapImpl,
  ParsedHclBlock, HclParseError, HclAttribute,
} from './internal/types'
import { parse as hclParse } from './internal/parse'
import evaluate from './expressions'
import { Keywords } from './language'
import {
  Functions,
} from './functions'

const { object: { mapValuesAsync } } = promises

const INSTANCE_ANNOTATIONS_ATTRS: string[] = Object.values(INSTANCE_ANNOTATIONS)

// Re-export these types because we do not want code outside the parser to import hcl
export type SourceRange = InternalSourceRange
export type ParseError = HclParseError & SaltoError

export type SourceMap = ReadonlyMap<string, SourceRange[]>

export const mergeSourceMaps = (sourceMaps: SourceMap[]): SourceMap => {
  const result = new collections.map.DefaultMap<string, SourceRange[]>(() => [])
  sourceMaps.forEach(sourceMap => {
    sourceMap.forEach((ranges, key) => {
      result.get(key).push(...ranges)
    })
  })
  return result
}

export const parseElemID = (fullname: string): ElemID => {
  const separatorIdx = fullname.indexOf(Keywords.NAMESPACE_SEPARATOR)
  const adapter = (separatorIdx >= 0) ? fullname.slice(0, separatorIdx) : ''
  const name = fullname.slice(separatorIdx + Keywords.NAMESPACE_SEPARATOR.length)
  return new ElemID(adapter, name)
}

/**
 * @param typeName Type name in HCL syntax
 * @returns Primitive type identifier
 */
const primitiveType = (typeName: string): PrimitiveTypes => {
  if (typeName === Keywords.TYPE_STRING) {
    return PrimitiveTypes.STRING
  }
  if (typeName === Keywords.TYPE_NUMBER) {
    return PrimitiveTypes.NUMBER
  }
  return PrimitiveTypes.BOOLEAN
}

export type ParseResult = {
  elements: Element[]
  errors: ParseError[]
  sourceMap: SourceMap
}

/**
 * Parse a Nacl file
 *
 * @param naclFile A buffer the contains the Nacl file to parse
 * @param filename The name of the file from which the Nacl file was read
 * @returns elements: Type elements found in the Nacl file
 *          errors: Errors encountered during parsing
 */
export const parse = async (
  naclFile: Buffer,
  filename: string,
  functions: Functions = {},
): Promise<ParseResult> => {
  const { body, errors: parseErrors } = hclParse(naclFile, filename)
  const sourceMap = new SourceMapImpl()
  const listElements: Map<string, ListType> = new Map<string, ListType>()

  const annotationTypes = (block: ParsedHclBlock, annotationTypesId: ElemID):
    Record <string, TypeElement> =>
    block.blocks
      .filter(b => b.type === Keywords.ANNOTATIONS_DEFINITION)
      .map(annoTypesBlk => {
        sourceMap.push(annotationTypesId, annoTypesBlk.source)
        return _(annoTypesBlk.blocks)
          .map(innerBlock => {
            sourceMap.push(annotationTypesId.createNestedID(innerBlock.labels[0]),
              innerBlock.source)
            return [innerBlock.labels[0], new ObjectType({ elemID: parseElemID(innerBlock.type) })]
          })
          .fromPairs()
          .value()
      }).pop() || {}

  const attrValue = (attr: HclAttribute, elemID: ElemID): Promise<Value> => {
    const exp = attr.expressions[0]
    // Use attribute source as expression source so it includes the key as well
    return evaluate(
      { ...exp, source: attr.source },
      functions,
      elemID,
      sourceMap,
    )
  }

  const attrValues = async (block: ParsedHclBlock, parentId: ElemID): Promise<Values> => {
    const attrs = await mapValuesAsync(
      block.attrs,
      (val, key) => attrValue(val, parentId.createNestedID(key)),
    )

    return _.omitBy(attrs, _.isUndefined)
  }

  const parseType = async (typeBlock: ParsedHclBlock, isSettings = false): Promise<TypeElement> => {
    const isFieldBlock = (block: ParsedHclBlock): boolean =>
      block.labels.length === 1

    const createFieldType = (blockType: string): TypeElement => {
      if (blockType.startsWith(Keywords.LIST_PREFIX)
        && blockType.endsWith(Keywords.GENERICS_SUFFIX)) {
        const listType = new ListType(createFieldType(
          blockType.substring(
            Keywords.LIST_PREFIX.length,
            blockType.length - Keywords.GENERICS_SUFFIX.length
          )
        ))
        listElements.set(listType.elemID.getFullName(), listType)
        return listType
      }
      return new ObjectType({ elemID: parseElemID(blockType) })
    }

    const [typeName] = typeBlock.labels
    const elemID = parseElemID(typeName)

    const fields = await Promise.all(typeBlock.blocks
      .filter(isFieldBlock)
      .map(async block => {
        const name = block.labels[0]
        const fieldId = elemID.createNestedID('field', name)
        const type = createFieldType(block.type)
        const annotations = await attrValues(block, fieldId)
        sourceMap.push(fieldId, block)
        return { name, type, annotations }
      }))

    // TODO: add error if there are any unparsed blocks

    const typeObj = new ObjectType(
      {
        elemID,
        fields,
        annotationTypes: annotationTypes(typeBlock, elemID.createNestedID('annotation')),
        annotations: await attrValues(typeBlock, elemID.createNestedID('attr')),
        isSettings,
      }
    )
    sourceMap.push(typeObj.elemID, typeBlock.source)

    return typeObj
  }

  const parsePrimitiveType = async (typeBlock: ParsedHclBlock): Promise<TypeElement> => {
    const [typeName, kw, baseType] = typeBlock.labels
    if (kw !== Keywords.TYPE_INHERITANCE_SEPARATOR) {
      throw new Error(`expected keyword ${Keywords.TYPE_INHERITANCE_SEPARATOR}. found ${kw}`)
    }

    if (baseType === Keywords.TYPE_OBJECT) {
      // There is currently no difference between an object type and a model
      return parseType(typeBlock)
    }

    const elemID = parseElemID(typeName)
    const typeObj = new PrimitiveType({
      elemID,
      primitive: primitiveType(baseType),
      annotationTypes: annotationTypes(typeBlock, elemID.createNestedID('annotation')),
      annotations: await attrValues(typeBlock, elemID.createNestedID('attr')),
    })
    sourceMap.push(typeObj.elemID, typeBlock)
    return typeObj
  }

  const parseInstance = async (instanceBlock: ParsedHclBlock): Promise<Element> => {
    let typeID = parseElemID(instanceBlock.type)
    if (_.isEmpty(typeID.adapter) && typeID.name.length > 0) {
      // In this case if there is just a single name we have to assume it is actually the adapter
      typeID = new ElemID(typeID.name)
    }
    const name = instanceBlock.labels[0] || ElemID.CONFIG_NAME
    const attrs = await attrValues(instanceBlock, typeID.createNestedID('instance', name))

    const inst = new InstanceElement(
      name,
      new ObjectType({
        elemID: typeID,
        isSettings: instanceBlock.labels.length === 0 && !typeID.isConfig(),
      }),
      _.omit(attrs, INSTANCE_ANNOTATIONS_ATTRS),
      undefined,
      _.pick(attrs, INSTANCE_ANNOTATIONS_ATTRS),
    )
    sourceMap.push(inst.elemID, instanceBlock)
    return inst
  }

  const parseVariable = async (name: string, varAttribute: HclAttribute): Promise<Element> => {
    const elemID = new ElemID(ElemID.VARIABLES_NAMESPACE, name)
    const value = await attrValue(varAttribute, elemID)
    const variable = new Variable(elemID, value)
    sourceMap.push(variable.elemID, varAttribute)
    return variable
  }

  const parseVariablesBlock = (variablesBlock: ParsedHclBlock): Promise<Element[]> =>
    Promise.all(_.values(
      _(variablesBlock.attrs).mapValues((v, k) => parseVariable(k, v)).value()
    ))

  const elements = _.flatten(
    await Promise.all(
      body.blocks.map((value: ParsedHclBlock): Promise<Element | Element[]> => {
        if (value.type === Keywords.TYPE_DEFINITION && value.labels.length > 1) {
          return parsePrimitiveType(value)
        }
        if (value.type === Keywords.TYPE_DEFINITION) {
          return parseType(value)
        }
        if (value.type === Keywords.SETTINGS_DEFINITION) {
          return parseType(value, true)
        }
        if (value.type === Keywords.VARIABLES_DEFINITION) {
          return Promise.resolve(parseVariablesBlock(value))
        }
        if (value.labels.length === 0 || value.labels.length === 1) {
          return parseInstance(value)
        }
        // Without this exception the linter won't allow us to end the function
        // without a return value
        throw new Error('unsupported block')
      })
    )
  )
  const errors: ParseError[] = parseErrors.map(err =>
  ({ ...err,
    ...{
      severity: 'Error',
      message: err.detail,
    } }) as ParseError)
  return {
    elements: _.concat(elements, [...listElements.values()]).map(flattenElementStr),
    errors,
    sourceMap,
  }
}
