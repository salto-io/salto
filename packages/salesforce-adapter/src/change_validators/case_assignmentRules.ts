/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  getChangeData,
  ChangeValidator,
  isInstanceChange,
  InstanceElement,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { isInstanceOfType } from '../filters/utils'
import { ASSIGNMENT_RULES_METADATA_TYPE } from '../constants'
import { apiName } from '../transformers/transformer'

const { awu } = collections.asynciterable

const CASE = 'Case'

type RuleEntry = {
  // with team
  team: string
}

type AssignmentRule = {
  ruleEntry: RuleEntry[]
}

type AssignmentRules = {
  assignmentRule: AssignmentRule[]
}

const RULE_ENTRY = Joi.object({
  team: Joi.string().required(),
}).unknown(true)

const ASSIGNMENT_RULE = Joi.object({
  ruleEntry: Joi.array().has(RULE_ENTRY),
}).unknown(true)

const ASSIGNMENT_RULES = Joi.object({
  assignmentRule: Joi.array().items(ASSIGNMENT_RULE).required(),
}).unknown(true)

const isAssignmentRulesWithTeam = createSchemeGuard<AssignmentRules>(ASSIGNMENT_RULES)

const createChangeError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message:
    'Deployment of case assignment rule that references a predefined case team is not supported. Please remove the ‘team’ property in order to deploy this element and then configure its team via the salesforce UI.',
  detailedMessage:
    'Deployment of case assignment rule that references a predefined case team is not supported in SF. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8031863-deployment-of-case-assignment-rule-that-references-a-predefined-case-team-is-not-supported.',
})

/**
 * SF does not support deploy of case assignment rules with case teams.
 */
const changeValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceOfType(ASSIGNMENT_RULES_METADATA_TYPE))
    .filter(async change => (await apiName(change)) === CASE)
    .filter(instance => isAssignmentRulesWithTeam(instance.value))
    .map(createChangeError)
    .toArray()

export default changeValidator
