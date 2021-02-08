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
// There is a real cycle here and alternatively values.ts should be defined in the same file
// eslint-disable-next-line import/no-cycle
import { Values, isEqualValues, Value } from './values'
import { CORE_ANNOTATIONS } from './core_annotations'

export const transformForComparison = (val: Values, omitCoreAnnotations: boolean): Values => (
  omitCoreAnnotations
    ? _.omit(val, Object.values(CORE_ANNOTATIONS))
    : val
)

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

  isEqual(other: Element, omitCoreAnnotations = false): boolean {
    return _.isEqual(this.elemID, other.elemID)
      && this.isAnnotationsEqual(other, omitCoreAnnotations)
  }

  isAnnotationsEqual(other: Element, omitCoreAnnotations = false): boolean {
    return this.isAnnotationsTypesEqual(other)
      && isEqualValues(
        transformForComparison(this.annotations, omitCoreAnnotations),
        transformForComparison(other.annotations, omitCoreAnnotations),
      )
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

export class ListType extends Element {
  public constructor(
   public innerType: TypeElement
  ) {
    super({
      elemID: new ElemID('', `list<${innerType.elemID.getFullName()}>`),
    })
    this.setInnerType(innerType)
  }

  isEqual(other: ListType, omitCoreAnnotations = false): boolean {
    return (super.isEqual(other, omitCoreAnnotations)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    && isEqualTypes(this.innerType, other.innerType))
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

  isEqual(other: MapType, omitCoreAnnotations = false): boolean {
    return (super.isEqual(other, omitCoreAnnotations)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    && isEqualTypes(this.innerType, other.innerType, omitCoreAnnotations))
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
export class Field extends Element {
  public constructor(
    public parent: ObjectType,
    public name: string,
    public type: TypeElement,
    annotations: Values = {},
  ) {
    super({ elemID: parent.elemID.createNestedID('field', name), annotations })
  }

  isEqual(other: Field, omitCoreAnnotations = false): boolean {
    return _.isEqual(this.type.elemID, other.type.elemID)
      && _.isEqual(this.elemID, other.elemID)
      && isEqualValues(
        transformForComparison(this.annotations, omitCoreAnnotations),
        transformForComparison(other.annotations, omitCoreAnnotations),
      )
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
      this.type,
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

  isEqual(other: PrimitiveType, omitCoreAnnotations = false): boolean {
    return super.isEqual(other, omitCoreAnnotations)
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
  type: TypeElement
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
      (fieldDef, name) => new Field(this, name, fieldDef.type, fieldDef.annotations),
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

  isEqual(other: ObjectType, omitCoreAnnotations = false): boolean {
    return super.isEqual(other, omitCoreAnnotations)
      && _.isEqual(
        _.mapValues(this.fields, f => f.elemID),
        _.mapValues(other.fields, f => f.elemID)
      )
      && _.isEqual(this.isSettings, other.isSettings)
      && _.every(Object.keys(this.fields).map(
        n => this.fields[n].isEqual(other.fields[n], omitCoreAnnotations)
      ))
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

export class InstanceElement extends Element {
  constructor(name: string,
    public type: ObjectType,
    public value: Values = {},
    path?: ReadonlyArray<string>,
    annotations?: Values) {
    super({ elemID: type.elemID.createNestedID('instance', name), annotations, path })
  }

  isEqual(other: InstanceElement, omitCoreAnnotations = false): boolean {
    return super.isEqual(other, omitCoreAnnotations)
      && _.isEqual(this.type.elemID, other.type.elemID)
      && isEqualValues(this.value, other.value)
  }

  /**
   * Return an independent copy of this instance.
   * @return {InstanceElement} the cloned instance
   */
  clone(): InstanceElement {
    return new InstanceElement(this.elemID.name, this.type, _.cloneDeep(this.value), this.path,
      _.cloneDeep(this.annotations))
  }
}

export class Variable extends Element {
  constructor(elemID: ElemID,
    public value: Value,
    path?: ReadonlyArray<string>) {
    super({ elemID, path })
  }

  isEqual(other: Variable, omitCoreAnnotations = false): boolean {
    return (super.isEqual(other, omitCoreAnnotations) && isEqualValues(this.value, other.value))
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

const isEqualTypes = (
  first: TypeElement,
  second: TypeElement,
  omitCoreAnnotations = false,
): boolean => {
  if (isPrimitiveType(first) && isPrimitiveType(second)) {
    return first.isEqual(second, omitCoreAnnotations)
  } if (isObjectType(first) && isObjectType(second)) {
    return first.isEqual(second, omitCoreAnnotations)
  } if (isListType(first) && isListType(second)) {
    return first.isEqual(second, omitCoreAnnotations)
  } if (isMapType(first) && isMapType(second)) {
    return first.isEqual(second, omitCoreAnnotations)
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isEqualElements(first?: any, second?: any, omitCoreAnnotations = false): boolean {
  if (!(first && second)) {
    return false
  }
  // first.isEqual line appears multiple times since the compiler is not smart
  // enough to understand the 'they are the same type' concept when using or
  if (isType(first) && isType(second)) {
    return isEqualTypes(first, second, omitCoreAnnotations)
  } if (isField(first) && isField(second)) {
    return first.isEqual(second, omitCoreAnnotations)
  } if (isInstanceElement(first) && isInstanceElement(second)) {
    return first.isEqual(second, omitCoreAnnotations)
  } if (isVariable(first) && isVariable(second)) {
    return first.isEqual(second, omitCoreAnnotations)
  }
  return false
}

export type ReadOnlyElementsSource = {
  list: () => Promise<AsyncIterable<ElemID>>
  get: (id: ElemID) => Promise<Element | undefined>
  getAll: () => Promise<AsyncIterable<Element>>
  has: (id: ElemID) => Promise<boolean>
}
