import _ from 'lodash'
import {
  TypeElement, ElemID, ObjectType, PrimitiveType, PrimitiveTypes, Field, Values,
  Element, InstanceElement, SaltoError, TypeMap, INSTANCE_ANNOTATIONS,
} from 'adapter-api'
import { collections } from '@salto/lowerdash'
import {
  SourceRange as InternalSourceRange, SourceMap as SourceMapImpl,
  ParsedHclBlock, HclParseError,
} from './internal/types'
import { parse as hclParse } from './internal/parse'
import evaluate from './expressions'
import { Keywords } from './language'

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

const annotationTypes = (block: ParsedHclBlock): TypeMap => block.blocks
  .filter(b => b.type === Keywords.ANNOTATIONS_DEFINITION)
  .map(b => _(b.blocks)
    .map(blk => [blk.labels[0], new ObjectType({ elemID: parseElemID(blk.type) })])
    .fromPairs()
    .value())
  .pop() || {}

export type ParseResult = {
  elements: Element[]
  errors: ParseError[]
  sourceMap: SourceMap
}

/**
 * Parse a blueprint
 *
 * @param blueprint A buffer the contains the blueprint to parse
 * @param filename The name of the file from which the blueprint was read
 * @returns elements: Type elements found in the blueprint
 *          errors: Errors encountered during parsing
 */
export const parse = (blueprint: Buffer, filename: string): ParseResult => {
  const { body, errors: parseErrors } = hclParse(blueprint, filename)
  const sourceMap = new SourceMapImpl()

  const attrValues = (block: ParsedHclBlock, parentId: ElemID): Values => (
    _(block.attrs).mapValues((val, key) => {
      const exp = val.expressions[0]
      // Use attribute source as expression source so it includes the key as well
      return evaluate({ ...exp, source: val.source }, parentId.createNestedID(key), sourceMap)
    })
      .omitBy(_.isUndefined)
      .value()
  )

  const parseType = (typeBlock: ParsedHclBlock, isSettings = false): TypeElement => {
    const [typeName] = typeBlock.labels
    const typeObj = new ObjectType(
      {
        elemID: parseElemID(typeName),
        annotationTypes: annotationTypes(typeBlock),
        annotations: attrValues(typeBlock, parseElemID(typeName).createNestedID('attr')),
        isSettings,
      }
    )
    sourceMap.push(typeObj.elemID, typeBlock.source)

    const isFieldBlock = (block: ParsedHclBlock): boolean =>
      (block.type === Keywords.LIST_DEFINITION || block.labels.length === 1)

    // Parse type fields
    typeBlock.blocks
      .filter(isFieldBlock)
      .forEach(block => {
        const isList = block.type === Keywords.LIST_DEFINITION
        const fieldName = isList ? block.labels[1] : block.labels[0]
        const fieldTypeName = isList ? block.labels[0] : block.type
        const field = new Field(
          typeObj.elemID,
          fieldName,
          new ObjectType(
            {
              elemID: parseElemID(fieldTypeName),
              isSettings: block.type === Keywords.SETTINGS_DEFINITION,
            }
          ),
          attrValues(block, typeObj.elemID.createNestedID('field', fieldName)),
          isList,
        )
        sourceMap.push(field.elemID, block)
        typeObj.fields[fieldName] = field
      })

    // TODO: add error if there are any unparsed blocks

    return typeObj
  }

  const parsePrimitiveType = (typeBlock: ParsedHclBlock): TypeElement => {
    const [typeName, kw, baseType] = typeBlock.labels
    if (kw !== Keywords.TYPE_INHERITANCE_SEPARATOR) {
      throw new Error(`expected keyword ${Keywords.TYPE_INHERITANCE_SEPARATOR}. found ${kw}`)
    }

    if (baseType === Keywords.TYPE_OBJECT) {
      // There is currently no difference between an object type and a model
      return parseType(typeBlock)
    }

    const typeObj = new PrimitiveType({
      elemID: parseElemID(typeName),
      primitive: primitiveType(baseType),
      annotationTypes: annotationTypes(typeBlock),
      annotations: attrValues(typeBlock, parseElemID(typeName).createNestedID('attr')),
    })
    sourceMap.push(typeObj.elemID, typeBlock)
    return typeObj
  }

  const parseInstance = (instanceBlock: ParsedHclBlock): Element => {
    let typeID = parseElemID(instanceBlock.type)
    if (_.isEmpty(typeID.adapter) && typeID.name.length > 0) {
      // In this case if there is just a single name we have to assume it is actually the adapter
      typeID = new ElemID(typeID.name)
    }
    const name = instanceBlock.labels[0] || ElemID.CONFIG_NAME
    const attrs = attrValues(instanceBlock, typeID.createNestedID('instance', name))

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

  const elements = body.blocks.map((value: ParsedHclBlock): Element => {
    if (value.type === Keywords.TYPE_DEFINITION && value.labels.length > 1) {
      return parsePrimitiveType(value)
    }
    if (value.type === Keywords.TYPE_DEFINITION) {
      return parseType(value)
    }
    if (value.type === Keywords.SETTINGS_DEFINITION) {
      return parseType(value, true)
    }
    if (value.labels.length === 0 || value.labels.length === 1) {
      return parseInstance(value)
    }
    // Without this exception the linter won't allow us to end the function
    // without a return value
    throw new Error('unsupported block')
  })
  const errors: ParseError[] = parseErrors.map(err =>
  ({ ...err,
    ...{
      severity: 'Error',
      message: err.detail,
    } }) as ParseError)

  return { elements, errors, sourceMap }
}
