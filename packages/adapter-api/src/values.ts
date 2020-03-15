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

export interface FunctionDumpDetails {
  funcName: string
  parameters: Value[]
}

export abstract class FunctionValue {
  abstract equals(other?: FunctionValue | Value): boolean
  abstract functionDumpDetails: FunctionDumpDetails
}

export class StaticFileAsset extends FunctionValue {
  private fileContent?: Buffer
  public hash?: string
  constructor(
    public readonly bpPath: string,
    public readonly relativeFileName: string,
    contentOrHash?: Buffer|string
  ) {
    super()
    if (contentOrHash) {
      if (contentOrHash instanceof Buffer) {
        this.content = contentOrHash
      } else {
        this.hash = contentOrHash as string
      }
    }
  }

  static get serializedTypeName(): string { return 'StaticFileAsset' }

  get content(): Buffer | undefined {
    return this.fileContent
  }

  set content(content: Buffer | undefined) {
    if (content && content !== this.content) {
      this.fileContent = content
      this.hash = files.getMD5FromBuffer(content)
    }
  }

  public get functionDumpDetails(): FunctionDumpDetails {
    return {
      funcName: 'file',
      parameters: [this.relativeFileName],
    }
  }

  public equals(other?: StaticFileAsset | Value): boolean {
    return other !== undefined
      && other instanceof StaticFileAsset
      && this.hash === other.hash
      && this.hash !== undefined
      && other.hash !== undefined
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

export type Expression = ReferenceExpression | TemplateExpression

export type TemplatePart = string | Expression

export const isEqualValues = (first: Value, second: Value): boolean => _.isEqualWith(
  first,
  second,
  (f, s) => {
    if (f && f.equals && s && s.equals) {
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
