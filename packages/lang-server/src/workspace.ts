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
import _ from 'lodash'
import path from 'path'
import wu from 'wu'
import { Workspace, nacl, errors, validator, COMMON_ENV_PREFIX, elementSource } from '@salto-io/workspace'
import {
  Element,
  SaltoError,
  ElemID,
  Change,
  getChangeData,
  isRemovalChange,
  isReferenceExpression,
  isContainerType,
  Value,
  isModificationChange,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { parser } from '@salto-io/parser'
import { detailedCompare, walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'

const { validateElements } = validator

const { awu } = collections.asynciterable

export type WorkspaceOperation<T> = (workspace: Workspace) => Promise<T>

export class EditorWorkspace {
  private workspace: Workspace
  // Indicates that the workspace is not the active workspace
  // (which means that the active workspace contains errors)
  // attempting to modify a copy of a workspace will result in an error
  private runningSetOperation?: Promise<void>
  private runningWorkspaceOperation?: Promise<void>
  private pendingSets: { [key: string]: nacl.NaclFile } = {}
  private pendingDeletes: Set<string> = new Set<string>()
  private wsErrors?: Promise<Readonly<errors.Errors>>
  private runValidation: boolean

  constructor(
    public baseDir: string,
    workspace: Workspace,
    runValidation = true,
  ) {
    this.workspace = workspace
    this.runValidation = runValidation
  }

  get elements(): Promise<elementSource.ElementsSource> {
    return this.workspace.elements(false)
  }

  async getElementSourceOfPath(filePath: string): Promise<ReadOnlyElementsSource> {
    return this.workspace.getElementSourceOfPath(this.workspaceFilename(filePath), false)
  }

  errors(): Promise<errors.Errors> {
    if (!this.runValidation || _.isUndefined(this.wsErrors)) {
      this.wsErrors = this.workspace.errors()
    }
    return this.wsErrors
  }

  private workspaceFilename(filename: string): string {
    return path.relative(this.baseDir, filename)
  }

  private editorFilename(filename: string): string {
    return path.resolve(this.baseDir, filename)
  }

  private isWorkspaceFile(filePath: string): boolean {
    return [this.workspace.currentEnv(), COMMON_ENV_PREFIX].includes(
      this.workspace.envOfFile(this.workspaceFilename(filePath)),
    )
  }

  private editorNaclFile(naclFile: nacl.NaclFile): nacl.NaclFile {
    return {
      ...naclFile,
      filename: this.editorFilename(naclFile.filename),
    }
  }

  private editorParsedNaclFile(naclFile: nacl.ParsedNaclFile): nacl.ParsedNaclFile {
    return {
      ...naclFile,
      filename: this.editorFilename(naclFile.filename),
    }
  }

  private workspaceNaclFile(naclFile: nacl.NaclFile): nacl.NaclFile {
    return {
      ...naclFile,
      filename: this.workspaceFilename(naclFile.filename),
    }
  }

  private editorSourceRange(range: parser.SourceRange): parser.SourceRange {
    return {
      ...range,
      filename: this.editorFilename(range.filename),
    }
  }

  private editorSourceMap(sourceMap: parser.SourceMap): parser.SourceMap {
    return new parser.SourceMap(
      wu(sourceMap.entries()).map(([key, ranges]) => [key, ranges.map(range => this.editorSourceRange(range))]),
    )
  }

  private hasPendingUpdates(): boolean {
    return !(_.isEmpty(this.pendingSets) && _.isEmpty(this.pendingDeletes))
  }

  private addPendingNaclFiles(naclFiles: nacl.NaclFile[]): void {
    _.assignWith(this.pendingSets, _.keyBy(naclFiles, 'filename'))
  }

  private addPendingDeletes(names: string[]): void {
    names.forEach(n => this.pendingDeletes.add(n))
  }

  private async elementsInFiles(filenames: string[]): Promise<ElemID[]> {
    return awu(filenames)
      .map(async f => (await this.workspace.getParsedNaclFile(this.workspaceFilename(f)))?.elements())
      .filter(values.isDefined)
      .flat()
      .map(e => e.elemID)
      .toArray()
  }

  private async getUnresolvedRefOfFile(
    filename: string,
    elements: ElemID[],
  ): Promise<errors.UnresolvedReferenceValidationError[]> {
    const fileElements =
      (await (await this.workspace.getParsedNaclFile(this.workspaceFilename(filename)))?.elements()) ?? awu([])
    const validationErrors: errors.UnresolvedReferenceValidationError[] = []
    const getReferenceExpressions: WalkOnFunc = ({ value, path: elemPath }) => {
      if (isReferenceExpression(value)) {
        elements.forEach(elem => {
          if (elem.isEqual(value.elemID) || elem.isParentOf(value.elemID)) {
            validationErrors.push(
              new errors.UnresolvedReferenceValidationError({ elemID: elemPath, target: value.elemID }),
            )
          }
        })
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    }
    await awu(fileElements)
      .filter(e => !isContainerType(e))
      .forEach(async element =>
        walkOnElement({
          element,
          func: getReferenceExpressions,
        }),
      )
    return validationErrors
  }

  private async getUnresolvedRefForElement(ids: ElemID[]): Promise<errors.UnresolvedReferenceValidationError[]> {
    const fileToReferencedIds = _(
      await Promise.all(ids.map(async id => (await this.getElementReferencedFiles(id)).map(file => ({ id, file })))),
    )
      .flatten()
      .groupBy('file')
      .mapValues(val =>
        _.uniqBy(
          val.map(ref => ref.id),
          e => e.getFullName(),
        ),
      )
      .value()
    return (
      await Promise.all(
        Object.entries(fileToReferencedIds).map(([filename, elemIds]) =>
          this.getUnresolvedRefOfFile(filename, elemIds),
        ),
      )
    ).flat()
  }

  private async validateElements(ids: Set<string>): Promise<errors.ValidationError[]> {
    if (ids.size === 0) {
      return []
    }
    const elements = await this.workspace.elements()
    const elementsToValidate = (
      await Promise.all([...ids].map(async id => elements.get(ElemID.fromFullName(id))))
    ).filter(values.isDefined)
    return validateElements(elementsToValidate, elements)
  }

  private async getValidationErrors(files: string[], changes: Change[]): Promise<errors.ValidationError[]> {
    // We update the validation errors iterativly by validating the following elements:
    //   - all the elements in the changed files
    //   - all the elements that includes references expression to removed elements
    //   - all the elements that currently got validation errors
    const elementsWithValidationErrors =
      this.wsErrors === undefined
        ? []
        : (await this.wsErrors).validation.map(error => error.elemID.createTopLevelParentID().parent)
    const elementsInChangedFiles = await this.elementsInFiles(files)
    const elementNamesToValidate = new Set(
      wu
        .chain(
          elementsInChangedFiles,
          elementsWithValidationErrors,
          changes.map(c => getChangeData(c).elemID),
        )
        .map(elemID => elemID.getFullName()),
    )
    const validationErrors = await this.validateElements(elementNamesToValidate)
    const removalChangesOfTopLevels = changes.filter(isRemovalChange).map(c => getChangeData(c).elemID)
    const removalChangesOfNonTopLevels = changes
      .filter(isModificationChange)
      .flatMap(c => detailedCompare(c.data.before, c.data.after, { createFieldChanges: true }))
      .filter(isRemovalChange)
      .map(c => c.id)
    const unresolvedReferences = await this.getUnresolvedRefForElement([
      ...removalChangesOfTopLevels,
      ...removalChangesOfNonTopLevels,
    ])
    const unresolvedReferencesElemIDs = new Set(unresolvedReferences.map(e => e.elemID.getFullName()))
    return validationErrors
      .filter(e => !validator.isUnresolvedRefError(e) || !unresolvedReferencesElemIDs.has(e.elemID.getFullName()))
      .concat(unresolvedReferences)
  }

  private async runAggregatedSetOperation(): Promise<void> {
    if (this.hasPendingUpdates() && this.workspace !== undefined) {
      const env = this.workspace.currentEnv()
      const opDeletes = this.pendingDeletes
      const opUpdates = this.pendingSets
      this.pendingDeletes = new Set<string>()
      this.pendingSets = {}
      // We start by running all deleted
      const shouldCalcValidation = this.wsErrors === undefined && this.runValidation
      const removeChanges = !_.isEmpty(opDeletes)
        ? (await this.workspace.removeNaclFiles([...opDeletes], shouldCalcValidation))[env].changes
        : []
      // Now add the waiting changes
      const updateChanges = !_.isEmpty(opUpdates)
        ? (await this.workspace.setNaclFiles(Object.values(opUpdates), shouldCalcValidation))[env]?.changes ?? []
        : []
      if (this.runValidation && this.wsErrors !== undefined) {
        const validation = await this.getValidationErrors(
          [...opDeletes, ...Object.keys(opUpdates)].filter(f => this.isWorkspaceFile(f)),
          [...removeChanges, ...updateChanges],
        )
        const workspaceErrors = await this.workspace.errors()
        this.wsErrors = Promise.resolve(
          new errors.Errors({
            merge: workspaceErrors.merge,
            parse: workspaceErrors.parse,
            validation: [
              // Validation errors (that are not from configuration elements) are calculated
              // in this class to avoid recalculating the entire workspace validation errors on
              // each update. Thus, we take from workspace.errors only the config validation errors
              ...validation,
              ...workspaceErrors.validation.filter((err: SaltoError) => err.type === 'config'),
            ],
          }),
        )
      }

      // We recall this method to make sure no pending were added since
      // we started. Returning the promise will make sure the caller
      // keeps on waiting until the queue is clear.
      return this.runAggregatedSetOperation()
    }
    this.runningSetOperation = undefined
    return undefined
  }

  private async triggerAggregatedSetOperation(): Promise<void> {
    if (this.runningSetOperation === undefined) {
      this.runningSetOperation = this.runOperationWithWorkspace(() => this.runAggregatedSetOperation())
    }
    return this.runningSetOperation
  }

  async getNaclFile(filename: string): Promise<nacl.NaclFile | undefined> {
    const naclFile = await this.workspace.getNaclFile(this.workspaceFilename(filename))
    return naclFile && this.editorNaclFile(naclFile)
  }

  async getParsedNaclFile(filename: string): Promise<nacl.ParsedNaclFile | undefined> {
    const naclFile = await this.workspace.getParsedNaclFile(this.workspaceFilename(filename))
    return naclFile && this.editorParsedNaclFile(naclFile)
  }

  async listNaclFiles(): Promise<string[]> {
    return (await this.workspace.listNaclFiles()).map(filename => this.editorFilename(filename))
  }

  async getElements(filename: string): Promise<AsyncIterable<Element>> {
    const elements =
      (await (await this.workspace.getParsedNaclFile(this.workspaceFilename(filename)))?.elements()) ?? []
    return awu(elements)
  }

  async getSourceMap(filename: string): Promise<parser.SourceMap> {
    return this.editorSourceMap(await this.workspace.getSourceMap(this.workspaceFilename(filename)))
  }

  async getSourceRanges(elemID: ElemID): Promise<parser.SourceRange[]> {
    return (await this.workspace.getSourceRanges(elemID)).map(range => this.editorSourceRange(range))
  }

  async transformError(error: SaltoError): Promise<errors.WorkspaceError<SaltoError>> {
    const wsError = await this.workspace.transformError(error)
    return {
      ...wsError,
      sourceLocations: wsError.sourceLocations.map(location => ({
        ...location,
        sourceRange: this.editorSourceRange(location.sourceRange),
      })),
    }
  }

  setNaclFiles(naclFiles: nacl.NaclFile[]): Promise<void> {
    this.addPendingNaclFiles(naclFiles.map(file => this.workspaceNaclFile(file)))
    return this.triggerAggregatedSetOperation()
  }

  removeNaclFiles(names: string[]): Promise<void> {
    this.addPendingDeletes(names.map(name => this.workspaceFilename(name)))
    return this.triggerAggregatedSetOperation()
  }

  hasErrors(): Promise<boolean> {
    return this.workspace.hasErrors()
  }

  async getElementReferencedFiles(id: ElemID): Promise<string[]> {
    return (await this.workspace.getElementReferencedFiles(id)).map(filename => this.editorFilename(filename))
  }

  async getElementNaclFiles(id: ElemID): Promise<string[]> {
    return (await this.workspace.getElementNaclFiles(id)).map(filename => this.editorFilename(filename))
  }

  private async validateFilesImpl(filenames: string[]): Promise<errors.Errors> {
    if (!this.runValidation || _.isUndefined(this.wsErrors)) {
      return this.errors()
    }
    const relevantFilenames = filenames.filter(f => this.isWorkspaceFile(f))
    const currentErrors = await this.wsErrors
    const elements = new Set((await this.elementsInFiles(relevantFilenames)).map(e => e.getFullName()))
    const validation = currentErrors.validation
      .filter(e => !elements.has(e.elemID.createTopLevelParentID().parent.getFullName()))
      .concat(await this.validateElements(elements))
    this.wsErrors = Promise.resolve(
      new errors.Errors({
        ...currentErrors,
        validation,
      }),
    )
    return this.wsErrors
  }

  async validateFiles(filenames: string[]): Promise<errors.Errors> {
    return this.runOperationWithWorkspace(() => this.validateFilesImpl(filenames))
  }

  async validate(): Promise<errors.Errors> {
    this.wsErrors = undefined
    return this.errors()
  }

  async awaitAllUpdates(): Promise<void> {
    await this.runningSetOperation
  }

  private async waitForOperation(operationPromise: Promise<unknown>): Promise<void> {
    await operationPromise
    this.runningWorkspaceOperation = undefined
  }

  async runOperationWithWorkspace<T>(operation: WorkspaceOperation<T>): Promise<T> {
    while (this.runningWorkspaceOperation !== undefined) {
      // eslint-disable-next-line no-await-in-loop
      await this.runningWorkspaceOperation
    }
    const operationPromise = operation(this.workspace)
    this.runningWorkspaceOperation = this.waitForOperation(operationPromise)
    return operationPromise
  }

  async getValue(id: ElemID): Promise<Value | undefined> {
    return this.workspace.getValue(id)
  }

  async getSearchableNames(): Promise<string[]> {
    return this.workspace.getSearchableNames()
  }
}
