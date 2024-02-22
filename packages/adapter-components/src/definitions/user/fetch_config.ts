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
import {
  FieldDefinition,
  ObjectType,
  ElemID,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Field,
  ListType,
  MapType,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { ElemIDDefinition, FieldIDPart } from '../system/fetch/element'

export type DefaultFetchCriteria = {
  name?: string
}

type FetchEntry<T extends Record<string, unknown> | undefined> = {
  type: string
  criteria?: T
}

export type ElemIDCustomization = ElemIDDefinition & {
  // when true - appends the added fields to the system-defined ones
  // when false - overrides the system's default for the specified type
  extendSystemPartsDefinition?: boolean
}

export type UserFetchConfig<T extends Record<string, unknown> | undefined = DefaultFetchCriteria> = {
  include: FetchEntry<T>[]
  exclude: FetchEntry<T>[]
  hideTypes?: boolean
  // TODO deprecate and remove once the migration is complete and everything is async
  asyncPagination?: boolean
  // customize how to generate elem ids
  // TODO validate that the types are valid and top-level
  // TODO (informative, remove after discussions) - not using default+customizations to avoid questions about
  //   priorities between user default and system custom
  elemID?: Record<string, ElemIDCustomization>
}

export const createUserFetchConfigType = ({
  adapterName,
  additionalFields,
  fetchCriteriaType,
  omitElemID,
}: {
  adapterName: string
  additionalFields?: Record<string, FieldDefinition>
  fetchCriteriaType?: ObjectType
  omitElemID?: boolean
}): ObjectType => {
  const defaultFetchCriteriaType = createMatchingObjectType<DefaultFetchCriteria>({
    elemID: new ElemID(adapterName, 'FetchFilters'),
    fields: {
      name: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
  const fetchEntryType = createMatchingObjectType<FetchEntry<DefaultFetchCriteria>>({
    elemID: new ElemID(adapterName, 'FetchEntry'),
    fields: {
      type: {
        refType: BuiltinTypes.STRING,
        annotations: { _required: true },
      },
      criteria: {
        refType: defaultFetchCriteriaType,
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  if (fetchCriteriaType !== undefined) {
    fetchEntryType.fields.criteria = new Field(fetchEntryType, 'criteria', fetchCriteriaType)
  }

  const elemIDPartType = createMatchingObjectType<Omit<FieldIDPart, 'condition' | 'custom'>>({
    elemID: new ElemID(adapterName, 'ElemIDPart'),
    fields: {
      fieldName: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
      isReference: {
        refType: BuiltinTypes.BOOLEAN,
      },
      mapping: {
        refType: BuiltinTypes.STRING,
      },
    },
  })

  const elemIDCustomizationType = createMatchingObjectType<ElemIDCustomization>({
    elemID: new ElemID(adapterName, 'ElemIDCustomization'),
    fields: {
      extendsParent: {
        refType: BuiltinTypes.BOOLEAN,
      },
      extendSystemPartsDefinition: {
        refType: BuiltinTypes.BOOLEAN,
      },
      delimiter: {
        refType: BuiltinTypes.STRING,
      },
      parts: {
        refType: new ListType(elemIDPartType),
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const type = createMatchingObjectType<UserFetchConfig>({
    elemID: new ElemID(adapterName, 'userFetchConfig'),
    fields: {
      include: {
        refType: new ListType(fetchEntryType),
        annotations: { _required: true },
      },
      exclude: {
        refType: new ListType(fetchEntryType),
        annotations: { _required: true },
      },
      hideTypes: { refType: BuiltinTypes.BOOLEAN },
      asyncPagination: { refType: BuiltinTypes.BOOLEAN },
      elemID: { refType: new MapType(elemIDCustomizationType) },
      ...additionalFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
  if (omitElemID) {
    type.fields = _.omit(type.fields, 'elemID')
  }
  return type
}
