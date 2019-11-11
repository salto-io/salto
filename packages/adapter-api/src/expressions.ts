import { types } from '@salto/lowerdash'
import { Value } from './elements'

export class ReferenceExpression extends types.Bean<{ traversalParts: Value[] }> {}

export class TemplateExpression extends types.Bean<{ parts: TemplatePart[] }> {}

export type Expression = ReferenceExpression | TemplateExpression

export type TemplatePart = string | Expression

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isExpression = (value: any): value is Expression => (
  value instanceof ReferenceExpression
    || value instanceof TemplateExpression
)
