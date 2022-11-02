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
  Change, DeployResult,
  Element, ElemID, Field, getChangeData,
  InstanceElement, isAdditionOrRemovalChange,
  isInstanceElement,
  isObjectType,
  ObjectType,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { ZENDESK } from '../constants'

const HELP_CENTER_TYPE = 'guide_settings__help_center'
const GUIDE_SETTINGS_PREFERENCE_TYPE = 'guide_settings__help_center__settings__preferences'
const HELP_CENTER_GENERAL_SETTINGS_ATTRIBUTES = 'guide_settings__help_center__general_settings_attributes'
const GUIDE_SETTINGS_TYPE = 'guide_settings'


type GuideSettingsType = InstanceElement & {
  value: {
    // eslint-disable-next-line camelcase
    help_center: {
      settings: {
        preferences: object
      }
    }
  }
}

const GUIDE_SETTINGS_SCHEMA = Joi.object({
  help_center: Joi.object({
    settings: Joi.object({
      preferences: Joi.object().unknown(true).required(),
    }).unknown(true).required(),
  }).unknown(true).required(),
}).unknown(true).required()

const isGuideSettings = createSchemeGuardForInstance<GuideSettingsType>(
  GUIDE_SETTINGS_SCHEMA, 'Received an invalid value for section/category'
)

const addGeneralSettingsAttributesToInstance = (elem: InstanceElement): void => {
  elem.value.help_center.general_settings_attributes = elem.value.help_center.settings.preferences
  delete elem.value.help_center.settings
}

const addGeneralSettingsAttributesToObjectType = (objects: ObjectType[]): void => {
  const helpCenter = objects.find(obj => obj.elemID.typeName === HELP_CENTER_TYPE)
  const preference = objects.find(obj => obj.elemID.typeName === GUIDE_SETTINGS_PREFERENCE_TYPE)
  if (preference === undefined || helpCenter === undefined) {
    return
  }
  const GeneralSettingsAttributesType = new ObjectType(
    { elemID: new ElemID(ZENDESK, HELP_CENTER_GENERAL_SETTINGS_ATTRIBUTES) }
  )
  helpCenter.fields.general_settings_attributes = new Field(
    GeneralSettingsAttributesType,
    'general_settings_attributes',
    preference,
  )
  delete helpCenter.fields.settings
}
// need to omit changes which are  removal of guide_settings
const needToOmit = (change: Change<InstanceElement>): boolean =>
  getChangeData(change).elemID.typeName === GUIDE_SETTINGS_TYPE && isAdditionOrRemovalChange(change)

// this filter adds a field of 'general_settings_attributes' to 'help_center' and removes the
// setting field. This is done as this arrangement of the instance is necessary for deploy.
// For deploy, this filter ignores addition or removal of guide_settings.
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    elements
      .filter(isInstanceElement)
      .filter(obj => GUIDE_SETTINGS_TYPE === obj.elemID.typeName)
      .filter(isGuideSettings)
      .forEach(addGeneralSettingsAttributesToInstance)
    const guideSettingsObjectTypes = elements
      .filter(isObjectType)
      .filter(obj => [HELP_CENTER_TYPE, GUIDE_SETTINGS_PREFERENCE_TYPE]
        .includes(obj.elemID.typeName))
    addGeneralSettingsAttributesToObjectType(guideSettingsObjectTypes)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [GuideSettingsChangesToIgnore, leftoverChanges] = _.partition(
      changes,
      needToOmit,
    )
    const deployResult: DeployResult = {
      appliedChanges: GuideSettingsChangesToIgnore,
      errors: [],
    }
    return { deployResult, leftoverChanges }
  },

})
export default filterCreator
