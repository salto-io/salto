import _ from 'lodash'

import {
  ElemID, Element, isObjectType, isInstanceElement, isType,
} from 'adapter-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResolvedRef = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Value = any

export class ReferenceExpression {
  static readonly TRAVERSAL_SEPERATOR = '.'
  traversal: string
  root: ElemID
  path: string[]
  constructor(traversal: string) {
    const traversalParts = traversal.split(ReferenceExpression.TRAVERSAL_SEPERATOR)
    const nameParts = traversalParts[0].split(ElemID.NAMESPACE_SEPERATOR)
    this.root = new ElemID(nameParts[0], ...nameParts.slice(1))
    this.path = (traversalParts.length > 1) ? traversalParts.slice(1) : []
    this.traversal = traversal
  }

  static isReferenceExpresion(value: Value): value is ReferenceExpression {
    return value instanceof ReferenceExpression
  }

  // This is only wrapped as function so that the error validation would be simpler
  private resolvePath(rootElement: Element): ResolvedRef {
    const hasPath = this.path.length > 0
    if (isInstanceElement(rootElement)) {
      return (hasPath) ? _.get(rootElement.value, this.path) : rootElement.value
    }
    if (isObjectType(rootElement) && rootElement.fields[this.path[0]]) {
      return _.get(rootElement.fields[this.path[0]].annotationsValues, this.path.slice(1))
    }
    if (isType(rootElement)) {
      return _.get(rootElement.annotationsValues, this.path)
    }

    return undefined
  }

  resolve(contextElements: Element[], visited: string[] = []): ResolvedRef {
    // Validation should throw an error if there is not match, or more than one match
    if (visited.filter(e => this.traversal === e).length > 0) {
      throw new Error(`can not resolve reference ${this.traversal} - circular dependency detected`)
    }

    const rootElement = contextElements.filter(e => _.isEqual(this.root, e.elemID))[0]
    const value = this.resolvePath(rootElement)
    if (value === undefined) {
      throw new Error(`Can not resolve reference ${this.traversal}`)
    }

    return ReferenceExpression.isReferenceExpresion(value)
      ? value.resolve(contextElements, [this.traversal, ...visited])
      : value
  }
}

export const resolve = (element: Element, contextElements: Element[]): Element => {
  const referenceCloner = (v: Value): ResolvedRef => (
    ReferenceExpression.isReferenceExpresion(v) ? v.resolve(contextElements) : undefined
  )

  if (isInstanceElement(element)) {
    element.value = _.cloneDeepWith(element.value, referenceCloner)
  }
  if (isObjectType(element)) {
    element.fields = _.cloneDeepWith(element.fields, referenceCloner)
  }
  if (isType(element)) {
    element.annotationsValues = _.cloneDeepWith(element.annotationsValues, referenceCloner)
  }

  return element
}
