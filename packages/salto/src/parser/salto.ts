import _ from 'lodash'
import {
  Type, ElemID, ObjectType, PrimitiveType, PrimitiveTypes, Field, Values,
  isObjectType, isPrimitiveType, Element, isInstanceElement, InstanceElement,
} from 'adapter-api'
import { collections } from '@salto/lowerdash'
import HCLParser, {
  SourceRange, HCLBlock, HCLAttribute, HclDumpReturn,
} from './hcl'
import evaluate from './expressions'

export type SourceMap = collections.map.DefaultMap<string, SourceRange[]>

interface SourcePos {
  line: number
  col: number
  byte: number
}

interface SourceRange {
  filename: string
  start: SourcePos
  end: SourcePos
}

enum Keywords {
  TYPE_DEFINITION = 'type',
  LIST_DEFINITION = 'list',
  TYPE_INHERITENCE_SEPARATOR = 'is',
  ANNOTATIONS_DEFINITION = 'annotations',

  // Primitive types
  TYPE_STRING = 'string',
  TYPE_NUMBER = 'number',
  TYPE_BOOL = 'boolean',
  TYPE_OBJECT = 'object',
}

const QUOTE_MARKER = 'Q_MARKER'

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

/**
 * @param primitiveType Primitive type identifier
 * @returns Type name in HCL syntax
 */
const getPrimitiveTypeName = (primitiveType: PrimitiveTypes): string => {
  if (primitiveType === PrimitiveTypes.STRING) {
    return Keywords.TYPE_STRING
  }
  if (primitiveType === PrimitiveTypes.NUMBER) {
    return Keywords.TYPE_NUMBER
  }
  if (primitiveType === PrimitiveTypes.BOOLEAN) {
    return Keywords.TYPE_BOOL
  }
  return Keywords.TYPE_OBJECT
}

const markQuote = (value: string): string => `${QUOTE_MARKER}${value}${QUOTE_MARKER}`

const markBlockQuotes = (block: HCLBlock): HCLBlock => {
  block.labels = block.labels.map(markQuote)
  block.blocks = block.blocks.map(markBlockQuotes)
  return block
}

const removeQuotes = (
  value: HclDumpReturn
): HclDumpReturn => value.replace(new RegExp(`"${QUOTE_MARKER}|${QUOTE_MARKER}"`, 'g'), '')

export default class Parser {
  private static getElemID(fullname: string): ElemID {
    const separatorIdx = fullname.indexOf(ElemID.NAMESPACE_SEPERATOR)
    const adapter = (separatorIdx >= 0) ? fullname.slice(0, separatorIdx) : ''
    const name = fullname.slice(separatorIdx + ElemID.NAMESPACE_SEPERATOR.length)
    return new ElemID(adapter, name)
  }

  private static addToSourceMap(
    sourceMap: SourceMap,
    id: ElemID,
    source: HCLBlock | HCLAttribute
  ): void {
    sourceMap.get(id.getFullName()).push(source.source as SourceRange)
  }

  private static getAttrValues(block: HCLBlock, sourceMap: SourceMap, parentId: ElemID): Values {
    return _.mapValues(block.attrs, (val, key) => {
      const attrId = new ElemID(parentId.adapter, ...parentId.nameParts, key)
      this.addToSourceMap(sourceMap, attrId, val)
      return evaluate(val.expressions[0])
    })
  }

  private static getAnnotations(block: HCLBlock): Record<string, Type> {
    return block.blocks
      .filter(b => b.type === Keywords.ANNOTATIONS_DEFINITION)
      .map(b => _(b.blocks)
        .map(blk => [blk.labels[0], new ObjectType({ elemID: this.getElemID(blk.type) })])
        .fromPairs()
        .value())
      .pop() || {}
  }

  private static parseType(typeBlock: HCLBlock, sourceMap: SourceMap): Type {
    const [typeName] = typeBlock.labels
    const typeObj = new ObjectType({ elemID: this.getElemID(typeName) })
    this.addToSourceMap(sourceMap, typeObj.elemID, typeBlock)

    typeObj.annotate(this.getAttrValues(typeBlock, sourceMap, typeObj.elemID))

    const isFieldBlock = (block: HCLBlock): boolean =>
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
          new ObjectType({ elemID: this.getElemID(fieldTypeName) }),
          this.getAttrValues(block, sourceMap, new ElemID(
            typeObj.elemID.adapter, ...typeObj.elemID.nameParts, fieldName,
          )),
          isList,
        )
        this.addToSourceMap(sourceMap, field.elemID, block)
        typeObj.fields[fieldName] = field
      })

    // TODO: add error if there are any unparsed blocks

    return typeObj
  }

  private static parsePrimitiveType(typeBlock: HCLBlock, sourceMap: SourceMap): Type {
    const [typeName, kw, baseType] = typeBlock.labels
    if (kw !== Keywords.TYPE_INHERITENCE_SEPARATOR) {
      throw new Error(`expected keyword ${Keywords.TYPE_INHERITENCE_SEPARATOR}. found ${kw}`)
    }

    if (baseType === Keywords.TYPE_OBJECT) {
      // There is currently no difference between an object type and a model
      return this.parseType(typeBlock, sourceMap)
    }

    const typeObj = new PrimitiveType({
      elemID: this.getElemID(typeName),
      primitive: getPrimitiveType(baseType),
      annotations: this.getAnnotations(typeBlock),
      annotationsValues: this.getAttrValues(typeBlock, sourceMap, this.getElemID(typeName)),
    })
    this.addToSourceMap(sourceMap, typeObj.elemID, typeBlock)
    return typeObj
  }

  private static parseInstance(instanceBlock: HCLBlock, sourceMap: SourceMap): Element {
    let typeID = this.getElemID(instanceBlock.type)
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
      this.getAttrValues(instanceBlock, sourceMap, new ElemID(typeID.adapter, name)),
    )
    this.addToSourceMap(sourceMap, inst.elemID, instanceBlock)
    return inst
  }

  /**
   * Parse a blueprint
   *
   * @param blueprint A buffer the contains the blueprint to parse
   * @param filename The name of the file from which the blueprint was read
   * @returns elements: Type elements found in the blueprint
   *          errors: Errors encountered during parsing
   */
  public static async parse(blueprint: Buffer, filename: string):
    Promise<{ elements: Element[]; errors: string[]; sourceMap: SourceMap }> {
    const { body, errors } = await HCLParser.parse(blueprint, filename)
    const sourceMap = new collections.map.DefaultMap<string, SourceRange[]>(() => [])
    const elements = body.blocks.map((value: HCLBlock): Element => {
      if (value.type === Keywords.TYPE_DEFINITION && value.labels.length > 1) {
        return this.parsePrimitiveType(value, sourceMap)
      }
      if (value.type === Keywords.TYPE_DEFINITION) {
        return this.parseType(value, sourceMap)
      }
      if (value.labels.length === 0 || value.labels.length === 1) {
        return this.parseInstance(value, sourceMap)
      }
      // Without this exception the linter won't allow us to end the function
      // without a return value
      throw new Error('unsupported block')
    })

    return { elements, errors, sourceMap }
  }

  private static getListFieldBlock(field: Field): HCLBlock {
    return {
      type: Keywords.LIST_DEFINITION,
      labels: [field.type.elemID.getFullName(), field.name],
      attrs: field.getAnnotationsValues() || {},
      blocks: [],
    }
  }

  private static getFieldBlock(field: Field): HCLBlock {
    return {
      type: field.type.elemID.getFullName(),
      labels: [field.name],
      attrs: field.getAnnotationsValues() || {},
      blocks: [],
    }
  }

  private static getAnnotationsBlock(element: PrimitiveType): HCLBlock {
    return {
      type: Keywords.ANNOTATIONS_DEFINITION,
      labels: [],
      attrs: {},
      blocks: Object.keys(element.annotations)
        .map(key => this.getFieldBlock(new Field(element.elemID, key, element.annotations[key]))),
    }
  }

  /**
   * Serialize elements to blueprint
   *
   * @param elements The elements to serialize
   * @returns A buffer with the elements serialized as a blueprint
   */
  public static async dump(elements: Element[]): Promise<string> {
    const blocks = elements.map(elem => {
      if (isObjectType(elem)) {
        // Clone the annotation values because we may delete some keys from there
        const annotationsValues = _.cloneDeep(elem.getAnnotationsValues())
        return {
          type: Keywords.TYPE_DEFINITION,
          labels: [elem.elemID.getFullName()],
          attrs: annotationsValues,
          blocks: Object.values(elem.fields).map(field => ((field.isList)
            ? this.getListFieldBlock(field)
            : this.getFieldBlock(field))),
        }
      }
      if (isPrimitiveType(elem)) {
        return {
          type: Keywords.TYPE_DEFINITION,
          labels: [
            elem.elemID.getFullName(),
            Keywords.TYPE_INHERITENCE_SEPARATOR,
            getPrimitiveTypeName(elem.primitive),
          ],
          attrs: elem.getAnnotationsValues(),
          blocks: Object.keys(elem.annotations).length > 0 ? [this.getAnnotationsBlock(elem)] : [],
        }
      }
      if (isInstanceElement(elem)) {
        const labels = elem.elemID.name === ElemID.CONFIG_INSTANCE_NAME
          ? []
          : [elem.elemID.name]

        return {
          type: elem.type.elemID.getFullName(),
          labels,
          attrs: elem.value,
          blocks: [],
        }
      }

      // Without this exception the linter won't allow us to end the function
      // without a return value
      throw new Error('unsupported type')
    })

    const body: HCLBlock = {
      type: '',
      labels: [],
      attrs: {},
      blocks: blocks.map(markBlockQuotes),
    }

    return removeQuotes(await HCLParser.dump(body))
  }
}
