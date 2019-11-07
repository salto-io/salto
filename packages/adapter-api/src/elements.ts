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

  readonly adapter: string
  private readonly nameParts: ReadonlyArray<string>
  constructor(adapter: string, ...name: ReadonlyArray<string>) {
    this.adapter = adapter
    this.nameParts = name
  }

  get name(): string {
    return this.fullNameParts().slice(-1)[0]
  }

  get nestingLevel(): number {
    return this.isConfig() ? 0 : this.nameParts.length
  }

  private fullNameParts(): string[] {
    return [this.adapter, ...this.nameParts].filter(part => !_.isEmpty(part)) as string[]
  }

  getFullName(): string {
    return this.isConfig() ? this.adapter : this.fullNameParts().join(ElemID.NAMESPACE_SEPERATOR)
  }

  isConfig(): boolean {
    return this.nameParts.length === 0
      || (this.nameParts.length === 1 && this.nameParts[0] === ElemID.CONFIG_INSTANCE_NAME)
  }

  createNestedID(...nameParts: string[]): ElemID {
    return new ElemID(this.adapter, ...[...this.nameParts, ...nameParts])
  }

  createParentID(): ElemID {
    return new ElemID(this.adapter, ...this.nameParts.slice(0, -1))
  }
}

export interface Element {
  elemID: ElemID
  path?: string[]
  annotations: Values
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
    public annotations: Values = {},
    public isList: boolean = false,
  ) {
    this.elemID = parentID.createNestedID(name)
  }

  isEqual(other: Field): boolean {
    return _.isEqual(this.type.elemID, other.type.elemID)
      && _.isEqual(this.annotations, other.annotations)
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
      _.cloneDeep(this.annotations),
      this.isList,
    )
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
  public static VALUES = '_values'
  public static RESTRICTION = '_restriction'
  public static ENFORCE_VALUE = 'enforce_value'

  readonly elemID: ElemID
  path?: string[]
  annotationTypes: TypeMap
  public readonly annotations: Values
  constructor({
    annotationTypes,
    annotations,
    elemID,
  }: {
    elemID: ElemID
    annotationTypes: TypeMap
    annotations: Values
  }) {
    this.annotationTypes = annotationTypes
    this.annotations = annotations
    this.elemID = elemID
    // Prevents reregistration of clones, we only want to register
    // first creation
  }

  /**
   * Return a deep copy of the instance annotations by recursivally
   * cloning all annotations (by invoking their clone method)
   */
  protected cloneAnnotationTypes(): TypeMap {
    const clonedAnnotationTypes: TypeMap = {}
    Object.keys(this.annotationTypes).forEach(key => {
      clonedAnnotationTypes[key] = this.annotationTypes[key].clone()
    })
    return clonedAnnotationTypes
  }

  /**
   * Return a deep copy of the instance annotations values.
   */
  protected cloneAnnotations(): Values {
    return _.cloneDeep(this.annotations)
  }

  isEqual(other: Type): boolean {
    return _.isEqual(this.elemID, other.elemID)
      && this.isAnnotationsEqual(other)
  }

  isAnnotationsEqual(other: Type): boolean {
    return _.isEqual(
      _.mapValues(this.annotationTypes, a => a.elemID),
      _.mapValues(other.annotationTypes, a => a.elemID)
    )
      && _.isEqual(this.annotations, other.annotations)
  }

  annotate(annotations: Values): void {
    // Should we override? I'm adding right now as it seems more
    // useful. (Roi R)
    Object.keys(annotations).forEach(key => {
      this.annotations[key] = annotations[key]
    })
  }

  /**
   * Return an independent copy of this instance. Needs to be implemented
   * by each subclass as this is structure dependent.
   * @return {Type} the cloned instance
   */
  abstract clone(annotations?: Values): Type
}

/**
 * Defines a type that represents a primitive value (This comment WAS NOT auto generated)
 */
export class PrimitiveType extends Type {
  primitive: PrimitiveTypes
  constructor({
    elemID,
    primitive,
    annotationTypes = {},
    annotations = {},
  }: {
    elemID: ElemID
    primitive: PrimitiveTypes
    annotationTypes?: TypeMap
    annotations?: Values
  }) {
    super({ elemID, annotationTypes, annotations })
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
  clone(additionalAnnotations: Values = {}): PrimitiveType {
    const res: PrimitiveType = new PrimitiveType({
      elemID: this.elemID,
      primitive: this.primitive,
      annotationTypes: this.cloneAnnotationTypes(),
      annotations: this.cloneAnnotations(),
    })
    res.annotate(additionalAnnotations)
    return res
  }
}

/**
 * Defines a type that represents an object (Also NOT auto generated)
 */
export class ObjectType extends Type {
  fields: FieldMap
  isSettings: boolean

  constructor({
    elemID,
    fields = {},
    annotationTypes = {},
    annotations = {},
    isSettings = false,
  }: {
    elemID: ElemID
    fields?: FieldMap
    annotationTypes?: TypeMap
    annotations?: Values
    isSettings?: boolean
  }) {
    super({ elemID, annotationTypes, annotations })
    this.fields = fields
    this.isSettings = isSettings
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
      && _.isEqual(this.isSettings, other.isSettings)
      && _.every(Object.keys(this.fields).map(n => this.fields[n].isEqual(other.fields[n])))
  }

  /**
   * Return an independent copy of this instance.
   * @return {ObjectType} the cloned instance
   */
  clone(additionalAnnotations: Values = {}): ObjectType {
    const clonedAnnotationTypes = this.cloneAnnotationTypes()
    const clonedAnnotations = this.cloneAnnotations()
    const clonedFields = this.cloneFields()
    const { isSettings } = this

    const res: ObjectType = new ObjectType({
      elemID: this.elemID,
      fields: clonedFields,
      annotationTypes: clonedAnnotationTypes,
      annotations: clonedAnnotations,
      isSettings,
    })

    res.annotate(additionalAnnotations)

    return res
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

  get annotations(): Values {
    return this.type.annotations
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
