/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS, Element, Field, InstanceElement, isInstanceElement, ListType, MapType, ObjectType, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { config as configUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { JiraConfig } from '../../config'
import { FilterCreator } from '../../filter'
import { findObject } from '../../utils'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from './constants'

const log = logger(module)

const addTypeValue = (instance: InstanceElement): void => {
  if (instance.value.schema?.custom !== undefined) {
    instance.value.type = instance.value.schema.custom
    delete instance.value.schema
  }
}

const addDefaultValuesToContexts = (
  instance: InstanceElement,
  idToContext: Record<string, Values>
): void => {
  (instance.value.contextDefaults ?? []).forEach((contextDefault: Values) => {
    if (idToContext[contextDefault.contextId] === undefined) {
      log.warn(`Context with id ${contextDefault.contextId} not found in instance ${instance.elemID.getFullName()} when assigning context defaults`)
      return
    }
    idToContext[contextDefault.contextId].defaultValue = _.omit(contextDefault, 'contextId')
  })

  delete instance.value.contextDefaults
}

const addIssueTypesToContexts = (
  instance: InstanceElement,
  idToContext: Record<string, Values>
): void => {
  (instance.value.contextIssueTypes ?? [])
    .filter((issueType: Values) => !issueType.isAnyIssueType)
    .forEach((issueType: Values) => {
      if (idToContext[issueType.contextId] === undefined) {
        log.warn(`Context with id ${issueType.contextId} not found in instance ${instance.elemID.getFullName()} when assigning issue types`)
        return
      }
      if (idToContext[issueType.contextId].issueTypeIds === undefined) {
        idToContext[issueType.contextId].issueTypeIds = []
      }
      idToContext[issueType.contextId].issueTypeIds.push(issueType.issueTypeId)
    })

  delete instance.value.contextIssueTypes
}

const addProjectsToContexts = (
  instance: InstanceElement,
  idToContext: Record<string, Values>
): void => {
  (instance.value.contextProjects ?? [])
    .filter((project: Values) => !project.isGlobalContext)
    .forEach((project: Values) => {
      if (idToContext[project.contextId] === undefined) {
        log.warn(`Context with id ${project.contextId} not found in instance ${instance.elemID.getFullName()} when assigning projects`)
        return
      }
      if (idToContext[project.contextId].projectIds === undefined) {
        idToContext[project.contextId].projectIds = []
      }
      idToContext[project.contextId].projectIds.push(project.projectId)
    })

  delete instance.value.contextProjects
}

const addCascadingOptionsToOptions = (instance: InstanceElement): void => {
  instance.value.contexts
    ?.filter((context: Values) => context.options !== undefined)
    .forEach((context: Values) => {
      const idToOption = _.keyBy(context.options, option => option.id)

      context.options
        .filter((option: Values) => option.optionId !== undefined)
        .forEach((option: Values) => {
          if (idToOption[option.optionId].cascadingOptions === undefined) {
            idToOption[option.optionId].cascadingOptions = {}
          }
          idToOption[option.optionId].cascadingOptions[naclCase(option.value)] = {
            ..._.omit(option, 'optionId'),
            position: Object.keys(idToOption[option.optionId].cascadingOptions).length,
          }
        })

      context.options = context.options.filter((option: Values) => option.optionId === undefined)
    })
}

const transformOptionsToMap = (instance: InstanceElement): void => {
  instance.value.contexts
    ?.filter((context: Values) => context.options !== undefined)
    .forEach((context: Values) => {
      const optionsWithIndex = context.options
        .map((option: Values, position: number) => ({ ...option, position }))

      context.options = _.keyBy(optionsWithIndex, option => naclCase(option.value))
    })
}

const getInstanceNameParts = (
  instanceValues: Values,
  typeName: string,
  config: JiraConfig
): string[] => {
  const { idFields } = configUtils.getConfigWithDefault(
    config.apiDefinitions.types[typeName].transformation,
    config.apiDefinitions.typeDefaults.transformation
  )
  return idFields.map(idField => _.get(instanceValues, idField))
    .filter(values.isDefined)
}

const createContextInstance = (
  context: Values,
  contextType: ObjectType,
  parentField: InstanceElement,
  config: JiraConfig,
): InstanceElement => {
  const parentNameParts = getInstanceNameParts(
    parentField.value,
    parentField.elemID.typeName,
    config,
  )
  const contextNameParts = getInstanceNameParts(context, contextType.elemID.typeName, config)

  return new InstanceElement(
    naclCase([...parentNameParts, ...contextNameParts].join('_')),
    contextType,
    context,
    parentField.path,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
    }
  )
}

/**
 * Converts the field structure to what expected structure of the deployment endpoints and
 * converts list with hidden values to maps
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    const fieldType = findObject(elements, FIELD_TYPE_NAME)
    const fieldContextType = findObject(elements, FIELD_CONTEXT_TYPE_NAME)
    const fieldContextDefaultValueType = findObject(elements, 'CustomFieldContextDefaultValue')
    const fieldContextOptionType = findObject(elements, 'CustomFieldContextOption')

    if (fieldType === undefined
      || fieldContextType === undefined
      || fieldContextDefaultValueType === undefined
      || fieldContextOptionType === undefined) {
      log.warn('Missing types for field structure filter, skipping')
      return
    }

    fieldType.fields.type = new Field(fieldType, 'type', BuiltinTypes.STRING)
    delete fieldType.fields.contextDefaults
    delete fieldType.fields.contextProjects
    delete fieldType.fields.contextIssueTypes

    fieldType.fields.contexts = new Field(fieldType, 'contexts', new MapType(fieldContextType))

    fieldContextType.fields.projectIds = new Field(fieldContextType, 'projectIds', new ListType(BuiltinTypes.STRING))
    fieldContextType.fields.issueTypeIds = new Field(fieldContextType, 'issueTypeIds', new ListType(BuiltinTypes.STRING))
    fieldContextType.fields.defaultValue = new Field(fieldContextType, 'defaultValue', fieldContextDefaultValueType)
    fieldContextType.fields.options = new Field(fieldType, 'options', new MapType(fieldContextOptionType))

    fieldContextOptionType.fields.position = new Field(fieldContextOptionType, 'position', BuiltinTypes.NUMBER)
    fieldContextOptionType.fields.cascadingOptions = new Field(fieldContextOptionType, 'cascadingOptions', new MapType(fieldContextOptionType))


    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
      .forEach(instance => {
        addTypeValue(instance)

        const idToContext = _.keyBy(instance.value.contexts ?? [], context => context.id)

        addDefaultValuesToContexts(instance, idToContext)
        addIssueTypesToContexts(instance, idToContext)
        addProjectsToContexts(instance, idToContext)

        addCascadingOptionsToOptions(instance)
        transformOptionsToMap(instance)

        const contexts = (instance.value.contexts ?? [])
          .map((context: Values) => createContextInstance(
            context,
            fieldContextType,
            instance,
            config,
          ))

        delete instance.value.contexts

        // Using this instead of push to make the parent field appear first in the NaCl
        elements.unshift(...contexts)
      })
  },
})

export default filter
