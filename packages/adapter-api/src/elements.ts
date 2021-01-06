/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { ElemID } from './element_id'
import { collections } from '@salto-io/lowerdash'
// There is a real cycle here and alternatively values.ts should be defined in the same file
// eslint-disable-next-line import/no-cycle
import { Values, isEqualValues, Value, ReferenceExpression, isReferenceExpression } from './values'

const { awu } = collections.asynciterable
// This is used to allow contructors Elements with Placeholder types
// to receive TypeElement and save the appropriate Reference
const getRefType = (typeOrRef: TypeOrRef): ReferenceExpression =>
  (isReferenceExpression(typeOrRef)
    ? typeOrRef
    : new ReferenceExpression(typeOrRef.elemID, typeOrRef))

const getRefTypeValue = (
  refType: ReferenceExpression,
  elementsSource?: ReadOnlyElementsSource,
): Value =>
  (refType.getResolvedValue(elementsSource))

/**
 * An abstract class that represent the base element.
 * Contains the base function and fields.
 * Each subclass needs to implement the clone function as it is members
 * dependent.
 */
export abstract class Element {
  readonly elemID: ElemID
  annotations: Values
  annotationRefTypes: ReferenceMap
  path?: ReadonlyArray<string>
  constructor({
    elemID,
    annotationRefsOrTypes,
    annotations,
    path,
  }: {
    elemID: ElemID
    annotationRefsOrTypes?: TypeRefMap
    annotations?: Values
    path?: ReadonlyArray<string>
  }) {
    this.elemID = elemID
    this.annotations = annotations || {}
    this.annotationRefTypes = _.mapValues(
      (annotationRefsOrTypes ?? {}),
      refOrType => getRefType(refOrType)
    )
    this.path = path
  }

  /**
   * Return a deep copy of the instance annotations values.
   */
  protected cloneAnnotations(): Values {
    return _.cloneDeep(this.annotations)
  }

  isEqual(other: Element): boolean {
    return _.isEqual(this.elemID, other.elemID)
      && this.isAnnotationsEqual(other)
  }

  isAnnotationsEqual(other: Element): boolean {
    return this.isAnnotationsTypesEqual(other)
      && isEqualValues(this.annotations, other.annotations)
  }

  isAnnotationsTypesEqual(other: Element): boolean {
    return _.isEqual(
      _.mapValues(this.annotationRefTypes, a => a.elemID),
      _.mapValues(other.annotationRefTypes, a => a.elemID)
    )
  }

  getAnnotationTypes(elementsSource?: ReadOnlyElementsSource): TypeMap {
    const annotationTypes = _.mapValues(
      this.annotationRefTypes,
      refType => (refType.getResolvedValue(elementsSource))
    )

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const nonTypeVals = Object.values(annotationTypes).filter(type => !isType(type))
    if (nonTypeVals.length) {
      throw new Error(`Element with ElemID ${this.elemID.getFullName()}'s has annotationType that resolves as non-TypeElement`)
    }
    return annotationTypes
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
  abstract clone(annotations?: Values): Element
}
export type ElementMap = Record<string, Element>

/**
 * Defines the list of supported types.
 */
export enum PrimitiveTypes {
  STRING,
  NUMBER,
  BOOLEAN,
  UNKNOWN
}

export type ContainerType = ListType | MapType
export type TypeElement = PrimitiveType | ObjectType | ContainerType
export type TypeMap = Record<string, TypeElement>
type TypeOrRef = TypeElement | ReferenceExpression
export type TypeRefMap = Record<string, TypeOrRef>
export type ReferenceMap = Record<string, ReferenceExpression>

abstract class PlaceholderTypeElement extends Element {
  constructor(
    elemID: ElemID,
    public refType: ReferenceExpression,
    annotationRefsOrTypes?: TypeRefMap,
    annotations?: Values,
    path?: ReadonlyArray<string>,
  ) {
    super({ elemID, annotationRefsOrTypes, annotations, path })
  }

  getType(elementsSource?: ReadOnlyElementsSource): TypeElement {
    const type = getRefTypeValue(this.refType, elementsSource)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (!isType(type)) {
      throw new Error(`Element with ElemID ${this.elemID.getFullName()}'s type is resolved non-TypeElement`)
    }
    return type
  }
}

export class ListType extends Element {
  public refInnerType: ReferenceExpression
  public constructor(
    innerTypeOrRef: TypeOrRef
  ) {
    super({
      elemID: new ElemID('', `List<${innerTypeOrRef.elemID.getFullName()}>`),
    })
    this.refInnerType = getRefType(innerTypeOrRef)
    this.setRefInnerType(innerTypeOrRef)
  }

  isEqual(other: ListType): boolean {
    return super.isEqual(other)
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      && this.refInnerType.elemID.isEqual(other.refInnerType.elemID) && isListType(other)
  }

  clone(): ListType {
    return new ListType(
      new ReferenceExpression(this.refInnerType.elemID, this.refInnerType.value)
    )
  }

  getInnerType(elementsSource?: ReadOnlyElementsSource): TypeElement {
    const refInnerTypeVal = getRefTypeValue(this.refInnerType, elementsSource)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (!isType(refInnerTypeVal)) {
      throw new Error(`Element with ElemID ${this.elemID.getFullName()}'s innerType is resolved non-TypeElement`)
    }
    return refInnerTypeVal
  }

  setRefInnerType(innerTypeOrRefInnerType: TypeOrRef): void {
    if (innerTypeOrRefInnerType.elemID.isEqual(this.refInnerType.elemID)) {
      this.refInnerType = getRefType(innerTypeOrRefInnerType)
      const innerType = this.refInnerType.value
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      if (innerType !== undefined && isType(innerType)) {
        this.annotations = innerType.annotations
        this.annotationRefTypes = innerType.annotationRefTypes
      }
    } else {
      throw new Error('Inner type id does not match ListType id')
    }
  }
}

/**
 * Represents a map with string keys and innerType values.
 */
export class MapType extends Element {
  public refInnerType: ReferenceExpression
  public constructor(
    innerTypeOrRef: TypeOrRef
  ) {
    super({
      elemID: new ElemID('', `Map<${innerTypeOrRef.elemID.getFullName()}>`),
    })
    this.refInnerType = getRefType(innerTypeOrRef)
    this.setRefInnerType(innerTypeOrRef)
  }

  isEqual(other: MapType): boolean {
    return super.isEqual(other)
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      && this.refInnerType.elemID.isEqual(other.refInnerType.elemID) && isMapType(other)
  }

  clone(): MapType {
    return new MapType(
      new ReferenceExpression(this.refInnerType.elemID, this.refInnerType.value)
    )
  }

  getInnerType(elementsSource?: ReadOnlyElementsSource): TypeElement {
    const refInnerTypeVal = getRefTypeValue(this.refInnerType, elementsSource)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (!isType(refInnerTypeVal)) {
      throw new Error(`Element with ElemID ${this.elemID.getFullName()}'s innerType is resolved non-TypeElement`)
    }
    return refInnerTypeVal
  }

  setRefInnerType(innerTypeOrRefInnerType: TypeOrRef): void {
    if (innerTypeOrRefInnerType.elemID.isEqual(this.refInnerType.elemID)) {
      this.refInnerType = getRefType(innerTypeOrRefInnerType)
      const innerType = this.refInnerType.value
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      if (innerType !== undefined && isType(innerType)) {
        this.annotations = innerType.annotations
        this.annotationRefTypes = innerType.annotationRefTypes
      }
    } else {
      throw new Error('Inner type id does not match MapType id')
    }
  }
}

/**
 * Represents a field inside a type
 */
export class Field extends PlaceholderTypeElement {
  public constructor(
    public parent: ObjectType,
    public name: string,
    typeOrRefType: TypeOrRef,
    annotations: Values = {},
  ) {
    super(
      parent.elemID.createNestedID('field', name),
      getRefType(typeOrRefType),
      {},
      annotations
    )
  }

  isEqual(other: Field): boolean {
    return _.isEqual(this.refType.elemID, other.refType.elemID)
      && _.isEqual(this.elemID, other.elemID)
      && isEqualValues(this.annotations, other.annotations)
  }

  /**
   * Clones a field
   * Note that the cloned field still has the same element ID so it cannot be used in a different
   * object
   */
  clone(annotations?: Values): Field {
    return new Field(
      this.parent,
      this.name,
      this.refType,
      annotations === undefined ? _.cloneDeep(this.annotations) : annotations,
    )
  }
}
export type FieldMap = Record<string, Field>

/**
 * Defines a type that represents a primitive value (This comment WAS NOT auto generated)
 */
export class PrimitiveType extends Element {
  primitive: PrimitiveTypes
  constructor({
    elemID,
    primitive,
    annotationRefsOrTypes = {},
    annotations = {},
    path = undefined,
  }: {
    elemID: ElemID
    primitive: PrimitiveTypes
    annotationRefsOrTypes?: TypeRefMap
    annotations?: Values
    path?: ReadonlyArray<string>
  }) {
    super({ elemID, annotationRefsOrTypes, annotations, path })
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
      annotationRefsOrTypes: this.annotationRefTypes,
      annotations: this.cloneAnnotations(),
    })
    res.annotate(additionalAnnotations)
    return res
  }
}

export type FieldDefinition = {
  refType: ReferenceExpression
  annotations?: Values
}
/**
 * Defines a type that represents an object (Also NOT auto generated)
 */
export class ObjectType extends Element {
  fields: FieldMap
  isSettings: boolean

  constructor({
    elemID,
    fields = {},
    annotationRefsOrTypes = {},
    annotations = {},
    isSettings = false,
    path = undefined,
  }: {
    elemID: ElemID
    fields?: Record<string, FieldDefinition>
    annotationRefsOrTypes?: TypeRefMap
    annotations?: Values
    isSettings?: boolean
    path?: ReadonlyArray<string>
  }) {
    super({ elemID, annotationRefsOrTypes, annotations, path })
    this.fields = _.mapValues(
      fields,
      (fieldDef, name) => new Field(this, name, fieldDef.refType, fieldDef.annotations),
    )
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
    const clonedAnnotations = this.cloneAnnotations()
    const clonedFields = this.cloneFields()
    const { isSettings } = this

    const res: ObjectType = new ObjectType({
      elemID: this.elemID,
      fields: clonedFields,
      annotationRefsOrTypes: this.annotationRefTypes,
      annotations: clonedAnnotations,
      isSettings,
    })

    res.annotate(additionalAnnotations)

    return res
  }
}

export class InstanceElement extends PlaceholderTypeElement {
  constructor(
    name: string,
    typeOrRefType: ObjectType | ReferenceExpression,
    public value: Values = {},
    path?: ReadonlyArray<string>,
    annotations?: Values,
  ) {
    super(
      typeOrRefType.elemID.createNestedID('instance', name),
      getRefType(typeOrRefType),
      undefined,
      annotations,
      path,
    )
  }

  getType(elementsSource?: ReadOnlyElementsSource): ObjectType {
    const type = getRefTypeValue(this.refType, elementsSource)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (!isObjectType(type)) {
      throw new Error(`Element with ElemID ${this.elemID.getFullName()}'s type is resolved non-ObjectType`)
    }
    return type
  }

  isEqual(other: InstanceElement): boolean {
    return super.isEqual(other)
      && _.isEqual(this.refType.elemID, other.refType.elemID)
      && isEqualValues(this.value, other.value)
  }

  /**
   * Return an independent copy of this instance.
   * @return {InstanceElement} the cloned instance
   */
  clone(): InstanceElement {
    return new InstanceElement(this.elemID.name, this.refType, _.cloneDeep(this.value), this.path,
      _.cloneDeep(this.annotations))
  }
}

export class Variable extends Element {
  constructor(elemID: ElemID,
    public value: Value,
    path?: ReadonlyArray<string>) {
    super({ elemID, path })
  }

  isEqual(other: Variable): boolean {
    return super.isEqual(other) && isEqualValues(this.value, other.value)
  }

  clone(): Variable {
    return new Variable(this.elemID, _.cloneDeep(this.value), this.path)
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isElement(value: any): value is Element {
  return value instanceof Element
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isInstanceElement(element: any): element is InstanceElement {
  return element instanceof InstanceElement
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isObjectType(element: any): element is ObjectType {
  return element instanceof ObjectType
}

export function isPrimitiveType(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  element: any,
): element is PrimitiveType {
  return element instanceof PrimitiveType
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isListType(element: any): element is ListType {
  return element instanceof ListType
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isMapType(element: any): element is MapType {
  return element instanceof MapType
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isContainerType(element: any): element is ContainerType {
  return isListType(element) || isMapType(element)
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isVariable(element: any): element is Variable {
  return element instanceof Variable
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isType(element: any): element is TypeElement {
  return isPrimitiveType(element) || isObjectType(element) || isContainerType(element)
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isField(element: any): element is Field {
  return element instanceof Field
}

const isEqualTypes = (first: TypeElement, second: TypeElement): boolean => {
  if (isPrimitiveType(first) && isPrimitiveType(second)) {
    return first.isEqual(second)
  } if (isObjectType(first) && isObjectType(second)) {
    return first.isEqual(second)
  } if (isListType(first) && isListType(second)) {
    return first.isEqual(second)
  } if (isMapType(first) && isMapType(second)) {
    return first.isEqual(second)
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isEqualElements(first?: any, second?: any): boolean {
  if (!(first && second)) {
    return false
  }
  // first.isEqual line appears multiple times since the compiler is not smart
  // enough to understand the 'they are the same type' concept when using or
  if (isType(first) && isType(second)) {
    return isEqualTypes(first, second)
  } if (isField(first) && isField(second)) {
    return first.isEqual(second)
  } if (isInstanceElement(first) && isInstanceElement(second)) {
    return first.isEqual(second)
  } if (isVariable(first) && isVariable(second)) {
    return first.isEqual(second)
  }
  return false
}

export type ReadOnlyElementsSource = {
  list: () => Promise<AsyncIterable<ElemID>>
  get: (id: ElemID) => Promise<Element | undefined>
  getAll: () => Promise<AsyncIterable<Element>>
  has: (id: ElemID) => Promise<boolean>
  getSync(id: ElemID): Value
}

// This is a hack for the places we don't really need types in
// transformElement. We need to replace this with not using transformElement.
export const placeholderReadonlyElementsSource = {
  getSync(id: ElemID): Value {
    return new ObjectType({
      elemID: id,
    })
  },
  async list(): Promise<AsyncIterable<ElemID>> {
    return awu([])
  },
  async get(id: ElemID): Promise<Element | undefined> {
    return new ObjectType({
      elemID: id,
    })
  },
  async getAll(): Promise<AsyncIterable<Element>> {
    return awu([])
  },
  async has(_id: ElemID): Promise<boolean> {
    return true
  }
}
