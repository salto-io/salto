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
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import * as constants from '../../constants'
import { enums } from '../enums'
import { fieldTypes } from '../field_types'

export const addressFormInnerTypes: ObjectType[] = []

const addressFormElemID = new ElemID(constants.NETSUITE, 'addressForm')
const addressForm_customCodeElemID = new ElemID(constants.NETSUITE, 'addressForm_customCode')

const addressForm_customCode = new ObjectType({
  elemID: addressForm_customCodeElemID,
  annotations: {
  },
  fields: {
    scriptFile: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
      },
    }, /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_customCode)

const addressForm_mainFields_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_defaultFieldGroup_fields_field')

const addressForm_mainFields_defaultFieldGroup_fields_field = new ObjectType({
  elemID: addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see addressform_fieldid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      refType: createRefToElmWithValue(enums.form_displaytype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    sameRowAsPrevious: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
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
      refType: createRefToElmWithValue(enums.form_fieldposition),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      refType: createRefToElmWithValue(new ListType(addressForm_mainFields_defaultFieldGroup_fields_field)),
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
      refType: createRefToElmWithValue(new ListType(addressForm_mainFields_defaultFieldGroup_fields)),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see addressform_fieldid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      refType: createRefToElmWithValue(enums.form_displaytype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    sameRowAsPrevious: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
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
      refType: createRefToElmWithValue(enums.form_fieldposition),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      refType: createRefToElmWithValue(new ListType(addressForm_mainFields_fieldGroup_fields_field)),
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
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showTitle: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    singleColumn: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fields: {
      refType: createRefToElmWithValue(new ListType(addressForm_mainFields_fieldGroup_fields)),
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
      refType: createRefToElmWithValue(new ListType(addressForm_mainFields_fieldGroup)),
      annotations: {
      },
    },
    defaultFieldGroup: {
      refType: createRefToElmWithValue(addressForm_mainFields_defaultFieldGroup),
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
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custform[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custform’. */
    standard: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    mainFields: {
      refType: createRefToElmWithValue(addressForm_mainFields),
      annotations: {
      },
    },
    customCode: {
      refType: createRefToElmWithValue(addressForm_customCode),
      annotations: {
      },
    },
    addressTemplate: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value can be up to 3990 characters long. */
    countries: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see countries. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})
