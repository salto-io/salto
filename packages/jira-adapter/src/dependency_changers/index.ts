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
import { dashboardGadgetsDependencyChanger } from './dashboard_gadgets'
import { formsDependencyChanger } from './forms'
import { globalFieldContextsDependencyChanger } from './global_field_contexts'
import { projectDependencyChanger } from './project'
import { projectContextsDependencyChanger } from './project_contexts'
import { removalsDependencyChanger } from './removals'
import { workflowDependencyChanger } from './workflow'
import { fieldContextDependencyChanger } from './field_contexts'
import { fieldConfigurationDependencyChanger } from './field_configuration'
import { rootObjectTypeToObjectSchemaDependencyChanger } from './root_object_type_to_schema'
import { issueLayoutDependencyChanger } from './issue_layout_dependency'
import { objectTypeParentDependencyChanger } from './object_type_parent'
import { objectTypeOrderToSchemaDependencyChanger } from './object_type_order_to_schema'

const { awu } = collections.asynciterable

const DEPENDENCY_CHANGERS: DependencyChanger[] = [
  deployment.dependency.removeStandaloneFieldDependency,
  projectDependencyChanger,
  workflowDependencyChanger,
  dashboardGadgetsDependencyChanger,
  formsDependencyChanger,
  rootObjectTypeToObjectSchemaDependencyChanger, // Must run before removalsDependencyChanger
  objectTypeParentDependencyChanger,
  removalsDependencyChanger,
  globalFieldContextsDependencyChanger,
  projectContextsDependencyChanger,
  fieldContextDependencyChanger,
  fieldConfigurationDependencyChanger,
  issueLayoutDependencyChanger,
  objectTypeOrderToSchemaDependencyChanger,
]

export const dependencyChanger: DependencyChanger = async (changes, deps) =>
  awu(DEPENDENCY_CHANGERS)
    .flatMap(changer => changer(changes, deps))
    .toArray()
