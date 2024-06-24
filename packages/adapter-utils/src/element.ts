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
import {
  ObjectType,
  FieldDefinition,
  PrimitiveType,
  ListType,
  MapType,
  PrimitiveTypes,
  TypeElement,
  TypeReference,
} from '@salto-io/adapter-api'
import { types } from '@salto-io/lowerdash'

type SaltoPrimitiveTypeForType<T> = T extends string
  ? PrimitiveTypes.STRING
  : T extends number
    ? PrimitiveTypes.NUMBER
    : T extends boolean
      ? PrimitiveTypes.BOOLEAN
      : PrimitiveTypes.UNKNOWN

type RecordOf<T, S> = string extends keyof T ? Record<string, S> : never

type SaltoTypeForType<T> =
  T extends Array<infer U>
    ? ListType<TypeElement & SaltoTypeForType<U>>
    : T extends string | number | boolean | undefined
      ? PrimitiveType<SaltoPrimitiveTypeForType<T>>
      : T extends Record<string, infer U> & RecordOf<T, infer U>
        ? MapType<TypeElement & SaltoTypeForType<U>>
        : T extends {}
          ? ObjectType
          : unknown

type OptionalKeys<T> = types.KeysOfExtendingType<T, undefined>

type SaltoAnnotationsForField<T, K> =
  K extends OptionalKeys<T> ? { annotations?: { _required?: false } } : { annotations: { _required: true } }

type ObjectTypeCtorForType<T> = Omit<ConstructorParameters<typeof ObjectType>[0], 'fields'> & {
  fields: {
    [K in keyof Required<T>]: FieldDefinition & {
      refType: SaltoTypeForType<T[K]> | TypeReference
    } & SaltoAnnotationsForField<T, K>
  }
}

/**
 * Create an object type with fields that match a typescript type
 */
export const createMatchingObjectType = <T>(params: ObjectTypeCtorForType<T>): ObjectType => new ObjectType(params)
