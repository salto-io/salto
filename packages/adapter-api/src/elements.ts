/*
*                      Copyright 2020 Salto Labs Ltd.
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
// import { ElementsSource } from '@salto-io/workspace'
import { ElemID } from './element_id'
// There is a real cycle here and alternatively values.ts should be defined in the same file
// eslint-disable-next-line import/no-cycle
import { Values, isEqualValues, Value, ReferenceExpression, isReferenceExpression } from './values'

export type ElementsSource = {
  getSync(id: ElemID): Value
}

/**
 * An abstract class that represent the base element.
 * Contains the base function and fields.
 * Each subclass needs to implement the clone function as it is members
 * dependent.
 */
export abstract class Element {
  readonly elemID: ElemID
  annotations: Values
  annotationTypes: TypeMap
  path?: ReadonlyArray<string>
  constructor({
    elemID,
    annotations,
    annotationTypes,
    path,
  }: {
    elemID: ElemID
    annotationTypes?: TypeMap
    annotations?: Values
    path?: ReadonlyArray<string>
  }) {
    this.elemID = elemID
    this.annotations = annotations || {}
    this.annotationTypes = annotationTypes || {}
    this.path = path
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

abstract class PlaceholderTypeElement extends Element {
  constructor(
    elemID: ElemID,
    public refType: ReferenceExpression,
    annotationTypes?: TypeMap,
    annotations?: Values,
    path?: ReadonlyArray<string>,
  ) {
    super({ elemID, annotationTypes, annotations, path })
  }

  getType(elementsSource?: ElementsSource): TypeElement {
    const type = this.refType.getResolvedValue(elementsSource)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (!isType(type)) {
      throw new Error(`Element with ElemID ${this.elemID.getFullName()}'s type is resolved non-TypeElement`)
    }
    return type
  }
}

export class ListType extends Element {
  public constructor(
   public innerType: TypeElement
  ) {
    super({
      elemID: new ElemID('', `list<${innerType.elemID.getFullName()}>`),
    })
    this.setInnerType(innerType)
  }

  isEqual(other: ListType): boolean {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return super.isEqual(other) && isEqualTypes(this.innerType, other.innerType)
  }

  clone(): ListType {
    return new ListType(
      this.innerType.clone()
    )
  }

  setInnerType(innerType: TypeElement): void {
    if (innerType.elemID.isEqual(this.innerType.elemID)) {
      this.innerType = innerType
      this.annotations = innerType.annotations
      this.annotationTypes = innerType.annotationTypes
    } else {
      throw new Error('Inner type id does not match ListType id')
    }
  }
}

/**
 * Represents a map with string keys and innerType values.
 */
export class MapType extends Element {
  public constructor(
   public innerType: TypeElement
  ) {
    super({
      elemID: new ElemID('', `map<${innerType.elemID.getFullName()}>`),
    })
    this.setInnerType(innerType)
  }

  isEqual(other: MapType): boolean {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return super.isEqual(other) && isEqualTypes(this.innerType, other.innerType)
  }

  clone(): MapType {
    return new MapType(
      this.innerType.clone()
    )
  }

  setInnerType(innerType: TypeElement): void {
    if (innerType.elemID.isEqual(this.innerType.elemID)) {
      this.innerType = innerType
      this.annotations = innerType.annotations
      this.annotationTypes = innerType.annotationTypes
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
    typeOrRefType: TypeElement | ReferenceExpression,
    annotations: Values = {},
  ) {
    super(
      parent.elemID.createNestedID('field', name),
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      isType(typeOrRefType)
        ? new ReferenceExpression(typeOrRefType.elemID, typeOrRefType)
        : typeOrRefType,
      {},
      annotations
    )
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (!isType(typeOrRefType) && !isReferenceExpression(typeOrRefType)) {
      throw new Error(`How the hell did I get here with this ${typeOrRefType}`)
    }
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
    annotationTypes = {},
    annotations = {},
    isSettings = false,
    path = undefined,
  }: {
    elemID: ElemID
    fields?: Record<string, FieldDefinition>
    annotationTypes?: TypeMap
    annotations?: Values
    isSettings?: boolean
    path?: ReadonlyArray<string>
  }) {
    super({ elemID, annotationTypes, annotations, path })
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
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      isObjectType(typeOrRefType)
        ? new ReferenceExpression(typeOrRefType.elemID, typeOrRefType)
        : typeOrRefType,
      undefined,
      annotations,
      path,
    )
  }

  getType(elementsSource?: ElementsSource): ObjectType {
    const type = this.refType.getResolvedValue(elementsSource)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (!isObjectType(type)) {
      throw new Error(`Element with ElemID ${this.elemID.getFullName()}'s type is resolved non-ObjectType`)
    }
    return type
  }

  isEqual(other: InstanceElement): boolean {
    return _.isEqual(this.refType.elemID, other.refType.elemID)
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
  return value && value.elemID && value.elemID instanceof ElemID
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
