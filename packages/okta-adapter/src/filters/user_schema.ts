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
import { InstanceElement, isObjectType, isInstanceElement, Values } from '@salto-io/adapter-api'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { USERTYPE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../constants'
import OktaClient from '../client/client'
import { API_DEFINITIONS_CONFIG } from '../config'
import { extractIdFromUrl } from '../utils'

const log = logger(module)
const { getTransformationConfigByType } = configUtils
const { toBasicInstance } = elementUtils
const { isDefined } = values
const LINK_PATH = ['_links', 'additionalProperties', 'schema', 'href']

const getUserSchemaId = (instance: InstanceElement): string | undefined => {
  const url = _.get(instance.value, LINK_PATH)
  if (url !== undefined) {
    const id = extractIdFromUrl(url)
    if (_.isString(id)) {
      return id
    }
  }
  log.error(`could not find id for UserSchema instance in UserType ${instance.elemID.name}`)
  return undefined
}

const getUserSchema = async (
  userSchemaId: string,
  client: OktaClient
): Promise<Values> => (await client.getSinglePage({
  url: `/api/v1/meta/schemas/user/${userSchemaId}`,
})).data as Values[]

/**
 * Fetch the non-default userSchema instances
 */
const filter: FilterCreator = ({ client, config }) => ({
  name: 'fetchUserSchemaFilter',
  onFetch: async elements => {
    const userTypeInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === USERTYPE_TYPE_NAME)
      // filter out the default user type because we already have the matching user schema
      .filter(instance => instance.value.default === false)
    const userSchemaType = elements.filter(isObjectType).find(type => type.elemID.name === USER_SCHEMA_TYPE_NAME)
    if (userSchemaType === undefined || _.isEmpty(userTypeInstances)) {
      return
    }

    const userSchemaIds = userTypeInstances.map(getUserSchemaId).filter(isDefined)
    const userSchemaEntries = (await Promise.all(
      userSchemaIds.map(async userSchemaId => {
        try {
          return await getUserSchema(userSchemaId, client)
        } catch (e) {
          log.error('Error while trying to get userSchema entry with id: %s, error: %s', userSchemaId, e)
        }
        return undefined
      })
    )).filter(isDefined)

    const userSchemaInstances = await Promise.all(userSchemaEntries.map(async (entry, index) => toBasicInstance({
      entry,
      type: userSchemaType,
      transformationConfigByType: getTransformationConfigByType(config[API_DEFINITIONS_CONFIG].types),
      transformationDefaultConfig: config[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
      nestName: undefined,
      parent: undefined,
      defaultName: `unnamed_${index}`,
      getElemIdFunc: undefined,
    })))
    elements.push(...userSchemaInstances)
  },
})

export default filter
