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
import { FileProperties } from '@salto-io/jsforce'
import _ from 'lodash'
import { types } from '@salto-io/lowerdash'
import {
  ASSIGNMENT_RULE_METADATA_TYPE,
  AUTO_RESPONSE_RULE_METADATA_TYPE,
  CUSTOM_FIELD,
  CUSTOM_LABEL_METADATA_TYPE,
  CUSTOM_OBJECT,
  ESCALATION_RULE_TYPE,
  TYPES_WITH_NESTED_INSTANCES,
  TYPES_WITH_NESTED_INSTANCES_PER_PARENT,
} from './constants'
import SalesforceClient from './client/client'
import {
  LastChangeDateOfTypesWithNestedInstances,
  MetadataQuery,
  TypeWithNestedInstances,
  TypeWithNestedInstancesPerParent,
} from './types'
import {
  CUSTOM_OBJECT_FIELDS,
  WORKFLOW_FIELDS,
} from './fetch_profile/metadata_types'
import {
  getMostRecentFileProperties,
  listMetadataObjects,
} from './filters/utils'
import { SHARING_RULES_API_NAMES } from './filters/author_information/sharing_rules'

type GetLastChangeDateOfTypesWithNestedInstancesParams = {
  client: SalesforceClient
  metadataQuery: MetadataQuery<FileProperties>
}

type TypeToNestedTypes = {
  [key in keyof LastChangeDateOfTypesWithNestedInstances]: types.NonEmptyArray<string>
}

type PromiseByType = {
  [key in keyof LastChangeDateOfTypesWithNestedInstances]: Promise<
    LastChangeDateOfTypesWithNestedInstances[key]
  >
}

export const isTypeWithNestedInstances = (
  typeName: string,
): typeName is TypeWithNestedInstances =>
  (TYPES_WITH_NESTED_INSTANCES as ReadonlyArray<string>).includes(typeName)

export const isTypeWithNestedInstancesPerParent = (
  typeName: string,
): typeName is TypeWithNestedInstancesPerParent =>
  (TYPES_WITH_NESTED_INSTANCES_PER_PARENT as ReadonlyArray<string>).includes(
    typeName,
  )

export const TYPE_TO_NESTED_TYPES: TypeToNestedTypes = {
  AssignmentRules: [ASSIGNMENT_RULE_METADATA_TYPE],
  AutoResponseRules: [AUTO_RESPONSE_RULE_METADATA_TYPE],
  CustomLabels: [CUSTOM_LABEL_METADATA_TYPE],
  CustomObject: [...CUSTOM_OBJECT_FIELDS, CUSTOM_OBJECT, CUSTOM_FIELD],
  EscalationRules: [ESCALATION_RULE_TYPE],
  SharingRules: [...SHARING_RULES_API_NAMES],
  Workflow: [...WORKFLOW_FIELDS],
}

export const getLastChangeDateOfTypesWithNestedInstances = async ({
  client,
  metadataQuery,
}: GetLastChangeDateOfTypesWithNestedInstancesParams): Promise<LastChangeDateOfTypesWithNestedInstances> => {
  const lastChangeDateOfTypeWithNestedInstancesPerParent = async (
    type: TypeWithNestedInstancesPerParent,
    relatedTypes: types.NonEmptyArray<string>,
  ): Promise<Record<string, string>> => {
    if (!metadataQuery.isTypeMatch(type)) {
      return {}
    }
    const allProps = (
      await Promise.all(
        relatedTypes.map((typeName) => listMetadataObjects(client, typeName)),
      )
    ).flatMap((result) => result.elements)
    const relatedPropsByParent = _.groupBy(
      allProps,
      (fileProp) => fileProp.fullName.split('.')[0],
    )
    const result: Record<string, string> = {}
    Object.entries(relatedPropsByParent).forEach(([parentName, fileProps]) => {
      const latestChangeProps = getMostRecentFileProperties(fileProps)
      if (latestChangeProps !== undefined) {
        result[parentName] = latestChangeProps.lastModifiedDate
      }
    })
    return result
  }

  const lastChangeDateOfTypeWithNestedInstances = async (
    type: TypeWithNestedInstances,
    relatedTypes: types.NonEmptyArray<string>,
  ): Promise<string | undefined> => {
    if (!metadataQuery.isTypeMatch(type)) {
      return undefined
    }
    const allProps = (
      await Promise.all(
        relatedTypes.map((typeName) => listMetadataObjects(client, typeName)),
      )
    ).flatMap((result) => result.elements)
    return getMostRecentFileProperties(allProps)?.lastModifiedDate
  }

  const promisedByType: PromiseByType = {
    AssignmentRules: lastChangeDateOfTypeWithNestedInstancesPerParent(
      'AssignmentRules',
      TYPE_TO_NESTED_TYPES.AssignmentRules,
    ),
    AutoResponseRules: lastChangeDateOfTypeWithNestedInstancesPerParent(
      'AutoResponseRules',
      TYPE_TO_NESTED_TYPES.AutoResponseRules,
    ),
    CustomObject: lastChangeDateOfTypeWithNestedInstancesPerParent(
      'CustomObject',
      TYPE_TO_NESTED_TYPES.CustomObject,
    ),
    EscalationRules: lastChangeDateOfTypeWithNestedInstancesPerParent(
      'EscalationRules',
      TYPE_TO_NESTED_TYPES.EscalationRules,
    ),
    SharingRules: lastChangeDateOfTypeWithNestedInstancesPerParent(
      'SharingRules',
      TYPE_TO_NESTED_TYPES.SharingRules,
    ),
    Workflow: lastChangeDateOfTypeWithNestedInstancesPerParent(
      'Workflow',
      TYPE_TO_NESTED_TYPES.Workflow,
    ),
    CustomLabels: lastChangeDateOfTypeWithNestedInstances(
      'CustomLabels',
      TYPE_TO_NESTED_TYPES.CustomLabels,
    ),
  }
  await Promise.all(Object.values(promisedByType) as Promise<unknown>[])
  return {
    AssignmentRules: await promisedByType.AssignmentRules,
    AutoResponseRules: await promisedByType.AutoResponseRules,
    CustomObject: await promisedByType.CustomObject,
    EscalationRules: await promisedByType.EscalationRules,
    SharingRules: await promisedByType.SharingRules,
    Workflow: await promisedByType.Workflow,
    CustomLabels: await promisedByType.CustomLabels,
  }
}
