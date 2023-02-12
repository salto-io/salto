/*
*                      Copyright 2023 Salto Labs Ltd.
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
  Change, getChangeData, InstanceElement, isInstanceElement, Element,
  ReferenceExpression, TemplateExpression,
} from '@salto-io/adapter-api'
import { extractTemplate, replaceTemplatesWithValues, resolveTemplates } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG, IdLocator } from '../config'
import { APP_INSTALLATION_TYPE_NAME } from './app'
import { TICKET_FIELD_TYPE_NAME } from '../constants'

const DELIMITERS = /(\\n | ,)/g
const CUSTOM_OPTION_TYPE = 'ticket_field__custom_field_options'

const APP_INSTLLATION_SPECIFIC_TYPES = ['group', CUSTOM_OPTION_TYPE]

const GENERAL_ID_REGEX = '([\\d]{10,})'

const LOCATORS: IdLocator[] = [{
  fieldRegex: '(?:(.*_fields)|(.*_field)|^(ticketfield.*))$',
  idRegex: GENERAL_ID_REGEX,
  type: [TICKET_FIELD_TYPE_NAME],
}, {
  fieldRegex: '.*_options$',
  idRegex: '(custom_field_)([\\d]+)',
  type: ['ticket_field__custom_field_options'],
}, {
  fieldRegex: '.*group.*$',
  idRegex: GENERAL_ID_REGEX,
  type: ['group'],
}]

const ALL_LOCATOR = {
  fieldRegex: '.*',
  idRegex: GENERAL_ID_REGEX,
  type: ['*'],
}

const valueToTemplate = (val: string, regex: RegExp, locatorTypes: string[],
  typeToElements: Record<string, InstanceElement[]>): TemplateExpression | string =>
  extractTemplate(val, [DELIMITERS, regex], expression => {
    if (expression.match(GENERAL_ID_REGEX)) {
      const elementsToSearch = (locatorTypes.includes('*'))
        ? Object.values(typeToElements).flat()
        : locatorTypes.flatMap(t => (typeToElements[t] ?? []))
      const element = elementsToSearch.find(e => _.toString(e.value?.id) === expression)
      if (!element) {
        return expression
      }
      return new ReferenceExpression(element.elemID, element)
    }
    return expression
  })

const runFunctionOnLocatedFields = (
  app: InstanceElement, locators: IdLocator[], func: (field: string, locator: IdLocator) => void
): void =>
  locators.forEach(locator => {
    Object.keys(app.value.settings ?? {}).forEach(key => {
      if (key.match(new RegExp(locator.fieldRegex, 'gi'))) {
        func(key, locator)
      }
    })
  })


const replaceFieldsWithTemplates = (
  app: InstanceElement, typeToElements: Record<string, InstanceElement[]>, locators: IdLocator[],
): void => {
  const convertValuesToTemplate = (field: string, locator: IdLocator): void => {
    if (app.value.settings && _.isString(app.value.settings[field])) {
      app.value.settings[field] = valueToTemplate(app.value.settings[field],
        new RegExp(locator.idRegex, 'gi'), locator.type, typeToElements)
    }
  }
  runFunctionOnLocatedFields(app, locators, convertValuesToTemplate)
}

const getAppInstallations = (instances: Element[]): InstanceElement[] =>
  instances.filter(isInstanceElement)
    .filter(e => e.elemID.typeName === APP_INSTALLATION_TYPE_NAME)
    .filter(e => e.value.settings)

const filterCreator: FilterCreator = ({ config }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  const fetchConfig = config[FETCH_CONFIG]
  const locators = fetchConfig.greedyAppReferences ? [ALL_LOCATOR]
    : (fetchConfig.appReferenceLocators ?? LOCATORS)
  return ({
    name: 'handleAppInstallationsFilter',
    onFetch: async (elements: InstanceElement[]): Promise<void> =>
      getAppInstallations(elements)
        .forEach(app => replaceFieldsWithTemplates(app, _.groupBy(elements.filter(
          e => [TICKET_FIELD_TYPE_NAME, // before it was the values of ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE
            ...APP_INSTLLATION_SPECIFIC_TYPES]
            .includes((e.elemID.typeName))
        ), e => e.elemID.typeName), locators)),
    preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> =>
      getAppInstallations(changes.map(getChangeData))
        .forEach(app => {
          const convertTemplatesToValues = (fieldName: string): void => {
            replaceTemplatesWithValues({ fieldName, values: [app.value.settings] },
              deployTemplateMapping, (part: ReferenceExpression) => {
                if (isInstanceElement(part.value) && part.value.value.id) {
                  return _.toString(part.value.value.id)
                }
                return part
              })
          }
          runFunctionOnLocatedFields(app, locators, convertTemplatesToValues)
        }),
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      getAppInstallations(changes.map(getChangeData))
        .forEach(app => {
          const resolveTemplateForApp = (fieldName: string): void => {
            resolveTemplates({ fieldName, values: [app.value.settings] }, deployTemplateMapping)
          }
          runFunctionOnLocatedFields(app, locators, resolveTemplateForApp)
        })
    },
  })
}

export default filterCreator
