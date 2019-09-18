import _ from 'lodash'
import {
  ReferenceExpression, TemplateExpression, EXPRESSION_TRAVERSAL_SEPERATOR, isReferenceExpression,
} from 'adapter-api'
import { HCLExpression } from '../src/parser/hcl'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const devaluate = (value: any): HCLExpression => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateValue = (v: any): HCLExpression => ({
    type: 'literal',
    expressions: [],
    value: v,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateString = (str: string): HCLExpression => ({
    type: 'template',
    expressions: [devaluateValue(str)],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateArray = (arr: any[]): HCLExpression => ({
    type: 'list',
    expressions: arr.map(e => devaluate(e)),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateObject = (obj: Record<string, any>): HCLExpression => ({
    type: 'map',
    expressions: _(obj).entries().flatten().map(e => devaluate(e))
      .value(),
  })

  const devaluateReference = (ref: ReferenceExpression): HCLExpression => ({
    type: 'reference',
    value: ref.traversalParts
      .join(EXPRESSION_TRAVERSAL_SEPERATOR)
      .split(EXPRESSION_TRAVERSAL_SEPERATOR),
    expressions: [],
  })

  const devaluateTemplateExpression = (templateExp: TemplateExpression): HCLExpression => ({
    type: 'template',
    expressions: templateExp.parts.map(p => (
      isReferenceExpression(p) ? devaluateReference(p) : devaluateValue(p)
    )),
  })

  if (_.isString(value)) {
    return devaluateString(value as string)
  }
  if (_.isArray(value)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return devaluateArray(value as any[])
  }
  if (_.isPlainObject(value)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return devaluateObject(value as Record<string, any>)
  }
  if (value.traversalParts) {
    return devaluateReference(value)
  }
  if (value.parts) {
    return devaluateTemplateExpression(value)
  }

  return devaluateValue(value)
}

export default devaluate
