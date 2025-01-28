/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DependencyChanger } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { changeDependenciesFromAppUserSchemaToApp } from './replace_app_user_schema_and_app'
import { addAppGroupToAppDependency } from './app_group_assignment_to_app'
import { removeProfileMappingAfterDeps } from './remove_profile_mapping_after_deps'
import { changeDependenciesFromPoliciesAndRulesToPriority } from './policy_and_rules_to_priority'
import { defaultMultifactorEnrollmentPolicyDependency } from './default_multi_factor_enrollment_policy'
import { addAuthenticatorToMfaPolicyDependency } from './authenticator_to_mfa_policy'
import { addDependenciesFromPolicyToPriorPolicy } from './order_policies_by_priority'
import { addAppGroupToAppUserSchemaDependency } from './app_group_assignment_to_app_schema'
import { addedEmailDomainAfterAddedBrand } from './brand_and_email_domain'

const { awu } = collections.asynciterable

const DEPENDENCY_CHANGERS: DependencyChanger[] = [
  deployment.dependency.removeStandaloneFieldDependency,
  changeDependenciesFromAppUserSchemaToApp,
  addAppGroupToAppDependency,
  addAppGroupToAppUserSchemaDependency,
  removeProfileMappingAfterDeps,
  changeDependenciesFromPoliciesAndRulesToPriority,
  defaultMultifactorEnrollmentPolicyDependency,
  addAuthenticatorToMfaPolicyDependency,
  addDependenciesFromPolicyToPriorPolicy,
  addedEmailDomainAfterAddedBrand,
]

export const dependencyChanger: DependencyChanger = async (changes, deps) =>
  awu(DEPENDENCY_CHANGERS)
    .flatMap(changer => changer(changes, deps))
    .toArray()
