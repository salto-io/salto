import _ from 'lodash'

import {
  ElemID, Element, isObjectType, isInstanceElement, isType, Value,
  ReferenceExpression, TemplateExpression, findElement,
} from 'adapter-api'

type Resolver<T> = (v: T, contextElements: Element[], visited?: Set<string>) => Value

class CircularReferenceError extends Error {
  constructor(ref: string, public elemID?: ElemID) {
    super(`failed to resolve reference ${ref} - circular dependecy detected`)
  }
}

export class UnresolvedReference {
  constructor(public ref: string) {}
}

let resolveReferenceExpression: Resolver<ReferenceExpression>
let resolveTemplateExpression: Resolver<TemplateExpression>

const resolveMaybeExpression: Resolver<Value> = (
  value: Value,
  contextElements: Element[],
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
  contextElements: Element[],
  visited: Set<string> = new Set<string>(),
): Value => {
  const { traversalParts } = expression
  const traversal = traversalParts.join(ElemID.NAMESPACE_SEPARATOR)

  if (visited.has(traversal)) {
    throw new CircularReferenceError(traversal)
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
  const rootElement = findElement(contextElements, parent)
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
