/*
*                      Copyright 2021 Salto Labs Ltd.
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
// import { ElementsSource } from '@salto-io/workspace'
import { ElemID } from './element_id'
// There is a real cycle here and alternatively elements.ts should be defined in the same file
// eslint-disable-next-line import/no-cycle
import { Element, ReadOnlyElementsSource, ObjectType } from './elements'

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
    public readonly elemID: ElemID,
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
    return new ExpressionCtor(this.elemID, resValue, resTopLevelParent)
  }

  get traversalParts(): string[] {
    return this.elemID.getFullNameParts()
  }

  get value(): Value {
    return (this.resValue instanceof ReferenceExpression)
      ? this.resValue.value
      : this.resValue
  }

  async getResolvedValue(elementsSource?: ReadOnlyElementsSource): Promise<Value> {
    if (this.resValue === undefined && elementsSource === undefined) {
      throw new Error(
        `Can not resolve value of reference with ElemID ${this.elemID.getFullName()} `
        + 'without elementsSource cause value does not exist'
      )
    }
    const value = (await elementsSource?.get(this.elemID)) ?? this.value
    // When there's no value in the ElementSource & in the Ref
    // Fallback to a placeholder Type. This resembles the behavior
    // before the RefType change.
    if (value === undefined) {
      return new ObjectType({
        elemID: this.elemID,
      })
    }
    return value
  }
}

export class VariableExpression extends ReferenceExpression {
  constructor(
    public readonly elemID: ElemID,
    resValue?: Value,
    public readonly topLevelParent?: Element
  ) {
    super(elemID, resValue, topLevelParent)
    // This is to prevent programing errors since the parser will always create
    // VariableExpressions with idType === 'var'
    if (elemID.idType !== 'var') {
      throw new Error(`A variable expression must point to a variable, but ${elemID.getFullName()
      } is a ${elemID.idType}`)
    }
  }
}

// eslint-disable-next-line no-use-before-define
export class TemplateExpression extends types.Bean<{ parts: TemplatePart[] }> { }

export type Expression = ReferenceExpression | TemplateExpression

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isStaticFile = (value: any): value is StaticFile => (
  value instanceof StaticFile
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isReferenceExpression = (value: any): value is ReferenceExpression => (
  value instanceof ReferenceExpression
)

export type TemplatePart = string | Expression
/*
  Benchmarking reveals that looping on strings is extremely expensive.
  It seems that random access to a string is, for some reason, a bit expensive.
  Using "replace" takes about 30 times as much as a straightforward comparison.
  However, it's about 20 times better to use replace than to iterate over both strings.
  For this reason we first check a naive comparison, and then test with replace.
  */
const compareStringsIgnoreNewlineDifferences = (s1: string, s2: string): boolean =>
  (s1 === s2) || (s1.replace(/\r\n/g, '\n') === s2.replace(/\r\n/g, '\n'))

export const compareSpecialValues = (
  first: Value,
  second: Value
): boolean | undefined => {
  if (isStaticFile(first) && isStaticFile(second)) {
    return first.isEqual(second)
  }
  if (isReferenceExpression(first) || isReferenceExpression(second)) {
    const fValue = isReferenceExpression(first) ? first.value : first
    const sValue = isReferenceExpression(second) ? second.value : second
    return (isReferenceExpression(first) && isReferenceExpression(second))
      ? first.elemID.isEqual(second.elemID)
      : _.isEqualWith(fValue, sValue, compareSpecialValues)
  }
  if (typeof first === 'string' && typeof second === 'string') {
    return compareStringsIgnoreNewlineDifferences(first, second)
  }
  return undefined
}

export const isEqualValues = (
  first: Value,
  second: Value
): boolean => _.isEqualWith(
  first,
  second,
  compareSpecialValues
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

export const isPrimitiveValue = (value: Value): value is PrimitiveValue => (
  value === undefined || value === null || ['string', 'number', 'boolean'].includes(typeof value)
)
