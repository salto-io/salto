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
import { DependencyChanger } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { changeDependenciesFromAppUserSchemaToApp } from './replace_app_user_schema_and_app'
import { addAppGroupToAppDependency } from './app_group_assignment_to_app'
import { removeProfileMappingAfterDeps } from './remove_profile_mapping_after_deps'
import { changeDependenciesFromPoliciesAndRulesToPriority } from './policy_and_rules_to_priority'
import { defaultMultifactorEnrollmentPolicyDependency } from './default_multi_factor_enrollment_policy'

const { awu } = collections.asynciterable

const DEPENDENCY_CHANGERS: DependencyChanger[] = [
  deployment.dependency.removeStandaloneFieldDependency,
  changeDependenciesFromAppUserSchemaToApp,
  addAppGroupToAppDependency,
  removeProfileMappingAfterDeps,
  changeDependenciesFromPoliciesAndRulesToPriority,
  defaultMultifactorEnrollmentPolicyDependency,
]

export const dependencyChanger: DependencyChanger = async (changes, deps) =>
  awu(DEPENDENCY_CHANGERS)
    .flatMap(changer => changer(changes, deps))
    .toArray()
