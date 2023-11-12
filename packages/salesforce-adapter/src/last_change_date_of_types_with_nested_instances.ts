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
import { FileProperties } from 'jsforce'
import _ from 'lodash'
import {
  ASSIGNMENT_RULE_METADATA_TYPE,
  ASSIGNMENT_RULES_METADATA_TYPE,
  AUTO_RESPONSE_RULE_METADATA_TYPE,
  AUTO_RESPONSE_RULES_METADATA_TYPE,
  CUSTOM_FIELD,
  CUSTOM_LABEL_METADATA_TYPE,
  CUSTOM_LABELS_METADATA_TYPE,
  CUSTOM_OBJECT,
  ESCALATION_RULE_TYPE,
  ESCALATION_RULES_TYPE,
  SHARING_RULE_METADATA_TYPE,
  SHARING_RULES_TYPE,
  WORKFLOW_METADATA_TYPE,
} from './constants'
import SalesforceClient from './client/client'
import { LastChangeDateOfTypesWithNestedInstances, MetadataQuery } from './types'
import { CUSTOM_OBJECT_FIELDS, WORKFLOW_FIELDS } from './fetch_profile/metadata_types'
import { getMostRecentFileProperties, listMetadataObjects } from './filters/utils'


type GetLastChangeDateOfTypesWithNestedInstancesParams = {
  client: SalesforceClient
  metadataQuery: MetadataQuery<FileProperties>
}


const getLastChangeDateByParent = (allProps: FileProperties[]): Record<string, string> => {
  const relatedPropsByParent = _.groupBy(
    allProps,
    fileProp => fileProp.fullName.split('.')[0],
  )
  const result: Record<string, string> = {}
  Object.entries(relatedPropsByParent)
    .forEach(([parentName, fileProps]) => {
      const latestChangeProps = getMostRecentFileProperties(fileProps)
      if (latestChangeProps !== undefined) {
        result[parentName] = latestChangeProps.lastModifiedDate
      }
    })
  return result
}

export const getLastChangeDateOfTypesWithNestedInstances = async ({
  client,
  metadataQuery,
}: GetLastChangeDateOfTypesWithNestedInstancesParams): Promise<LastChangeDateOfTypesWithNestedInstances> => {
  const lastChangeDateOfCustomObjectTypes = async (): Promise<Record<string, string> | undefined> => {
    if (!metadataQuery.isTypeMatch(CUSTOM_OBJECT)) {
      return undefined
    }
    const allProps = (await Promise.all(
      [
        ...CUSTOM_OBJECT_FIELDS,
        CUSTOM_OBJECT,
      ].filter(type => metadataQuery.isTypeMatch(type))
        // This CustomField type is excluded by default. Listing CustomFields is mandatory when listing CustomObjects
        .concat(CUSTOM_FIELD)
        .map(typeName => listMetadataObjects(client, typeName))
    )).flatMap(result => result.elements)
      .filter(fileProp => metadataQuery.isInstanceIncluded(fileProp))
    return getLastChangeDateByParent(allProps)
  }
  const lastChangeDateOfCustomLabels = async (): Promise<string | undefined> => {
    if (!metadataQuery.isTypeMatch(CUSTOM_LABELS_METADATA_TYPE)) {
      return undefined
    }
    const fileProps = (await listMetadataObjects(client, CUSTOM_LABEL_METADATA_TYPE))
      .elements
      .filter(fileProp => metadataQuery.isInstanceIncluded(fileProp))
    return getMostRecentFileProperties(fileProps)?.lastModifiedDate
  }
  const lastChangeDateOfAssignmentRules = async (): Promise<Record<string, string> | undefined> => {
    if (!metadataQuery.isTypeMatch(ASSIGNMENT_RULES_METADATA_TYPE)) {
      return undefined
    }
    const allProps = (await listMetadataObjects(client, ASSIGNMENT_RULE_METADATA_TYPE))
      .elements
      .filter(fileProp => metadataQuery.isInstanceIncluded(fileProp))
    return getLastChangeDateByParent(allProps)
  }

  const lastChangeDateOfAutoResponseRules = async (): Promise<Record<string, string> | undefined> => {
    if (!metadataQuery.isTypeMatch(AUTO_RESPONSE_RULES_METADATA_TYPE)) {
      return undefined
    }
    const allProps = (await listMetadataObjects(client, AUTO_RESPONSE_RULE_METADATA_TYPE))
      .elements
      .filter(fileProp => metadataQuery.isInstanceIncluded(fileProp))
    return getLastChangeDateByParent(allProps)
  }

  const lastChangeDateOfSharingRules = async (): Promise<Record<string, string> | undefined> => {
    if (!metadataQuery.isTypeMatch(SHARING_RULES_TYPE)) {
      return undefined
    }
    const allProps = (await listMetadataObjects(client, SHARING_RULE_METADATA_TYPE))
      .elements
      .filter(fileProp => metadataQuery.isInstanceIncluded(fileProp))
    return getLastChangeDateByParent(allProps)
  }

  const lastChangeDateOfEscalationRules = async (): Promise<Record<string, string> | undefined> => {
    if (!metadataQuery.isTypeMatch(ESCALATION_RULES_TYPE)) {
      return undefined
    }
    const allProps = (await listMetadataObjects(client, ESCALATION_RULE_TYPE))
      .elements
      .filter(fileProp => metadataQuery.isInstanceIncluded(fileProp))
    return getLastChangeDateByParent(allProps)
  }

  const lastChangeDateOfWorkflows = async (): Promise<Record<string, string> | undefined> => {
    if (!metadataQuery.isTypeMatch(WORKFLOW_METADATA_TYPE)) {
      return undefined
    }
    const allProps = (await Promise.all(
      [
        ...WORKFLOW_FIELDS,
      ].filter(type => metadataQuery.isTypeMatch(type))
        .map(typeName => listMetadataObjects(client, typeName))
    )).flatMap(result => result.elements)
      .filter(fileProp => metadataQuery.isInstanceIncluded(fileProp))
    return getLastChangeDateByParent(allProps)
  }

  const promisedByType = {
    [CUSTOM_OBJECT]: lastChangeDateOfCustomObjectTypes(),
    [CUSTOM_LABELS_METADATA_TYPE]: lastChangeDateOfCustomLabels(),
    [ASSIGNMENT_RULES_METADATA_TYPE]: lastChangeDateOfAssignmentRules(),
    [AUTO_RESPONSE_RULES_METADATA_TYPE]: lastChangeDateOfAutoResponseRules(),
    [SHARING_RULES_TYPE]: lastChangeDateOfSharingRules(),
    [ESCALATION_RULES_TYPE]: lastChangeDateOfEscalationRules(),
    [WORKFLOW_METADATA_TYPE]: lastChangeDateOfWorkflows(),
  }
  await Promise.all(Object.values(promisedByType) as Promise<unknown>[])
  return {
    [CUSTOM_OBJECT]: await promisedByType[CUSTOM_OBJECT],
    [CUSTOM_LABELS_METADATA_TYPE]: await promisedByType[CUSTOM_LABELS_METADATA_TYPE],
    [ASSIGNMENT_RULES_METADATA_TYPE]: await promisedByType[ASSIGNMENT_RULES_METADATA_TYPE],
    [AUTO_RESPONSE_RULES_METADATA_TYPE]: await promisedByType[AUTO_RESPONSE_RULES_METADATA_TYPE],
    [SHARING_RULES_TYPE]: await promisedByType[SHARING_RULES_TYPE],
    [ESCALATION_RULES_TYPE]: await promisedByType[ESCALATION_RULES_TYPE],
    [WORKFLOW_METADATA_TYPE]: await promisedByType[WORKFLOW_METADATA_TYPE],
  }
}
