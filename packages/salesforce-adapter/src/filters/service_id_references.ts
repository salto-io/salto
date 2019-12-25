import { Element, ElemID, isType, isInstanceElement, isObjectType, Type, isField, Values, Field, Value, ReferenceExpression } from 'adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import { INSTANCE_FULL_NAME_FIELD, API_NAME, METADATA_TYPE } from '../constants'


const createApiNameMap = (elements: Element[]): Record<string, ElemID> => (
  _(elements)
    .map(e => (isObjectType(e) ? [e, ..._.values(e.fields)] : [e]))
    .flatten()
    .map((e: Element) => {
      if (isInstanceElement(e)) {
        return [apiName(e), e.elemID.createNestedID(INSTANCE_FULL_NAME_FIELD)]
      }
      if (isField(e)) {
        return [
          `${apiName(e.type)}.${apiName(e)}`,
          e.elemID.createNestedID('annotation', API_NAME),
        ]
      }
      return [
        apiName(e),
        apiName(e) === metadataType(e)
          ? e.elemID.createNestedID('annotation', METADATA_TYPE)
          : e.elemID.createNestedID('annotation', API_NAME),
      ]
    })
    .fromPairs()
    .value()
)

const isReplaceCandidate = (candidate: Element, apiToIdMap: Record<string, ElemID>): boolean => {
  if (isType(candidate) || isField(candidate)) {
    return !_.isEmpty(candidate.annotations[Type.VALUES])
      && _.some(candidate.annotations[Type.VALUES], val => apiToIdMap[val])
  }
  return false
}

const getReplaceTypes = (
  elements: Element[],
  apiToIdMap: Record<string, ElemID>
): Set<string> => new Set(
  _(elements)
    .map(e => (isObjectType(e) ? [e, ..._.values(e.fields)] as Element[] : [e]))
    .flatten()
    .filter(e => isReplaceCandidate(e, apiToIdMap))
    .map(e => e.elemID.getFullName())
    .value()
)

const replaceValue = (
  value: Value,
  refElement: Type | Field,
  apiToIdMap: Record<string, ElemID>,
  replaceTypes: Set<string>
): Value => {
  const refType = isField(refElement) ? refElement.type : refElement
  if (!refType) return value
  if (_.isPlainObject(value) && isObjectType(refType)) {
    return _.mapValues(
      value,
      (v, k) => replaceValue(v, refType.fields[k], apiToIdMap, replaceTypes)
    )
  }
  if (_.isArray(value)) {
    return value.map(v => replaceValue(v, refElement, apiToIdMap, replaceTypes))
  }
  const isRefField = replaceTypes.has(refElement.elemID.getFullName())
    || replaceTypes.has(refType.elemID.getFullName())
  if (isRefField && apiToIdMap[value]) {
    return new ReferenceExpression(apiToIdMap[value])
  }
  return value
}

const replaceAnnotations = (
  element: Type | Field,
  apiToIdMap: Record<string, ElemID>,
  replaceTypes: Set<string>
): Values => {
  const refType = isField(element) ? element.type : element
  return _.mapValues(element.annotations, (value, annoName) => (
    refType.annotationTypes[annoName] ? replaceValue(
      value,
      refType.annotationTypes[annoName],
      apiToIdMap,
      replaceTypes
    )
      : value
  ))
}

const replaceApiNames = (
  element: Element,
  apiToIdMap: Record<string, ElemID>,
  replaceTypes: Set<string>
): void => {
  if (isInstanceElement(element)) {
    element.value = replaceValue(element.value, element.type, apiToIdMap, replaceTypes)
  }
  if (isType(element)) {
    element.annotate(replaceAnnotations(element, apiToIdMap, replaceTypes))
  }
  if (isField(element)) {
    element.annotations = replaceAnnotations(element, apiToIdMap, replaceTypes)
  }
  if (isObjectType(element)) {
    _.values(element.fields).forEach(f => {
      replaceApiNames(f, apiToIdMap, replaceTypes)
    })
  }
}

const filter: FilterCreator = () => ({
  /**
     * Upon fetch, mark all list fields as list fields in all fetched types
     *
     * @param elements the already fetched elements
     */
  onFetch: async (elements: Element[]) => {
    const apiToIdMap = createApiNameMap(elements)
    const replaceTypes = getReplaceTypes(elements, apiToIdMap)
    elements.forEach(e => replaceApiNames(e, apiToIdMap, replaceTypes))
  },
})

export default filter
