import { types } from '@salto/lowerdash'
import { Value } from './elements'

export class ReferenceExpression extends types.Bean<{
  traversalParts: Value[]
}> {}

export const EXPRESSION_TRAVERSAL_SEPERATOR = '.'

export class TemplateExpression extends types.Bean<{
  parts: TemplatePart[]
}> { }

export type Expression = ReferenceExpression | TemplateExpression

export type TemplatePart = string | Expression
