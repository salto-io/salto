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
import {
  types,
  files,
} from '@salto-io/lowerdash'
import _ from 'lodash'
import { ElemID } from './element_id'

export type PrimitiveValue = string | boolean | number

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Value = any

export interface Values {
  [key: string]: Value
}

export class FunctionExpression {
  constructor(
    public readonly funcName: string,
    public readonly parameters: Value[],
    public readonly bpPath: string
  ) {}

  static get serializedTypeName(): string { return 'FunctionExpression' }
  static get functionNameAliases(): string[] { return [] }

  public equals(other: FunctionExpression): boolean {
    return this.funcName === other.funcName
    && this.parameters.length === other.parameters.length
    && this.parameters.every((param, index) => param === other.parameters[index])
  }
}

export class StaticFileAssetExpression extends FunctionExpression {
  public relativeFileName: string
  private fileContent?: Buffer
  public hash?: string
  constructor(
    // NOTE: Whilst it might look unnecessary,
    // we need the func name here to ensure that we keep whatever aliases the user use manually
    public readonly funcName: string,
    public readonly parameters: Value[],
    public readonly bpPath: string = 'none',
    contentOrHash?: Buffer|string
  ) {
    super(funcName, parameters, bpPath)
    const [relativeFileName] = parameters
    this.relativeFileName = relativeFileName
    if (contentOrHash) {
      if (contentOrHash instanceof Buffer) {
        this.content = contentOrHash
      } else {
        this.hash = contentOrHash as string
      }
    }
  }

  static get serializedTypeName(): string { return 'StaticFileAssetExpression' }
  static get functionNameAliases(): string[] { return ['file'] }

  get content(): Buffer | undefined {
    return this.fileContent
  }

  set content(content: Buffer | undefined) {
    if (content && content !== this.content) {
      this.fileContent = content
      this.hash = files.getMD5FromBuffer(content)
    }
  }

  public equals(other: StaticFileAssetExpression): boolean {
    return [this.hash, other.hash].every(x => x !== undefined)
    && this.hash === other.hash
  }
}

export class ReferenceExpression {
  constructor(
    public readonly elemId: ElemID, private resValue?: Value
  ) {}

  static get serializedTypeName(): string { return 'ReferenceExpression' }

  get traversalParts(): string[] {
    return this.elemId.getFullNameParts()
  }

  get value(): Value {
    return (this.resValue instanceof ReferenceExpression)
      ? this.resValue.value
      : this.resValue
  }
}

export class TemplateExpression extends types.Bean<{ parts: TemplatePart[] }> {
  static get serializedTypeName(): string { return 'TemplateExpression' }
}

export type Expression = ReferenceExpression | TemplateExpression | FunctionExpression

export type TemplatePart = string | Expression

export const isEqualValues = (first: Value, second: Value): boolean => _.isEqualWith(
  first,
  second,
  (f, s) => {
    if (f instanceof FunctionExpression && s instanceof FunctionExpression) {
      return f.equals(s)
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
export const isTemplateExpression = (value: any): value is TemplateExpression => (
  value instanceof TemplateExpression
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isFunctionExpression = (value: any): value is FunctionExpression => (
  value instanceof FunctionExpression
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isExpression = (value: any): value is Expression => (
  isReferenceExpression(value) || isTemplateExpression(value) || isFunctionExpression(value)
)
