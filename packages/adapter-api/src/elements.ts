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
import { ElemID } from './element_id'
import { Values, isEqualValues } from './values'

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
}

export type TypeElement = PrimitiveType | ObjectType
export type TypeMap = Record<string, TypeElement>

/**
 * Represents a field inside a type
 */
export class Field extends Element {
  public constructor(
    public parentID: ElemID,
    public name: string,
    public type: TypeElement,
    annotations: Values = {},
    public isList: boolean = false,
  ) {
    super({ elemID: parentID.createNestedID('field', name), annotations })
  }

  static get serializedTypeName(): string { return 'Field' }

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

  static get serializedTypeName(): string { return 'PrimitiveType' }

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

  static get serializedTypeName(): string { return 'ObjectType' }

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

export class InstanceElement extends Element {
  constructor(name: string,
    public type: ObjectType,
    public value: Values = {},
    path?: ReadonlyArray<string>,
    annotations?: Values) {
    super({ elemID: type.elemID.createNestedID('instance', name), annotations, path })
  }

  static get serializedTypeName(): string { return 'InstanceElement' }

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
    return new InstanceElement(this.elemID.name, this.type, _.cloneDeep(this.value), this.path,
      _.cloneDeep(this.annotations))
  }
}
