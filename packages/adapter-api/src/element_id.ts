/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS } from './core_annotations'

export type ElemIDType = 'type' | 'field' | 'instance' | 'attr' | 'annotation' | 'var'
export const ElemIDTypes = ['type', 'field', 'instance', 'attr', 'annotation', 'var'] as ReadonlyArray<string>
export const isElemIDType = (v: string): v is ElemIDType => ElemIDTypes.includes(v)
export const MAP_ID_PREFIX = 'Map'
export const LIST_ID_PREFIX = 'List'
export const GENERIC_ID_PREFIX = '<'
export const GENERIC_ID_SUFFIX = '>'
export const GLOBAL_ADAPTER = ''

export type ContainerTypeName = 'Map' | 'List'
const CONTAINER_PREFIXES = [MAP_ID_PREFIX, LIST_ID_PREFIX]
const CONTAINER_PARTS_REGEX = new RegExp(`^(${CONTAINER_PREFIXES.join('|')})${GENERIC_ID_PREFIX}(.+)${GENERIC_ID_SUFFIX}$`)

export const INSTANCE_ANNOTATIONS = {
  DEPENDS_ON: CORE_ANNOTATIONS.DEPENDS_ON,
  PARENT: CORE_ANNOTATIONS.PARENT,
  GENERATED_DEPENDENCIES: CORE_ANNOTATIONS.GENERATED_DEPENDENCIES,
  HIDDEN: CORE_ANNOTATIONS.HIDDEN,
  SERVICE_URL: CORE_ANNOTATIONS.SERVICE_URL,
  CREATED_BY: CORE_ANNOTATIONS.CREATED_BY,
  CREATED_AT: CORE_ANNOTATIONS.CREATED_AT,
  CHANGED_BY: CORE_ANNOTATIONS.CHANGED_BY,
  CHANGED_AT: CORE_ANNOTATIONS.CHANGED_AT,
  ALIAS: CORE_ANNOTATIONS.ALIAS,
}

type ContainerPrefixAndInnerType = {
  prefix: ContainerTypeName
  innerTypeName: string
}
const getContainerPrefix = (fullName: string): ContainerPrefixAndInnerType | undefined => {
  const [prefix, innerTypeName] = fullName.match(CONTAINER_PARTS_REGEX)?.slice(1) ?? []
  if (prefix !== undefined && innerTypeName !== undefined) {
    return { prefix: prefix as ContainerTypeName, innerTypeName }
  }
  return undefined
}

const getInnerTypePrefixStartIndex = (fullName: string): number => {
  const nestedMap = fullName.lastIndexOf(`${MAP_ID_PREFIX}${GENERIC_ID_PREFIX}`)
  const nestedList = fullName.lastIndexOf(`${LIST_ID_PREFIX}${GENERIC_ID_PREFIX}`)
  if (nestedList > nestedMap) {
    return nestedList + `${LIST_ID_PREFIX}${GENERIC_ID_PREFIX}`.length
  }
  if (nestedMap > nestedList) {
    return nestedMap + `${MAP_ID_PREFIX}${GENERIC_ID_PREFIX}`.length
  }
  return -1
}

export class ElemID {
  static readonly NAMESPACE_SEPARATOR = '.'
  static readonly NUM_ELEM_ID_NON_NAME_PARTS = 3
  static readonly CONFIG_NAME = '_config'
  static readonly VARIABLES_NAMESPACE = 'var'
  static readonly TOP_LEVEL_ID_TYPES_WITH_NAME = ['instance']
  static readonly TOP_LEVEL_ID_TYPES = ['type', 'var']

  static getDefaultIdType = (adapter: string): ElemIDType => (adapter === ElemID.VARIABLES_NAMESPACE ? 'var' : 'type')

  static fromFullName(fullName: string): ElemID {
    const containerNameParts = getContainerPrefix(fullName)
    if (containerNameParts !== undefined) {
      return new ElemID(GLOBAL_ADAPTER, fullName)
    }
    const [adapter, typeName, idType, ...name] = fullName.split(ElemID.NAMESPACE_SEPARATOR)
    if (idType === undefined) {
      return new ElemID(adapter, typeName)
    }
    if (!isElemIDType(idType)) {
      throw new Error(`Cannot create ID ${fullName} - Invalid ID type ${idType}`)
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

  // This assumes List</Map< will only be in container types' ElemID and that they have closing >
  static getTypeOrContainerTypeID = (elemID: ElemID): ElemID => {
    const fullName = elemID.getFullName()
    const deepInnerTypeStart = getInnerTypePrefixStartIndex(fullName)
    const deepInnerTypeEnd = fullName.indexOf(GENERIC_ID_SUFFIX)
    if (deepInnerTypeStart === -1 && deepInnerTypeEnd === -1) {
      return elemID
    }
    if (deepInnerTypeStart === -1 || deepInnerTypeEnd < deepInnerTypeStart) {
      throw new Error(`Invalid < > structure in ElemID - ${fullName}`)
    }
    return ElemID.fromFullName(fullName.slice(
      deepInnerTypeStart,
      deepInnerTypeEnd
    ))
  }

  readonly adapter: string
  readonly typeName: string
  readonly idType: ElemIDType
  private readonly nameParts: ReadonlyArray<string>
  private readonly fullName: string
  constructor(
    adapter: string,
    typeName?: string,
    idType?: ElemIDType,
    ...name: ReadonlyArray<string>
  ) {
    this.adapter = adapter
    this.typeName = _.isEmpty(typeName) ? ElemID.CONFIG_NAME : typeName as string
    this.idType = idType || ElemID.getDefaultIdType(adapter)
    this.nameParts = name
    this.fullName = this.generateFullName()
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
    if (this.isAnnotationTypeID()) {
      // annotation is already 1 level nested
      return this.nameParts.length + 1
    }
    return this.nameParts.length
  }

  private fullNameParts(): string[] {
    const parts = ElemID.TOP_LEVEL_ID_TYPES.includes(this.idType)
      ? [this.adapter, this.typeName]
      : [this.adapter, this.typeName, this.idType, ...this.nameParts]
    return parts.filter(part => !_.isEmpty(part)) as string[]
  }

  private generateFullName(): string {
    const nameParts = this.fullNameParts()
    return nameParts
      // If the last part of the name is empty we can omit it
      .filter((part, idx) => idx !== nameParts.length - 1 || part !== ElemID.CONFIG_NAME)
      .join(ElemID.NAMESPACE_SEPARATOR)
  }

  getFullName(): string {
    return this.fullName
  }

  getFullNameParts(): string[] {
    const nameParts = this.fullNameParts()
    return nameParts
      // If the last part of the name is empty we can omit it
      .filter((part, idx) => idx !== nameParts.length - 1 || part !== ElemID.CONFIG_NAME)
  }

  isConfig(): boolean {
    return this.typeName === ElemID.CONFIG_NAME
  }

  isTopLevel(): boolean {
    return ElemID.TOP_LEVEL_ID_TYPES.includes(this.idType)
      || (ElemID.TOP_LEVEL_ID_TYPES_WITH_NAME.includes(this.idType)
        && this.nameParts.length === 1)
  }

  isBaseID(): boolean {
    return (this.idType === 'field' && this.nameParts.length === 1) || this.isTopLevel()
  }

  isEqual(other: ElemID): boolean {
    return this.getFullName() === other.getFullName()
  }

  isParentOf(other: ElemID): boolean {
    if (other.isTopLevel() || this.nestingLevel >= other.nestingLevel) {
      return false
    }
    const sameLevelID = other.createParentID(other.nestingLevel - this.nestingLevel)
    return this.isEqual(sameLevelID)
  }

  createNestedID(...nameParts: string[]): ElemID {
    if (ElemID.TOP_LEVEL_ID_TYPES.includes(this.idType)) {
      const newIdName = [...this.fullNameParts(), ...nameParts].join(ElemID.NAMESPACE_SEPARATOR)
      if (this.idType === 'var') {
        throw new Error(`Cannot create nested ID ${newIdName} - object variables are not supported`)
      }
      // IDs nested under type IDs should have a different type
      const [nestedIDType, ...nestedNameParts] = nameParts
      if (!isElemIDType(nestedIDType)) {
        throw new Error(`Cannot create nested ID ${newIdName} - Invalid ID type ${nestedIDType}`)
      }
      return new ElemID(this.adapter, this.typeName, nestedIDType, ...nestedNameParts)
    }
    return new ElemID(this.adapter, this.typeName, this.idType, ...this.nameParts, ...nameParts)
  }

  createParentID(numLevels = 1): ElemID {
    if (numLevels < 1) {
      throw new Error(`Invalid argument to "createParentID" - numLevels=${numLevels} must be a positive number`)
    }
    const newNameParts = this.nameParts.slice(0, -1 * numLevels)
    if (!_.isEmpty(newNameParts)) {
      // Parent should have the same type as this ID
      return new ElemID(this.adapter, this.typeName, this.idType, ...newNameParts)
    }
    if (this.isTopLevel()) {
      // The parent of top level elements is the adapter
      return new ElemID(this.adapter)
    }
    if (this.isAnnotationTypeID() && this.nameParts.length === numLevels) {
      // The parent of an annotationType is annotationTypes
      return new ElemID(this.adapter, this.typeName, this.idType)
    }
    // The parent of all other id types is the type
    return new ElemID(this.adapter, this.typeName)
  }

  createAllElemIdParents(): ElemID[] {
    return this.isTopLevel()
      ? [this]
      : [this, ...this.createParentID().createAllElemIdParents()]
  }

  createTopLevelParentID(): { parent: ElemID; path: ReadonlyArray<string> } {
    if (this.isTopLevel()) {
      // This is already the top level ID
      return { parent: this, path: [] }
    }
    if (ElemID.TOP_LEVEL_ID_TYPES_WITH_NAME.includes(this.idType)) {
      // Instance is a top level ID, the name of the instance is always the first name part
      return {
        parent: new ElemID(this.adapter, this.typeName, this.idType, this.nameParts[0]),
        path: this.nameParts.slice(1),
      }
    }
    // Everything other than instance is nested under type
    return { parent: new ElemID(this.adapter, this.typeName), path: this.nameParts }
  }

  createBaseID(): { parent: ElemID; path: ReadonlyArray<string> } {
    const { parent, path } = this.createTopLevelParentID()
    if (this.idType === 'field') {
      const [fieldName, ...fieldPath] = this.nameParts
      return {
        parent: parent.createNestedID('field', fieldName),
        path: fieldPath,
      }
    }
    return { parent, path }
  }

  getRelativePath(other: ElemID): ReadonlyArray<string> {
    if (!this.isEqual(other) && !this.isParentOf(other)) {
      throw new Error(`Cannot get relative path of ${this.getFullName()} and ${other.getFullName()
      } - ${this.getFullName()} is not parent of ${other.getFullName()}`)
    }
    const relPath = other.createTopLevelParentID().path.slice(this.nestingLevel)
    return this.idType === 'type' && ['attr', 'annotation', 'field'].includes(other.idType)
      ? [other.idType as string].concat(relPath)
      : relPath
  }

  replaceParentId(newParent: ElemID): ElemID {
    const relativeId = this.fullNameParts().splice(newParent.fullNameParts().length)
    return relativeId.length !== 0
      ? newParent.createNestedID(...relativeId)
      : newParent
  }

  isAttrID(): boolean {
    return this.idType === 'attr'
      || (
        this.idType === 'instance'
        && Object.values(INSTANCE_ANNOTATIONS).includes(this.nameParts[1])
      )
  }

  isAnnotationTypeID(): boolean {
    return this.idType === 'annotation'
  }

  getContainerPrefixAndInnerType(): ContainerPrefixAndInnerType | undefined {
    if (this.adapter === GLOBAL_ADAPTER && this.idType === 'type') {
      return getContainerPrefix(this.typeName)
    }
    return undefined
  }
}
