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
  InstanceElement,
  isObjectType,
  isInstanceElement,
  Values,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  isInstanceChange,
  getChangeData,
  Change,
  isAdditionChange,
  AdditionChange,
} from '@salto-io/adapter-api'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData, getParents } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { USERTYPE_TYPE_NAME, USER_SCHEMA_TYPE_NAME, LINKS_FIELD } from '../constants'
import OktaClient from '../client/client'
import { API_DEFINITIONS_CONFIG } from '../config'
import { extractIdFromUrl } from '../utils'
import { isUserType } from './user_type'

const log = logger(module)
const { getTransformationConfigByType } = configUtils
const { toBasicInstance } = elementUtils
const { isDefined } = values
const LINK_PATH = [LINKS_FIELD, 'additionalProperties', 'schema', 'href']

const getUserSchemaId = (instance: InstanceElement): string | undefined => {
  const url = _.get(instance.value, LINK_PATH)
  if (url !== undefined) {
    const id = extractIdFromUrl(url)
    if (_.isString(id)) {
      return id
    }
  }
  log.error(`Could not find id for UserSchema instance in UserType ${instance.elemID.name}`)
  return undefined
}

const getUserSchema = async (userSchemaId: string, client: OktaClient): Promise<Values> =>
  (
    await client.get({
      url: `/api/v1/meta/schemas/user/${userSchemaId}`,
    })
  ).data as Values[]

/**
 * 1. onFetch: Fetch UserSchema instances and add UserType as parent to its UserSchema instance
 * 2. preDeploy & onDeploy: Update UserSchema with its correct id
 * 3. deploy: Deploy UserSchema removals, by verifying the parent UserType instance was removed
 */
const filter: FilterCreator = ({ client, config }) => ({
  name: 'userSchemaFilter',
  onFetch: async elements => {
    const userTypeInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === USERTYPE_TYPE_NAME)
    const userSchemaType = elements.filter(isObjectType).find(type => type.elemID.name === USER_SCHEMA_TYPE_NAME)
    if (userSchemaType === undefined || _.isEmpty(userTypeInstances)) {
      return
    }

    const schemaIdToUserType = Object.fromEntries(
      userTypeInstances.map(userType => [getUserSchemaId(userType), userType]),
    )
    const userSchemaIds = Object.keys(schemaIdToUserType)
    const userSchemaEntries = (
      await Promise.all(
        userSchemaIds.map(async userSchemaId => {
          try {
            const entry = await getUserSchema(userSchemaId, client)
            // update UserSchema id in entry
            entry.id = userSchemaId
            return entry
          } catch (e) {
            log.error('Error while trying to get userSchema entry with id: %s, error: %s', userSchemaId, e)
          }
          return undefined
        }),
      )
    ).filter(isDefined)

    const userSchemaInstances = await Promise.all(
      userSchemaEntries.map(async (entry, index) =>
        toBasicInstance({
          entry,
          type: userSchemaType,
          transformationConfigByType: getTransformationConfigByType(config[API_DEFINITIONS_CONFIG].types),
          transformationDefaultConfig: config[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
          nestName: undefined,
          parent: undefined,
          defaultName: `unnamed_${index}`,
          getElemIdFunc: undefined,
        }),
      ),
    )

    // Add UserType instance as parent to UserSchema instance
    userSchemaInstances.forEach(instance => {
      const userTypeInstance = schemaIdToUserType[instance.value.id]
      if (isInstanceElement(userTypeInstance)) {
        instance.annotations[CORE_ANNOTATIONS.PARENT] = [
          new ReferenceExpression(userTypeInstance.elemID, userTypeInstance),
        ]
      }
      log.warn(`Could not add UserType as parent for UserSchema ${instance.elemID.getFullName()}`)
    })
    elements.push(...userSchemaInstances)
  },
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .forEach(async change => {
        const userTypeValues = getParents(getChangeData(change))?.[0]
        if (!isUserType(userTypeValues)) {
          log.error(
            `Failed to find matching UserType instance for UserSchema: ${getChangeData(change).elemID.getFullName()}, can not updadate id`,
          )
          return
        }
        // get schemaId from the parent UserType _links object
        const schemaId = extractIdFromUrl(userTypeValues[LINKS_FIELD].schema.href)
        await applyFunctionToChangeData<AdditionChange<InstanceElement>>(change, async instance => {
          instance.value.id = schemaId
          return instance
        })
      })
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .forEach(async change => {
        // The id returned from the service includes the base url, update the field to include only the id
        const id = extractIdFromUrl(getChangeData(change).value.id)
        if (!_.isString(id)) {
          log.error(`Failed to update id for UserSchema instance: ${getChangeData(change).elemID.getFullName()}`)
          return
        }
        await applyFunctionToChangeData<AdditionChange<InstanceElement>>(change, async instance => {
          instance.value.id = id
          return instance
        })
      })
  },
})

export default filter
