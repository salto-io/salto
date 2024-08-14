/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
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
