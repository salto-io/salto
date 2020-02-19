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

export type ElemIDType = 'type' | 'field' | 'instance' | 'attr' | 'annotation'
export const ElemIDTypes = ['type', 'field', 'instance', 'attr', 'annotation'] as ReadonlyArray<string>
export const isElemIDType = (v: string): v is ElemIDType => ElemIDTypes.includes(v)

export class ElemID {
  static readonly NAMESPACE_SEPARATOR = '.'
  static readonly CONFIG_NAME = '_config'

  static fromFullName(fullName: string): ElemID {
    const [adapter, typeName, idType, ...name] = fullName.split(ElemID.NAMESPACE_SEPARATOR)
    if (idType === undefined) {
      return new ElemID(adapter, typeName)
    }
    if (!isElemIDType(idType)) {
      throw new Error(`Invalid ID type ${idType}`)
    }
    if (idType === 'instance' && _.isEmpty(name)) {
      // This is a config instance (the last name part is omitted)
      return new ElemID(adapter, typeName, idType, ElemID.CONFIG_NAME)
    }
    return new ElemID(adapter, typeName, idType, ...name)
  }

  static fromFullNameParts(nameParts: string[]): ElemID {
    return ElemID.fromFullName(nameParts.join(ElemID.NAMESPACE_SEPARATOR))
  }

  readonly adapter: string
  readonly typeName: string
  readonly idType: ElemIDType
  private readonly nameParts: ReadonlyArray<string>
  constructor(
    adapter: string,
    typeName?: string,
    idType?: ElemIDType,
    ...name: ReadonlyArray<string>
  ) {
    this.adapter = adapter
    this.typeName = _.isEmpty(typeName) ? ElemID.CONFIG_NAME : typeName as string
    this.idType = idType || 'type'
    this.nameParts = name
  }

  get name(): string {
    return this.fullNameParts().slice(-1)[0]
  }

  get nestingLevel(): number {
    if (this.isTopLevel()) {
      return 0
    }
    if (this.idType === 'instance') {
      // First name part is the instance name which is top level
      return this.nameParts.length - 1
    }
    if (this.idType === 'annotation') {
      // annotation is already 1 level nested
      return this.nameParts.length + 1
    }
    return this.nameParts.length
  }

  private fullNameParts(): string[] {
    const parts = this.idType === 'type'
      ? [this.adapter, this.typeName]
      : [this.adapter, this.typeName, this.idType, ...this.nameParts]
    return parts.filter(part => !_.isEmpty(part)) as string[]
  }

  getFullName(): string {
    const nameParts = this.fullNameParts()
    return this.fullNameParts()
      // If the last part of the name is empty we can omit it
      .filter((part, idx) => idx !== nameParts.length - 1 || part !== ElemID.CONFIG_NAME)
      .join(ElemID.NAMESPACE_SEPARATOR)
  }

  getFullNameParts(): string[] {
    const nameParts = this.fullNameParts()
    return this.fullNameParts()
      // If the last part of the name is empty we can omit it
      .filter((part, idx) => idx !== nameParts.length - 1 || part !== ElemID.CONFIG_NAME)
  }

  isConfig(): boolean {
    return this.typeName === ElemID.CONFIG_NAME
  }

  isTopLevel(): boolean {
    return this.idType === 'type'
      || (this.idType === 'instance' && this.nameParts.length === 1)
  }

  isEqual(other: ElemID): boolean {
    return this.getFullName() === other.getFullName()
  }

  createNestedID(...nameParts: string[]): ElemID {
    if (this.idType === 'type') {
      // IDs nested under type IDs should have a different type
      const [nestedIDType, ...nestedNameParts] = nameParts
      if (!isElemIDType(nestedIDType)) {
        throw new Error(`Invalid ID type ${nestedIDType}`)
      }
      return new ElemID(this.adapter, this.typeName, nestedIDType, ...nestedNameParts)
    }
    return new ElemID(this.adapter, this.typeName, this.idType, ...this.nameParts, ...nameParts)
  }

  createParentID(): ElemID {
    const newNameParts = this.nameParts.slice(0, -1)
    if (!_.isEmpty(newNameParts)) {
      // Parent should have the same type as this ID
      return new ElemID(this.adapter, this.typeName, this.idType, ...newNameParts)
    }
    if (this.isTopLevel()) {
      // The parent of top level elements is the adapter
      return new ElemID(this.adapter)
    }
    if (this.idType === 'annotation' && this.nameParts.length === 1) {
      // The parent of an annotationType is annotationTypes
      return new ElemID(this.adapter, this.typeName, this.idType)
    }
    // The parent of all other id types is the type
    return new ElemID(this.adapter, this.typeName)
  }

  createTopLevelParentID(): { parent: ElemID; path: ReadonlyArray<string> } {
    if (this.isTopLevel()) {
      // This is already the top level ID
      return { parent: this, path: [] }
    }
    if (this.idType === 'instance') {
      // Instance is a top level ID, the name of the instance is always the first name part
      return {
        parent: new ElemID(this.adapter, this.typeName, this.idType, this.nameParts[0]),
        path: this.nameParts.slice(1),
      }
    }
    // Everything other than instance is nested under type
    return { parent: new ElemID(this.adapter, this.typeName), path: this.nameParts }
  }
}
