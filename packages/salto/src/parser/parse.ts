import _ from 'lodash'
import {
  Type, ElemID, ObjectType, PrimitiveType, PrimitiveTypes, Field, Values,
  Element, InstanceElement,
} from 'adapter-api'
import { SourceRange, SourceMap as SourceMapImpl } from './parser_internal_types'
import HCLParser, { ParsedHCLBlock, HclParseError } from './hcl'
import evaluate from './expressions'

// Re-export these types because we do not want code outside the parser to import hcl
export type SourceRange = SourceRange
export type SourceMap = Map<string, SourceRange[]>
export type ParseError = HclParseError

enum Keywords {
  TYPE_DEFINITION = 'type',
  SETTINGS_DEFINITION = 'settings',
  LIST_DEFINITION = 'list',
  TYPE_INHERITANCE_SEPARATOR = 'is',
  ANNOTATIONS_DEFINITION = 'annotations',

  // Primitive types
  TYPE_STRING = 'string',
  TYPE_NUMBER = 'number',
  TYPE_BOOL = 'boolean',
  TYPE_OBJECT = 'object',
}

const getElemID = (fullname: string): ElemID => {
  const separatorIdx = fullname.indexOf(ElemID.NAMESPACE_SEPERATOR)
  const adapter = (separatorIdx >= 0) ? fullname.slice(0, separatorIdx) : ''
  const name = fullname.slice(separatorIdx + ElemID.NAMESPACE_SEPERATOR.length)
  return new ElemID(adapter, name)
}

/**
 * @param typeName Type name in HCL syntax
 * @returns Primitive type identifier
 */
const getPrimitiveType = (typeName: string): PrimitiveTypes => {
  if (typeName === Keywords.TYPE_STRING) {
    return PrimitiveTypes.STRING
  }
  if (typeName === Keywords.TYPE_NUMBER) {
    return PrimitiveTypes.NUMBER
  }
  return PrimitiveTypes.BOOLEAN
}

const getAnnotationTypes = (block: ParsedHCLBlock): Record <string, Type> => block.blocks
  .filter(b => b.type === Keywords.ANNOTATIONS_DEFINITION)
  .map(b => _(b.blocks)
    .map(blk => [blk.labels[0], new ObjectType({ elemID: getElemID(blk.type) })])
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
export const parse = async (blueprint: Buffer, filename: string): Promise<ParseResult> => {
  const { body, errors } = await HCLParser.parse(blueprint, filename)
  const sourceMap = new SourceMapImpl()

  const getAttrValues = (block: ParsedHCLBlock, parentId: ElemID): Values => _.mapValues(
    block.attrs,
    /* eslint-disable-next-line @typescript-eslint/no-use-before-define */
    (val, key) => evaluate(val.expressions[0], parentId.createNestedID(key), sourceMap)
  )

  const parseType = (typeBlock: ParsedHCLBlock, isSettings = false): Type => {
    const [typeName] = typeBlock.labels
    const typeObj = new ObjectType(
      {
        elemID: getElemID(typeName),
        isSettings,
      }
    )
    sourceMap.push(typeObj.elemID, typeBlock.source)

    typeObj.annotate(getAttrValues(typeBlock, typeObj.elemID))

    const isFieldBlock = (block: ParsedHCLBlock): boolean =>
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
              elemID: getElemID(fieldTypeName),
              isSettings: block.type === Keywords.SETTINGS_DEFINITION,
            }
          ),
          getAttrValues(block, typeObj.elemID.createNestedID(fieldName)),
          isList,
        )
        sourceMap.push(field.elemID, block)
        typeObj.fields[fieldName] = field
      })

    // TODO: add error if there are any unparsed blocks

    return typeObj
  }

  const parsePrimitiveType = (typeBlock: ParsedHCLBlock): Type => {
    const [typeName, kw, baseType] = typeBlock.labels
    if (kw !== Keywords.TYPE_INHERITANCE_SEPARATOR) {
      throw new Error(`expected keyword ${Keywords.TYPE_INHERITANCE_SEPARATOR}. found ${kw}`)
    }

    if (baseType === Keywords.TYPE_OBJECT) {
      // There is currently no difference between an object type and a model
      return parseType(typeBlock)
    }

    const typeObj = new PrimitiveType({
      elemID: getElemID(typeName),
      primitive: getPrimitiveType(baseType),
      annotationTypes: getAnnotationTypes(typeBlock),
      annotations: getAttrValues(typeBlock, getElemID(typeName)),
    })
    sourceMap.push(typeObj.elemID, typeBlock)
    return typeObj
  }

  const parseInstance = (instanceBlock: ParsedHCLBlock): Element => {
    let typeID = getElemID(instanceBlock.type)
    if (_.isEmpty(typeID.adapter) && typeID.name.length > 0) {
      // In this case if there is just a single name we have to assume it is actually the adapter
      typeID = new ElemID(typeID.name)
    }
    const name = instanceBlock.labels.length === 0
      ? ElemID.CONFIG_INSTANCE_NAME
      : instanceBlock.labels[0]

    const inst = new InstanceElement(
      new ElemID(typeID.adapter, name),
      new ObjectType({ elemID: typeID }),
      getAttrValues(instanceBlock, new ElemID(typeID.adapter, name)),
    )
    sourceMap.push(inst.elemID, instanceBlock)
    return inst
  }

  const elements = body.blocks.map((value: ParsedHCLBlock): Element => {
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

  return { elements, errors, sourceMap }
}
