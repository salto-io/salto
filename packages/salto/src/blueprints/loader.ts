import _ from 'lodash'
import {
  ObjectType, isType, isObjectType, isInstanceElement, Element, Field,
} from 'adapter-api'
import Parser from '../parser/salto'
import Blueprint from './blueprint'

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
  const parentID = (bases[0] || updates[0]).parentID().getFullName()
  const fieldName = (bases[0] || updates[0]).name
  if (bases.length === 0) {
    throw new Error(`can't extend ${parentID}: field ${fieldName} has no base definition.`)
  }
  if (bases.length > 1) {
    throw new Error(`can't extend ${parentID}: field ${fieldName} has multiple base definition.`)
  }
  // Ensure each annotation value is updated at most once.
  try {
    _.mergeWith({}, ...updates.map(u => u.annotationsValues), validateNoDuplicates)
  } catch (e) {
    throw new Error(`can't extend ${parentID}: ${e.message}`)
  }
}

const mergeFieldDefinitions = (
  definitions: Field[]
): Field => {
  const bases = definitions.filter(d => !isUpdate(d))
  const updates = definitions.filter(d => isUpdate(d))
  validateDefinitions(bases, updates)
  // If there is more then one base validation would have failed
  const base = bases[0]
  const annotationsValues = _.merge(
    {},
    base.annotationsValues,
    ...updates.map(u => u.annotationsValues)
  )
  return new Field(base.parentID(), base.name, base.type, annotationsValues, base.isList)
}

const mergeObjectDefinitions = (objects: ObjectType[]): ObjectType => {
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
  const annotations = _.mergeWith(
    {},
    ...objects.map(o => o.annotations),
    validateNoDuplicates
  )
  const annotationsValues = _.mergeWith(
    {},
    ...objects.map(o => o.annotationsValues),
    validateNoDuplicates
  )
  return new ObjectType({
    elemID, fields, annotations, annotationsValues,
  })
}

/**
 * Merge all of the object types by dividing into groups according to elemID
 * and merging the defs
 */
const mergeObjects = (
  objects: ObjectType[]
): Record<string, ObjectType> => _(objects).groupBy(o => o.elemID.getFullName())
  .mapValues(mergeObjectDefinitions).value()


/**
 * Replace the pointers to all the merged elements to the merged version.
 */
const updateMergedTypes = (
  elements: Element[],
  mergedObjects: Record<string, ObjectType>
): Element[] => elements.map(elem => {
  if (isType(elem)) {
    elem.annotations = _.mapValues(
      elem.annotations,
      anno => mergedObjects[anno.elemID.getFullName()] || anno
    )
  }
  if (isObjectType(elem)) {
    elem.fields = _.mapValues(
      elem.fields,
      field => {
        field.type = mergedObjects[field.type.elemID.getFullName()] || field.type
        return field
      }
    )
  }
  if (isInstanceElement(elem)) {
    elem.type = mergedObjects[elem.type.elemID.getFullName()] || elem.type
  }
  return elem
})

/**
 * Merge a list of elements by applying all updates, and replacing the pointers
 * to the updated elements.
 */
export const mergeElements = (elements: Element[]): Element[] => {
  const mergedObjects = mergeObjects(elements.filter(e => isObjectType(e)) as ObjectType[])
  const mergedElements = [
    ...elements.filter(e => !isObjectType(e)),
    ...Object.values(mergedObjects),
  ]
  return updateMergedTypes(mergedElements, mergedObjects)
}

export const getAllElements = async (blueprints: Blueprint[]): Promise<Element[]> => {
  const parseResults = await Promise.all(blueprints.map(
    bp => Parser.parse(bp.buffer, bp.filename)
  ))

  const elements = _.flatten(parseResults.map(r => r.elements))
  const errors = _.flatten(parseResults.map(r => r.errors))

  if (errors.length > 0) {
    throw new Error(`Failed to parse blueprints: ${errors.join('\n')}`)
  }
  return mergeElements(elements)
}
