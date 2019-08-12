import _ from 'lodash'

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
  return devaluateValue(value)
}

export default devaluate
