import { Field, Element, isObjectType, isInstanceElement, Value, Values, ObjectType, ElemID, ReferenceExpression, PrimitiveValue, PrimitiveField, transform } from 'adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import { apiName } from '../transformers/transformer'

const fieldToTypeMappingDefs: Array<[ElemID, string]> = [
  [new ElemID(SALESFORCE, 'Role', 'field', 'parentRole'), 'Role'],
  [new ElemID(SALESFORCE, 'ProfileApplicationVisibility', 'field', 'application'), 'CustomApplication'],
  [new ElemID(SALESFORCE, 'ProfileLayoutAssignment', 'field', 'layout'), 'Layout'],
]

export const fieldToTypeMapping = new Map(
  fieldToTypeMappingDefs.map(([fieldID, metadataType]) => [fieldID.getFullName(), metadataType])
)

const mapElemTypeToElemID = (elements: Element[]): Record<string, ElemID> => (
  _(elements)
    .map(e => [e.elemID.typeName, e.elemID])
    .fromPairs()
    .value()
)

export const groupByAPIName = (elements: Element[]): Record<string, Record<string, ElemID>> => (
  _(elements)
    .map<Element[]>(e => (isObjectType(e) ? [e, ..._.values(e.fields)] : [e]))
    .flatten()
    .groupBy(apiName)
    .mapValues(mapElemTypeToElemID)
    .value()
)

const replaceReferenceValues = (
  values: Values,
  refElement: ObjectType,
  replaceTypes: Map<string, string>,
  apiToIdMap: Record<string, Record<string, ElemID>>
): Values => {
  const shouldReplace = (element: Element): boolean => (
    replaceTypes.has(element.elemID.getFullName())
  )

  const replacePrimitive = (val: Value, field: Field): Value => {
    const elemIDMap = apiToIdMap[val]
    if (_.isUndefined(elemIDMap)) {
      return val
    }

    const targetType = replaceTypes.get(field.elemID.getFullName())
    if (_.isUndefined(targetType)) {
      return val
    }

    const elemID = elemIDMap[targetType]
    if (_.isUndefined(elemID)) {
      return val
    }

    return _.isString(val) ? new ReferenceExpression(elemID) : val
  }


  const transformReferences = (val: PrimitiveValue, field: PrimitiveField): Value => (
    shouldReplace(field) ? replacePrimitive(val, field) : val
  )

  return transform(values, refElement, transformReferences, false) || values
}

export const replaceInstances = (elements: Element[], fieldToTypeMap: Map<string, string>):
  void => {
  const apiNameToElemIDs = groupByAPIName(elements.filter(isInstanceElement))
  elements.filter(isInstanceElement).forEach(instance => {
    instance.value = replaceReferenceValues(
      instance.value,
      instance.type,
      fieldToTypeMap,
      apiNameToElemIDs
    )
  })
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    replaceInstances(elements, fieldToTypeMapping)
  },
})

export default filter
