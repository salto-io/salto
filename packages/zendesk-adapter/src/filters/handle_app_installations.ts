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
import {
  Change, getChangeData, InstanceElement, isInstanceElement, isTemplateExpression,
  ReferenceExpression, TemplateExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { strings } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { APP_INSTALLATION_TYPE_NAME } from './app'
import { createTemplateUsingIdField, zendeskReferenceTypeToSaltoType } from './handle_template_expressions'

const log = logger(module)

const { matchAll } = strings


const potentialReferences = Object.values(zendeskReferenceTypeToSaltoType)

type IdLocator = {
    fieldRegex: RegExp
    idRegex: RegExp
    type: string
}

const locators: IdLocator[] = [{
  fieldRegex: /.*_fields/g,
  idRegex: /(?:([\d]+)\s*,\s*|([\d]+)$)/g,
  type: 'ticket_field',
}]

const valueToTemplate = (val: string, regex: RegExp, locatorType: string,
  typeToElements: Record<string, InstanceElement[]>): TemplateExpression | string => {
  const matches = Array.from(matchAll(val, regex))
    .flatMap(match => Array.from(match.slice(1))).filter(e => !_.isUndefined(e))
  if (matches.length > 0) {
    // If we found any matches, we now want to cut the string around the matches
    // We make no assumptions on the structure of the regex, so we can't do this with one run
    const exactPartsRegex = new RegExp(`(${matches.join('|')})`, 'g')
    const parts = val.split(exactPartsRegex).filter(e => !_.isEmpty(e)).map(part => {
      if (part.match(exactPartsRegex)) {
        const elementsToSearch = (locatorType === '*')
          ? Object.values(typeToElements).flat()
          : typeToElements[locatorType]
        const element = elementsToSearch.find(e => _.toString(e.value?.id) === part)
        if (!element) {
          return part
        }
        return new ReferenceExpression(element.elemID, element)
      }
      return part
    })
    if (parts.every(_.isString)) {
      return parts.join('')
    }
    return new TemplateExpression({ parts })
  }
  return val
}

const runFunctionOnLocatedFields = (
  app: InstanceElement, func: (field: string, locator: IdLocator) => void
): void =>
  locators.forEach(locator => {
    Object.keys(app.value.settings).forEach(key => {
      if (key.match(locator.fieldRegex)) {
        func(key, locator)
      }
    })
  })


const replaceFieldsWithTemplates = (
  app: InstanceElement, typeToElements: Record<string, InstanceElement[]>
): void => {
  const convertValuesToTemplate = (field: string, locator: IdLocator): void => {
    // eslint-disable-next-line no-console
    console.log(field)
    app.value.settings[field] = valueToTemplate(app.value.settings[field],
      locator.idRegex, locator.type, typeToElements)
  }
  runFunctionOnLocatedFields(app, convertValuesToTemplate)
}

const getAppInstallations = (instances: InstanceElement[]): InstanceElement[] =>
  instances.filter(e => e.elemID.typeName === APP_INSTALLATION_TYPE_NAME)
    .filter(e => e.value.settings)

const filterCreator: FilterCreator = () => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return ({
    onFetch: async (elements: InstanceElement[]): Promise<void> => log.time(async () =>
      getAppInstallations(elements.filter(isInstanceElement))
        .forEach(app => replaceFieldsWithTemplates(app, _.groupBy(elements.filter(
          e => potentialReferences.includes((e.elemID.typeName))
        ), e => e.elemID.typeName))),
    'Create template creation filter'),
    preDeploy: (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () => {
      getAppInstallations(changes.map(getChangeData).filter(isInstanceElement))
        .forEach(app => {
          const convertTemplatesToValues = (field: string): void => {
            if (isTemplateExpression(app.value.settings[field])) {
              const templateUsingIdField = createTemplateUsingIdField(app.value.settings[field],
                true)
              deployTemplateMapping[templateUsingIdField.value] = app.value.settings[field]
              app.value.settings[field] = templateUsingIdField.value
            }
          }
          runFunctionOnLocatedFields(app, convertTemplatesToValues)
        })
    }, 'Create template resolve filter'),
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () =>
      getAppInstallations(changes.map(getChangeData).filter(isInstanceElement))
        .forEach(app => {
          const resolveTemplates = (field: string): void => {
            app.value.settings[field] = deployTemplateMapping[app.value.settings[field]]
                ?? app.value.settings[field]
          }
          runFunctionOnLocatedFields(app, resolveTemplates)
        }),
    'Create templates restore filter'),
  })
}

export default filterCreator
