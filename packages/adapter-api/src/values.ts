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
import { types } from '@salto-io/lowerdash'
import _ from 'lodash'
import crypto from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { dirname, isAbsolute } from 'path'

import { ElemID } from './element_id'

const sum = crypto.createHash('sha256')

const RESOURCES_PREFIX_DIRNAME = 'static-resources'

export type PrimitiveValue = string | boolean | number

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Value = any

export interface Values {
  [key: string]: Value
}

// TODO: Actually implement (!)
export class StaticAssetExpression {
  private evaluatedHash: string | null
  private evaluatedContent: string | null

  static get serializedTypeName(): string { return 'StaticAssetExpression' }

  constructor(
    public readonly filePath: string,
    public readonly text: string,
    public readonly bpFileName: string,
  ) {
    this.evaluatedHash = null
    this.evaluatedContent = null
  }

  public resolveFilePath(): string | null {
    if (isAbsolute(this.filePath)) {
      return this.filePath
    }

    const bpDir = dirname(this.bpFileName)

    const assetPathInBpDir = `${bpDir}/${RESOURCES_PREFIX_DIRNAME}/${this.filePath}`

    if (existsSync(assetPathInBpDir)) {
      return assetPathInBpDir
    }

    const adapterRootFolder = this.bpFileName.split('/')[0]

    const assetPathInAdapterStaticDir = `${adapterRootFolder}/${RESOURCES_PREFIX_DIRNAME}/${this.filePath}`

    if (existsSync(assetPathInAdapterStaticDir)) {
      return assetPathInAdapterStaticDir
    }

    // TODO: Undefined > null
    return existsSync(this.filePath) ? this.filePath : null
  }

  get fileHash(): string {
    if (this.evaluatedHash) {
      return this.evaluatedHash
    }
    const content = this.fileContent

    this.evaluatedHash = sum.update(content).digest('hex')

    return this.evaluatedHash
  }

  get fileContent(): string {
    // TODO: Override this for non filesystem (like S3) ? Make Async?
    if (!this.evaluatedContent) {
      const resolvedFilePath = this.resolveFilePath()
      if (!resolvedFilePath) {
        throw new Error(`Unable to resolve static asset: '${this.filePath}'`)
      }
      this.evaluatedContent = readFileSync(resolvedFilePath, { encoding: 'utf-8' })
    }

    return this.evaluatedContent
  }

  get value(): Value {
    return this.text
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

export type Expression = ReferenceExpression | TemplateExpression | StaticAssetExpression

export type TemplatePart = string | Expression

export const isEqualValues = (first: Value, second: Value): boolean => _.isEqualWith(
  first,
  second,
  (f, s) => {
    if (f instanceof StaticAssetExpression || s instanceof StaticAssetExpression) {
      return f && s && isEqualValues(f.fileHash, s.fileHash)
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
