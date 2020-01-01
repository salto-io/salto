import { types } from '@salto/lowerdash'
import { ElemID, Value } from './elements'

export class ReferenceExpression {
  constructor(
    public readonly elemId: ElemID, private resValue?: Value
  ) {}

  get traversalParts(): string[] {
    return this.elemId.getFullNameParts()
  }

  get value(): Value {
    return (this.resValue instanceof ReferenceExpression) 
      ? this.resValue.value
      : this.resValue
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
