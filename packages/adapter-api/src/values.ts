/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import path from 'path'
import { inspect } from 'util'
import { hash as hashUtils } from '@salto-io/lowerdash'
// import { ElementsSource } from '@salto-io/workspace'
import { ElemID } from './element_id'
// There is a real cycle here and alternatively elements.ts should be defined in the same file
// eslint-disable-next-line import/no-cycle
import { Element, ReadOnlyElementsSource, PlaceholderObjectType, TypeElement, isVariable } from './elements'

export type PrimitiveValue = string | boolean | number

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Value = any

export interface Values {
  [key: string]: Value
}

export type CompareOptions = {
  compareByValue?: boolean
}

export const calculateStaticFileHash = (content: Buffer): string => hashUtils.toMD5(content)

type HashOrContent =
  | {
      content: Buffer
    }
  | {
      hash: string
    }

export type StaticFileParameters = {
  filepath: string
  encoding?: BufferEncoding
  isTemplate?: boolean // if true then encoding has to be utf8
} & HashOrContent

export const DEFAULT_STATIC_FILE_ENCODING: BufferEncoding = 'binary'

export class StaticFile {
  public readonly filepath: string
  public readonly hash: string
  public readonly isTemplate?: boolean
  public readonly encoding: BufferEncoding
  private internalContent?: Buffer
  constructor(params: StaticFileParameters) {
    this.isTemplate = params.isTemplate
    this.filepath = path.normalize(params.filepath)
    this.encoding = params.encoding ?? DEFAULT_STATIC_FILE_ENCODING
    if (this.isTemplate === true && params.encoding !== 'utf8') {
      this.encoding = 'utf8'
    }
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

  async getContent(): Promise<Buffer | undefined> {
    return this.internalContent
  }

  public isEqual(other: StaticFile): boolean {
    return this.hash === other.hash && this.encoding === other.encoding
  }

  [inspect.custom](): string {
    return `StaticFile(${this.filepath}, ${this.hash ? this.hash : '<unknown hash>'})`
  }
}

type StaticFileMetadata = Pick<StaticFile, 'filepath' | 'hash'>
export const getStaticFileUniqueName = ({ filepath, hash }: StaticFileMetadata): string => `${filepath}-${hash}`

const getResolvedValue = async (
  elemID: ElemID,
  elementsSource?: ReadOnlyElementsSource,
  resolvedValue?: Value,
): Promise<Value> => {
  if (resolvedValue === undefined && elementsSource === undefined) {
    throw new Error(
      `Can not resolve value of reference with ElemID ${elemID.getFullName()} ` +
        'without elementsSource because value does not exist',
    )
  }
  const value = resolvedValue ?? (await elementsSource?.get(elemID))
  // When there's no value in the ElementSource & in the Ref
  // Fallback to a placeholder Type. This resembles the behavior
  // before the RefType change.
  if (value === undefined) {
    return new PlaceholderObjectType({ elemID })
  }
  return value
}

export class UnresolvedReference {
  constructor(public target: ElemID) {}
}

export class ReferenceExpression {
  constructor(
    public readonly elemID: ElemID,
    private resValue?: Value,
    public topLevelParent?: Element,
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

  clone(): this {
    type CtorType = new (...args: ConstructorParameters<typeof ReferenceExpression>) => this
    const ExpressionCtor = this.constructor as CtorType
    return new ExpressionCtor(this.elemID, this.resValue, this.topLevelParent)
  }

  get value(): Value {
    // Dereference variables and recursive reference expressions
    const innerValue = isVariable(this.resValue) ? this.resValue.value : this.resValue
    return innerValue instanceof ReferenceExpression ? innerValue.value : innerValue
  }

  set value(value: Value) {
    this.resValue = value
  }

  async getResolvedValue(elementsSource?: ReadOnlyElementsSource): Promise<Value> {
    return getResolvedValue(this.elemID, elementsSource, this.value)
  }

  [inspect.custom](): string {
    return `ReferenceExpression(${this.elemID.getFullName()}, ${this.value ? '<omitted>' : '<no value>'})`
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isReferenceExpression = (value: any): value is ReferenceExpression => value instanceof ReferenceExpression

export class VariableExpression extends ReferenceExpression {
  constructor(elemID: ElemID, resValue?: Value, topLevelParent?: Element) {
    super(elemID, resValue, topLevelParent)
    // This is to prevent programming errors since the parser will always create
    // VariableExpressions with idType === 'var'
    if (elemID.idType !== 'var') {
      throw new Error(
        `A variable expression must point to a variable, but ${elemID.getFullName()} is a ${elemID.idType}`,
      )
    }
  }
}

export class TypeReference {
  constructor(
    public readonly elemID: ElemID,
    public type: TypeElement | undefined = undefined,
  ) {
    if (!elemID.isTopLevel()) {
      throw new Error(`Invalid id for type reference: ${elemID.getFullName()}. Type reference must be top level.`)
    }
  }

  clone(): TypeReference {
    return new TypeReference(this.elemID, this.type)
  }

  async getResolvedValue(elementsSource?: ReadOnlyElementsSource): Promise<TypeElement> {
    return getResolvedValue(this.elemID, elementsSource, this.type)
  }

  getResolvedValueSync(): TypeElement | undefined {
    return this.type
  }

  [inspect.custom](): string {
    return `TypeReference(${this.elemID.getFullName()}, ${this.type ? '<omitted>' : '<no value>'})`
  }
}

export type TemplatePart = string | ReferenceExpression

export class TemplateExpression {
  parts: TemplatePart[]

  constructor({ parts }: { parts: TemplatePart[] }) {
    this.parts = parts
  }

  get value(): string {
    return this.parts.map(part => (isReferenceExpression(part) ? part.value : part)).join('')
  }
}

export type Expression = ReferenceExpression | TemplateExpression

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isStaticFile = (value: any): value is StaticFile => value instanceof StaticFile

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isTypeReference = (value: any): value is TypeReference => value instanceof TypeReference

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isVariableExpression = (value: any): value is VariableExpression => value instanceof VariableExpression

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isTemplateExpression = (value: any): value is TemplateExpression => value instanceof TemplateExpression

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isExpression = (value: any): value is Expression =>
  isReferenceExpression(value) || isTemplateExpression(value)

export const isPrimitiveValue = (value: Value): value is PrimitiveValue =>
  value === undefined || value === null || ['string', 'number', 'boolean'].includes(typeof value)

// A _.cloneDeep variation that stops at references to avoid creating recursive clones
// of elements and element parts.
// This is not completely safe as it will keep references pointing to the original values
// so use with caution
export const cloneDeepWithoutRefs = <T>(value: T): T =>
  _.cloneDeepWith(value, val => {
    if (isReferenceExpression(val)) {
      return val.clone()
    }
    if (isTypeReference(val)) {
      return new TypeReference(val.elemID, val.type)
    }
    return undefined
  })
