/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { extractTemplate, replaceTemplatesWithValues, resolveTemplates } from '@salto-io/adapter-utils'
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

const CUSTOM_FIELD_PATTERN = /(customfield_\d+)/

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

const referenceCustomFields = (
  script: string,
  fieldInstancesById: Map<string, InstanceElement>,
): TemplateExpression | string =>
  extractTemplate(script, [CUSTOM_FIELD_PATTERN], expression => {
    const instance = fieldInstancesById.get(expression)
    if (!expression.match(CUSTOM_FIELD_PATTERN) || instance === undefined) {
      return expression
    }
    return new ReferenceExpression(instance.elemID, instance)
  })

const addTemplateReferences =
  (fieldInstancesById: Map<string, InstanceElement>): referenceFunc =>
  (value: Value, fieldName: string): void => {
    if (typeof value[fieldName] === 'string') {
      value[fieldName] = referenceCustomFields(value[fieldName], fieldInstancesById)
    }
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

      walkOnScripts({ func: addTemplateReferences(fieldInstancesById), isDc: client.isDataCenter, instances })
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
