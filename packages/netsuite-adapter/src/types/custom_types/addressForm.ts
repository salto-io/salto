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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'
import { fieldTypes } from '../field_types'

export const addressFormInnerTypes: ObjectType[] = []

const addressFormElemID = new ElemID(constants.NETSUITE, 'addressForm')
const addressForm_mainFields_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_defaultFieldGroup_fields_field')

const addressForm_mainFields_defaultFieldGroup_fields_field = new ObjectType({
  elemID: addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see addressform_fieldid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    sameRowAsPrevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_defaultFieldGroup_fields_field)

const addressForm_mainFields_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_defaultFieldGroup_fields')

const addressForm_mainFields_defaultFieldGroup_fields = new ObjectType({
  elemID: addressForm_mainFields_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: {
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      type: new ListType(addressForm_mainFields_defaultFieldGroup_fields_field),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_defaultFieldGroup_fields)

const addressForm_mainFields_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_defaultFieldGroup')

const addressForm_mainFields_defaultFieldGroup = new ObjectType({
  elemID: addressForm_mainFields_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: {
      type: new ListType(addressForm_mainFields_defaultFieldGroup_fields),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_defaultFieldGroup)

const addressForm_mainFields_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_fieldGroup_fields_field')

const addressForm_mainFields_fieldGroup_fields_field = new ObjectType({
  elemID: addressForm_mainFields_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see addressform_fieldid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    sameRowAsPrevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_fieldGroup_fields_field)

const addressForm_mainFields_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_fieldGroup_fields')

const addressForm_mainFields_fieldGroup_fields = new ObjectType({
  elemID: addressForm_mainFields_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: {
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      type: new ListType(addressForm_mainFields_fieldGroup_fields_field),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_fieldGroup_fields)

const addressForm_mainFields_fieldGroupElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_fieldGroup')

const addressForm_mainFields_fieldGroup = new ObjectType({
  elemID: addressForm_mainFields_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showTitle: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    singleColumn: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fields: {
      type: new ListType(addressForm_mainFields_fieldGroup_fields),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_fieldGroup)

const addressForm_mainFieldsElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields')

const addressForm_mainFields = new ObjectType({
  elemID: addressForm_mainFieldsElemID,
  annotations: {
  },
  fields: {
    fieldGroup: {
      type: new ListType(addressForm_mainFields_fieldGroup),
      annotations: {
      },
    },
    defaultFieldGroup: {
      type: addressForm_mainFields_defaultFieldGroup,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields)


export const addressForm = new ObjectType({
  elemID: addressFormElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custform[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custform’. */
    standard: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    mainFields: {
      type: addressForm_mainFields,
      annotations: {
      },
    },
    addressTemplate: {
      type: fieldTypes.cdata,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value can be up to 3990 characters long. */
    countries: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see countries. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})
