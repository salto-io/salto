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
  AdditionChange,
  Change,
  CORE_ANNOTATIONS,
  Element,
  Field,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  isModificationChange,
  isObjectType,
  isReferenceExpression,
  isTemplateExpression,
  MapType,
  ModificationChange,
  SaltoElementError,
  SaltoError,
  StaticFile,
  TemplateExpression,
} from '@salto-io/adapter-api'
import {
  applyFunctionToChangeData,
  getInstancesFromElementSource,
  inspectValue,
  naclCase,
  replaceTemplatesWithValues,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues, values } from '@salto-io/lowerdash'
import { parserUtils } from '@salto-io/parser'
import JSZip from 'jszip'
import _, { remove } from 'lodash'
import ZendeskClient from '../client/client'
import { FETCH_CONFIG, isGuideThemesEnabled, Themes } from '../config'
import {
  GUIDE_THEME_TYPE_NAME,
  THEME_FILE_TYPE_NAME,
  THEME_FOLDER_TYPE_NAME,
  THEME_SETTINGS_TYPE_NAME,
  ZENDESK,
} from '../constants'
import { FilterCreator } from '../filter'
import { create } from './guide_themes/create'
import { deleteTheme } from './guide_themes/delete'
import { download } from './guide_themes/download'
import { publish } from './guide_themes/publish'
import {
  createHandlebarTemplateExpression,
  createHtmlTemplateExpression,
  createJavascriptTemplateExpression,
  TemplateEngineCreator,
} from './template_engines/creator'
import { getBrandsForGuideThemes, matchBrandSubdomainFunc } from './utils'
import { prepRef } from './article/utils'

const log = logger(module)
const { isPlainRecord } = lowerdashValues
const { awu } = collections.asynciterable

type ThemeFile = { filename: string; content: StaticFile }
type DeployInputThemeFile = { filename: string; content: Buffer | TemplateExpression }
type DeployOutputThemeFile = { filename: string; content: Buffer }

export type ThemeDirectory = {
  files: Record<string, ThemeFile | DeployInputThemeFile>
  folders: Record<string, ThemeDirectory>
}

const createTemplateExpression = ({
  filePath,
  content,
  idsToElements,
  matchBrandSubdomain,
  config,
}: {
  filePath: string
  content: string
  idsToElements: Record<string, InstanceElement>
  matchBrandSubdomain: (url: string) => InstanceElement | undefined
  config: Themes
}): string | TemplateExpression => {
  if (config.referenceOptions.enableReferenceLookup === false) {
    return content
  }
  try {
    let createTemplateExpressionFunc: TemplateEngineCreator
    if (filePath.endsWith('.hbs')) {
      createTemplateExpressionFunc = createHandlebarTemplateExpression
    } else if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
      createTemplateExpressionFunc = createHtmlTemplateExpression
    } else if (filePath.endsWith('.js')) {
      createTemplateExpressionFunc = createJavascriptTemplateExpression
    } else {
      return content
    }
    return createTemplateExpressionFunc(
      content,
      {
        idsToElements,
        matchBrandSubdomain,
        enableMissingReferences: false, // Starting with false, to gain confidence in the feature
      },
      config.referenceOptions.javascriptReferenceLookupStrategy,
    )
  } catch (e) {
    log.warn('Error parsing references in file %s, %o', filePath, e)
    return content
  }
}

export const unzipFolderToElements = async ({
  buffer,
  currentBrandName,
  name,
  idsToElements,
  matchBrandSubdomain,
  config,
}: {
  buffer: Buffer
  currentBrandName: string
  name: string
  idsToElements: Record<string, InstanceElement>
  matchBrandSubdomain: (url: string) => InstanceElement | undefined
  config: Themes
}): Promise<ThemeDirectory> => {
  const zip = new JSZip()
  const unzippedContents = await zip.loadAsync(buffer)

  const elements: ThemeDirectory = { files: {}, folders: {} }
  const addFile = async ({
    fullPath,
    pathParts,
    file,
    currentDir,
  }: {
    fullPath: string
    pathParts: string[]
    file: JSZip.JSZipObject
    currentDir: ThemeDirectory
  }): Promise<void> => {
    const [firstPart, ...rest] = pathParts

    if (pathParts.length === 1) {
      // It's a file
      const filepath = `${ZENDESK}/themes/brands/${currentBrandName}/${name}/${fullPath}`
      const content = await file.async('nodebuffer')
      const templateExpression = createTemplateExpression({
        filePath: fullPath,
        content: content.toString(),
        idsToElements,
        matchBrandSubdomain,
        config,
      })
      const staticFile =
        typeof templateExpression === 'string'
          ? new StaticFile({ filepath, content })
          : parserUtils.templateExpressionToStaticFile(templateExpression, filepath)
      currentDir.files[naclCase(firstPart)] = {
        filename: fullPath,
        content: staticFile,
      }
      return
    }
    // It's a folder
    if (!currentDir.folders[naclCase(firstPart)]) {
      currentDir.folders[naclCase(firstPart)] = { files: {}, folders: {} }
    }
    await addFile({
      fullPath,
      pathParts: rest,
      file,
      currentDir: currentDir.folders[naclCase(firstPart)],
    })
  }
  await Promise.all(
    Object.entries(unzippedContents.files).map(async ([fullPath, file]): Promise<void> => {
      if (!file.dir) {
        const pathParts = fullPath.split('/')
        await addFile({ fullPath, pathParts, file, currentDir: elements })
      }
    }),
  )
  return elements
}

const isDeployInputThemeFile = (file: ThemeFile | DeployInputThemeFile): file is DeployInputThemeFile => {
  const isValidContent = Buffer.isBuffer(file.content) || isTemplateExpression(file.content)
  if (isValidContent === false) {
    log.error(
      `content for file ${file.filename} is not a buffer or a template expression, will not add it to the deploy`,
    )
  }
  return isValidContent
}
const isThemeDirectory = (dir: unknown): dir is ThemeDirectory => {
  if (!isPlainRecord(dir)) {
    return false
  }
  return isPlainRecord(dir.files) && isPlainRecord(dir.folders)
}

const extractFilesFromThemeDirectory = (
  themeDirectory: ThemeDirectory,
): { files: DeployOutputThemeFile[]; errors: string[] } => {
  let files: DeployOutputThemeFile[] = []
  let errors: string[] = []
  if (!isThemeDirectory(themeDirectory)) {
    // TODO should be tested in SALTO-5320
    log.error('current theme directory is not valid: %o', inspectValue(themeDirectory))
    return { files, errors: ['Invalid theme directory'] }
  }
  // Add all files in the current directory
  Object.values(themeDirectory.files).forEach(fileRecord => {
    if (isDeployInputThemeFile(fileRecord)) {
      if (isTemplateExpression(fileRecord.content)) {
        try {
          replaceTemplatesWithValues({ values: [fileRecord], fieldName: 'content' }, {}, prepRef)
        } catch (e) {
          log.error('Error while resolving references in file %s', fileRecord.filename)
          errors.push(`Error while resolving references in file ${fileRecord.filename}`)
          return
        }
        if (isTemplateExpression(fileRecord.content)) {
          log.error('Failed to resolve all references in file %s', fileRecord.filename)
          errors.push(`Failed to resolve all references in file ${fileRecord.filename}`)
          return
        }
        // The content is replaced and is now a string
        fileRecord.content = Buffer.from(fileRecord.content as unknown as string)
      }
      files.push({
        filename: fileRecord.filename,
        content: fileRecord.content,
      })
    }
  })
  // Recursively add files from subdirectories
  Object.values(themeDirectory.folders).forEach(subdirectory => {
    const { files: subFiles, errors: subErrors } = extractFilesFromThemeDirectory(subdirectory)
    files = files.concat(subFiles)
    errors = errors.concat(subErrors)
  })
  return { files, errors }
}

const getFullName = (instance: InstanceElement): string => instance.elemID.getFullName()

const addDownloadErrors = (theme: InstanceElement, downloadErrors: string[]): SaltoError[] =>
  downloadErrors.length > 0
    ? downloadErrors.map(e => ({
        message: `Error fetching theme id ${theme.value.id}, ${e}`,
        severity: 'Warning',
      }))
    : [
        {
          message: `Error fetching theme id ${theme.value.id}, no content returned from Zendesk API`,
          severity: 'Warning',
        },
      ]

const createTheme = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: ZendeskClient,
  isLiveTheme: boolean,
): Promise<string[]> => {
  const live = isLiveTheme
  const { brand_id: brandId, root } = change.data.after.value
  const { files: staticFiles, errors: extractionErrors } = extractFilesFromThemeDirectory(root)
  const { themeId, errors: elementErrors } = await create({ brandId, staticFiles }, client)
  if (themeId === undefined) {
    return [
      ...elementErrors,
      ...extractionErrors,
      // TODO check if we need this error
      `Missing theme id from create theme response for theme ${change.data.after.elemID.getFullName()}`,
    ]
  }
  getChangeData(change).value.id = themeId
  if (live && elementErrors.length === 0) {
    const publishErrors = await publish(themeId, client)
    return publishErrors
  }
  return [...elementErrors, ...extractionErrors]
}

const updateTheme = async (
  change: ModificationChange<InstanceElement>,
  client: ZendeskClient,
  isLiveTheme: boolean,
): Promise<string[]> => {
  const elementErrors = await createTheme(change, client, isLiveTheme)
  if (elementErrors.length > 0) {
    const lastError = elementErrors[elementErrors.length - 1]
    if (lastError.includes('Failed to publish')) {
      elementErrors.pop()
      elementErrors.push(
        `${lastError}. The theme has been created but not published; you can manually publish it in the Zendesk UI.`,
      )
    }
    return elementErrors
  }
  return deleteTheme(change.data.before.value.id, client)
}

// we should replace it once the fix is available
const fixThemeTypes = (elements: Element[]): void => {
  const relevantTypes = elements
    .filter(isObjectType)
    .filter(type =>
      [GUIDE_THEME_TYPE_NAME, THEME_FOLDER_TYPE_NAME, THEME_FILE_TYPE_NAME].includes(type.elemID.typeName),
    )
  const themeType = relevantTypes.find(type => GUIDE_THEME_TYPE_NAME === type.elemID.typeName)
  const themeFolderType = relevantTypes.find(type => THEME_FOLDER_TYPE_NAME === type.elemID.typeName)
  const themeFileType = relevantTypes.find(type => THEME_FILE_TYPE_NAME === type.elemID.typeName)
  if (themeType === undefined || themeFolderType === undefined || themeFileType === undefined) {
    log.error('could not fix types for themes')
    return
  }
  themeFolderType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false
  themeFileType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false
  themeFolderType.fields.files = new Field(themeFolderType, 'files', new MapType(themeFileType))
  themeType.fields.root = new Field(themeType, 'root', themeFolderType)
}

/**
 * Fetches guide theme content
 */
const filterCreator: FilterCreator = ({ config, client, elementsSource }) => ({
  name: 'guideThemesFilter',
  onFetch: async elements => {
    if (!isGuideThemesEnabled(config[FETCH_CONFIG])) {
      return undefined
    }

    fixThemeTypes(elements)

    const instances = elements.filter(isInstanceElement)
    const guideThemes = instances.filter(instance => instance.elemID.typeName === GUIDE_THEME_TYPE_NAME)
    const brands = getBrandsForGuideThemes(instances, config[FETCH_CONFIG])
    const fullNameByNameBrand = _.mapValues(_.keyBy(brands, getFullName), 'value.name')
    const getBrandName = (theme: InstanceElement): string | undefined => {
      if (!isReferenceExpression(theme.value.brand_id)) {
        log.info('brand_id is not a reference expression for instance %s.', theme.elemID.getFullName())
        return undefined
      }
      const brandElemId = theme.value.brand_id?.elemID.getFullName()
      const brandName = fullNameByNameBrand[brandElemId]
      if (brandName === undefined) {
        log.info('brand name was not found for instance %s.', theme.elemID.getFullName())
        return undefined
      }
      return brandName
    }
    const matchBrandSubdomain = matchBrandSubdomainFunc(instances, config[FETCH_CONFIG])
    const idsToElements = await awu(await elementsSource.getAll())
      .filter(isInstanceElement)
      .filter(element => element.value.id !== undefined)
      .reduce<Record<string, InstanceElement>>((acc, elem) => {
        acc[elem.value.id] = elem
        return acc
      }, {})

    const processedThemes = await Promise.all(
      guideThemes.map(async (theme): Promise<{ successfulTheme?: InstanceElement; errors: SaltoError[] }> => {
        const currentBrandName = getBrandName(theme)
        if (currentBrandName === undefined) {
          // a log is written in the getBrandName func
          remove(elements, element => element.elemID.isEqual(theme.elemID))
          return { errors: [] }
        }
        const { content: themeZip, errors: downloadErrors } = await download(theme.value.id, client)
        if (themeZip === undefined) {
          remove(elements, element => element.elemID.isEqual(theme.elemID))
          return { errors: addDownloadErrors(theme, downloadErrors) }
        }
        try {
          const themeElements = await unzipFolderToElements({
            buffer: themeZip,
            currentBrandName,
            name: theme.value.name,
            idsToElements,
            matchBrandSubdomain,
            config: config[FETCH_CONFIG].guide?.themes || {
              referenceOptions: {
                enableReferenceLookup: false,
              },
            },
          })
          theme.value.root = themeElements
        } catch (e) {
          if (!(e instanceof Error)) {
            remove(elements, element => element.elemID.isEqual(theme.elemID))
            log.error('Error fetching theme id %s, %o', theme.value.id, e)
            return {
              errors: [{ message: `Error fetching theme id ${theme.value.id}, ${e}`, severity: 'Warning' }],
            }
          }

          remove(elements, element => element.elemID.isEqual(theme.elemID))
          return {
            errors: [
              {
                message: `Error fetching theme id ${theme.value.id}, ${e.message}`,
                severity: 'Warning',
              },
            ],
          }
        }
        return { successfulTheme: theme, errors: [] }
      }),
    )
    const errors = processedThemes.flatMap(theme => theme.errors)
    return { errors }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [themeChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        // Removal changes are handled in the default config.
        isAdditionOrModificationChange(change) && GUIDE_THEME_TYPE_NAME === getChangeData(change).elemID.typeName,
    )

    if (_.isEmpty(themeChanges)) {
      return { deployResult: { appliedChanges: [], errors: [] }, leftoverChanges }
    }

    // If multiple theme settings exist for a single brand, we will randomly select and examine only one setting to
    // ensure there is just one live theme per brand.
    const liveThemesByBrand = Object.fromEntries(
      (await getInstancesFromElementSource(elementsSource, [THEME_SETTINGS_TYPE_NAME]))
        .filter(
          instance => isReferenceExpression(instance.value.liveTheme) && isReferenceExpression(instance.value.brand),
        )
        .map(instance => [instance.value.brand.elemID.getFullName(), instance.value.liveTheme.elemID.getFullName()]),
    )
    const liveThemesNames = new Set(Object.values(liveThemesByBrand))

    const processedChanges = await Promise.all(
      themeChanges
        .filter(isAdditionOrModificationChange)
        .map(async (change): Promise<{ appliedChange?: Change<InstanceElement>; errors: SaltoElementError[] }> => {
          const clonedChange = await applyFunctionToChangeData<
            AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
          >(change, inst => inst.clone())
          const isLiveTheme = liveThemesNames.has(getChangeData(clonedChange).elemID.getFullName())
          const elementErrors = isModificationChange(clonedChange)
            ? await updateTheme(clonedChange, client, isLiveTheme)
            : await createTheme(clonedChange, client, isLiveTheme)
          if (getChangeData(clonedChange).value.id !== undefined) {
            // The theme id is set in the createTheme function
            getChangeData(change).value.id = getChangeData(clonedChange).value.id
          }
          if (elementErrors.length > 0) {
            return {
              errors: elementErrors.map(e => ({
                elemID: clonedChange.data.after.elemID,
                message: e,
                severity: 'Error',
              })),
            }
          }
          // We return the original change with the updated theme id (with TemplateExpressions)
          return { appliedChange: change, errors: [] }
        }),
    )
    const errors = processedChanges.flatMap(change => change.errors)
    const appliedChanges = processedChanges.map(change => change.appliedChange).filter(values.isDefined)
    return { deployResult: { appliedChanges, errors }, leftoverChanges }
  },
})

export default filterCreator
