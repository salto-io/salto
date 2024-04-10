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
import { definitions, references as referenceUtils } from '@salto-io/adapter-components'
import { ReferenceContextStrategies, Options, CustomReferenceSerializationStrategyName } from './types'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  {
    src: { field: 'roleId', parentTypes: ['roleAssignment'] },
    serializationStrategy: 'roleId',
    target: { type: 'role' },
  },
  {
    src: { field: 'assignedTo', parentTypes: ['roleAssignment'] },
    serializationStrategy: 'id',
    target: { type: 'group' },
  },
  {
    src: { field: 'parentOrgUnitId', parentTypes: ['orgUnit'] },
    serializationStrategy: 'orgUnitId',
    target: { type: 'orgUnit' },
  },
  {
    src: { field: 'buildingId', parentTypes: ['room'] },
    serializationStrategy: 'buildingId',
    target: { type: 'building' },
  },
  {
    src: { field: 'name', parentTypes: ['room__featureInstances__feature'] },
    serializationStrategy: 'name',
    target: { type: 'feature' },
  },
  {
    src: { field: 'email', parentTypes: ['groupMember'] },
    serializationStrategy: 'email',
    target: { type: 'group' },
  },
]

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  serializationStrategyLookup: {
    roleId: {
      serialize: ({ ref }) => ref.value.value.roleId,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'roleId',
    },
    buildingId: {
      serialize: ({ ref }) => ref.value.value.buildingId,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'buildingId',
    },
    orgUnitId: {
      serialize: ({ ref }) => ref.value.value.orgUnitId,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'orgUnitId',
    },
    email: {
      serialize: ({ ref }) => ref.value.value.email,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'email',
    },
  },
  fieldsToGroupBy: ['id', 'roleId', 'buildingId', 'orgUnitId', 'email', 'name'],
}
