import _ from 'lodash'
import {
  ReferenceExpression, TemplateExpression, EXPRESSION_TRAVERSAL_SEPERATOR,
} from 'adapter-api'
import { HclExpression } from '../../../src/parser/internal/hcl'
import { SourceRange } from '../../../src/parser/internal/types'

const source: SourceRange = {
  filename: 'dummy',
  start: { line: 0, col: 0, byte: 0 },
  end: { line: 0, col: 0, byte: 0 },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const devaluate = (value: any): HclExpression => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateValue = (v: any): HclExpression => ({
    type: 'literal',
    expressions: [],
    value: v,
    source,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateString = (str: string): HclExpression => ({
    type: 'template',
    expressions: [devaluateValue(str)],
    source,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateArray = (arr: any[]): HclExpression => ({
    type: 'list',
    expressions: arr.map(e => devaluate(e)),
    source,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateObject = (obj: Record<string, any>): HclExpression => ({
    type: 'map',
    expressions: _(obj).entries().flatten().map(e => devaluate(e))
      .value(),
    source,
  })

  const devaluateReference = (ref: ReferenceExpression): HclExpression => ({
    type: 'reference',
    value: ref.traversalParts
      .join(EXPRESSION_TRAVERSAL_SEPERATOR)
      .split(EXPRESSION_TRAVERSAL_SEPERATOR),
    expressions: [],
    source,
  })

  const devaluateTemplateExpression = (templateExp: TemplateExpression): HclExpression => ({
    type: 'template',
    expressions: templateExp.parts.map(p => (
      p instanceof ReferenceExpression ? devaluateReference(p) : devaluateValue(p)
    )),
    source,
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
  if (value instanceof ReferenceExpression) {
    return devaluateReference(value)
  }
  if (value instanceof TemplateExpression) {
    return devaluateTemplateExpression(value)
  }

  return devaluateValue(value)
}

export default devaluate
