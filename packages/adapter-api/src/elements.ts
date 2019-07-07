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

interface ElemIDArgs {
  adapter?: string
  name?: string
}


export class ElemID {
  static readonly NAMESPACE_SEPERATOR = '_'

  name?: string
  adapter?: string
  constructor(args: ElemIDArgs) {
    this.name = args.name
    this.adapter = args.adapter
  }

  getFullName(): string {
    return [this.adapter, this.name]
      .filter(part => !_.isEmpty(part))
      .join(ElemID.NAMESPACE_SEPERATOR)
  }
}

export interface Element {
  elemID: ElemID
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


  readonly elemID: ElemID
  annotations: TypeMap
  annotationsValues: Values
  constructor({
    annotations,
    annotationsValues,
    elemID,
  }: {
    elemID: ElemID
    annotations: TypeMap
    annotationsValues: Values
  }) {
    this.annotations = annotations
    this.annotationsValues = annotationsValues
    this.elemID = elemID
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
    elemID,
    primitive,
    annotations = {},
    annotationsValues = {},
  }: {
    elemID: ElemID
    primitive: PrimitiveTypes
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ elemID, annotations, annotationsValues })
    this.primitive = primitive
  }

  /**
   * Return an independent copy of this instance.
   * @return {PrimitiveType} the cloned instance
   */
  clone(additionalAnnotationsValues: Values = {}): PrimitiveType {
    const res: PrimitiveType = new PrimitiveType({
      elemID: this.elemID,
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
    elemID,
    fields = {},
    annotations = {},
    annotationsValues = {},
  }: {
    elemID: ElemID
    fields?: TypeMap
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ elemID, annotations, annotationsValues })
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
      elemID: this.elemID,
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
    elemID,
    elementType,
    annotations = {},
    annotationsValues = {},
  }: {
    elemID: ElemID
    elementType?: Type
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ elemID, annotations, annotationsValues })
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
      elemID: this.elemID,
      elementType: clonedElementType,
      annotations: clonedAnnotations,
      annotationsValues: clonedAnnotationValues,
    })

    res.annotate(additionalAnnotationsValues)
    return res
  }
}

export class InstanceElement implements Element {
  elemID: ElemID
  type: Type
  value: Values
  constructor(elemID: ElemID, type: Type, value: Values) {
    this.elemID = elemID
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
    const key = elementToRegister.elemID.getFullName()
    const existingElement = this.registeredElements[key]
    if (existingElement) {
      throw new Error('Type extension is not supported for now')
    }
    this.registeredElements[key] = elementToRegister
  }

  hasElement(elemID: ElemID): boolean {
    const fullName = elemID.getFullName()
    return Object.prototype.hasOwnProperty.call(this.registeredElements, fullName)
  }

  getAllElements(): Element[] {
    return Object.values(this.registeredElements)
  }

  getElement(
    elemID: ElemID,
    type: PrimitiveTypes|Type = PrimitiveTypes.OBJECT,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ): any {
    // Using any here is ugly, but I can't find a better comiling solution. TODO - fix this
    const key = elemID.getFullName()
    let res: Element = this.registeredElements[key]
    if (!res) {
      if (type === PrimitiveTypes.OBJECT) {
        res = new ObjectType({ elemID })
      } else
      if (type === PrimitiveTypes.LIST) {
        res = new ListType({ elemID })
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      } else if (type as any in PrimitiveTypes) {
        res = new PrimitiveType({ elemID, primitive: type as PrimitiveTypes })
      } else {
        res = new InstanceElement(elemID, type as Type, {})
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
