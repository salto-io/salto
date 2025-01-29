/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values, Element, isInstanceElement } from '@salto-io/adapter-api'
// import { naclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { INSTANCE_TYPE_FIELD } from './custom_objects_to_object_type'
import { Types } from '../transformers/transformer'
import {
  // API_NAME,
  FORMULA,
  FORMULA_TYPE_NAME,
  // INSTANCE_FULL_NAME_FIELD,
  INTERNAL_FIELD_TYPE_NAMES,
  // METADATA_TYPE,
} from '../constants'
import { isCustomObjectOrCustomMetadataRecordTypeSync } from './utils'

// import { isCustomObjectOrCustomMetadataRecordTypeSync } from './utils'
// import { FORMULA } from '../constants'

// type ElementWithFields = Element & {
//   fields: Record<string, unknown>
// }
const formulaTypeName = (baseType: string): string => `${FORMULA_TYPE_NAME}${baseType}`

const getFieldTypeName = (annotations: Values): string => {
  const typeName = annotations[INSTANCE_TYPE_FIELD] ?? INTERNAL_FIELD_TYPE_NAMES.UNKNOWN
  return annotations[FORMULA] ? formulaTypeName(typeName) : typeName
}

// const toServiceIdsString = (ids: Record<string, string>): string =>
//   Object.entries(ids)
//     .sort(([k1], [k2]) => k1.localeCompare(k2))
//     .map(([k, v]) => `${k}:${v}`)
//     .join(';')

// const transformFieldAnnotations = (fieldName: Values, parentName: string): Values =>
//   // This is a simplified version - implement according to your needs
//   ({
//     [API_NAME]: `${parentName}.${fieldName}`,
//     // Add other annotations as needed
//   })

// Main function
const createAndReplaceFormulaFieldFromMetadataInstance = async (
  // parentObject: InstanceElement,
  formulaField: Values,
  // parentInstanceName: string,
  // formulaFieldsPath: string[],
): Promise<void> => {
  // Get the field API name before creating the new field
  // const fieldApiName = formulaField.fullName

  // Find and store the old field before removing it
  // const oldField = Object.values(parentObject.value).find(field => field.name === naclCase(fieldApiName))

  // Create the new formula field
  // let fieldType =
  //   Types.getKnownType(
  //     formulaTypeName(formulaField.refType.elemID.typeName ?? INTERNAL_FIELD_TYPE_NAMES.UNKNOWN),
  //     true,
  //   ) ?? Types.getKnownType(INTERNAL_FIELD_TYPE_NAMES.UNKNOWN, true)
  const fieldTypeName = getFieldTypeName(formulaField)
  if (fieldTypeName.startsWith(FORMULA_TYPE_NAME)) {
    const fieldType = Types.getKnownType(fieldTypeName, true)
    formulaField.type = fieldType
  }

  // const annotations = transformFieldAnnotations(fieldApiName, parentInstanceName)

  // const serviceIds = {
  //   [API_NAME]: annotations[API_NAME],
  //   [OBJECT_SERVICE_ID]: toServiceIdsString({
  //     [API_NAME]: parentInstanceName,
  //     [METADATA_TYPE]: 'FormulaField',
  //   }),
  // }

  // const fieldName = Types.getElemId(naclCase(fieldApiName), true, serviceIds).name
  // console.log(fieldName, fieldType, formulaField)

  // Create the new field with custom path
  // const newField = new Field(parentObject, fieldName, fieldType, annotations)
  // newField.path = [...formulaFieldsPath, pathNaclCase(newField.elemID.name)]

  // Remove the old field if it exists
  // if (oldField) {
  //   delete parentObject.value[oldField.name]
  // }
  // Add the new field to the parent object
  // parentObject.value[fieldName] = newField
}

const filterCreator: FilterCreator = () => ({
  name: 'convertFieldsToFormulaFields',
  onFetch: async (elements: Element[]) => {
    await Promise.all(
      elements
        .filter(isInstanceElement)
        .filter(element => !isCustomObjectOrCustomMetadataRecordTypeSync(element))
        .flatMap(element =>
          Object.keys(element.value).map(async field => {
            if (field === 'fields') {
              if (Array.isArray(element.value.fields)) {
                await Promise.all(
                  element.value.fields.map(innerField =>
                    createAndReplaceFormulaFieldFromMetadataInstance(
                      innerField,
                      //  element.elemID.getFullName()
                    ),
                  ),
                )
              } else {
                await createAndReplaceFormulaFieldFromMetadataInstance(
                  element.value.fields,
                  // element.elemID.getFullName(),
                )
              }
            }
          }),
        ),
    )

    // const objectTypes = elements as Value[]
    // // .filter(element => !isCustomObjectOrCustomMetadataRecordTypeSync(element))
    // const fields = objectTypes.filter(objectType => 'value' in objectType && 'formula' in objectType.value)
    // await Promise.all(
    //   fields.map(async objectType => {
    //     const b = 3
    //     console.log(b)
    //     const fieldType = Types.getKnownType(getFieldTypeName(objectType.value), true)
    //     const annotations = transformFieldAnnotations(objectType.value, objectType.getFullName())
    //     const serviceIds = {
    //       [API_NAME]: annotations[API_NAME],
    //       [OBJECT_SERVICE_ID]: toServiceIdsString({
    //         [API_NAME]: objectType.getFullName(),
    //         [METADATA_TYPE]: objectType.getType(),
    //       }),
    //     }
    //     const fieldApiName = objectType.value[INSTANCE_FULL_NAME_FIELD]
    //     const fieldName = Types.getElemId(naclCase(fieldApiName), true, serviceIds).name
    //     const neoField = new Field(objectType, fieldName, fieldType, annotations)
    //     objectType.fields[neoField.name] = neoField
    //   }),
    // )
    // // .filter(a => a.length > 0)
    // // .filter(a => a instanceof Object && !Array.isArray(a) && 'formula' in a)
    // // const formulaFields = fields.filter(field => 'formula' in field)
    // // console.log(fields)
    // if (Array.isArray(fields)) {
    //   /* empty */
    // }
  },
})

export default filterCreator
