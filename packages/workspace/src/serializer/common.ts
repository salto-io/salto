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
import {
  InstanceElement, ObjectType, Variable, PrimitiveType, ListType, Field,
  TemplateExpression, ReferenceExpression, VariableExpression, StaticFile, ElemID,
} from '@salto-io/adapter-api'

export const CLASS_FIELD = '_salto_class'

export type NonFunctionProperties<T> = Omit<T, types.FunctionPropertyNames<T>>

// Can't use MyClass.constructor.name because it gets mangled by webpack
const serializedClasses: [({ prototype: object }), string][] = [
  [ElemID, 'ElemID'],
  [InstanceElement, 'InstanceElement'],
  [ObjectType, 'ObjectType'],
  [Variable, 'Variable'],
  [PrimitiveType, 'PrimitiveType'],
  [ListType, 'ListType'],
  [Field, 'Field'],
  [TemplateExpression, 'TemplateExpression'],
  [ReferenceExpression, 'ReferenceExpression'],
  [VariableExpression, 'VariableExpression'],
  [StaticFile, 'StaticFile'],
]

export const prototypeToClassName: [object, string][] = serializedClasses
  .map(([cls, name]) => [cls.prototype, name])
