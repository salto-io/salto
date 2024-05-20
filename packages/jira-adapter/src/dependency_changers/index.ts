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
import { dashboardGadgetsDependencyChanger } from './dashboard_gadgets'
import { globalFieldContextsDependencyChanger } from './global_field_contexts'
import { projectDependencyChanger } from './project'
import { projectContextsDependencyChanger } from './project_contexts'
import { removalsDependencyChanger } from './removals'
import { workflowDependencyChanger } from './workflow'
import { fieldContextDependencyChanger } from './field_contexts'
import { fieldConfigurationDependencyChanger } from './field_configuration'
import { jsmProjectToJsmFieldDependencyChanger } from './jsm_project_to_jsm_field'
import { rootObjectTypeToObjectSchemaDependencyChanger } from './root_object_type_to_schema'
import { issueLayoutDependencyChanger } from './issue_layout_dependency'

const { awu } = collections.asynciterable

const DEPENDENCY_CHANGERS: DependencyChanger[] = [
  deployment.dependency.removeStandaloneFieldDependency,
  projectDependencyChanger,
  workflowDependencyChanger,
  dashboardGadgetsDependencyChanger,
  rootObjectTypeToObjectSchemaDependencyChanger, // Must run before removalsDependencyChanger
  removalsDependencyChanger,
  globalFieldContextsDependencyChanger,
  projectContextsDependencyChanger,
  fieldContextDependencyChanger,
  fieldConfigurationDependencyChanger,
  jsmProjectToJsmFieldDependencyChanger,
  issueLayoutDependencyChanger,
]

export const dependencyChanger: DependencyChanger = async (changes, deps) =>
  awu(DEPENDENCY_CHANGERS)
    .flatMap(changer => changer(changes, deps))
    .toArray()
