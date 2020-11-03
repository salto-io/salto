/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { hash as hashUtils, types } from '@salto-io/lowerdash'
import { ElemID } from './element_id'
// There is a real cycle here and alternatively elements.ts should be defined in the same file
// eslint-disable-next-line import/no-cycle
import { Element } from './elements'

export type PrimitiveValue = string | boolean | number

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Value = any

export interface Values {
  [key: string]: Value
}

export const calculateStaticFileHash = (content: Buffer): string =>
  hashUtils.toMD5(content)

type HashOrContent = {
  content: Buffer
} | {
  hash: string
}

export type StaticFileParameters = {
  filepath: string
  encoding?: BufferEncoding
} & HashOrContent

export const DEFAULT_STATIC_FILE_ENCODING: BufferEncoding = 'binary'

export class StaticFile {
  public readonly filepath: string
  public readonly hash: string
  public readonly encoding: BufferEncoding
  protected internalContent?: Buffer
  constructor(params: StaticFileParameters) {
    this.filepath = params.filepath
    this.encoding = params.encoding ?? DEFAULT_STATIC_FILE_ENCODING
    if (!Buffer.isEncoding(this.encoding)) {
      throw Error(`Cannot create StaticFile at path - ${this.filepath} due to invalid encoding - ${this.encoding}`)
    }
    if ('content' in params) {
      this.internalContent = params.content
      this.hash = calculateStaticFileHash(this.internalContent)
    } else {
      this.hash = params.hash
    }
  }

  get content(): Buffer | undefined {
    return this.internalContent
  }

  async getContent(): Promise<Buffer | undefined> {
    return this.internalContent
  }

  public isEqual(other: StaticFile): boolean {
    return this.hash === other.hash && this.encoding === other.encoding
  }
}

export class ReferenceExpression {
  constructor(
    public readonly elemId: ElemID,
    private resValue?: Value,
    public readonly topLevelParent?: Element
  ) {}

  /**
   * Create a new instance which is of the same type as the current instance, and
   * has the provided value.
   * For example, if the instance is a VariableExpression,
   * create a VariableExpression, not a ReferenceExpression.
   */
  public createWithValue(resValue: Value, resTopLevelParent?: Element): ReferenceExpression {
    const ExpressionCtor = this.constructor as typeof ReferenceExpression
    return new ExpressionCtor(this.elemId, resValue, resTopLevelParent)
  }

  get traversalParts(): string[] {
    return this.elemId.getFullNameParts()
  }

  get value(): Value {
    return (this.resValue instanceof ReferenceExpression)
      ? this.resValue.value
      : this.resValue
  }
}

export class VariableExpression extends ReferenceExpression {
  constructor(
    public readonly elemId: ElemID,
    resValue?: Value,
    public readonly topLevelParent?: Element
  ) {
    super(elemId, resValue, topLevelParent)
    // This is to prevent programing errors since the parser will always create
    // VariableExpressions with idType === 'var'
    if (elemId.idType !== 'var') {
      throw new Error(`A variable expression must point to a variable, but ${elemId.getFullName()
      } is a ${elemId.idType}`)
    }
  }
}

export class TemplateExpression extends types.Bean<{ parts: TemplatePart[] }> { }

export type Expression = ReferenceExpression | TemplateExpression

export type TemplatePart = string | Expression

export const isEqualValues = (first: Value, second: Value): boolean => _.isEqualWith(
  first,
  second,
  (f, s) => {
    if (f instanceof StaticFile && s instanceof StaticFile) {
      return f.isEqual(s)
    }
    if (f instanceof ReferenceExpression || s instanceof ReferenceExpression) {
      const fValue = f instanceof ReferenceExpression ? f.value : f
      const sValue = s instanceof ReferenceExpression ? s.value : s
      return (f instanceof ReferenceExpression && s instanceof ReferenceExpression)
        ? f.elemId.isEqual(s.elemId)
        : isEqualValues(fValue, sValue)
    }
    return undefined
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isReferenceExpression = (value: any): value is ReferenceExpression => (
  value instanceof ReferenceExpression
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isVariableExpression = (value: any): value is VariableExpression => (
  value instanceof VariableExpression
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isTemplateExpression = (value: any): value is TemplateExpression => (
  value instanceof TemplateExpression
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isExpression = (value: any): value is Expression => (
  isReferenceExpression(value) || isTemplateExpression(value)
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isStaticFile = (value: any): value is StaticFile => (
  value instanceof StaticFile
)

export const isPrimitiveValue = (value: Value): value is PrimitiveValue => (
  value === undefined || value === null || ['string', 'number', 'boolean'].includes(typeof value)
)
