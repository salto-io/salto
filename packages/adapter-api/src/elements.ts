import _ from 'lodash'

/**
 * Defines the list of supported types.
 */
export enum PrimitiveTypes {
  STRING,
  NUMBER,
  BOOLEAN,
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Value = any
export interface Values {
  [key: string]: Value
}

export type FieldMap = Record<string, Field>
type TypeMap = Record<string, Type>


export class ElemID {
  static readonly NAMESPACE_SEPERATOR = '_'
  static readonly CONFIG_INSTANCE_NAME = '_config'

  nameParts: string[]
  adapter: string
  constructor(adapter: string, ...name: string[]) {
    this.adapter = adapter
    this.nameParts = name
  }

  get name(): string {
    return this.nameParts.join(ElemID.NAMESPACE_SEPERATOR)
  }

  getFullName(): string {
    return this.isConfig() ? this.adapter
      : [this.adapter, this.name].filter(p => !_.isEmpty(p)).join(ElemID.NAMESPACE_SEPERATOR)
  }

  isConfig(): boolean {
    return _.isEmpty(this.name) || this.name === ElemID.CONFIG_INSTANCE_NAME
  }
}

export interface Element {
  elemID: ElemID
  path?: string[]
  getAnnotationsValues: () => Values
}

type ElementMap = Record<string, Element>

/**
 * Represents a field inside a type
 */
export class Field implements Element {
  readonly elemID: ElemID

  public constructor(
    public parentID: ElemID,
    public name: string,
    public type: Type,
    private annotationsValues: Values = {},
    public isList: boolean = false,
  ) {
    this.elemID = new ElemID(parentID.adapter, ...parentID.nameParts, name)
  }

  isEqual(other: Field): boolean {
    return _.isEqual(this.type.elemID, other.type.elemID)
           && _.isEqual(this.annotationsValues, other.annotationsValues)
           && this.isList === other.isList
  }

  /**
   * Clones a field
   * Note that the cloned field still has the same element ID so it cannot be used in a different
   * object
   */
  clone(): Field {
    return new Field(
      this.parentID,
      this.name,
      this.type,
      _.cloneDeep(this.annotationsValues),
      this.isList,
    )
  }

  getAnnotationsValues(): Values {
    return this.annotationsValues
  }

  setAnnotationsValues(values: Values): void {
    this.annotationsValues = values
  }
}

/**
 * An abstract class that represent the base type.
 * Contains the base function and fields.
 * Each subclass needs to implement the clone function as it is members
 * dependent.
 */
export abstract class Type implements Element {
  public static DEFAULT = '_default'
  public static REQUIRED = '_required'
  public static RESTRICTION = '_restriction'


  readonly elemID: ElemID
  path?: string[]
  annotations: TypeMap
  private readonly annotationsValues: Values
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

  isEqual(other: Type): boolean {
    return _.isEqual(this.elemID, other.elemID)
          && this.isAnnotationsEqual(other)
  }

  isAnnotationsEqual(other: Type): boolean {
    return _.isEqual(
      _.mapValues(this.annotations, a => a.elemID),
      _.mapValues(other.annotations, a => a.elemID)
    )
          && _.isEqual(this.annotationsValues, other.annotationsValues)
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

  getAnnotationsValues(): Values {
    return this.annotationsValues
  }
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

  isEqual(other: PrimitiveType): boolean {
    return super.isEqual(other)
           && this.primitive === other.primitive
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
  fields: FieldMap

  constructor({
    elemID,
    fields = {},
    annotations = {},
    annotationsValues = {},
  }: {
    elemID: ElemID
    fields?: FieldMap
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ elemID, annotations, annotationsValues })
    this.fields = fields
  }

  private cloneFields(): FieldMap {
    const clonedFields: FieldMap = {}
    Object.keys(this.fields).forEach(key => {
      clonedFields[key] = this.fields[key].clone()
    })
    return clonedFields
  }

  isEqual(other: ObjectType): boolean {
    return super.isEqual(other)
          && _.isEqual(
            _.mapValues(this.fields, f => f.elemID),
            _.mapValues(other.fields, f => f.elemID)
          )
          && _.every(Object.keys(this.fields).map(n => this.fields[n].isEqual(other.fields[n])))
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
      elemID: new ElemID(this.elemID.adapter, ...this.elemID.nameParts),
      fields: clonedFields,
      annotations: clonedAnnotations,
      annotationsValues: clonedAnnotationValues,
    })

    res.annotate(additionalAnnotationsValues)

    return res
  }

  getFieldsThatAreNotInOther(other: this): Field[] {
    const otherSet = new Set<string>(Object.keys(other.fields))
    return Object.values(this.fields).filter(f => !otherSet.has(f.name))
  }

  getMutualFieldsWithOther(other: this): Field[] {
    const otherSet = new Set<string>(Object.keys(other.fields))
    return Object.values(this.fields).filter(f => otherSet.has(f.name))
  }
}

export class InstanceElement implements Element {
  elemID: ElemID
  path?: string[]
  type: ObjectType
  value: Values
  constructor(elemID: ElemID, type: ObjectType, value: Values, path?: string[]) {
    this.elemID = elemID
    this.type = type
    this.value = value
    this.path = path
  }

  getAnnotationsValues(): Values {
    return this.type.getAnnotationsValues()
  }

  isEqual(other: InstanceElement): boolean {
    return _.isEqual(this.type.elemID, other.type.elemID)
           && _.isEqual(this.value, other.value)
  }

  /**
   * Find all values that are in this.values and not in prev (this.values / prevValues)
   * Or different (same key and different value).
   *
   * @param prevValues to compare
   * @return All values which unique (not in prev) or different.
   */
  getValuesThatNotInPrevOrDifferent(prevValues: Values): Values {
    return _.pickBy(this.value, (val, key) => !_.isEqual(val, prevValues[key]))
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
    type?: PrimitiveTypes|ObjectType,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ): any {
    // Using any here is ugly, but I can't find a better comiling solution. TODO - fix this
    const key = elemID.getFullName()
    let res: Element = this.registeredElements[key]
    if (!res) {
      if (type === undefined) {
        res = new ObjectType({ elemID })
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      } else if (type as any in PrimitiveTypes) {
        res = new PrimitiveType({ elemID, primitive: type as PrimitiveTypes })
      } else {
        res = new InstanceElement(elemID, type as ObjectType, {})
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

export const BuiltinTypes: Record<string, PrimitiveType> = {
  STRING: new PrimitiveType({
    elemID: new ElemID('', 'string'),
    primitive: PrimitiveTypes.STRING,
  }),
  NUMBER: new PrimitiveType({
    elemID: new ElemID('', 'number'),
    primitive: PrimitiveTypes.NUMBER,
  }),
  BOOLEAN: new PrimitiveType({
    elemID: new ElemID('', 'boolean'),
    primitive: PrimitiveTypes.BOOLEAN,
  }),
}


/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isElement(value: any): value is Element {
  return value && value.elemID && value.elemID instanceof ElemID
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
export function isInstanceElement(element: any): element is InstanceElement {
  return element instanceof InstanceElement
}

export function isPrimitiveType(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  element: any,
): element is PrimitiveType {
  return element instanceof PrimitiveType
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isField(element: any): element is Field {
  return element instanceof Field
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isEqualElements(first?: any, second?: any): boolean {
  if (!(first && second)) {
    return false
  }
  // first.isEqual line appears multiple times since the compiler is not smart
  // enough to understand the 'they are the same type' concept when using or
  if (isPrimitiveType(first) && isPrimitiveType(second)) {
    return first.isEqual(second)
  } if (isObjectType(first) && isObjectType(second)) {
    return first.isEqual(second)
  } if (isField(first) && isField(second)) {
    return first.isEqual(second)
  } if (isInstanceElement(first) && isInstanceElement(second)) {
    return first.isEqual(second)
  }
  return false
}
