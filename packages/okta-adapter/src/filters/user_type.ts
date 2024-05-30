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
import Joi from 'joi'
import { InstanceElement, isInstanceChange, isAdditionChange, getChangeData, Change } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { USERTYPE_TYPE_NAME, LINKS_FIELD } from '../constants'
import OktaClient from '../client/client'
import { API_DEFINITIONS_CONFIG, OktaSwaggerApiConfig } from '../config'
import { defaultDeployChange, deployChanges } from '../deployment'

type UserType = {
  _links: {
    schema: {
      href: string
    }
  }
}

const USER_TYPE_SCHEMA = Joi.object({
  _links: Joi.object({
    schema: Joi.object({
      href: Joi.string().required(),
    })
      .required()
      .unknown(true),
  })
    .required()
    .unknown(true),
}).unknown(true)

export const isUserType = createSchemeGuard<UserType>(USER_TYPE_SCHEMA, 'Received invalid UserType object')

const deployUserType = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  apiDefinitions: OktaSwaggerApiConfig,
): Promise<void> => {
  const response = await defaultDeployChange(change, client, apiDefinitions)
  if (!isUserType(response)) {
    return
  }
  await applyFunctionToChangeData<Change<InstanceElement>>(change, async instance => {
    instance.value[LINKS_FIELD] = response[LINKS_FIELD]
    return instance
  })
}

/**
 * Deploy additions of UserType changes,
 * and set '_links' object to the added instance which is later used to deploy UserSchema changes
 */
const filter: FilterCreator = ({ client, config }) => ({
  name: 'userTypeFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isAdditionChange(change) &&
        getChangeData(change).elemID.typeName === USERTYPE_TYPE_NAME,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change =>
      deployUserType(change, client, config[API_DEFINITIONS_CONFIG]),
    )

    return { leftoverChanges, deployResult }
  },
})

export default filter
