import _ from 'lodash'
import { Element, ObjectType, isObjectType } from 'adapter-api'

interface MergeHelper {
  model: ObjectType
  ref: ObjectType
}
type MergeHelpersMap = Record<string, MergeHelper>

const validateLegalAnnotationOverrides = (
  helper: MergeHelper,
  extension: ObjectType
): void => {
  // FOR Ref: HCL spec, Extension, Note #3 should be handled
  // By the general annotaiton validation (That is, cannot add
  // annotation vlaues for undefined annotation)

  // For Ref: HCL spec, Extension, Note #5
  Object.keys(extension.annotationsValues).forEach(key => {
    const refAnno = helper.ref.annotationsValues[key]
    const currentAnno = helper.model.annotationsValues[key]
    if (!_.isEqual(refAnno, currentAnno)) {
      throw new Error('An annotaiton value can only be changed once')
    }
  })
}

const validateLegalFieldAdditions = (
  helper: MergeHelper,
  extension: ObjectType
): void => {
  Object.keys(extension.fields).forEach(key => {
    // Ref: HCL spec, Extension, Note #2
    if (helper.ref.fields[key]) {
      throw new Error('Can not add a field that was defined '
        + 'in the main model definition')
    }
    // Ref: HCL spec, Extension, Note #6
    if (helper.model.fields[key]) {
      throw new Error('A field can be only added by one extension')
    }
  })
}

const addExtention = (mergeMap: MergeHelpersMap, extension: ObjectType):
  MergeHelpersMap => {
  const key = extension.elemID.getFullName()
  const helper = mergeMap[key]

  // Ref: HCL spec, Extension, Note #1
  if (!helper) {
    throw new Error('Missing model definition')
  }

  validateLegalAnnotationOverrides(helper, extension)
  validateLegalFieldAdditions(helper, extension)

  // We know all fields are new so we can safely add them
  helper.model.fields = Object.assign(
    helper.model.fields,
    extension.fields
  )

  // We use assign and not merged to fully replace to account for
  // Ref: HCL spec, Extension, Note #4
  helper.model.annotationsValues = Object.assign(
    helper.model.annotationsValues,
    extension.annotationsValues
  )

  mergeMap[key] = helper
  return mergeMap
}

const mergeElements = (elements: Element[]): Element[] => {
  // Create an array of all the models
  const models = elements.filter(elem =>
    isObjectType(elem) && !elem.isExtension) as ObjectType[]

  // Create an array of all the extensions
  const extensions = elements.filter(elem =>
    isObjectType(elem) && elem.isExtension) as ObjectType[]

  // We save the rest of the elements for later
  const rest = elements.filter(elem => !isObjectType(elem))

  // We create a helper structure to help us understand if a specific
  // extension can be added
  const mergeHelperInit: MergeHelpersMap = {}
  const beforeMergeMap: MergeHelpersMap = models.reduce((acc, model) => {
    acc[model.elemID.getFullName()] = { model, ref: model.clone() }
    return acc
  }, mergeHelperInit)

  // Add every extension
  const afterMergeMap: MergeHelpersMap = extensions.reduce(addExtention, beforeMergeMap)

  // Unpack
  const mergedModels = Object.values(afterMergeMap).map(data =>
    data.model)


  return [...mergedModels, ...rest]
}

export default mergeElements
