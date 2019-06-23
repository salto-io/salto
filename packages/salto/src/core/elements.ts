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

interface Values {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  [key: string]: any
}
type TypeMap = Record<string, Type>
/**
 * An abstract class that represent the base type.
 * Contains the base function and fields.
 * Each subclass needs to implement the clone function as it is members
 * dependent.
 */
export abstract class Type {
  public static DEFAULT = '_default'

  static registeredTypes: TypeMap = {}

  readonly name: string
  annotations: TypeMap
  annotationsValues: Values
  constructor({
    annotations,
    annotationsValues,
    name,
  }: {
    name: string
    annotations: TypeMap
    annotationsValues: Values
  }) {
    this.annotations = annotations
    this.annotationsValues = annotationsValues
    this.name = name
    // Prevents reregistration of clones, we only want to register
    // first creation
    if (!Type.registeredTypes[name]) {
      Type.registeredTypes[name] = this
    }
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

  protected annotate(annotationsValues: Values): void {
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
    name,
    primitive,
    annotations = {},
    annotationsValues = {},
  }: {
    name: string
    primitive: PrimitiveTypes
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ name, annotations, annotationsValues })
    this.primitive = primitive
  }

  /**
   * Return an independent copy of this instance.
   * @return {PrimitiveType} the cloned instance
   */
  clone(additionalAnnotationsValues: Values = {}): PrimitiveType {
    const res: PrimitiveType = new PrimitiveType({
      name: this.name,
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
    name,
    fields = {},
    annotations = {},
    annotationsValues = {},
  }: {
    name: string
    fields?: TypeMap
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ name, annotations, annotationsValues })
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
      name: this.name,
      fields: clonedFields,
      annotations: clonedAnnotations,
      annotationsValues: clonedAnnotationValues,
    })

    res.annotate(additionalAnnotationsValues)

    return res
  }
}

/**
 * Defines a type that represents an array (OK I DID copy paste from prev comments.)
 */
export class ListType extends Type {
  elementType?: Type
  constructor({
    name,
    elementType,
    annotations = {},
    annotationsValues = {},
  }: {
    name: string
    elementType?: Type
    annotations?: TypeMap
    annotationsValues?: Values
  }) {
    super({ name, annotations, annotationsValues })
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
      name: this.name,
      elementType: clonedElementType,
      annotations: clonedAnnotations,
      annotationsValues: clonedAnnotationValues,
    })

    res.annotate(additionalAnnotationsValues)
    return res
  }
}

/**
 * Create or returns a type according to the name provided. If the this is the first time
 * the type is requested, an empty type will be provided. Configure it from the outside as follows:
 *
 *  const saltoAddr = getType('salto_address')
 *  saltoAddr.annotations.label = getType('string')
 *  saltoAddr.fields.country = getType('string')
 *  saltoAddr.fields.city = getType('string')
 *
 * @param  {string} name the name of the type to get or create
 * @param  {PrimitiveTypes = PrimitiveTypes.OBJECT} type the type of the needed type. Used in order
 * to decide with class to create if the type is not yet registered.
 * @return {any} the requested type element.
 */
export function getType(
  name: string,
  type: PrimitiveTypes = PrimitiveTypes.OBJECT
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
): any {
  // Using any here is ugly, but I can't find a better comiling solution. TODO - fix this
  let res: Type = Type.registeredTypes[name]
  if (!res) {
    if (type === PrimitiveTypes.OBJECT) {
      res = new ObjectType({ name })
    } else if (type === PrimitiveTypes.LIST) {
      res = new ListType({ name })
    } else {
      res = new PrimitiveType({ name, primitive: type })
    }
  }
  return res
}

export function isObjectType(element: Type | null): element is ObjectType {
  return element instanceof ObjectType
}

export function isListType(element: Type | null): element is ListType {
  return element instanceof ListType
}

export function isPrimitiveType(
  element: Type | null
): element is PrimitiveType {
  return element instanceof PrimitiveType
}
