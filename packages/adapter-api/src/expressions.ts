import _ from 'lodash'
import { Value } from './elements'

export type ReferenceExpression = {
  traversalParts: Value[]
}

export const isReferenceExpression = (v: Value): v is ReferenceExpression =>
  _.isArrayLike(v.traversalParts)

export const EXPRESSION_TRAVERSAL_SEPERATOR = '.'

export type TemplateExpression = {
  parts: TemplatePart[]
}

export const isTemplateExpression = (v: Value): v is TemplateExpression =>
  _.isArrayLike(v.parts)

export type Expression = ReferenceExpression | TemplateExpression

export const isExpression = (v: Value): v is Expression =>
  isReferenceExpression(v) || isTemplateExpression(v)

export type TemplatePart = string | Expression
