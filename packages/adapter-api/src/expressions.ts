import _ from 'lodash'

import { Element, Value } from './elements'

export interface Expression {
  resolve(contextElements: Element[], visited?: string[]): Value
}

export const isExpression = (value: Value): value is Expression => _.isFunction(value.resolve)
