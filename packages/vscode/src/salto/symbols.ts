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
import { EditorRange, PositionContext } from './context'
import { isIndexPathPart } from '@salto-io/adapter-api'

export enum SaltoSymbolKind {
  File,
  Type,
  Field,
  Array,
  Instance,
  Annotation,
  Attribute
}

export interface SaltoSymbol {
  name: string
  type: SaltoSymbolKind
  range: EditorRange
}

const getSaltoSymbolName = (context: PositionContext): string => {
  if (context.ref) {
    const fullName = _.last(context.ref.path) || context.ref.element.elemID.name
    return isIndexPathPart(fullName) ? `[${fullName}]` : fullName
  }
  return 'global'
}

const getSaltoSymbolKind = (context: PositionContext): SaltoSymbolKind => {
  if (context.ref && context.ref.isList) return SaltoSymbolKind.Array
  if (context.type === 'field') {
    return (context.ref && !_.isEmpty(context.ref.path))
      ? SaltoSymbolKind.Annotation
      : SaltoSymbolKind.Field
  }
  if (context.type === 'instance') {
    return (context.ref && !_.isEmpty(context.ref.path))
      ? SaltoSymbolKind.Attribute
      : SaltoSymbolKind.Instance
  }
  if (context.type === 'type') {
    return (context.ref && !_.isEmpty(context.ref.path))
      ? SaltoSymbolKind.Annotation
      : SaltoSymbolKind.Type
  }
  return SaltoSymbolKind.File
}

export const createSaltoSymbol = (
  context: PositionContext,
): SaltoSymbol => {
  const name = getSaltoSymbolName(context)
  const type = getSaltoSymbolKind(context)
  return { name, type, range: context.range }
}
