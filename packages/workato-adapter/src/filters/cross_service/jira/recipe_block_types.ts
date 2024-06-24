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
// eslint-disable-next-line import/no-extraneous-dependencies
import Joi from 'joi'
import { BlockBase, createBlockChecker } from '../recipe_block_types'
import { CROSS_SERVICE_SUPPORTED_APPS, JIRA } from '../../../constants'

export type JiraBlock = BlockBase & {
  as: string
  provider: 'jira' | 'jira_secondary'
  input: {
    issueType: string
    projectKey: string
    sampleProjectKey?: string
    sampleIssueType?: string
  }
}

const JIRA_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().valid('jira', 'jira_secondary').required(),
  input: Joi.object({
    issueType: Joi.string().required(),
    projectKey: Joi.string().required(),
    sampleProjectKey: Joi.string(),
    sampleIssueType: Joi.string(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

export const isJiraBlock = createBlockChecker<JiraBlock>(JIRA_BLOCK_SCHEMA, CROSS_SERVICE_SUPPORTED_APPS[JIRA])
