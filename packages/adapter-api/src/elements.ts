import wu from 'wu'
import _ from 'lodash'
import { types } from '@salto/lowerdash'
/**
 * Defines the list of supported types.
 */
export enum PrimitiveTypes {
  STRING,
  NUMBER,
  BOOLEAN,
}

export type PrimitiveValue = string | boolean | number

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Value = any
export interface Values {
  [key: string]: Value
}

export class ReferenceExpression {
  constructor(
    public readonly elemId: ElemID, private resValue?: Value
  ) {}

  get traversalParts(): string[] {
    return this.elemId.getFullNameParts()
  }

  get value(): Value {
    return (this.resValue instanceof ReferenceExpression)
      ? this.resValue.value
      : this.resValue
  }
}

export class TemplateExpression extends types.Bean<{ parts: TemplatePart[] }> {}

export type Expression = ReferenceExpression | TemplateExpression

export type TemplatePart = string | Expression

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isExpression = (value: any): value is Expression => (
  value instanceof ReferenceExpression
    || value instanceof TemplateExpression
)

export type FieldMap = Record<string, Field>
export type TypeMap = Record<string, Type>

export type ElemIDType = 'type' | 'field' | 'instance' | 'attr' | 'annotation'
export const ElemIDTypes = ['type', 'field', 'instance', 'attr', 'annotation'] as ReadonlyArray<string>
export const isElemIDType = (v: string): v is ElemIDType => ElemIDTypes.includes(v)

export class ElemID {
  static readonly NAMESPACE_SEPARATOR = '.'
  static readonly CONFIG_NAME = '_config'

  static fromFullName(fullName: string): ElemID {
    const [adapter, typeName, idType, ...name] = fullName.split(ElemID.NAMESPACE_SEPARATOR)
    if (idType === undefined) {
      return new ElemID(adapter, typeName)
    }
    if (!isElemIDType(idType)) {
      throw new Error(`Invalid ID type ${idType}`)
    }
    if (idType === 'instance' && _.isEmpty(name)) {
      // This is a config instance (the last name part is omitted)
      return new ElemID(adapter, typeName, idType, ElemID.CONFIG_NAME)
    }
    return new ElemID(adapter, typeName, idType, ...name)
  }

  readonly adapter: string
  readonly typeName: string
  readonly idType: ElemIDType
  private readonly nameParts: ReadonlyArray<string>
  constructor(
    adapter: string,
    typeName?: string,
    idType?: ElemIDType,
    ...name: ReadonlyArray<string>
  ) {
    this.adapter = adapter
    this.typeName = _.isEmpty(typeName) ? ElemID.CONFIG_NAME : typeName as string
    this.idType = idType || 'type'
    this.nameParts = name
  }

  get name(): string {
    return this.fullNameParts().slice(-1)[0]
  }

  get nestingLevel(): number {
    if (this.isTopLevel()) {
      return 0
    }
    if (this.idType === 'instance') {
      // First name part is the instance name which is top level
      return this.nameParts.length - 1
    }
    return this.nameParts.length
  }

  private fullNameParts(): string[] {
    const parts = this.idType === 'type'
      ? [this.adapter, this.typeName]
      : [this.adapter, this.typeName, this.idType, ...this.nameParts]
    return parts.filter(part => !_.isEmpty(part)) as string[]
  }

  getFullName(): string {
    const nameParts = this.fullNameParts()
    return this.fullNameParts()
      // If the last part of the name is empty we can omit it
      .filter((part, idx) => idx !== nameParts.length - 1 || part !== ElemID.CONFIG_NAME)
      .join(ElemID.NAMESPACE_SEPARATOR)
  }

  getFullNameParts(): string[] {
    const nameParts = this.fullNameParts()
    return this.fullNameParts()
      // If the last part of the name is empty we can omit it
      .filter((part, idx) => idx !== nameParts.length - 1 || part !== ElemID.CONFIG_NAME)
  }

  isConfig(): boolean {
    return this.typeName === ElemID.CONFIG_NAME
  }

  isTopLevel(): boolean {
    return this.idType === 'type'
      || (this.idType === 'instance' && this.nameParts.length === 1)
  }

  isEqual(other: ElemID): boolean {
    return this.getFullName() === other.getFullName()
  }

  createNestedID(...nameParts: string[]): ElemID {
    if (this.idType === 'type') {
      // IDs nested under type IDs should have a different type
      const [nestedIDType, ...nestedNameParts] = nameParts
      if (!isElemIDType(nestedIDType)) {
        throw new Error(`Invalid ID type ${nestedIDType}`)
      }
      return new ElemID(this.adapter, this.typeName, nestedIDType, ...nestedNameParts)
    }
    return new ElemID(this.adapter, this.typeName, this.idType, ...this.nameParts, ...nameParts)
  }

  createParentID(): ElemID {
    const newNameParts = this.nameParts.slice(0, -1)
    if (!_.isEmpty(newNameParts)) {
      // Parent should have the same type as this ID
      return new ElemID(this.adapter, this.typeName, this.idType, ...newNameParts)
    }
    if (this.isTopLevel()) {
      // The parent of top level elements is the adapter
      return new ElemID(this.adapter)
    }
    // The parent of all other id types is the type
    return new ElemID(this.adapter, this.typeName)
  }

  createTopLevelParentID(): { parent: ElemID; path: ReadonlyArray<string> } {
    if (this.isTopLevel()) {
      // This is already the top level ID
      return { parent: this, path: [] }
    }
    if (this.idType === 'instance') {
      // Instance is a top level ID, the name of the instance is always the first name part
      return {
        parent: new ElemID(this.adapter, this.typeName, this.idType, this.nameParts[0]),
        path: this.nameParts.slice(1),
      }
    }
    // Everything other than instance is nested under type
    return { parent: new ElemID(this.adapter, this.typeName), path: this.nameParts }
  }
}

export const isEqualValues = (first: Value, second: Value): boolean => _.isEqualWith(
  first,
  second,
  (f, s) => {
    if (f instanceof ReferenceExpression || s instanceof ReferenceExpression) {
      const fValue = f instanceof ReferenceExpression ? f.value : f
      const sValue = s instanceof ReferenceExpression ? s.value : s
      return (f instanceof ReferenceExpression && s instanceof ReferenceExpression)
        ? f.elemId.isEqual(s.elemId)
        : isEqualValues(fValue, sValue)
    }
    return undefined
  }
)

export interface Element {
  elemID: ElemID
  path?: ReadonlyArray<string>
  annotations: Values
  clone: () => Element
}

export type ElementMap = Record<string, Element>

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
    this.elemID = parentID.createNestedID('field', name)
  }

  isEqual(other: Field): boolean {
    return _.isEqual(this.type.elemID, other.type.elemID)
      && _.isEqual(this.elemID, other.elemID)
      && isEqualValues(this.annotations, other.annotations)
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
  readonly elemID: ElemID
  path?: ReadonlyArray<string>
  annotationTypes: TypeMap
  public readonly annotations: Values
  constructor({
    annotationTypes,
    annotations,
    elemID,
    path,
  }: {
    elemID: ElemID
    annotationTypes: TypeMap
    annotations: Values
    path?: ReadonlyArray<string>
  }) {
    this.annotationTypes = annotationTypes
    this.annotations = annotations
    this.elemID = elemID
    this.path = path
    // Prevents reregistration of clones, we only want to register
    // first creation
  }

  /**
   * Return a deep copy of the instance annotations by recursively
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
    return this.isAnnotationsTypesEqual(other)
      && isEqualValues(this.annotations, other.annotations)
  }

  isAnnotationsTypesEqual(other: Type): boolean {
    return _.isEqual(
      _.mapValues(this.annotationTypes, a => a.elemID),
      _.mapValues(other.annotationTypes, a => a.elemID)
    )
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
    path = undefined,
  }: {
    elemID: ElemID
    primitive: PrimitiveTypes
    annotationTypes?: TypeMap
    annotations?: Values
    path?: ReadonlyArray<string>
  }) {
    super({ elemID, annotationTypes, annotations, path })
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
    path = undefined,
  }: {
    elemID: ElemID
    fields?: FieldMap
    annotationTypes?: TypeMap
    annotations?: Values
    isSettings?: boolean
    path?: ReadonlyArray<string>
  }) {
    super({ elemID, annotationTypes, annotations, path })
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
  path?: ReadonlyArray<string>
  type: ObjectType
  value: Values
  constructor(name: string, type: ObjectType, value: Values, path?: ReadonlyArray<string>) {
    this.elemID = type.elemID.createNestedID('instance', name)
    this.type = type
    this.value = value
    this.path = path
  }

  get annotations(): Values {
    return this.type.annotations
  }

  isEqual(other: InstanceElement): boolean {
    return _.isEqual(this.type.elemID, other.type.elemID)
      && isEqualValues(this.value, other.value)
  }

  /**
   * Find all values that are in this.values and not in prev (this.values / prevValues)
   * Or different (same key and different value).
   *
   * @param prevValues to compare
   * @return All values which unique (not in prev) or different.
   */
  getValuesThatNotInPrevOrDifferent(prevValues: Values): Values {
    return _.pickBy(this.value, (val, key) => !isEqualValues(val, prevValues[key]))
  }

  /**
   * Return an independent copy of this instance.
   * @return {InstanceElement} the cloned instance
   */
  clone(): InstanceElement {
    return new InstanceElement(this.elemID.name, this.type, _.cloneDeep(this.value), this.path)
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
    // Using any here is ugly, but I can't find a better compiling solution. TODO - fix this
    const key = elemID.getFullName()
    let res: Element = this.registeredElements[key]
    if (!res) {
      if (type === undefined) {
        res = new ObjectType({ elemID })
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      } else if (type as any in PrimitiveTypes) {
        res = new PrimitiveType({ elemID, primitive: type as PrimitiveTypes })
      } else {
        res = new InstanceElement(elemID.name, type as ObjectType, {})
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
  SERVICE_ID: new PrimitiveType({
    elemID: new ElemID('', 'serviceid'),
    primitive: PrimitiveTypes.STRING,
  }),
}

export const CORE_ANNOTATIONS = {
  DEFAULT: '_default',
  REQUIRED: '_required',
  VALUES: '_values',
  RESTRICTION: '_restriction',
}

export const RESTRICTION_ANNOTATIONS = {
  ENFORCE_VALUE: 'enforce_value',
  MIN: 'min',
  MAX: 'max',
}

const restrictionElemID = new ElemID('', 'restriction')
export const BuiltinAnnotationTypes: Record<string, Type> = {
  [CORE_ANNOTATIONS.DEFAULT]: BuiltinTypes.STRING,
  [CORE_ANNOTATIONS.REQUIRED]: BuiltinTypes.BOOLEAN,
  [CORE_ANNOTATIONS.VALUES]: BuiltinTypes.STRING,
  [CORE_ANNOTATIONS.RESTRICTION]: new ObjectType({ elemID: restrictionElemID,
    fields: {
      [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: new Field(
        restrictionElemID, RESTRICTION_ANNOTATIONS.ENFORCE_VALUE, BuiltinTypes.BOOLEAN
      ),
      [RESTRICTION_ANNOTATIONS.MIN]: new Field(
        restrictionElemID, RESTRICTION_ANNOTATIONS.MIN, BuiltinTypes.NUMBER
      ),
      [RESTRICTION_ANNOTATIONS.MAX]: new Field(
        restrictionElemID, RESTRICTION_ANNOTATIONS.MAX, BuiltinTypes.NUMBER
      ),
    } }),
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

export const findElements = (elements: Iterable<Element>, id: ElemID): Iterable<Element> => (
  wu(elements).filter(e => e.elemID.isEqual(id))
)

export const findElement = (elements: Iterable<Element>, id: ElemID): Element | undefined => (
  wu(elements).find(e => e.elemID.isEqual(id))
)

export const findObjectType = (elements: Iterable<Element>, id: ElemID): ObjectType | undefined => {
  const objects = wu(elements).filter(isObjectType) as wu.WuIterable<ObjectType>
  return objects.find(e => e.elemID.isEqual(id))
}

export const findInstances = (
  elements: Iterable<Element>,
  typeID: ElemID,
): Iterable<InstanceElement> => {
  const instances = wu(elements).filter(isInstanceElement) as wu.WuIterable<InstanceElement>
  return instances.filter(e => e.type.elemID.isEqual(typeID))
}
