import _ from 'lodash'

import {
  ElemID, Element, isObjectType, isInstanceElement, isType, Value,
  EXPRESSION_TRAVERSAL_SEPERATOR,
  ReferenceExpression, TemplateExpression,
  isTemplateExpression, isReferenceExpression,
} from 'adapter-api'

type Resolver<T> = (v: T, contextElements: Element[], visited?: Set<string>) => Value

let resolveReferenceExpression: Resolver<ReferenceExpression>
let resolveTemplateExpression: Resolver<TemplateExpression>

const resolveMaybeExpression: Resolver<Value> = (
  value: Value,
  contextElements: Element[],
  visited: Set<string> = new Set<string>(),
): Value => {
  if (isReferenceExpression(value)) {
    return resolveReferenceExpression(value, contextElements, visited)
  }

  if (isTemplateExpression(value)) {
    return resolveTemplateExpression(value, contextElements, visited)
  }

  return undefined
}

resolveReferenceExpression = (
  expression: ReferenceExpression,
  contextElements: Element[],
  visited: Set<string> = new Set<string>(),
): Value => {
  const { traversalParts } = expression
  const traversal = traversalParts.join(EXPRESSION_TRAVERSAL_SEPERATOR)

  if (visited.has(traversal)) {
    throw new Error(`can not resolve reference ${traversal} - circular dependency detected`)
  }
  visited.add(traversal)

  const nameParts = traversalParts[0].split(ElemID.NAMESPACE_SEPERATOR)
  const root = new ElemID(nameParts[0], ...nameParts.slice(1))
  const path = traversalParts.slice(1)

  const resolvePath = (rootElement: Element): Value => {
    if (isInstanceElement(rootElement)) {
      return (!_.isEmpty(path)) ? _.get(rootElement.value, path) : rootElement.value
    }

    if (isObjectType(rootElement) && rootElement.fields[path[0]]) {
      return _.get(rootElement.fields[path[0]].annotations, path.slice(1))
    }

    if (isType(rootElement)) {
      return _.get(rootElement.annotations, path)
    }

    return undefined
  }

  // Validation should throw an error if there is not match, or more than one match
  const rootElement = contextElements.filter(e => _.isEqual(root, e.elemID))[0]
  if (!rootElement) {
    throw new Error(`Can not resolve reference ${traversal}`)
  }

  const value = resolvePath(rootElement)
  if (value === undefined) {
    throw new Error(`Can not resolve reference ${traversal}`)
  }

  return resolveMaybeExpression(value, contextElements, visited) || value
}

resolveTemplateExpression = (
  expression: TemplateExpression,
  contextElements: Element[],
  visited: Set<string> = new Set<string>(),
): Value => expression.parts
  .map(p => resolveMaybeExpression(p, contextElements, visited) || p)
  .join('')

export const resolve = (element: Element, contextElements: Element[]): Element => {
  const referenceCloner = (v: Value): Value => resolveMaybeExpression(v, contextElements)

  if (isInstanceElement(element)) {
    element.value = _.cloneDeepWith(element.value, referenceCloner)
  }

  if (isObjectType(element)) {
    element.fields = _.cloneDeepWith(element.fields, referenceCloner)
  }

  if (isType(element)) {
    element.annotate(_.cloneDeepWith(element.annotations, referenceCloner))
  }

  return element
}
