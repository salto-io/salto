/* eslint-disable */
import _ from 'lodash'
import * as vscode from 'vscode'
import { SaltoWorkspace } from './workspace'
import { getPositionContext } from './context'
/**
 * This file is used in order to quickly create debug functions on the loaded
 * workspace. Just add them to the map below, and to package.json. 
 *
 * Run the commands by pressing shift+command+p and searching for the name
 * added in package.json.
 *
 * This file is not coverd by tests or lints as it should only be used for
 * quick debuging (without it, debuging can be a bit annoying in vscode)
 *
 * TODO - Should we exclude this file from the final build when created?
 */

// type LineType = 'instance_def'|'type_def'|'field_def'|'instance_attr'|'field_attr'|'na'

// const getLineTokens = (line: string): string[] => line.split(' ')

// const getFullLine = (doc: vscode.TextDocument, position: vscode.Position): string => {
//   return doc.lineAt(position).text.substr(0, position.character)
// }

// const getLineType = (context: PositionContext, lineTokens: string[]): LineType => {
//   if (context.type === 'type' && context.part === 'definition') {
//     return 'type_def'
//   }
//   if (context.type === 'type' && context.part === 'body') {
//     return 'field_def'
//   }
//   if (context.type === 'field' && context.part === 'definition') {
//     return 'field_def'
//   }
//   if (context.type === 'field' && context.part === 'body') {
//     return 'field_attr'
//   }
//   if (context.type === 'instance' && context.part === 'definition') {
//     return 'instance_def'
//   }
//   if (context.type === 'instance' && context.part === 'body') {
//     return 'instance_attr'
//   }
//   // If we reached this point we are in global scope, which means that
//   // either we are in one of the following:
//   // - a parital type def line
//   if (lineTokens[0] === 'type') {
//     return 'type_def'
//   } 
//   // - a parital instance def line (or a undefined line not handle right now)
//   if (lineTokens.join('').length > 0) {
//     return 'instance_def'
//   }
//   // - empty line 
//   return 'na'
// }

// const getFieldDefCompletions = (
//   mergedElements: Element[],
//   refType: ObjectType,  
//   tokens: string[]
// ): vscode.CompletionItem[] => {
//   const adapter = refType.elemID.adapter
//   const [fieldType, fieldName] = tokens
//   if (!fieldType) {
//     return getDefinedTypesSuggestions(mergedElements, adapter)
//   }
//   if (fieldType && !fieldName) {
//     const typePrefix = fieldType.split(new RegExp(`${ElemID.NAMESPACE_SEPERATOR}(.*)`))[1]
//     return getDefinedTypesSuggestions(mergedElements, adapter, typePrefix)
//   }
//   return []
// }

// const getTypeDefCompletions = (
//   mergedElements: Element[],
//   tokens: string[]
// ) : vscode.CompletionItem[] => {
//   const [kw, typeName, is, primitive, ...rest] = tokens
//   // If we only have the key word we can help with adapter prefix
//   if (kw && typeName && is !== undefined && rest.length === 0) {
//     return getInheritanceSuggestions(primitive)
//   }
//   if (kw && typeName) {
//     return getAdapterSuggestions(mergedElements, typeName)
//   } 
//   return []
// }

// const getInstanceDefCompletions = (
//   mergedElements: Element[], 
//   tokens: string[]
// ) : vscode.CompletionItem[] => {
//   const [instanceType, instanceName] = tokens
//   if (!instanceName) {
//     const [adapterPrefix, namePrefix] = instanceType.split(
//       new RegExp(`${ElemID.NAMESPACE_SEPERATOR}(.*)`)
//     )
//     return getDefinedTypesSuggestions(mergedElements, adapterPrefix, namePrefix)
//   }
//   return []
// }

// const getNACompletions = (mergedElements: Element[]): vscode.CompletionItem[] => {
//   const typeCompletion = new vscode.CompletionItem('type', 13)
//   const definedTypes = getDefinedTypesSuggestions(mergedElements)
//   return [...definedTypes, typeCompletion]
// }

// const createAttrValueSuggestions = (
//   refType: ObjectType,
//   attrName: string
// ): vscode.CompletionItem[] => {
//   const valueField = refType.fields[attrName]
//   if (!valueField) {
//     return []
//   }
//   if (valueField.getAnnotationsValues()['_restriction'] && 
//       valueField.getAnnotationsValues()['_restriction'].values) {
//     return valueField.getAnnotationsValues()['_restriction'].values.map(
//       (v: any) => new vscode.CompletionItem(v)
//     )
//   }
//   const valueType = valueField.type
//   if (isObjectType(valueType)){
//     return [new vscode.CompletionItem('{}')]
//   }
//   if (isPrimitiveType(valueType) && valueType.primitive === PrimitiveTypes.STRING){
//     return [new vscode.CompletionItem('""')]
//   }
//   if (isPrimitiveType(valueType) && valueType.primitive === PrimitiveTypes.BOOLEAN){
//     return [
//       new vscode.CompletionItem('true'),
//       new vscode.CompletionItem('false')
//     ]
//   }
//   return []
// }

// const getObjectAttrSuggestions = (
//   refType: ObjectType, 
//   tokens: string[],
//   _isList: boolean
// ): vscode.CompletionItem[] => {
//   const [attrName, eq, attrValue] = tokens
//   //If we only have attr name, we complete with field names 
//   if (attrName && eq === undefined) {
//     return _.keys(refType.fields).map(fname => new vscode.CompletionItem(fname))
//   }
//   if (attrName && eq !== undefined) {
//     return [new vscode.CompletionItem('=')]
//   }
//   if (attrValue !== undefined){
//     return createAttrValueSuggestions(refType, attrName)
//   }
//   return []
// }

// const getPathRefType = (refType : Type, pathParts: string[]): Type|undefined => {
//   //This is a little tricky. Since many fields can have _ in them,
//   //and we can't tell of the _ is path seperator or a part of the
//   //the path name. As long as path is not empty we will try to advance
//   //in the recursion in two ways - First we try only the first token.
//   //If it fails, we try to first to tokens (the recursion will take)
//   //care of the next "join"
//   const [curPart, ...restOfParts] = pathParts
//   if (!curPart || curPart.length === 0){
//     return refType
//   }
//   if (!isObjectType(refType)){
//     return undefined
//   }
//   if (refType.fields[curPart] && isObjectType(refType.fields[curPart].type)){
//     return getPathRefType(refType.fields[curPart].type, restOfParts)
//   }
//   // We advance in the recursion by joining the next token to the current one
//   return getPathRefType(
//     refType, 
//     [[curPart, restOfParts[0]].join('_'), ... restOfParts.slice(1)]
//   )
// }

// const getRefType = (ref: ContextReference): Type => {
//   if (isField(ref.element)){
//     return ref.element.type
//   }
//   if (isInstanceElement(ref.element)){
//     return ref.element.type
//   }
//   return ref.element as Type
// }

// const getAttrCompletions = (
//   ref: ContextReference,
//   tokens: string[],
//   isList: boolean
// ): vscode.CompletionItem[] => {
//   const refType = getRefType(ref)
//   const pathRefType = getPathRefType(refType, ref.path.split("_"))
//   if (isObjectType(pathRefType)) {
//     console.log("YAY OBJ")
//     return getObjectAttrSuggestions(pathRefType, tokens, isList)
//   }
//   console.log("BOO NO")
//   return []
// }

// const getAnnoCompletions = (
//   ref: ContextReference,
//   tokens: string[]
// ): vscode.CompletionItem[] => {
//   const refType = getRefType(ref)
//   if (ref.path.length === 0 && tokens.length <= 1) {
//     return _.keys(refType.annotations).map(a => new vscode.CompletionItem(a))
//   }
//   const isList = false
//   return getAttrCompletions(ref, tokens, isList)
// }

// const getLineCompletions = (
//   workspace: SaltoWorkspace,
//   context: PositionContext,
//   tokens: string[],
//   lineType: LineType
// ): vscode.CompletionItem[] => {
//   console.log(lineType)
//   const mergedElements = workspace.mergedElements || []
//   if (lineType === 'type_def') {
//     return getTypeDefCompletions(mergedElements, tokens)
//   }
//   if (lineType === 'instance_def') {
//     return getInstanceDefCompletions(mergedElements, tokens)
//   }
//   if (lineType === 'field_def' && context.ref && context.ref.element) { 
//     return getFieldDefCompletions(mergedElements, context.ref.element as ObjectType, tokens)
//   }
//   if (lineType === 'instance_attr' && context.ref) {
//     const isList = isField(context.ref.element) && context.ref.element.isList
//     return getAttrCompletions(context.ref, tokens, isList)
//   }
//   if (lineType === 'field_attr' && context.ref) {
//     return getAnnoCompletions(context.ref, tokens)
//   }
//   return getNACompletions(mergedElements)
// }

// const provideWorkspaceCompletionItems = (
//     workspace: SaltoWorkspace,
//     doc: vscode.TextDocument, 
//     position: vscode.Position, 
// ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionItem[]> => {
//     const context = getPositionContext(workspace, doc.fileName, {
//       line: position.line + 1,
//       col: position.character
//     })
//     const line = getFullLine(doc, position)
//     const tokens = getLineTokens(line) 
//     const lineType = getLineType(context, tokens)
//     return getLineCompletions(workspace, context, tokens, lineType)
// }

// export const createProvider = (
//   workspace: SaltoWorkspace
// ): vscode.CompletionItemProvider => ({
//   provideCompletionItems : (
//     doc: vscode.TextDocument, 
//     position: vscode.Position
//   ) => {return provideWorkspaceCompletionItems(workspace, doc, position)}
// })

export const debugFunctions: { [key: string] : (workspace: SaltoWorkspace) => void } = {
  'salto.printMergedElementsNames' : (workspace: SaltoWorkspace): void => {
    (workspace.mergedElements || []).forEach(e => console.log(e.elemID.getFullName()))
  },
  'salto.printMergedElementsCount' : (workspace: SaltoWorkspace): void => {
    console.log((workspace.mergedElements || []).length)
  },
  'salto.printErrors' : (workspace: SaltoWorkspace): void => {
    if (workspace.generalErrors.length > 0) {
      console.log("========= General =======")
      console.log(workspace.generalErrors.join("\n"))
    }
    _.keys(workspace.parsedBlueprints).forEach(k => {
      const errors = workspace.parsedBlueprints[k].errors
      if (errors.length > 0) {
        console.log(`======== ${k} =========`)
        console.log(errors.join("\n"))
      }
    })
    console.log("RR")
  },
  'salto.getCursorContext' : (workspace: SaltoWorkspace): void => {
    const editor = vscode.window.activeTextEditor
    if (editor) {
      const position = editor.selection.active
      const ctx = getPositionContext(workspace, editor.document.fileName, {line: position.line + 1, col: position.character})
      console.log("------", ctx)
    }
    else {
      console.log("No active editor :(")
    }
  },
}