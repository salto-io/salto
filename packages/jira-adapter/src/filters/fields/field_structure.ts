/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { BuiltinTypes, Element, Field, InstanceElement, isInstanceElement, isObjectType, ListType, MapType, ObjectType, Values } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { FIELD_TYPE_NAME } from './utils'

const findObject = (elements: Element[], name: string): ObjectType | undefined =>
  elements.filter(isObjectType).find(
    element => element.elemID.name === name
  )

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
  (instance.value.contextIssueTypes ?? [])
    .filter((issueType: Values) => !issueType.isAnyIssueType)
    .forEach((issueType: Values) => {
      if (idToContext[issueType.contextId].issueTypeIds === undefined) {
        idToContext[issueType.contextId].issueTypeIds = []
      }
      idToContext[issueType.contextId].issueTypeIds.push(issueType.issueTypeId)
    })

  delete instance.value.contextIssueTypes
}

const transformOptionsToMap = (instance: InstanceElement): void => {
  instance.value.contexts
    ?.filter((context: Values) => context.options !== undefined)
    .forEach((context: Values) => {
      const optionsWithIndex = _(context.options)
        .groupBy(option => option.optionId)
        .values()
        .flatMap(options => options.map((option, position) => ({ ...option, position })))
        // To put the cascading options in the end of the list
        .sortBy(option => option.optionId !== undefined)
        .value()

      context.options = _.keyBy(optionsWithIndex, option => naclCase(option.value))
    })
}

/**
 * Converts the field structure to what expected structure of the deployment endpoints and
 * converts list with hidden values to maps
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
      .forEach(instance => {
        addTypeValue(instance)

        const idToContext = _.keyBy(instance.value.contexts ?? [], context => context.id)

        addDefaultValuesToContexts(instance, idToContext)
        addIssueTypesToContexts(instance, idToContext)
        addProjectsToContexts(instance, idToContext)

        transformOptionsToMap(instance)
        instance.value.contexts = instance.value.contexts
          && _.keyBy(instance.value.contexts, context => naclCase(context.name))
      })

    const fieldType = findObject(elements, FIELD_TYPE_NAME)
    const fieldContextType = findObject(elements, 'CustomFieldContext')
    const fieldContextDefaultValueType = findObject(elements, 'CustomFieldContextDefaultValue')
    const fieldContextOptionType = findObject(elements, 'CustomFieldContextOption')

    if (fieldType !== undefined
      && fieldContextType !== undefined
      && fieldContextDefaultValueType !== undefined
      && fieldContextOptionType !== undefined) {
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
    }
  },
})

export default filter
