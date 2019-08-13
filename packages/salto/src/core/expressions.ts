import _ from 'lodash'

import {
  ElemID, Element, isObjectType, isInstanceElement, isType, Value,
} from 'adapter-api'

interface Expression {
  resolve(contextElements: Element[], visited?: string[]): Value
}

type TemplatePart = string|Expression

const isExpression = (value: Value): value is Expression => _.isFunction(value.resolve)

export class ReferenceExpression {
  static readonly TRAVERSAL_SEPERATOR = '.'
  traversal: string
  root: ElemID
  path: string[]
  constructor(traversalParts: Value[]) {
    const nameParts = traversalParts[0].split(ElemID.NAMESPACE_SEPERATOR)
    this.root = new ElemID(nameParts[0], ...nameParts.slice(1))
    this.path = traversalParts.slice(1)
    this.traversal = traversalParts.join(ReferenceExpression.TRAVERSAL_SEPERATOR)
  }

  // This is only wrapped as function so that the error validation would be simpler
  private resolvePath(rootElement: Element): Value {
    if (isInstanceElement(rootElement)) {
      return (!_.isEmpty(this.path)) ? _.get(rootElement.value, this.path) : rootElement.value
    }
    if (isObjectType(rootElement) && rootElement.fields[this.path[0]]) {
      return _.get(rootElement.fields[this.path[0]].getAnnotationsValues(), this.path.slice(1))
    }
    if (isType(rootElement)) {
      return _.get(rootElement.getAnnotationsValues(), this.path)
    }

    return undefined
  }

  resolve(contextElements: Element[], visited: string[] = []): Value {
    if (visited.includes(this.traversal)) {
      throw new Error(`can not resolve reference ${this.traversal} - circular dependency detected`)
    }

    // Validation should throw an error if there is not match, or more than one match
    const rootElement = contextElements.filter(e => _.isEqual(this.root, e.elemID))[0]
    if (rootElement === undefined) {
      throw new Error(`Can not resolve reference ${this.traversal}`)
    }

    const value = this.resolvePath(rootElement)
    if (value === undefined) {
      throw new Error(`Can not resolve reference ${this.traversal}`)
    }

    return isExpression(value)
      ? value.resolve(contextElements, [this.traversal, ...visited])
      : value
  }
}

export class TemplateExpression {
  parts: TemplatePart[]

  constructor(parts: TemplatePart[]) {
    this.parts = parts
  }

  resolve(contextElements: Element[], visited: string[] = []): Value {
    return this.parts.map(p => (isExpression(p) ? p.resolve(contextElements, visited) : p)).join('')
  }
}

export const resolve = (element: Element, contextElements: Element[]): Element => {
  const referenceCloner = (v: Value): Value => (
    isExpression(v) ? v.resolve(contextElements) : undefined
  )

  if (isInstanceElement(element)) {
    element.value = _.cloneDeepWith(element.value, referenceCloner)
  }
  if (isObjectType(element)) {
    element.fields = _.cloneDeepWith(element.fields, referenceCloner)
  }
  if (isType(element)) {
    element.annotate(_.cloneDeepWith(
      element.getAnnotationsValues(), referenceCloner
    ))
  }

  return element
}
