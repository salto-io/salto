import * as _ from 'lodash'

import {
  Type, ElemID, ObjectType, PrimitiveType, PrimitiveTypes, Field,
  isObjectType, isPrimitiveType, Element, isInstanceElement, InstanceElement,
} from 'adapter-api'
import HCLParser from './hcl'

enum Keywords {
  MODEL = 'model',
  TYPE_DEFINITION = 'type',
  LIST_DEFINITION = 'list',
  TYPE_INHERITENCE_SEPARATOR = 'is',

  // Primitive types
  TYPE_STRING = 'string',
  TYPE_NUMBER = 'number',
  TYPE_BOOL = 'boolean',
  TYPE_OBJECT = 'object',
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

export default class Parser {
  private static getElemID(fullname: string): ElemID {
    const separatorIdx = fullname.indexOf(ElemID.NAMESPACE_SEPERATOR)
    const adapter = (separatorIdx >= 0) ? fullname.slice(0, separatorIdx) : ''
    const name = fullname.slice(separatorIdx + ElemID.NAMESPACE_SEPERATOR.length)
    return new ElemID(adapter, name)
  }

  private static parseType(typeBlock: HCLBlock): Type {
    const [typeName] = typeBlock.labels
    const typeObj = new ObjectType({ elemID: this.getElemID(typeName) })

    typeObj.annotate(typeBlock.attrs)

    typeBlock.blocks.forEach(block => {
      if (block.type === Keywords.LIST_DEFINITION) {
        // List Field block
        const fieldName = block.labels[1]
        const listElementType = block.labels[0]
        typeObj.fields[fieldName] = new Field(
          typeObj.elemID,
          fieldName,
          new ObjectType({ elemID: this.getElemID(listElementType) }),
          block.attrs,
          true
        )
      } else if (block.labels.length === 1) {
        // Field block
        const fieldName = block.labels[0]
        typeObj.fields[fieldName] = new Field(
          typeObj.elemID,
          fieldName,
          new ObjectType({ elemID: this.getElemID(block.type) }),
          block.attrs,
        )
      } else {
        // This is something else, lets assume it is field overrides for now and we can extend
        // this later as we support more parts of the language
        typeObj.annotationsValues[block.type] = block.attrs
      }
    })

    return typeObj
  }

  private static parsePrimitiveType(typeBlock: HCLBlock): Type {
    const [typeName, kw, baseType] = typeBlock.labels
    if (kw !== Keywords.TYPE_INHERITENCE_SEPARATOR) {
      throw new Error(`expected keyword ${Keywords.TYPE_INHERITENCE_SEPARATOR}. found ${kw}`)
    }

    if (baseType === Keywords.TYPE_OBJECT) {
      // There is currently no difference between an object type and a model
      return this.parseType(typeBlock)
    }
    return new PrimitiveType({
      elemID: this.getElemID(typeName),
      primitive: getPrimitiveType(baseType),
      annotationsValues: typeBlock.attrs,
    })
  }

  private static parseInstance(instanceBlock: HCLBlock): Element {
    let typeID = this.getElemID(instanceBlock.type)
    if (_.isEmpty(typeID.adapter) && typeID.name.length > 0) {
      // In this case if there is just a single name we have to assume it is actually the adapter
      typeID = new ElemID(typeID.name)
    }
    const name = instanceBlock.labels.length === 0
      ? ElemID.CONFIG_INSTANCE_NAME
      : instanceBlock.labels[0]

    return new InstanceElement(
      new ElemID(typeID.adapter, name),
      new ObjectType({ elemID: typeID }),
      instanceBlock.attrs,
    )
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
    Promise<{ elements: Element[]; errors: string[] }> {
    const { body, errors } = await HCLParser.parse(blueprint, filename)

    const elements = body.blocks.map((value: HCLBlock): Element => {
      if (value.type === Keywords.MODEL) {
        return this.parseType(value)
        // TODO: we probably need to mark that elem is a model type so the adapter
        // will know it should create a new table for it
      }
      if (value.type === Keywords.TYPE_DEFINITION) {
        return this.parsePrimitiveType(value)
      }
      if (value.labels.length === 0 || value.labels.length === 1) {
        return this.parseInstance(value)
      }
      // Without this exception the linter won't allow us to end the function
      // without a return value
      throw new Error('unsupported block')
    })

    return { elements, errors }
  }

  private static getListFieldBlock(field: Field): HCLBlock {
    const fieldBlock: HCLBlock = {
      type: Keywords.LIST_DEFINITION,
      labels: [field.type.elemID.getFullName(), field.name],
      attrs: field.annotationsValues || {},
      blocks: [],
    }
    return fieldBlock
  }

  private static getFieldBlock(field: Field): HCLBlock {
    const fieldBlock: HCLBlock = {
      type: field.type.elemID.getFullName(),
      labels: [field.name],
      attrs: field.annotationsValues || {},
      blocks: [],
    }
    return fieldBlock
  }

  /**
   * Serialize elements to blueprint
   *
   * @param elements The elements to serialize
   * @returns A buffer with the elements serialized as a blueprint
   */
  public static dump(elements: Element[]): Promise<Buffer> {
    const blocks = elements.map(elem => {
      if (isObjectType(elem)) {
        // Clone the annotation values because we may delete some keys from there
        const annotationsValues = _.cloneDeep(elem.annotationsValues)
        return {
          type: Keywords.MODEL,
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
          attrs: elem.annotationsValues,
          blocks: [],
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
      blocks,
    }

    return HCLParser.dump(body)
  }
}
