/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { replaceTemplatesWithValues, resolveTemplates } from '@salto-io/adapter-utils'
import {
  InstanceElement,
  isInstanceElement,
  TemplateExpression,
  ReferenceExpression,
  Element,
  Value,
  isAdditionOrModificationChange,
  getChangeData,
  isInstanceChange,
  TemplatePart,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { FIELD_TYPE_NAME } from '../fields/constants'
import { referenceFunc, walkOnScripts } from './walk_on_scripts'
import { addFieldsTemplateReferences } from '../fields/reference_to_fields'

const removeTemplateReferences =
  (originalInstances: Record<string, TemplateExpression>): referenceFunc =>
  (value: Value, fieldName: string): void => {
    replaceTemplatesWithValues(
      { values: [value], fieldName },
      originalInstances,
      (part: ReferenceExpression): TemplatePart => {
        if (part.elemID.isTopLevel()) {
          return part.value.value.id
        }
        throw new Error(
          `Received an invalid value inside a template expression of ScriptRunner ${part.elemID.getFullName()}`,
        )
      },
    )
  }

const restoreTemplateReferences =
  (originalInstances: Record<string, TemplateExpression>): referenceFunc =>
  (value: Value, fieldName: string): void => {
    resolveTemplates({ values: [value], fieldName }, originalInstances)
  }

// This filter is used to add and remove template expressions in scriptRunner scripts
const filter: FilterCreator = ({ config, client }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    name: 'scriptRunnerTemplateExpressionsFilter',
    onFetch: async (elements: Element[]) => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      const instances = elements.filter(isInstanceElement)
      const fieldInstances = instances.filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
      const fieldInstancesById = new Map(
        fieldInstances.map(instance => [instance.value.id, instance] as [string, InstanceElement]),
      )

      walkOnScripts({
        func: addFieldsTemplateReferences(fieldInstancesById, config.fetch.enableMissingReferences ?? true),
        isDc: client.isDataCenter,
        instances,
      })
    },
    preDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      walkOnScripts({
        func: removeTemplateReferences(deployTemplateMapping),
        isDc: client.isDataCenter,
        instances: changes.filter(isAdditionOrModificationChange).filter(isInstanceChange).map(getChangeData),
      })
    },
    onDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }

      walkOnScripts({
        func: restoreTemplateReferences(deployTemplateMapping),
        isDc: client.isDataCenter,
        instances: changes.filter(isAdditionOrModificationChange).filter(isInstanceChange).map(getChangeData),
      })
    },
  }
}
export default filter
