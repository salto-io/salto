/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Workspace, nacl, errors, parser, validator } from '@salto-io/workspace'
import { Element, SaltoError, ElemID, Change, getChangeElement,
  isRemovalChange, isReferenceExpression, isContainerType, Value } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { transformElement, TransformFuncArgs } from '@salto-io/adapter-utils'

const { validateElements } = validator
export type WorkspaceOperation<T> = (workspace: Workspace) => Promise<T>

export class EditorWorkspace {
  private workspace: Workspace
  // Indicates that the workspace is not the active workspace
  // (which means that the active workspace contains errors)
  // attempting to modify a copy of a workspace will result in an error
  private runningSetOperation?: Promise<void>
  private runningWorkspaceOperation?: Promise<void>
  private pendingSets: {[key: string]: nacl.NaclFile} = {}
  private pendingDeletes: Set<string> = new Set<string>()
  private wsErrors?: Promise<Readonly<errors.Errors>>

  constructor(public baseDir: string, workspace: Workspace) {
    this.workspace = workspace
  }

  get elements(): Promise<readonly Element[]> {
    return this.workspace.elements(false)
  }

  errors(): Promise<errors.Errors> {
    if (_.isUndefined(this.wsErrors)) {
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

  private editorNaclFile(naclFile: nacl.NaclFile): nacl.NaclFile {
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
    return new parser.SourceMap(wu(sourceMap.entries())
      .map(([key, ranges]) => [
        key,
        ranges.map(range => this.editorSourceRange(range)),
      ]))
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
    return (await Promise.all(
      filenames.map(f => this.workspace.getParsedNaclFile(this.workspaceFilename(f)))
    )).filter(values.isDefined)
      .flatMap(parsed => parsed.elements)
      .map(e => e.elemID)
  }

  private async getUnresolvedRefOfFile(target: ElemID, filename: string):
  Promise<errors.UnresolvedReferenceValidationError[]> {
    const elements = (await this.workspace.getParsedNaclFile(
      this.workspaceFilename(filename)
    ))?.elements ?? []
    const ids = new Set<string>()
    const getReferenceExpressions = ({ value, path: elemPath }: TransformFuncArgs): Value => {
      if (isReferenceExpression(value) && elemPath) {
        if (target.isEqual(value.elemId) || target.isParentOf(value.elemId)) {
          ids.add(elemPath.getFullName())
        }
      }
      return value
    }
    elements.forEach(element => {
      if (!isContainerType(element)) {
        transformElement({ element, transformFunc: getReferenceExpressions, strict: false })
      }
    })
    return [...ids].map(id => new errors.UnresolvedReferenceValidationError(
      { elemID: ElemID.fromFullName(id), target }
    ))
  }

  private async getUnresolvedRefForElement(element: Element):
  Promise<errors.UnresolvedReferenceValidationError[]> {
    const filesWithRefExpToElem = await this.getElementReferencesToFiles(element.elemID)
    return (await Promise.all(
      filesWithRefExpToElem.map(file => this.getUnresolvedRefOfFile(element.elemID, file))
    )).flat()
  }

  private async getValidationErrors(files: string[], changes: Change<Element>[]):
  Promise<errors.ValidationError[]> {
    // We update the validation errors iterativly by validating the following elements:
    //   - all the elements in the changed files
    //   - all the elements that includes references expression to removed elements
    //   - all the elements that currently got validation errors
    const elementNamesToValidate = new Set<string>()
    if (this.wsErrors) {
      (await this.errors()).validation
        .forEach(ve => {
          elementNamesToValidate.add(ve.elemID.createTopLevelParentID().parent.getFullName())
        })
    }
    const parsedNaclFiles = (await Promise.all(files.map(
      file => this.workspace.getParsedNaclFile(this.workspaceFilename(file))
    ))).filter(values.isDefined)
    parsedNaclFiles.forEach(parsed => {
      parsed.elements.forEach(elem => elementNamesToValidate.add(elem.elemID.getFullName()))
    })
    const elementsToValidate = (await Promise.all([...elementNamesToValidate]
      .map(name => this.workspace.getElement(ElemID.fromFullName(name)))))
      .flat()
      .filter(values.isDefined)
    const validationErrors = validateElements(
      elementsToValidate, await this.workspace.elements()
    )
    const unresolvedReferences = (await Promise.all(
      changes
        .filter(isRemovalChange)
        .map(getChangeElement)
        .map(async element => this.getUnresolvedRefForElement(element))
    )).flat()
    return validationErrors
      .filter(e => !validator.isUnresolvedRefError(e))
      .concat(unresolvedReferences)
  }

  private async update(opDeletes: string[], opNaclFiles: Record<string, nacl.NaclFile>):
  Promise<Change<Element>[]> {
    // We start by running all deleted
    const removeChanges = (!_.isEmpty(opDeletes) && this.workspace)
      ? await this.workspace.removeNaclFiles(...opDeletes)
      : []
    // Now add the waiting changes
    const updateChanges = (!_.isEmpty(opNaclFiles) && this.workspace)
      ? await this.workspace.setNaclFiles(..._.values(opNaclFiles))
      : []
    return [...removeChanges, ...updateChanges]
  }

  private async runAggregatedSetOperation(): Promise<void> {
    if (this.hasPendingUpdates()) {
      const opDeletes = this.pendingDeletes
      const opNaclFiles = this.pendingSets
      this.pendingDeletes = new Set<string>()
      this.pendingSets = {}
      if (_.isUndefined(this.wsErrors)) {
        await this.update([...opDeletes], opNaclFiles)
        await this.errors()
      } else {
        const changes = await this.update([...opDeletes], opNaclFiles)
        const validation = await this.getValidationErrors(
          [...opDeletes, ...Object.keys(opNaclFiles)], changes
        )
        const errorsWithoutValidation = await this.workspace.errors(false)
        this.wsErrors = Promise.resolve(new errors.Errors({
          merge: errorsWithoutValidation.merge,
          parse: errorsWithoutValidation.parse,
          validation,
        }))
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
      this.runningSetOperation = this.runOperationWithWorkspace(() =>
        this.runAggregatedSetOperation())
    }
    return this.runningSetOperation
  }

  async getNaclFile(filename: string): Promise<nacl.NaclFile | undefined> {
    const naclFile = await this.workspace.getNaclFile(this.workspaceFilename(filename))
    return naclFile && this.editorNaclFile(naclFile)
  }

  async listNaclFiles(): Promise<string[]> {
    return (await this.workspace.listNaclFiles()).map(filename => this.editorFilename(filename))
  }

  async getElements(filename: string): Promise<Element[]> {
    return (
      await this.workspace.getParsedNaclFile(this.workspaceFilename(filename))
      )?.elements || []
  }

  async getSourceMap(filename: string): Promise<parser.SourceMap> {
    return this.editorSourceMap(await this.workspace.getSourceMap(this.workspaceFilename(filename)))
  }

  async getSourceRanges(elemID: ElemID): Promise<parser.SourceRange[]> {
    return (await this.workspace.getSourceRanges(elemID))
      .map(range => this.editorSourceRange(range))
  }

  async transformError(error: SaltoError): Promise<errors.WorkspaceError<SaltoError>> {
    const wsError = await this.workspace.transformError(error)
    return {
      ...wsError,
      sourceFragments: wsError.sourceFragments.map(fragment => ({
        ...fragment,
        sourceRange: this.editorSourceRange(fragment.sourceRange),
      })),
    }
  }

  setNaclFiles(...naclFiles: nacl.NaclFile[]): Promise<void> {
    this.addPendingNaclFiles(naclFiles.map(file => this.workspaceNaclFile(file)))
    return this.triggerAggregatedSetOperation()
  }

  removeNaclFiles(...names: string[]): Promise<void> {
    this.addPendingDeletes(names.map(name => this.workspaceFilename(name)))
    return this.triggerAggregatedSetOperation()
  }

  hasErrors(): Promise<boolean> {
    return this.workspace.hasErrors()
  }

  async getElementReferencedFiles(id: ElemID): Promise<string[]> {
    return (await this.workspace.getElementReferencedFiles(id))
      .map(filename => this.editorFilename(filename))
  }

  async getElementReferencesToFiles(id: ElemID): Promise<string[]> {
    return (await this.workspace.getElementReferencesToFiles(id))
      .map(filename => this.editorFilename(filename))
  }

  async getElementNaclFiles(id: ElemID): Promise<string[]> {
    return (await this.workspace.getElementNaclFiles(id))
      .map(filename => this.editorFilename(filename))
  }

  async validateFiles(filenames: string[]): Promise<errors.Errors> {
    if (_.isUndefined(this.wsErrors)) {
      return this.errors()
    }
    const elements = (await this.elementsInFiles(filenames)).map(e => e.getFullName())
    const currentErrors = await this.errors()
    const validation = currentErrors.validation
      .filter(e => !elements.includes(e.elemID.createTopLevelParentID().parent.getFullName()))
      .concat(validateElements(
        (await Promise.all(elements.map(e => this.workspace.getElement(ElemID.fromFullName(e)))))
          .filter(values.isDefined),
        await this.workspace.elements(),
      ))
    this.wsErrors = Promise.resolve(new errors.Errors({
      ...currentErrors,
      validation,
    }))
    return this.wsErrors
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
}
