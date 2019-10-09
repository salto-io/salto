import _ from 'lodash'
import {
  ObjectType, isType, isObjectType, isInstanceElement, Element, Field, InstanceElement,
  Type, Values, PrimitiveType, isPrimitiveType, BuiltinTypes,
} from 'adapter-api'
import { resolve } from './expressions'

export const UPDATE_KEYWORD = 'update'

const isUpdate = (
  definition: Field
): boolean => definition.type.elemID.name === UPDATE_KEYWORD

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateNoDuplicates = (existingValue: any, _s: any, key: string): void => {
  if (!_.isUndefined(existingValue)) throw new Error(`duplicated key ${key}`)
}

const validateDefinitions = (bases: Field[], updates: Field[]): void => {
  // ensure only one base field and no less
  const parentID = (bases[0] || updates[0]).parentID.getFullName()
  const fieldName = (bases[0] || updates[0]).name
  if (bases.length === 0) {
    throw new Error(`can't extend ${parentID}: field ${fieldName} has no base definition.`)
  }
  if (bases.length > 1) {
    throw new Error(`can't extend ${parentID}: field ${fieldName} has multiple base definition.`)
  }
  // Ensure each annotation value is updated at most once.
  try {
    _.mergeWith({}, ...updates.map(u => u.annotations), validateNoDuplicates)
  } catch (e) {
    throw new Error(`can't extend ${parentID}: ${e.message}`)
  }
}

const mergeFieldDefinitions = (
  definitions: Field[]
): Field => {
  // TODO validate no update fields (the only possible fail, which won't effect
  // usage, btw )
  if (definitions.length === 1) return definitions[0]
  const bases = definitions.filter(d => !isUpdate(d))
  const updates = definitions.filter(d => isUpdate(d))
  validateDefinitions(bases, updates)
  // If there is more then one base validation would have failed
  const base = bases[0]
  const annotations = _.merge(
    {},
    base.annotations,
    ...updates.map(u => u.annotations)
  )
  return new Field(base.parentID, base.name, base.type, annotations, base.isList)
}

const mergeObjectDefinitions = (objects: ObjectType[]): ObjectType => {
  if (objects.length === 1 && _.values(objects[0].fields).filter(isUpdate).length === 0) {
    return objects[0]
  }
  const { elemID } = objects[0]

  const fieldDefs: Record<string, Field[]> = {}
  objects.forEach(obj => {
    Object.keys(obj.fields).forEach(name => {
      const field = obj.fields[name]
      fieldDefs[name] = fieldDefs[name] ? [...fieldDefs[name], field] : [field]
    })
  })

  const fields = _.mapValues(fieldDefs, mergeFieldDefinitions)
  // There are no rules in the spec on merging annotations and
  // annotations values so we simply merge without allowing duplicates
  const annotationTypes = _.mergeWith(
    {},
    ...objects.map(o => o.annotationTypes),
    validateNoDuplicates
  )
  const annotations = _.mergeWith(
    {},
    ...objects.map(o => o.annotations),
    validateNoDuplicates
  )
  return new ObjectType({
    elemID, fields, annotationTypes, annotations,
  })
}

const mergePrimitiveDefinitions = (primtives: PrimitiveType[]): PrimitiveType => {
  if (primtives.length > 1) {
    throw new Error('Merging for primitive types is not supported.'
                    + `Found duplicated element ${primtives[0].elemID.getFullName()}`)
  }
  return primtives[0]
}

const buildDefaults = (
  type: Type
): Values | undefined => {
  const buildObjectDefaults = (object: ObjectType): Values | undefined => {
    const def = _(object.fields).mapValues(field =>
      ((field.annotations[Type.DEFAULT] === undefined && !field.isList)
        ? buildDefaults(field.type)
        : field.annotations[Type.DEFAULT])).pickBy(v => v !== undefined).value()
    return _.isEmpty(def) ? undefined : def
  }

  return (type.annotations[Type.DEFAULT] === undefined && isObjectType(type)
    ? buildObjectDefaults(type)
    : type.annotations[Type.DEFAULT])
}

/**
 * Merge all of the object types by dividing into groups according to elemID
 * and merging the defs
 */
const mergeObjects = (
  objects: ObjectType[]
): Record<string, ObjectType> => _(objects).groupBy(o => o.elemID.getFullName())
  .mapValues(mergeObjectDefinitions).value()

const mergeInstances = (
  instances: InstanceElement[]
): InstanceElement[] => {
  const mergeInstanceDefinitions = (instanceDefs: InstanceElement[]): InstanceElement => {
    if (instanceDefs.length > 1) console.log("OH BOY", instanceDefs[0].elemID.getFullName(), instanceDefs[1].elemID.getFullName())
    const refInst = instanceDefs[0]
    const value = (instanceDefs.length > 1) ? _.mergeWith(
      {},
      ...instanceDefs.map(i => i.value),
      validateNoDuplicates
    ) : refInst.value
    const defaults = buildDefaults(refInst.type)
    const valueWithDefault = _.isEmpty(defaults)? value : _.merge({}, buildDefaults(refInst.type) || {}, value)
    return new InstanceElement(refInst.elemID, refInst.type as ObjectType, valueWithDefault)
  }

  return _(instances).groupBy(i => i.elemID.getFullName())
    .mapValues(mergeInstanceDefinitions).values()
    .value()
}

const mergePrimitives = (
  primitives: PrimitiveType[]
): Record<string, PrimitiveType> => _(primitives).groupBy(p => p.elemID.getFullName())
  .mapValues(mergePrimitiveDefinitions).value()
/**
 * Replace the pointers to all the merged elements to the merged version.
 */
const updateMergedTypes = (
  elements: Element[],
  mergedTypes: Record<string, Type>
): Element[] => elements.map(elem => {
  if (isType(elem)) {
    elem.annotationTypes = _.mapValues(
      elem.annotationTypes,
      anno => mergedTypes[anno.elemID.getFullName()] || anno
    )
  }
  if (isObjectType(elem)) {
    elem.fields = _.mapValues(
      elem.fields,
      field => {
        field.type = mergedTypes[field.type.elemID.getFullName()] || field.type
        return field
      }
    )
  }
  if (isInstanceElement(elem)) {
    elem.type = mergedTypes[elem.type.elemID.getFullName()] as ObjectType || elem.type
  }
  return elem
})

/**
 * Merge a list of elements by applying all updates, and replacing the pointers
 * to the updated elements.
 */
export const mergeElements = (elements: Element[]): Element[] => {
  const mergedObjects = mergeObjects(elements.filter(e => isObjectType(e)) as ObjectType[])
  const mergedInstances = mergeInstances(elements.filter(
    e => isInstanceElement(e)
  ) as InstanceElement[])
  const mergedPrimitives = mergePrimitives([
    ...elements.filter(e => isPrimitiveType(e)) as PrimitiveType[],
    ...Object.values(BuiltinTypes),
  ])
  const mergedElements = [
    ...Object.values(mergedObjects),
    ...mergedInstances,
    ...Object.values(mergePrimitives)
  ]
  const updated = updateMergedTypes(mergedElements, _.merge({}, mergedObjects, mergedPrimitives))
  return updated.map(e => resolve(e, updated))
}
