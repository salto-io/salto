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

export const transactionFormInnerTypes: ObjectType[] = []

const transactionFormElemID = new ElemID(constants.NETSUITE, 'transactionForm')
const transactionForm_actionbar_buttons_buttonElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_buttons_button')

const transactionForm_actionbar_buttons_button = new ObjectType({
  elemID: transactionForm_actionbar_buttons_buttonElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_actionbar_buttons_buttonElemID,
      'id',
      enums.transactionform_buttonid,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see transactionform_buttonid. */
    label: new Field(
      transactionForm_actionbar_buttons_buttonElemID,
      'label',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    visible: new Field(
      transactionForm_actionbar_buttons_buttonElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_buttons_button)

const transactionForm_actionbar_buttonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_buttons')

const transactionForm_actionbar_buttons = new ObjectType({
  elemID: transactionForm_actionbar_buttonsElemID,
  annotations: {
  },
  fields: {
    button: new Field(
      transactionForm_actionbar_buttonsElemID,
      'button',
      new ListType(transactionForm_actionbar_buttons_button),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_buttons)

const transactionForm_actionbar_customButtons_customButtonElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customButtons_customButton')

const transactionForm_actionbar_customButtons_customButton = new ObjectType({
  elemID: transactionForm_actionbar_customButtons_customButtonElemID,
  annotations: {
  },
  fields: {
    label: new Field(
      transactionForm_actionbar_customButtons_customButtonElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    ), /* Original description: This field value can be up to 99 characters long. */
    function: new Field(
      transactionForm_actionbar_customButtons_customButtonElemID,
      'function',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customButtons_customButton)

const transactionForm_actionbar_customButtonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customButtons')

const transactionForm_actionbar_customButtons = new ObjectType({
  elemID: transactionForm_actionbar_customButtonsElemID,
  annotations: {
  },
  fields: {
    customButton: new Field(
      transactionForm_actionbar_customButtonsElemID,
      'customButton',
      new ListType(transactionForm_actionbar_customButtons_customButton),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customButtons)

const transactionForm_actionbar_customMenu_customMenuItemElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customMenu_customMenuItem')

const transactionForm_actionbar_customMenu_customMenuItem = new ObjectType({
  elemID: transactionForm_actionbar_customMenu_customMenuItemElemID,
  annotations: {
  },
  fields: {
    label: new Field(
      transactionForm_actionbar_customMenu_customMenuItemElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    ), /* Original description: This field value can be up to 99 characters long. */
    function: new Field(
      transactionForm_actionbar_customMenu_customMenuItemElemID,
      'function',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customMenu_customMenuItem)

const transactionForm_actionbar_customMenuElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customMenu')

const transactionForm_actionbar_customMenu = new ObjectType({
  elemID: transactionForm_actionbar_customMenuElemID,
  annotations: {
  },
  fields: {
    customMenuItem: new Field(
      transactionForm_actionbar_customMenuElemID,
      'customMenuItem',
      new ListType(transactionForm_actionbar_customMenu_customMenuItem),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customMenu)

const transactionForm_actionbar_menu_menuitemElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_menu_menuitem')

const transactionForm_actionbar_menu_menuitem = new ObjectType({
  elemID: transactionForm_actionbar_menu_menuitemElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_actionbar_menu_menuitemElemID,
      'id',
      enums.transactionform_buttonid,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see transactionform_buttonid. */
    label: new Field(
      transactionForm_actionbar_menu_menuitemElemID,
      'label',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    visible: new Field(
      transactionForm_actionbar_menu_menuitemElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_menu_menuitem)

const transactionForm_actionbar_menuElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_menu')

const transactionForm_actionbar_menu = new ObjectType({
  elemID: transactionForm_actionbar_menuElemID,
  annotations: {
  },
  fields: {
    menuitem: new Field(
      transactionForm_actionbar_menuElemID,
      'menuitem',
      new ListType(transactionForm_actionbar_menu_menuitem),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_menu)

const transactionForm_actionbarElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar')

const transactionForm_actionbar = new ObjectType({
  elemID: transactionForm_actionbarElemID,
  annotations: {
  },
  fields: {
    buttons: new Field(
      transactionForm_actionbarElemID,
      'buttons',
      transactionForm_actionbar_buttons,
      {
      },
    ),
    customButtons: new Field(
      transactionForm_actionbarElemID,
      'customButtons',
      transactionForm_actionbar_customButtons,
      {
      },
    ),
    customMenu: new Field(
      transactionForm_actionbarElemID,
      'customMenu',
      transactionForm_actionbar_customMenu,
      {
      },
    ),
    menu: new Field(
      transactionForm_actionbarElemID,
      'menu',
      transactionForm_actionbar_menu,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar)

const transactionForm_buttons_standardButtons_buttonElemID = new ElemID(constants.NETSUITE, 'transactionForm_buttons_standardButtons_button')

const transactionForm_buttons_standardButtons_button = new ObjectType({
  elemID: transactionForm_buttons_standardButtons_buttonElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_buttons_standardButtons_buttonElemID,
      'id',
      enums.transactionform_buttonid,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see transactionform_buttonid. */
    label: new Field(
      transactionForm_buttons_standardButtons_buttonElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      transactionForm_buttons_standardButtons_buttonElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    style: new Field(
      transactionForm_buttons_standardButtons_buttonElemID,
      'style',
      enums.form_buttonstyle,
      {
      },
    ), /* Original description: For information about possible values, see form_buttonstyle.   The default value is 'BUTTON'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_buttons_standardButtons_button)

const transactionForm_buttons_standardButtonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_buttons_standardButtons')

const transactionForm_buttons_standardButtons = new ObjectType({
  elemID: transactionForm_buttons_standardButtonsElemID,
  annotations: {
  },
  fields: {
    button: new Field(
      transactionForm_buttons_standardButtonsElemID,
      'button',
      new ListType(transactionForm_buttons_standardButtons_button),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_buttons_standardButtons)

const transactionForm_buttonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_buttons')

const transactionForm_buttons = new ObjectType({
  elemID: transactionForm_buttonsElemID,
  annotations: {
  },
  fields: {
    standardButtons: new Field(
      transactionForm_buttonsElemID,
      'standardButtons',
      transactionForm_buttons_standardButtons,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_buttons)

const transactionForm_customCodeElemID = new ElemID(constants.NETSUITE, 'transactionForm_customCode')

const transactionForm_customCode = new ObjectType({
  elemID: transactionForm_customCodeElemID,
  annotations: {
  },
  fields: {
    scriptFile: new Field(
      transactionForm_customCodeElemID,
      'scriptFile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_customCode)

const transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup_fields_field')

const transactionForm_mainFields_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    checkBoxDefault: new Field(
      transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'checkBoxDefault',
      enums.transactionform_checkboxdefault,
      {
      },
    ), /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'UNCHECKED'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_defaultFieldGroup_fields_field)

const transactionForm_mainFields_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup_fields')

const transactionForm_mainFields_defaultFieldGroup_fields = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      transactionForm_mainFields_defaultFieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      transactionForm_mainFields_defaultFieldGroup_fieldsElemID,
      'field',
      new ListType(transactionForm_mainFields_defaultFieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_defaultFieldGroup_fields)

const transactionForm_mainFields_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup')

const transactionForm_mainFields_defaultFieldGroup = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: new Field(
      transactionForm_mainFields_defaultFieldGroupElemID,
      'fields',
      transactionForm_mainFields_defaultFieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_defaultFieldGroup)

const transactionForm_mainFields_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_fieldGroup_fields_field')

const transactionForm_mainFields_fieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_mainFields_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    checkBoxDefault: new Field(
      transactionForm_mainFields_fieldGroup_fields_fieldElemID,
      'checkBoxDefault',
      enums.transactionform_checkboxdefault,
      {
      },
    ), /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'UNCHECKED'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_fieldGroup_fields_field)

const transactionForm_mainFields_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_fieldGroup_fields')

const transactionForm_mainFields_fieldGroup_fields = new ObjectType({
  elemID: transactionForm_mainFields_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      transactionForm_mainFields_fieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      transactionForm_mainFields_fieldGroup_fieldsElemID,
      'field',
      new ListType(transactionForm_mainFields_fieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_fieldGroup_fields)

const transactionForm_mainFields_fieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_fieldGroup')

const transactionForm_mainFields_fieldGroup = new ObjectType({
  elemID: transactionForm_mainFields_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      transactionForm_mainFields_fieldGroupElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long. */
    label: new Field(
      transactionForm_mainFields_fieldGroupElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      transactionForm_mainFields_fieldGroupElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showTitle: new Field(
      transactionForm_mainFields_fieldGroupElemID,
      'showTitle',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    singleColumn: new Field(
      transactionForm_mainFields_fieldGroupElemID,
      'singleColumn',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fields: new Field(
      transactionForm_mainFields_fieldGroupElemID,
      'fields',
      transactionForm_mainFields_fieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_fieldGroup)

const transactionForm_mainFieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields')

const transactionForm_mainFields = new ObjectType({
  elemID: transactionForm_mainFieldsElemID,
  annotations: {
  },
  fields: {
    defaultFieldGroup: new Field(
      transactionForm_mainFieldsElemID,
      'defaultFieldGroup',
      transactionForm_mainFields_defaultFieldGroup,
      {
      },
    ),
    fieldGroup: new Field(
      transactionForm_mainFieldsElemID,
      'fieldGroup',
      new ListType(transactionForm_mainFields_fieldGroup),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields)

const transactionForm_printingType_advancedElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType_advanced')

const transactionForm_printingType_advanced = new ObjectType({
  elemID: transactionForm_printingType_advancedElemID,
  annotations: {
  },
  fields: {
    printTemplate: new Field(
      transactionForm_printingType_advancedElemID,
      'printTemplate',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the advancedpdftemplate custom type.   For information about other possible values, see transactionform_advancedtemplate.   If this field appears in the project, you must reference the ADVANCEDPRINTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDPRINTING must be enabled for this field to appear in your account. */
    emailTemplate: new Field(
      transactionForm_printingType_advancedElemID,
      'emailTemplate',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the advancedpdftemplate custom type.   For information about other possible values, see transactionform_advancedtemplate.   If this field appears in the project, you must reference the ADVANCEDPRINTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDPRINTING must be enabled for this field to appear in your account. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_printingType_advanced)

const transactionForm_printingType_basicElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType_basic')

const transactionForm_printingType_basic = new ObjectType({
  elemID: transactionForm_printingType_basicElemID,
  annotations: {
  },
  fields: {
    pdfLayout: new Field(
      transactionForm_printingType_basicElemID,
      'pdfLayout',
      enums.transactionform_pdflayout,
      {
      },
    ), /* Original description: For information about possible values, see transactionform_pdflayout. */
    htmlLayout: new Field(
      transactionForm_printingType_basicElemID,
      'htmlLayout',
      enums.transactionform_htmllayout,
      {
      },
    ), /* Original description: For information about possible values, see transactionform_htmllayout. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_printingType_basic)

const transactionForm_printingTypeElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType')

const transactionForm_printingType = new ObjectType({
  elemID: transactionForm_printingTypeElemID,
  annotations: {
  },
  fields: {
    advanced: new Field(
      transactionForm_printingTypeElemID,
      'advanced',
      transactionForm_printingType_advanced,
      {
      },
    ),
    basic: new Field(
      transactionForm_printingTypeElemID,
      'basic',
      transactionForm_printingType_basic,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_printingType)

const transactionForm_quickViewFields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_quickViewFields_field')

const transactionForm_quickViewFields_field = new ObjectType({
  elemID: transactionForm_quickViewFields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_quickViewFields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_quickViewFields_field)

const transactionForm_quickViewFieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_quickViewFields')

const transactionForm_quickViewFields = new ObjectType({
  elemID: transactionForm_quickViewFieldsElemID,
  annotations: {
  },
  fields: {
    field: new Field(
      transactionForm_quickViewFieldsElemID,
      'field',
      new ListType(transactionForm_quickViewFields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_quickViewFields)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    checkBoxDefault: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'checkBoxDefault',
      enums.transactionform_checkboxdefault,
      {
      },
    ), /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID,
      'field',
      new ListType(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: new Field(
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroupElemID,
      'fields',
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup)

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field')

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    checkBoxDefault: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
      'checkBoxDefault',
      enums.transactionform_checkboxdefault,
      {
      },
    ), /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field)

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_fieldGroup_fields')

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID,
      'field',
      new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields)

const transactionForm_tabs_tab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_fieldGroup')

const transactionForm_tabs_tab_fieldGroups_fieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long. */
    label: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showTitle: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'showTitle',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    singleColumn: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'singleColumn',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fields: new Field(
      transactionForm_tabs_tab_fieldGroups_fieldGroupElemID,
      'fields',
      transactionForm_tabs_tab_fieldGroups_fieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_fieldGroup)

const transactionForm_tabs_tab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups')

const transactionForm_tabs_tab_fieldGroups = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroupsElemID,
  annotations: {
  },
  fields: {
    defaultFieldGroup: new Field(
      transactionForm_tabs_tab_fieldGroupsElemID,
      'defaultFieldGroup',
      transactionForm_tabs_tab_fieldGroups_defaultFieldGroup,
      {
      },
    ),
    fieldGroup: new Field(
      transactionForm_tabs_tab_fieldGroupsElemID,
      'fieldGroup',
      new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups)

const transactionForm_tabs_tab_subItems_subList_columns_columnElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subList_columns_column')

const transactionForm_tabs_tab_subItems_subList_columns_column = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subList_columns_columnElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_tabs_tab_subItems_subList_columns_columnElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the transactioncolumncustomfield custom type.   For information about other possible values, see transactionform_columnid. */
    label: new Field(
      transactionForm_tabs_tab_subItems_subList_columns_columnElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_subItems_subList_columns_columnElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subList_columns_column)

const transactionForm_tabs_tab_subItems_subList_columnsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subList_columns')

const transactionForm_tabs_tab_subItems_subList_columns = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subList_columnsElemID,
  annotations: {
  },
  fields: {
    column: new Field(
      transactionForm_tabs_tab_subItems_subList_columnsElemID,
      'column',
      new ListType(transactionForm_tabs_tab_subItems_subList_columns_column),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subList_columns)

const transactionForm_tabs_tab_subItems_subListElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subList')

const transactionForm_tabs_tab_subItems_subList = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subListElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_tabs_tab_subItems_subListElemID,
      'id',
      BuiltinTypes.STRING /* Original type was enums.transactionform_sublistid but it can also be CRMCONTACTS */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see transactionform_sublistid. */
    label: new Field(
      transactionForm_tabs_tab_subItems_subListElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_subItems_subListElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    columns: new Field(
      transactionForm_tabs_tab_subItems_subListElemID,
      'columns',
      transactionForm_tabs_tab_subItems_subList_columns,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subList)

const transactionForm_tabs_tab_subItems_subLists_subListElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subLists_subList')

const transactionForm_tabs_tab_subItems_subLists_subList = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subLists_subListElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_tabs_tab_subItems_subLists_subListElemID,
      'id',
      BuiltinTypes.STRING /* Original type was enums.transactionform_sublistid but it can also be CRMCONTACTS */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see transactionform_sublistid. */
    label: new Field(
      transactionForm_tabs_tab_subItems_subLists_subListElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_subItems_subLists_subListElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subLists_subList)

const transactionForm_tabs_tab_subItems_subListsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subLists')

const transactionForm_tabs_tab_subItems_subLists = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subListsElemID,
  annotations: {
  },
  fields: {
    subList: new Field(
      transactionForm_tabs_tab_subItems_subListsElemID,
      'subList',
      new ListType(transactionForm_tabs_tab_subItems_subLists_subList),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subLists)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    checkBoxDefault: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
      'checkBoxDefault',
      enums.transactionform_checkboxdefault,
      {
      },
    ), /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID,
      'field',
      new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID,
      'fields',
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    quickAdd: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'quickAdd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    checkBoxDefault: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
      'checkBoxDefault',
      enums.transactionform_checkboxdefault,
      {
      },
    ), /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID,
      'field',
      new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long. */
    label: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showTitle: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'showTitle',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    singleColumn: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'singleColumn',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fields: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
      'fields',
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup)

const transactionForm_tabs_tab_subItems_subTab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroupsElemID,
  annotations: {
  },
  fields: {
    defaultFieldGroup: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroupsElemID,
      'defaultFieldGroup',
      transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup,
      {
      },
    ),
    fieldGroup: new Field(
      transactionForm_tabs_tab_subItems_subTab_fieldGroupsElemID,
      'fieldGroup',
      new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups)

const transactionForm_tabs_tab_subItems_subTabElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab')

const transactionForm_tabs_tab_subItems_subTab = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTabElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_tabs_tab_subItems_subTabElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see transactionform_subtabid. */
    label: new Field(
      transactionForm_tabs_tab_subItems_subTabElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      transactionForm_tabs_tab_subItems_subTabElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    fieldGroups: new Field(
      transactionForm_tabs_tab_subItems_subTabElemID,
      'fieldGroups',
      transactionForm_tabs_tab_subItems_subTab_fieldGroups,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab)

const transactionForm_tabs_tab_subItemsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems')

const transactionForm_tabs_tab_subItems = new ObjectType({
  elemID: transactionForm_tabs_tab_subItemsElemID,
  annotations: {
  },
  fields: {
    subList: new Field(
      transactionForm_tabs_tab_subItemsElemID,
      'subList',
      new ListType(transactionForm_tabs_tab_subItems_subList),
      {
      },
    ),
    subLists: new Field(
      transactionForm_tabs_tab_subItemsElemID,
      'subLists',
      new ListType(transactionForm_tabs_tab_subItems_subLists),
      {
      },
    ),
    subTab: new Field(
      transactionForm_tabs_tab_subItemsElemID,
      'subTab',
      new ListType(transactionForm_tabs_tab_subItems_subTab),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems)

const transactionForm_tabs_tabElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab')

const transactionForm_tabs_tab = new ObjectType({
  elemID: transactionForm_tabs_tabElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      transactionForm_tabs_tabElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see transactionform_tabid. */
    label: new Field(
      transactionForm_tabs_tabElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      transactionForm_tabs_tabElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    fieldGroups: new Field(
      transactionForm_tabs_tabElemID,
      'fieldGroups',
      transactionForm_tabs_tab_fieldGroups,
      {
      },
    ),
    subItems: new Field(
      transactionForm_tabs_tabElemID,
      'subItems',
      transactionForm_tabs_tab_subItems,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab)

const transactionForm_tabsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs')

const transactionForm_tabs = new ObjectType({
  elemID: transactionForm_tabsElemID,
  annotations: {
  },
  fields: {
    tab: new Field(
      transactionForm_tabsElemID,
      'tab',
      new ListType(transactionForm_tabs_tab),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs)


export const transactionForm = new ObjectType({
  elemID: transactionFormElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custform_',
  },
  fields: {
    scriptid: new Field(
      transactionFormElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custform’. */
    standard: new Field(
      transactionFormElemID,
      'standard',
      enums.transactionform_standard,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   For information about possible values, see transactionform_standard. */
    name: new Field(
      transactionFormElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    ),
    recordType: new Field(
      transactionFormElemID,
      'recordType',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ),
    inactive: new Field(
      transactionFormElemID,
      'inactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    preferred: new Field(
      transactionFormElemID,
      'preferred',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    storedWithRecord: new Field(
      transactionFormElemID,
      'storedWithRecord',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    disclaimer: new Field(
      transactionFormElemID,
      'disclaimer',
      BuiltinTypes.STRING,
      {
      },
    ),
    address: new Field(
      transactionFormElemID,
      'address',
      BuiltinTypes.STRING,
      {
      },
    ),
    allowAddMultiple: new Field(
      transactionFormElemID,
      'allowAddMultiple',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    actionbar: new Field(
      transactionFormElemID,
      'actionbar',
      transactionForm_actionbar,
      {
      },
    ),
    buttons: new Field(
      transactionFormElemID,
      'buttons',
      transactionForm_buttons,
      {
      },
    ),
    customCode: new Field(
      transactionFormElemID,
      'customCode',
      transactionForm_customCode,
      {
      },
    ),
    mainFields: new Field(
      transactionFormElemID,
      'mainFields',
      transactionForm_mainFields,
      {
      },
    ),
    printingType: new Field(
      transactionFormElemID,
      'printingType',
      transactionForm_printingType,
      {
      },
    ),
    quickViewFields: new Field(
      transactionFormElemID,
      'quickViewFields',
      transactionForm_quickViewFields,
      {
      },
    ),
    tabs: new Field(
      transactionFormElemID,
      'tabs',
      transactionForm_tabs,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})
