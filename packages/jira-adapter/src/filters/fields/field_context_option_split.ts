/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemIdGetter,
  Field,
  InstanceElement,
  isInstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { config as configUtils, elements as adapterElements } from '@salto-io/adapter-components'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'
import { FilterCreator } from '../../filter'
import { findObject, setTypeDeploymentAnnotations } from '../../utils'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME } from './constants'
import { getOptionsFromContext } from './context_options'

const { getTransformationConfigByType } = configUtils
const { toBasicInstance } = adapterElements

const FIELD_CONTEXT_OPTIONS_FILE_NAME = 'Options'
export const CONTEXT_NAME_FIELD = 'contextName'

const getOptionInstancesFromContext = async (
  context: InstanceElement,
  fieldContextOptionType: ObjectType,
  getElemIdFunc: ElemIdGetter | undefined,
): Promise<InstanceElement[]> =>
  Promise.all(
    getOptionsFromContext(context).map(async (option: Values) => {
      option[CONTEXT_NAME_FIELD] = context.elemID.name
      const optionInstance = await toBasicInstance({
        entry: option,
        type: fieldContextOptionType,
        transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
        transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
        defaultName: naclCase(`${context.elemID.name}_${option.value}`),
        getElemIdFunc,
        parent: context,
      })
      optionInstance.path = context.path && [
        ...context.path,
        pathNaclCase(naclCase(`${context.elemID.name}_${FIELD_CONTEXT_OPTIONS_FILE_NAME}`)),
        // TODO: we should consider remove the context.elemID.name from the name because it is very long
      ]

      return optionInstance
    }),
  )

const filter: FilterCreator = ({ config, getElemIdFunc }) => ({
  name: 'fieldContextOptionsSplitFilter',
  onFetch: async elements => {
    if (!config.fetch.splitFieldContext) {
      return
    }

    const fieldContextType = findObject(elements, FIELD_CONTEXT_TYPE_NAME)
    const fieldContextOptionType = findObject(elements, FIELD_CONTEXT_OPTION_TYPE_NAME)

    if (fieldContextType === undefined || fieldContextOptionType === undefined) {
      return
    }

    fieldContextType.fields.options = new Field(fieldContextType, 'options', new ListType(BuiltinTypes.STRING))

    fieldContextOptionType.fields[CONTEXT_NAME_FIELD] = new Field(
      fieldContextOptionType,
      CONTEXT_NAME_FIELD,
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      },
    )
    setTypeDeploymentAnnotations(fieldContextOptionType) // TODO: what do I need this for?

    const contexts = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)

    const options = _.flatten(
      await Promise.all(
        contexts
          .filter(context => context.value.options !== undefined)
          .flatMap(async context => {
            const contextOptions = await getOptionInstancesFromContext(context, fieldContextOptionType, getElemIdFunc)
            context.value.options = contextOptions.map(option => new ReferenceExpression(option.elemID, option, option))
            return contextOptions
          }),
      ),
    )

    contexts.forEach(context => {
      context.path = context.path && [...context.path, context.path[context.path.length - 1]]
    })

    options.forEach(option => elements.push(option))
  },
})

export default filter
