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
import _ from 'lodash'
import path from 'path'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { ElemID, InstanceElement, isObjectType, ReadOnlyElementsSource, Values } from '@salto-io/adapter-api'
import { readTextFile } from '@salto-io/file'
import { CUSTOM_OBJECT, FIELD_ANNOTATIONS, SALESFORCE } from '../../constants'
import { isInstanceOfType } from '../../filters/utils'
import { FilesFilterCreator } from '../../filter'
import { apiName } from '../../transformers/transformer'
import { xmlToValues } from '../../transformers/xml_transformer'

const { awu } = collections.asynciterable
const log = logger(module)

const FIELD_FILE_NAME_REGEXP = new RegExp('(?<pkg>[^/]+)/(?<app>[^/]+)/(?<type>[^/]+)/(?<object>[^/]+)/.*\\.field-meta\\.xml')

const getFieldsOfCustomObject = async (
  customObjectName: string,
  packageDir: string,
  sourceFileNames: string[],
): Promise<Values[]> => {
  // After A LOT of messing around with SFDX, it seems like the way it determines which
  // object a field belongs to is that it expects a specific level of nesting.
  // it is assumed objects are under "<package>/something/something/something/<object name>"
  // where the default is "<package>/main/default/objects/<object name>" but the specific names
  // do not seem to matter, only the number of nesting levels
  //
  // funnily enough, the object definition itself can be pretty much anywhere as long as it is in
  // a folder with the same name as the object. but the fields must be under the structure
  // as described above
  // const [/* pkgName */, /* appName */, /* typeFolder */, objectName] = fileName.split(path.sep)
  const fieldFileNames = sourceFileNames
    .filter(fileName => {
      const match = fileName.match(FIELD_FILE_NAME_REGEXP)
      return match?.groups?.object === customObjectName
    })

  return awu(fieldFileNames)
    .map(async fileName => {
      const fileContent = await readTextFile.notFoundAsUndefined(path.join(packageDir, fileName))
      if (fileContent === undefined) {
        // Should never happen
        log.warn('skipping %s because we could not get its content', fileName)
        return undefined
      }
      return xmlToValues(fileContent).values
    })
    .filter(values.isDefined)
    .toArray()
}

const addFieldAccessAnnotations = async (
  customObjectName: string,
  fields: Values[],
  elementsSource: ReadOnlyElementsSource,
): Promise<Values[]> => {
  const elem = await elementsSource.get(new ElemID(SALESFORCE, customObjectName))
  const fieldAnnotations = isObjectType(elem)
    ? _.mapValues(
      elem.fields,
      fieldFromElem => _.pick(
        fieldFromElem.annotations,
        [FIELD_ANNOTATIONS.CREATABLE, FIELD_ANNOTATIONS.UPDATEABLE, FIELD_ANNOTATIONS.QUERYABLE],
      )
    )
    : {}
  return fields.map(field => ({
    ...field,
    ...fieldAnnotations[field.fullName] ?? {
      [FIELD_ANNOTATIONS.CREATABLE]: true,
      [FIELD_ANNOTATIONS.UPDATEABLE]: true,
      [FIELD_ANNOTATIONS.QUERYABLE]: true,
    },
  }))
}

const filterCreator: FilesFilterCreator = ({ files, config }) => ({
  name: 'sfdxCustomFieldsFilter',
  onFetch: async elements => {
    const customObjects = await awu(elements)
      .filter(isInstanceOfType(CUSTOM_OBJECT))
      .keyBy(apiName) as Record<string, InstanceElement>

    await awu(Object.entries(customObjects))
      .forEach(async ([customObjectName, customObjectInstance]) => {
        const fields = await getFieldsOfCustomObject(
          customObjectName,
          files.baseDirName,
          files.sourceFileNames,
        )
        // An issue that is specific to custom fields - because we don't have the soap API
        // to tell us about the field's access, we get all fields as if we have no access to them
        // in order to work around this issue, we try to take the values from the existing fields
        // annotations (from the element source), and assume all new fields have full access
        customObjectInstance.value.fields = await addFieldAccessAnnotations(
          customObjectName,
          fields,
          config.elementsSource,
        )
      })

    // TODO: merge system fields into the custom object as well, otherwise we are missing
    // references in layouts and this can cause conflicts
  },
})

export default filterCreator
