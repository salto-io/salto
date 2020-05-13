/*
*                      Copyright 2020 Salto Labs Ltd.
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
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/camelcase */
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const entryFormInnerTypes: ObjectType[] = []

const entryFormElemID = new ElemID(constants.NETSUITE, 'entryForm')
const entryForm_actionbar_buttons_buttonElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_buttons_button')

const entryForm_actionbar_buttons_button = new ObjectType({
  elemID: entryForm_actionbar_buttons_buttonElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_actionbar_buttons_buttonElemID,
      'id',
      enums.entryform_buttonid,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see entryform_buttonid. */
    label: new Field(
      entryForm_actionbar_buttons_buttonElemID,
      'label',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    visible: new Field(
      entryForm_actionbar_buttons_buttonElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_actionbar_buttons_button)

const entryForm_actionbar_buttonsElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_buttons')

const entryForm_actionbar_buttons = new ObjectType({
  elemID: entryForm_actionbar_buttonsElemID,
  annotations: {
  },
  fields: {
    button: new Field(
      entryForm_actionbar_buttonsElemID,
      'button',
      new ListType(entryForm_actionbar_buttons_button),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_actionbar_buttons)

const entryForm_actionbar_customButtons_customButtonElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_customButtons_customButton')

const entryForm_actionbar_customButtons_customButton = new ObjectType({
  elemID: entryForm_actionbar_customButtons_customButtonElemID,
  annotations: {
  },
  fields: {
    label: new Field(
      entryForm_actionbar_customButtons_customButtonElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    ), /* Original description: This field value can be up to 99 characters long. */
    function: new Field(
      entryForm_actionbar_customButtons_customButtonElemID,
      'function',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_actionbar_customButtons_customButton)

const entryForm_actionbar_customButtonsElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_customButtons')

const entryForm_actionbar_customButtons = new ObjectType({
  elemID: entryForm_actionbar_customButtonsElemID,
  annotations: {
  },
  fields: {
    customButton: new Field(
      entryForm_actionbar_customButtonsElemID,
      'customButton',
      new ListType(entryForm_actionbar_customButtons_customButton),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_actionbar_customButtons)

const entryForm_actionbar_customMenu_customMenuItemElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_customMenu_customMenuItem')

const entryForm_actionbar_customMenu_customMenuItem = new ObjectType({
  elemID: entryForm_actionbar_customMenu_customMenuItemElemID,
  annotations: {
  },
  fields: {
    label: new Field(
      entryForm_actionbar_customMenu_customMenuItemElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    ), /* Original description: This field value can be up to 99 characters long. */
    function: new Field(
      entryForm_actionbar_customMenu_customMenuItemElemID,
      'function',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_actionbar_customMenu_customMenuItem)

const entryForm_actionbar_customMenuElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_customMenu')

const entryForm_actionbar_customMenu = new ObjectType({
  elemID: entryForm_actionbar_customMenuElemID,
  annotations: {
  },
  fields: {
    customMenuItem: new Field(
      entryForm_actionbar_customMenuElemID,
      'customMenuItem',
      new ListType(entryForm_actionbar_customMenu_customMenuItem),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_actionbar_customMenu)

const entryForm_actionbar_menu_menuitemElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_menu_menuitem')

const entryForm_actionbar_menu_menuitem = new ObjectType({
  elemID: entryForm_actionbar_menu_menuitemElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_actionbar_menu_menuitemElemID,
      'id',
      enums.entryform_buttonid,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see entryform_buttonid. */
    label: new Field(
      entryForm_actionbar_menu_menuitemElemID,
      'label',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    visible: new Field(
      entryForm_actionbar_menu_menuitemElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_actionbar_menu_menuitem)

const entryForm_actionbar_menuElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_menu')

const entryForm_actionbar_menu = new ObjectType({
  elemID: entryForm_actionbar_menuElemID,
  annotations: {
  },
  fields: {
    menuitem: new Field(
      entryForm_actionbar_menuElemID,
      'menuitem',
      new ListType(entryForm_actionbar_menu_menuitem),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_actionbar_menu)

const entryForm_actionbarElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar')

const entryForm_actionbar = new ObjectType({
  elemID: entryForm_actionbarElemID,
  annotations: {
  },
  fields: {
    buttons: new Field(
      entryForm_actionbarElemID,
      'buttons',
      entryForm_actionbar_buttons,
      {
      },
    ),
    customButtons: new Field(
      entryForm_actionbarElemID,
      'customButtons',
      entryForm_actionbar_customButtons,
      {
      },
    ),
    customMenu: new Field(
      entryForm_actionbarElemID,
      'customMenu',
      entryForm_actionbar_customMenu,
      {
      },
    ),
    menu: new Field(
      entryForm_actionbarElemID,
      'menu',
      entryForm_actionbar_menu,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_actionbar)

const entryForm_buttons_standardButtons_buttonElemID = new ElemID(constants.NETSUITE, 'entryForm_buttons_standardButtons_button')

const entryForm_buttons_standardButtons_button = new ObjectType({
  elemID: entryForm_buttons_standardButtons_buttonElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_buttons_standardButtons_buttonElemID,
      'id',
      enums.entryform_buttonid,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see entryform_buttonid. */
    label: new Field(
      entryForm_buttons_standardButtons_buttonElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      entryForm_buttons_standardButtons_buttonElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    style: new Field(
      entryForm_buttons_standardButtons_buttonElemID,
      'style',
      enums.form_buttonstyle,
      {
      },
    ), /* Original description: For information about possible values, see form_buttonstyle.   The default value is 'BUTTON'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_buttons_standardButtons_button)

const entryForm_buttons_standardButtonsElemID = new ElemID(constants.NETSUITE, 'entryForm_buttons_standardButtons')

const entryForm_buttons_standardButtons = new ObjectType({
  elemID: entryForm_buttons_standardButtonsElemID,
  annotations: {
  },
  fields: {
    button: new Field(
      entryForm_buttons_standardButtonsElemID,
      'button',
      new ListType(entryForm_buttons_standardButtons_button),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_buttons_standardButtons)

const entryForm_buttonsElemID = new ElemID(constants.NETSUITE, 'entryForm_buttons')

const entryForm_buttons = new ObjectType({
  elemID: entryForm_buttonsElemID,
  annotations: {
  },
  fields: {
    standardButtons: new Field(
      entryForm_buttonsElemID,
      'standardButtons',
      entryForm_buttons_standardButtons,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_buttons)

const entryForm_customCodeElemID = new ElemID(constants.NETSUITE, 'entryForm_customCode')

const entryForm_customCode = new ObjectType({
  elemID: entryForm_customCodeElemID,
  annotations: {
  },
  fields: {
    scriptFile: new Field(
      entryForm_customCodeElemID,
      'scriptFile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_customCode)

const entryForm_mainFields_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_defaultFieldGroup_fields_field')

const entryForm_mainFields_defaultFieldGroup_fields_field = new ObjectType({
  elemID: entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
    label: new Field(
      entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_mainFields_defaultFieldGroup_fields_field)

const entryForm_mainFields_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_defaultFieldGroup_fields')

const entryForm_mainFields_defaultFieldGroup_fields = new ObjectType({
  elemID: entryForm_mainFields_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      entryForm_mainFields_defaultFieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      entryForm_mainFields_defaultFieldGroup_fieldsElemID,
      'field',
      new ListType(entryForm_mainFields_defaultFieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_mainFields_defaultFieldGroup_fields)

const entryForm_mainFields_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_defaultFieldGroup')

const entryForm_mainFields_defaultFieldGroup = new ObjectType({
  elemID: entryForm_mainFields_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: new Field(
      entryForm_mainFields_defaultFieldGroupElemID,
      'fields',
      entryForm_mainFields_defaultFieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_mainFields_defaultFieldGroup)

const entryForm_mainFields_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_fieldGroup_fields_field')

const entryForm_mainFields_fieldGroup_fields_field = new ObjectType({
  elemID: entryForm_mainFields_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_mainFields_fieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
    label: new Field(
      entryForm_mainFields_fieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      entryForm_mainFields_fieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      entryForm_mainFields_fieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      entryForm_mainFields_fieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      entryForm_mainFields_fieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      entryForm_mainFields_fieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      entryForm_mainFields_fieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      entryForm_mainFields_fieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_mainFields_fieldGroup_fields_field)

const entryForm_mainFields_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_fieldGroup_fields')

const entryForm_mainFields_fieldGroup_fields = new ObjectType({
  elemID: entryForm_mainFields_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      entryForm_mainFields_fieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      entryForm_mainFields_fieldGroup_fieldsElemID,
      'field',
      new ListType(entryForm_mainFields_fieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_mainFields_fieldGroup_fields)

const entryForm_mainFields_fieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_fieldGroup')

const entryForm_mainFields_fieldGroup = new ObjectType({
  elemID: entryForm_mainFields_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      entryForm_mainFields_fieldGroupElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long. */
    label: new Field(
      entryForm_mainFields_fieldGroupElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      entryForm_mainFields_fieldGroupElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showTitle: new Field(
      entryForm_mainFields_fieldGroupElemID,
      'showTitle',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    singleColumn: new Field(
      entryForm_mainFields_fieldGroupElemID,
      'singleColumn',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fields: new Field(
      entryForm_mainFields_fieldGroupElemID,
      'fields',
      entryForm_mainFields_fieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_mainFields_fieldGroup)

const entryForm_mainFieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields')

const entryForm_mainFields = new ObjectType({
  elemID: entryForm_mainFieldsElemID,
  annotations: {
  },
  fields: {
    defaultFieldGroup: new Field(
      entryForm_mainFieldsElemID,
      'defaultFieldGroup',
      entryForm_mainFields_defaultFieldGroup,
      {
      },
    ),
    fieldGroup: new Field(
      entryForm_mainFieldsElemID,
      'fieldGroup',
      new ListType(entryForm_mainFields_fieldGroup),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_mainFields)

const entryForm_quickViewFields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_quickViewFields_field')

const entryForm_quickViewFields_field = new ObjectType({
  elemID: entryForm_quickViewFields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_quickViewFields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_quickViewFields_field)

const entryForm_quickViewFieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_quickViewFields')

const entryForm_quickViewFields = new ObjectType({
  elemID: entryForm_quickViewFieldsElemID,
  annotations: {
  },
  fields: {
    field: new Field(
      entryForm_quickViewFieldsElemID,
      'field',
      new ListType(entryForm_quickViewFields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_quickViewFields)

const entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field')

const entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
  elemID: entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
    label: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field)

const entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields')

const entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
  elemID: entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID,
      'field',
      new ListType(entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields)

const entryForm_tabs_tab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_defaultFieldGroup')

const entryForm_tabs_tab_fieldGroups_defaultFieldGroup = new ObjectType({
  elemID: entryForm_tabs_tab_fieldGroups_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: new Field(
      entryForm_tabs_tab_fieldGroups_defaultFieldGroupElemID,
      'fields',
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_fieldGroups_defaultFieldGroup)

const entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field')

const entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field = new ObjectType({
  elemID: entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
    label: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field)

const entryForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_fieldGroup_fields')

const entryForm_tabs_tab_fieldGroups_fieldGroup_fields = new ObjectType({
  elemID: entryForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID,
      'field',
      new ListType(entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_fieldGroups_fieldGroup_fields)

const entryForm_tabs_tab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_fieldGroup')

const entryForm_tabs_tab_fieldGroups_fieldGroup = new ObjectType({
  elemID: entryForm_tabs_tab_fieldGroups_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long. */
    label: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showTitle: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'showTitle',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    singleColumn: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'singleColumn',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fields: new Field(
      entryForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'fields',
      entryForm_tabs_tab_fieldGroups_fieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_fieldGroups_fieldGroup)

const entryForm_tabs_tab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups')

const entryForm_tabs_tab_fieldGroups = new ObjectType({
  elemID: entryForm_tabs_tab_fieldGroupsElemID,
  annotations: {
  },
  fields: {
    defaultFieldGroup: new Field(
      entryForm_tabs_tab_fieldGroupsElemID,
      'defaultFieldGroup',
      entryForm_tabs_tab_fieldGroups_defaultFieldGroup,
      {
      },
    ),
    fieldGroup: new Field(
      entryForm_tabs_tab_fieldGroupsElemID,
      'fieldGroup',
      new ListType(entryForm_tabs_tab_fieldGroups_fieldGroup),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_fieldGroups)

const entryForm_tabs_tab_subItems_subListElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subList')

const entryForm_tabs_tab_subItems_subList = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subListElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_tabs_tab_subItems_subListElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactionbodycustomfield   itemcustomfield   entitycustomfield   recordsublist   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_sublistid. */
    label: new Field(
      entryForm_tabs_tab_subItems_subListElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      entryForm_tabs_tab_subItems_subListElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subList)

const entryForm_tabs_tab_subItems_subLists_subListElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subLists_subList')

const entryForm_tabs_tab_subItems_subLists_subList = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subLists_subListElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_tabs_tab_subItems_subLists_subListElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactionbodycustomfield   itemcustomfield   entitycustomfield   recordsublist   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_sublistid. */
    label: new Field(
      entryForm_tabs_tab_subItems_subLists_subListElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      entryForm_tabs_tab_subItems_subLists_subListElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subLists_subList)

const entryForm_tabs_tab_subItems_subListsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subLists')

const entryForm_tabs_tab_subItems_subLists = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subListsElemID,
  annotations: {
  },
  fields: {
    subList: new Field(
      entryForm_tabs_tab_subItems_subListsElemID,
      'subList',
      new ListType(entryForm_tabs_tab_subItems_subLists_subList),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subLists)

const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field')

const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
    label: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field)

const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields')

const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID,
      'field',
      new ListType(entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields)

const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup')

const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID,
      'fields',
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup)

const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field')

const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
    label: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field)

const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields')

const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID,
      'field',
      new ListType(entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields)

const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup')

const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long. */
    label: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showTitle: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'showTitle',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    singleColumn: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'singleColumn',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fields: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'fields',
      entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup)

const entryForm_tabs_tab_subItems_subTab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups')

const entryForm_tabs_tab_subItems_subTab_fieldGroups = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subTab_fieldGroupsElemID,
  annotations: {
  },
  fields: {
    defaultFieldGroup: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroupsElemID,
      'defaultFieldGroup',
      entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup,
      {
      },
    ),
    fieldGroup: new Field(
      entryForm_tabs_tab_subItems_subTab_fieldGroupsElemID,
      'fieldGroup',
      new ListType(entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subTab_fieldGroups)

const entryForm_tabs_tab_subItems_subTabElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab')

const entryForm_tabs_tab_subItems_subTab = new ObjectType({
  elemID: entryForm_tabs_tab_subItems_subTabElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_tabs_tab_subItems_subTabElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see entryform_subtabid. */
    label: new Field(
      entryForm_tabs_tab_subItems_subTabElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      entryForm_tabs_tab_subItems_subTabElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    fieldGroups: new Field(
      entryForm_tabs_tab_subItems_subTabElemID,
      'fieldGroups',
      entryForm_tabs_tab_subItems_subTab_fieldGroups,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems_subTab)

const entryForm_tabs_tab_subItemsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems')

const entryForm_tabs_tab_subItems = new ObjectType({
  elemID: entryForm_tabs_tab_subItemsElemID,
  annotations: {
  },
  fields: {
    subList: new Field(
      entryForm_tabs_tab_subItemsElemID,
      'subList',
      new ListType(entryForm_tabs_tab_subItems_subList),
      {
      },
    ),
    subLists: new Field(
      entryForm_tabs_tab_subItemsElemID,
      'subLists',
      new ListType(entryForm_tabs_tab_subItems_subLists),
      {
      },
    ),
    subTab: new Field(
      entryForm_tabs_tab_subItemsElemID,
      'subTab',
      new ListType(entryForm_tabs_tab_subItems_subTab),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab_subItems)

const entryForm_tabs_tabElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab')

const entryForm_tabs_tab = new ObjectType({
  elemID: entryForm_tabs_tabElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      entryForm_tabs_tabElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see entryform_tabid. */
    label: new Field(
      entryForm_tabs_tabElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      entryForm_tabs_tabElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    fieldGroups: new Field(
      entryForm_tabs_tabElemID,
      'fieldGroups',
      entryForm_tabs_tab_fieldGroups,
      {
      },
    ),
    subItems: new Field(
      entryForm_tabs_tabElemID,
      'subItems',
      entryForm_tabs_tab_subItems,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs_tab)

const entryForm_tabsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs')

const entryForm_tabs = new ObjectType({
  elemID: entryForm_tabsElemID,
  annotations: {
  },
  fields: {
    tab: new Field(
      entryForm_tabsElemID,
      'tab',
      new ListType(entryForm_tabs_tab),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})

entryFormInnerTypes.push(entryForm_tabs)


export const entryForm = new ObjectType({
  elemID: entryFormElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custform_',
  },
  fields: {
    scriptid: new Field(
      entryFormElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custform’. */
    standard: new Field(
      entryFormElemID,
      'standard',
      enums.entryform_standard,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   For information about possible values, see entryform_standard. */
    name: new Field(
      entryFormElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    ),
    recordType: new Field(
      entryFormElemID,
      'recordType',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the customrecordtype custom type. */
    inactive: new Field(
      entryFormElemID,
      'inactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    preferred: new Field(
      entryFormElemID,
      'preferred',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    storedWithRecord: new Field(
      entryFormElemID,
      'storedWithRecord',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    useForPopup: new Field(
      entryFormElemID,
      'useForPopup',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    editingInList: new Field(
      entryFormElemID,
      'editingInList',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    actionbar: new Field(
      entryFormElemID,
      'actionbar',
      entryForm_actionbar,
      {
      },
    ),
    buttons: new Field(
      entryFormElemID,
      'buttons',
      entryForm_buttons,
      {
      },
    ),
    customCode: new Field(
      entryFormElemID,
      'customCode',
      entryForm_customCode,
      {
      },
    ),
    mainFields: new Field(
      entryFormElemID,
      'mainFields',
      entryForm_mainFields,
      {
      },
    ),
    quickViewFields: new Field(
      entryFormElemID,
      'quickViewFields',
      entryForm_quickViewFields,
      {
      },
    ),
    tabs: new Field(
      entryFormElemID,
      'tabs',
      entryForm_tabs,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
})
