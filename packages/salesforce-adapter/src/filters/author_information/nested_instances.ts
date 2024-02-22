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
import { Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { RemoteFilterCreator } from '../../filter'
import {
  apiNameSync,
  ensureSafeFilterFetch,
  isMetadataInstanceElementSync,
} from '../utils'
import { WORKFLOW_FIELD_TO_TYPE } from '../workflow'
import { NESTED_INSTANCE_VALUE_TO_TYPE_NAME } from '../custom_objects_to_object_type'
import {
  getAuthorAnnotations,
  MetadataInstanceElement,
} from '../../transformers/transformer'
import SalesforceClient from '../../client/client'

const log = logger(module)

export const WARNING_MESSAGE =
  'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.'

const NESTED_INSTANCES_METADATA_TYPES = [
  'CustomLabel',
  'AssignmentRule',
  'AutoResponseRule',
  'EscalationRule',
  'MatchingRule',
  ...Object.values(WORKFLOW_FIELD_TO_TYPE),
  ...Object.values(NESTED_INSTANCE_VALUE_TO_TYPE_NAME),
] as const

type NestedInstanceMetadataType =
  (typeof NESTED_INSTANCES_METADATA_TYPES)[number]

type SetAuthorInformationForTypeParams = {
  client: SalesforceClient
  typeName: NestedInstanceMetadataType
  instances: MetadataInstanceElement[]
}

const setAuthorInformationForInstancesOfType = async ({
  client,
  typeName,
  instances,
}: SetAuthorInformationForTypeParams): Promise<void> => {
  const { result: filesProps } = await client.listMetadataObjects([
    { type: typeName },
  ])
  const filePropsByFullName = _.keyBy(filesProps, (props) => props.fullName)
  const instancesWithMissingFileProps: MetadataInstanceElement[] = []
  instances.forEach((instance) => {
    const instanceFullName = apiNameSync(instance)
    if (instanceFullName === undefined) {
      return
    }
    const fileProps = filePropsByFullName[instanceFullName]
    if (fileProps === undefined) {
      instancesWithMissingFileProps.push(instance)
      return
    }
    Object.assign(instance.annotations, getAuthorAnnotations(fileProps))
  })
  if (instancesWithMissingFileProps.length > 0) {
    log.debug(
      `Failed to populate author information for the following ${typeName} instances: ${instancesWithMissingFileProps.map((instance) => apiNameSync(instance)).join(', ')}`,
    )
  }
}

/*
 * add author information on nested instances
 */
const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'nestedInstancesAuthorFilter',
  remote: true,
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'authorInformation',
    fetchFilterFunc: async (elements: Element[]) => {
      const nestedInstancesByType = _.pick(
        _.groupBy(elements.filter(isMetadataInstanceElementSync), (e) =>
          apiNameSync(e.getTypeSync()),
        ),
        NESTED_INSTANCES_METADATA_TYPES,
      )
      await Promise.all(
        NESTED_INSTANCES_METADATA_TYPES.map((typeName) => ({
          typeName,
          instances: nestedInstancesByType[typeName] ?? [],
        }))
          .filter(({ instances }) => instances.length > 0)
          .map(({ typeName, instances }) =>
            setAuthorInformationForInstancesOfType({
              client,
              typeName,
              instances,
            }),
          ),
      )
    },
  }),
})

export default filterCreator
