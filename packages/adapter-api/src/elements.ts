import * as _ from 'lodash'

/**
 * Defines the list of supported types.
 */
export enum PrimitiveTypes {
  STRING,
  NUMBER,
  BOOLEAN,
  OBJECT,
  LIST,
}

export interface Values {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  [key: string]: any
}
type TypeMap = Record<string, Type>

interface TypeIDArgs {
  adapter?: string
  name?: string
}


export class TypeID {
  static readonly NAMESPACE_SEPERATOR = '_'

  name?: string
  adapter?: string
  constructor(args: TypeIDArgs) {
    this.name = args.name
    this.adapter = args.adapter
  }

  getFullName(): string {
    return [this.adapter, this.name]
      .filter(part => !_.isEmpty(part))
      .join(TypeID.NAMESPACE_SEPERATOR)
  }
}

export interface Element {
  typeID: TypeID
}

type ElementMap = Record<string, Element>

/**
 * An abstract class that represent the base type.
 * Contains the base function and fields.
 * Each subclass needs to implement the clone function as it is members
 * dependent.
 */
export abstract class Type implements Element {
  public static DEFAULT = '_default'
  public static REQUIRED = 'required'


  readonly typeID: TypeID
  annotations: TypeMap
  annotationsValues: Values
  constructor({
    annotations,
    annotationsValues,
    typeID,
  }: {
    typeID: TypeID
    annotations: TypeMap
    annotationsValues: Values
  }) {
    this.annotations = annotations
    this.annotationsValues = annotationsValues
    this.typeID = typeID
    // Prevents reregistration of clones, we only want to register
    // first creation
  }

  /**
   * Return a deep copy of the instance annotations by recursivally
   * cloning all annotations (by invoking their clone method)
   */
  protected cloneAnnotations(): TypeMap {
    const clonedAnnotations: TypeMap = {}
    Object.keys(this.annotations).forEach(key => {
      clonedAnnotations[key] = this.annotations[key].clone()
    })
    return clonedAnnotations
  }

  /**
   * Return a deep copy of the instance annotations values.
   */
  protected cloneAnnotationsValues(): Values {
    return _.cloneDeep(this.annotationsValues)
  }

  annotate(annotationsValues: Values): void {
    // Should we overide? I'm adding right now as it seems more
    // usefull. (Roi R)
    Object.keys(annotationsValues).forEach(key => {
      this.annotationsValues[key] = annotationsValues[key]
    })
  }

  /**
   * Return an independent copy of this instance. Needs to be implemented
   * by each subclass as this is structure dependent.
   * @return {Type} the cloned instance
   */
  abstract clone(annotationsValues?: Values): Type
}

/**
 * Defines a type that represents a primitive value (This comment WAS NOT auto generated)
 */
export class PrimitiveType extends Type {
  primitive: PrimitiveTypes
  constructor({
    typeID,
    primitive,
    annotations = {},
    annotationsValues = {},
  }: {
    typeID: TypeID
    primitive: PrimitiveTypes
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ typeID, annotations, annotationsValues })
    this.primitive = primitive
  }

  /**
   * Return an independent copy of this instance.
   * @return {PrimitiveType} the cloned instance
   */
  clone(additionalAnnotationsValues: Values = {}): PrimitiveType {
    const res: PrimitiveType = new PrimitiveType({
      typeID: this.typeID,
      primitive: this.primitive,
      annotations: this.cloneAnnotations(),
      annotationsValues: this.cloneAnnotationsValues(),
    })
    res.annotate(additionalAnnotationsValues)
    return res
  }
}

/**
 * Defines a type that represents an object (Also NOT auto generated)
 */
export class ObjectType extends Type {
  fields: TypeMap

  constructor({
    typeID,
    fields = {},
    annotations = {},
    annotationsValues = {},
  }: {
    typeID: TypeID
    fields?: TypeMap
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ typeID, annotations, annotationsValues })
    this.fields = fields
  }

  private cloneFields(): TypeMap {
    const clonedFields: TypeMap = {}
    Object.keys(this.fields).forEach(key => {
      clonedFields[key] = this.fields[key].clone()
    })
    return clonedFields
  }

  /**
   * Return an independent copy of this instance.
   * @return {ObjectType} the cloned instance
   */
  clone(additionalAnnotationsValues: Values = {}): ObjectType {
    const clonedAnnotations = this.cloneAnnotations()
    const clonedAnnotationValues = this.cloneAnnotationsValues()
    const clonedFields = this.cloneFields()

    const res: ObjectType = new ObjectType({
      typeID: this.typeID,
      fields: clonedFields,
      annotations: clonedAnnotations,
      annotationsValues: clonedAnnotationValues,
    })

    res.annotate(additionalAnnotationsValues)

    return res
  }

  getFieldsThatAreNotInOther(other: ObjectType): string[] {
    return Object.keys(this.fields).filter(
      field => !Object.keys(other.fields).includes(field),
    )
  }
}

/**
 * Defines a type that represents an array (OK I DID copy paste from prev comments.)
 */
export class ListType extends Type {
  elementType?: Type
  constructor({
    typeID,
    elementType,
    annotations = {},
    annotationsValues = {},
  }: {
    typeID: TypeID
    elementType?: Type
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ typeID, annotations, annotationsValues })
    this.elementType = elementType
  }

  /**
   * Return an independent copy of this instance.
   * @return {ListType} the cloned instance
   */
  clone(additionalAnnotationsValues: Values = {}): ListType {
    const clonedElementType = this.elementType
      ? this.elementType.clone()
      : undefined
    const clonedAnnotations = this.cloneAnnotations()
    const clonedAnnotationValues = this.cloneAnnotationsValues()

    const res: ListType = new ListType({
      typeID: this.typeID,
      elementType: clonedElementType,
      annotations: clonedAnnotations,
      annotationsValues: clonedAnnotationValues,
    })

    res.annotate(additionalAnnotationsValues)
    return res
  }
}

export class InstanceElement implements Element {
  typeID: TypeID
  type: Type
  value: Values
  constructor(typeID: TypeID, type: Type, value: Values) {
    this.typeID = typeID
    this.type = type
    this.value = value
  }
}

export class ElementsRegistry {
  registeredElements: ElementMap
  constructor(initElements: Element[] = []) {
    this.registeredElements = {}
    initElements.forEach(type => this.registerElement(type))
  }

  registerElement(elementToRegister: Element): void {
    const key = elementToRegister.typeID.getFullName()
    const existingElement = this.registeredElements[key]
    if (existingElement) {
      throw new Error('Type extension is not supported for now')
    }
    this.registeredElements[key] = elementToRegister
  }

  hasElement(typeID: TypeID): boolean {
    const fullName = typeID.getFullName()
    return Object.prototype.hasOwnProperty.call(this.registeredElements, fullName)
  }

  getAllElements(): Element[] {
    return Object.values(this.registeredElements)
  }

  getElement(
    typeID: TypeID,
    type: PrimitiveTypes|Type = PrimitiveTypes.OBJECT,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ): any {
    // Using any here is ugly, but I can't find a better comiling solution. TODO - fix this
    const key = typeID.getFullName()
    let res: Element = this.registeredElements[key]
    if (!res) {
      if (type === PrimitiveTypes.OBJECT) {
        res = new ObjectType({ typeID })
      } else
      if (type === PrimitiveTypes.LIST) {
        res = new ListType({ typeID })
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      } else if (type as any in PrimitiveTypes) {
        res = new PrimitiveType({ typeID, primitive: type as PrimitiveTypes })
      } else {
        res = new InstanceElement(typeID, type as Type, {})
      }
      this.registerElement(res)
    }
    return res
  }

  merge(otherRegistry: ElementsRegistry): ElementsRegistry {
    const allElements = this.getAllElements().concat(otherRegistry.getAllElements())
    return new ElementsRegistry(allElements)
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isType(element: any): element is Type {
  return element instanceof Type
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isObjectType(element: any): element is ObjectType {
  return element instanceof ObjectType
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isListType(element: any): element is ListType {
  return element instanceof ListType
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isInstanceElement(element: any): element is InstanceElement {
  return element instanceof InstanceElement
}

export function isPrimitiveType(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  element: any,
): element is PrimitiveType {
  return element instanceof PrimitiveType
}
