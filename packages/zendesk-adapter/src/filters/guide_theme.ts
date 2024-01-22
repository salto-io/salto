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
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  isModificationChange,
  isReferenceExpression,
  ModificationChange,
  SaltoElementError,
  SaltoError,
  StaticFile,
  Element,
  isObjectType, Field, MapType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import JSZip from 'jszip'
import _, { remove } from 'lodash'
import { getInstancesFromElementSource, naclCase } from '@salto-io/adapter-utils'
import ZendeskClient from '../client/client'
import { FETCH_CONFIG, isGuideThemesEnabled } from '../config'
import {
  GUIDE_THEME_TYPE_NAME, THEME_FILE_TYPE_NAME, THEME_FOLDER_TYPE_NAME, THEME_SETTINGS_TYPE_NAME, ZENDESK,
} from '../constants'
import { FilterCreator } from '../filter'
import { create } from './guide_themes/create'
import { deleteTheme } from './guide_themes/delete'
import { download } from './guide_themes/download'
import { publish } from './guide_themes/publish'
import { getBrandsForGuideThemes } from './utils'

const log = logger(module)

type ThemeFile = { filename: string; content: StaticFile }
type DeployThemeFile = { filename: string; content: Buffer }


type ThemeDirectory = {
  files: Record<string, ThemeFile | DeployThemeFile>
  folders: Record<string, ThemeDirectory>
}

const unzipFolderToElements = async (
  buffer: Buffer, brandName: string, name: string,
): Promise<ThemeDirectory> => {
  const zip = new JSZip()
  const unzippedContents = await zip.loadAsync(buffer)

  const elements: ThemeDirectory = { files: {}, folders: {} }
  const addFile = async (
    fullPath: string,
    pathParts: string[],
    file: JSZip.JSZipObject,
    currentDir: ThemeDirectory
  ): Promise<void> => {
    const [firstPart, ...rest] = pathParts

    if (pathParts.length === 1) {
      // It's a file
      const filepath = `${ZENDESK}/themes/brands/${brandName}/${name}/${fullPath}`
      const content = await file.async('nodebuffer')
      currentDir.files[naclCase(firstPart)] = {
        filename: fullPath,
        content: new StaticFile({ filepath, content }),
      }
    } else {
      // It's a folder
      if (!currentDir.folders[naclCase(firstPart)]) {
        currentDir.folders[naclCase(firstPart)] = { files: {}, folders: {} }
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await addFile(fullPath, rest, file, currentDir.folders[naclCase(firstPart)])
    }
  }
  await Promise.all(Object.entries(unzippedContents.files).map(async ([relativePath, file]): Promise<void> => {
    if (!file.dir) {
      const pathParts = relativePath.split('/')
      await addFile(relativePath, pathParts, file, elements)
    }
  }))
  return elements
}

const extractFilesFromThemeDirectory = (themeDirectory: ThemeDirectory): DeployThemeFile[] => {
  let files: DeployThemeFile[] = []
  // Add all files in the current directory
  Object.values(themeDirectory.files).forEach(fileRecord => {
    files.push(fileRecord as DeployThemeFile)
  })

  // Recursively add files from subdirectories
  Object.values(themeDirectory.folders).forEach(subdirectory => {
    files = files.concat(extractFilesFromThemeDirectory(subdirectory))
  })
  return files
}

const getFullName = (instance: InstanceElement): string => instance.elemID.getFullName()

const addDownloadErrors = (
  theme: InstanceElement,
  downloadErrors: string[]
): SaltoError[] => ((downloadErrors.length > 0)
  ? downloadErrors.map(e => ({
    message: `Error fetching theme id ${theme.value.id}, ${e}`,
    severity: 'Warning',
  }))
  : [{
    message: `Error fetching theme id ${theme.value.id}, no content returned from Zendesk API`,
    severity: 'Warning',
  }])

const createTheme = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: ZendeskClient,
  isLiveTheme: boolean
): Promise<string[]> => {
  const live = isLiveTheme
  const { brand_id: brandId, root } = change.data.after.value
  const staticFiles = extractFilesFromThemeDirectory(root)
  const { themeId, errors: elementErrors } = await create({ brandId, staticFiles }, client)
  if (themeId === undefined) {
    return [
      ...elementErrors,
      `Missing theme id from create theme response for theme ${change.data.after.elemID.getFullName()}`,
    ]
  }
  getChangeData(change).value.id = themeId
  if (live && elementErrors.length === 0) {
    const publishErrors = await publish(themeId, client)
    return publishErrors
  }
  return elementErrors
}

const updateTheme = async (
  change: ModificationChange<InstanceElement>, client: ZendeskClient, isLiveTheme: boolean
): Promise<string[]> => {
  const elementErrors = await createTheme(change, client, isLiveTheme)
  if (elementErrors.length > 0) {
    const lastError = elementErrors[elementErrors.length - 1]
    if (lastError.includes('Failed to publish')) {
      elementErrors[elementErrors.length - 1] = `${lastError}. The theme has been created but not published; you can manually publish it in the Zendesk UI.`
    }
    return elementErrors
  }
  return deleteTheme(change.data.before.value.id, client)
}

const fixThemeTypes = (elements: Element[]): void => {
  const relevantTypes = elements
    .filter(isObjectType)
    .filter(type => [GUIDE_THEME_TYPE_NAME, THEME_FOLDER_TYPE_NAME, THEME_FILE_TYPE_NAME]
      .includes(type.elemID.typeName))
  const themeType = relevantTypes.find(type => GUIDE_THEME_TYPE_NAME === type.elemID.typeName)
  const themeFolderType = relevantTypes.find(type => THEME_FOLDER_TYPE_NAME === type.elemID.typeName)
  const themeFileType = relevantTypes.find(type => THEME_FILE_TYPE_NAME === type.elemID.typeName)
  if (themeType === undefined || themeFolderType === undefined || themeFileType === undefined) {
    log.error('could not fix types for themes')
    return
  }
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
        log.info('brandName was not found for instance %s.', theme.elemID.getFullName())
        return undefined
      }
      return brandName
    }

    const processedThemes = await Promise.all(guideThemes
      .map(async (theme): Promise<{ successfulTheme?: InstanceElement; errors: SaltoError[] }> => {
        const brandName = getBrandName(theme)
        if (brandName === undefined) {
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
          const themeElements = await unzipFolderToElements(
            themeZip, brandName, theme.value.name
          )
          theme.value.root = themeElements
        } catch (e) {
          if (!(e instanceof Error)) {
            remove(elements, element => element.elemID.isEqual(theme.elemID))
            log.error('Error fetching theme id %s, %o', theme.value.id, e)
            return {
              errors: [
                { message: `Error fetching theme id ${theme.value.id}, ${e}`, severity: 'Warning' },
              ],
            }
          }

          remove(elements, element => element.elemID.isEqual(theme.elemID))
          return {
            errors: [{
              message: `Error fetching theme id ${theme.value.id}, ${e.message}`,
              severity: 'Warning',
            }],
          }
        }
        return { successfulTheme: theme, errors: [] }
      }))
    const errors = processedThemes.flatMap(theme => theme.errors)
    return { errors }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [themeChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        // Removal changes are handled in the default config.
        isAdditionOrModificationChange(change)
        && GUIDE_THEME_TYPE_NAME === getChangeData(change).elemID.typeName,
    )

    if (_.isEmpty(themeChanges)) {
      return { deployResult: { appliedChanges: [], errors: [] }, leftoverChanges }
    }

    // If multiple theme settings exist for a single brand, we will randomly select and examine only one setting to
    // ensure there is just one live theme per brand.
    const liveThemesByBrand = Object.fromEntries(
      (await getInstancesFromElementSource(elementsSource, [THEME_SETTINGS_TYPE_NAME]))
        .filter(instance => isReferenceExpression(instance.value.liveTheme)
          && isReferenceExpression(instance.value.brand))
        .map(instance => [instance.value.brand.elemID.getFullName(), instance.value.liveTheme.elemID.getFullName()])
    )
    const liveThemesNames = new Set(Object.values(liveThemesByBrand))

    const processedChanges = await Promise.all(themeChanges
      .filter(isAdditionOrModificationChange)
      .map(async (change): Promise<{ appliedChange?: Change<InstanceElement>; errors: SaltoElementError[] }> => {
        const isLiveTheme = liveThemesNames.has(getChangeData(change).elemID.getFullName())
        const elementErrors = isModificationChange(change)
          ? await updateTheme(change, client, isLiveTheme)
          : await createTheme(change, client, isLiveTheme)
        if (elementErrors.length > 0) {
          return {
            errors: elementErrors.map(e => ({
              elemID: change.data.after.elemID,
              message: e,
              severity: 'Error',
            })),
          }
        }
        return { appliedChange: change, errors: [] }
      }))
    const errors = processedChanges.flatMap(change => change.errors)
    const appliedChanges = processedChanges.map(change => change.appliedChange).filter(values.isDefined)
    return { deployResult: { appliedChanges, errors }, leftoverChanges }
  },
})

export default filterCreator
