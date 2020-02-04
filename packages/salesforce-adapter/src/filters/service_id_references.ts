import {
  Element, ElemID, isType, isInstanceElement, isObjectType, TypeElement,
  isField, Values, Field, Value, ReferenceExpression, CORE_ANNOTATIONS,
  transform, ObjectType, TransformValueFunc,
} from 'adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { buildAnnotationsObjectType } from './utils'


const createApiNameMap = (elements: Element[]): Record<string, ElemID> => (
  _(elements)
    .map(e => (isObjectType(e) ? [e, ..._.values(e.fields)] : [e]))
    .flatten()
    .map((e: Element) => [apiName(e), e.elemID])
    .fromPairs()
    .value()
)

const isReplaceCandidate = (candidate: Element, apiToIdMap: Record<string, ElemID>): boolean => {
  if (isType(candidate) || isField(candidate)) {
    return !_.isEmpty(candidate.annotations[CORE_ANNOTATIONS.VALUES])
      && _.some(candidate.annotations[CORE_ANNOTATIONS.VALUES], val => apiToIdMap[val])
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
  values: Values,
  refElement: ObjectType,
  apiToIdMap: Record<string, ElemID>,
  replaceTypes: Set<string>
): Values => {
  const isRefElement = (element?: Element): boolean => (
    element !== undefined && replaceTypes.has(element.elemID.getFullName())
  )

  const replacePrimitive = (val: Value): Value => (
    _.isString(val) && apiToIdMap[val] ? new ReferenceExpression(apiToIdMap[val]) : val
  )

  const transformReferences: TransformValueFunc = (val, field) => (
    isRefElement(field) || isRefElement(field.type) ? replacePrimitive(val) : val
  )

  return transform(values, refElement, transformReferences, false) || values
}
const replaceAnnotations = (
  element: TypeElement | Field,
  apiToIdMap: Record<string, ElemID>,
  replaceTypes: Set<string>
): Values => {
  const annoTypeObject = isField(element)
    ? buildAnnotationsObjectType(element.type)
    : buildAnnotationsObjectType(element)
  return replaceValue(element.annotations, annoTypeObject, apiToIdMap, replaceTypes)
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
  if (isObjectType(element)) {
    _.values(element.fields)
      .forEach(f => {
        f.annotations = replaceAnnotations(f, apiToIdMap, replaceTypes)
      })
  }
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const apiToIdMap = createApiNameMap(elements)
    const replaceTypes = getReplaceTypes(elements, apiToIdMap)
    elements.forEach(e => replaceApiNames(e, apiToIdMap, replaceTypes))
  },
})

export default filter
