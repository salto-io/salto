import { types } from '@salto/lowerdash'
import { ElemID } from './elements'

export class ReferenceExpression {
  constructor(
    public readonly elemId: ElemID
  ) {
    this.elemId = elemId
  }

  get traversalParts(): string[] {
    return this.elemId.getFullNameParts()
  }
}

export class TemplateExpression extends types.Bean<{ parts: TemplatePart[] }> {}

export type Expression = ReferenceExpression | TemplateExpression

export type TemplatePart = string | Expression

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isExpression = (value: any): value is Expression => (
  value instanceof ReferenceExpression
    || value instanceof TemplateExpression
)
