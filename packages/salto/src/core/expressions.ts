import _ from 'lodash'

import {
  ElemID, Element, isObjectType, isInstanceElement, isType, Value,
  ReferenceExpression, TemplateExpression,
} from 'adapter-api'

type Resolver<T> = (
  v: T,
  contextElements: Record<string, Element[]>,
  visited?: Set<string>
) => Value

export class UnresolvedReference {
  constructor(public ref: string) {}
}

export class CircularReference {
  constructor(public ref: string) {}
}

let resolveReferenceExpression: Resolver<ReferenceExpression>
let resolveTemplateExpression: Resolver<TemplateExpression>

const resolveMaybeExpression: Resolver<Value> = (
  value: Value,
  contextElements: Record<string, Element[]>,
  visited: Set<string> = new Set<string>(),
): Value => {
  if (value instanceof ReferenceExpression) {
    return resolveReferenceExpression(value, contextElements, visited)
  }

  if (value instanceof TemplateExpression) {
    return resolveTemplateExpression(value, contextElements, visited)
  }

  return undefined
}

resolveReferenceExpression = (
  expression: ReferenceExpression,
  contextElements: Record<string, Element[]>,
  visited: Set<string> = new Set<string>(),
): Value => {
  const { traversalParts } = expression
  const traversal = traversalParts.join(ElemID.NAMESPACE_SEPARATOR)

  if (visited.has(traversal)) {
    return new CircularReference(traversal)
  }
  visited.add(traversal)

  const { parent, path } = ElemID.fromFullName(traversal).createTopLevelParentID()

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
  const rootElement = contextElements[parent.getFullName()]
    && contextElements[parent.getFullName()][0]

  if (!rootElement) {
    return new UnresolvedReference(traversal)
  }

  const value = resolvePath(rootElement)
  if (value === undefined) {
    return new UnresolvedReference(traversal)
  }

  return resolveMaybeExpression(value, contextElements, visited) || value
}

resolveTemplateExpression = (
  expression: TemplateExpression,
  contextElements: Record<string, Element[]>,
  visited: Set<string> = new Set<string>(),
): Value => expression.parts
  .map(p => resolveMaybeExpression(p, contextElements, visited) || p)
  .join('')

export const resolveElement = (
  srcElement: Element,
  contextElements: Record<string, Element[]>
): Element => {
  const referenceCloner = (v: Value): Value => resolveMaybeExpression(v, contextElements)
  const element = _.clone(srcElement)
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

export const resolve = (elements: readonly Element[]): Element[] => {
  const contextElements = _.groupBy(elements, e => e.elemID.getFullName())
  return elements.map(e => resolveElement(e, contextElements))
}
