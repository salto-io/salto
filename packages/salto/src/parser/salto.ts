import HCLParser from './hcl'
import {
  TypesRegistry, Type, TypeID, ObjectType, PrimitiveType, PrimitiveTypes,
} from '../core/elements'

enum Keywords {
  MODEL = 'model',
  TYPE_DEFINITION = 'type',
  TYPE_INHERITENCE_SEPARATOR = 'is',
}

// Assume all primitives are strings for now
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getPrimitiveType = (_typeName: string): PrimitiveTypes => PrimitiveTypes.STRING

export default class Parser {
  static getTypeID(fullname: string): TypeID {
    const separatorIdx = fullname.indexOf(TypeID.NAMESPACE_SEPERATOR)
    const adapter = fullname.slice(0, separatorIdx)
    const name = fullname.slice(separatorIdx + TypeID.NAMESPACE_SEPERATOR.length)
    return new TypeID({ adapter, name })
  }

  types: TypesRegistry

  constructor(types: TypesRegistry) {
    this.types = new TypesRegistry()
    this.types = this.types.merge(types)
  }

  parseType(typeBlock: HCLBlock): Type {
    const [typeName] = typeBlock.labels
    const typeObj = this.types.getType(Parser.getTypeID(typeName)) as ObjectType

    Object.entries(typeBlock.attrs).forEach(([attrName, attrValue]) => {
      typeObj.annotationsValues[attrName] = attrValue
    })

    typeBlock.blocks.forEach(block => {
      if (block.labels.length === 1) {
        // Field block
        const fieldName = block.labels[0]
        typeObj.fields[fieldName] = this.types.getType(Parser.getTypeID(block.type))
        typeObj.annotationsValues[fieldName] = block.attrs
      } else {
        // This is something else, lets assume it is field overrides for now and we can extend
        // this later as we support more parts of the language
        typeObj.annotationsValues[block.type] = block.attrs
      }
    })

    return typeObj
  }

  parsePrimitiveType(typeBlock: HCLBlock): PrimitiveType {
    const [typeName, kw, baseType] = typeBlock.labels
    if (kw !== Keywords.TYPE_INHERITENCE_SEPARATOR) {
      throw new Error(`expected keyword ${Keywords.TYPE_INHERITENCE_SEPARATOR}. found ${kw}`)
    }
    const typeObj = this.types.getType(
      Parser.getTypeID(typeName), getPrimitiveType(baseType),
    ) as PrimitiveType
    typeObj.annotationsValues = typeBlock.attrs
    return typeObj
  }

  async parse(blueprint: Buffer, filename: string):
    Promise<{ elements: Type[]; errors: string[] }> {
    const { body, errors } = await HCLParser.parse(blueprint, filename)

    body.blocks.forEach((value: HCLBlock): Type => {
      let elem: Type
      if (value.type === Keywords.MODEL) {
        elem = this.parseType(value)
        // TODO: we probably need to mark that elem is a model type so the adapter
        // will know it should create a new table for it
      } else if (value.type === Keywords.TYPE_DEFINITION) {
        elem = this.parsePrimitiveType(value)
      } else {
        // Without this exception the linter won't allow us to return elem
        // since it might be uninitialized
        throw new Error('unsupported block')
      }
      return elem
    })

    return { elements: this.types.getAllTypes(), errors }
  }
}
