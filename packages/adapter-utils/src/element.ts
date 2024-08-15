/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  Element,
  CORE_ANNOTATIONS,
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

export const getElementPrettyName = (element: Element): string =>
  element.annotations[CORE_ANNOTATIONS.ALIAS] ?? element.elemID.name
