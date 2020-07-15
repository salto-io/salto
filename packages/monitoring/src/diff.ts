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
import * as Diff from 'diff'
import * as Diff2Html from 'diff2html'
import * as html2pdf from 'html-pdf'
import { parser } from '@salto-io/workspace'
import {
  Element,
  isObjectType,
  isInstanceElement,
  isField,
  ObjectType,
  isPrimitiveType,
  PrimitiveType,
  Field,
  Value, Change, DetailedChange, isElement,
} from '@salto-io/adapter-api'
import wu from 'wu'
import _ from 'lodash'

export type UnifiedDiff = string
const { dumpElements } = parser

type ChangeData = { before?: Element; after?: Element }

export const PDF = 'PDF'
export const HTML = 'HTML'
type DiffViewFileType = 'PDF' | 'HTML'
type DiffViewOptions = {
  fileType: DiffViewFileType
  title: string
  subtitle: string
}

const diffContextSize = 25

const orderByAfterElement = (before: Element, after: Element): Element => {
  const orderMapBy = (
    targetMap: Record<string, Value | Element | Field>,
    refMap: Record<string, Value | Element | Field>
  ): Record<string, Value | Element | Field> => _(targetMap)
    .toPairs()
    .sortBy(([key, _v]) => _.keys(refMap).indexOf(key))
    .fromPairs()
    .value()

  if (isObjectType(before) && isObjectType(after)) {
    return new ObjectType({
      elemID: before.elemID,
      fields: orderMapBy(before.fields, after.fields),
      annotationTypes: orderMapBy(before.annotationTypes, after.annotationTypes),
      annotations: orderMapBy(before.annotations, after.annotations),
    })
  }

  if (isPrimitiveType(before) && isPrimitiveType(after)) {
    return new PrimitiveType({
      elemID: before.elemID,
      primitive: before.primitive,
      annotationTypes: orderMapBy(before.annotationTypes, after.annotationTypes),
      annotations: orderMapBy(before.annotations, after.annotations),
    })
  }

  if (isField(before) && isField(after)) {
    return new Field(
      before.parent,
      before.name,
      before.type,
      orderMapBy(before.annotations, after.annotations)
    )
  }

  if (isInstanceElement(before) && isInstanceElement(after)) {
    const res = before.clone()
    res.value = orderMapBy(before.value, after.value)
    return res
  }

  return before
}

const getElementName = (change: DetailedChange): string => change.id.getFullName()

const actionToHTML = (klass: string, text: string): string =>
  `<span class="d2h-tag d2h-${klass} d2h-${klass}-tag">${text.toUpperCase()}</span></span>`

const getActionHTMLElement = (
  change: Change,
): string => {
  switch (change.action) {
    case 'modify':
      return actionToHTML('changed', 'modify')
    case 'remove':
      return actionToHTML('deleted', 'remove')
    default:
      return actionToHTML('added', 'add')
  }
}

const transformDiff = (change: Change, diff: UnifiedDiff): UnifiedDiff => {
  const actionElement = getActionHTMLElement(change)
  return Diff2Html.html(diff, { drawFileList: false })
    .replace(actionToHTML('changed', 'changed'), actionElement)
}

const renderOptionsHTML = (options?: DiffViewOptions): string => {
  const html: string[] = []
  if (options?.title) {
    html.push(`<h1 class="text">${options.title}</h1>`)
  }
  if (options?.subtitle) {
    html.push(`<p class="text">${options.subtitle}</p>`)
  }
  return html.join('\n')
}

const renderHTMLDiffView = async (
  diff: UnifiedDiff, options?: DiffViewOptions): Promise<Buffer> => {
  const html = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
          .d2h-wrapper{text-align:left}
          .d2h-file-header{height:35px;padding:5px 10px;border-bottom:1px solid #d8d8d8;background-color:#f7f7f7}
          .d2h-file-stats{display:flex;margin-left:auto;font-size:14px}
          .d2h-lines-added{text-align:right;border:1px solid #b4e2b4;border-radius:5px 0 0 5px;color:#399839;padding:2px;vertical-align:middle}
          .d2h-lines-deleted{text-align:left;border:1px solid #e9aeae;border-radius:0 5px 5px 0;color:#c33;padding:2px;vertical-align:middle;margin-left:1px}
          .d2h-file-name-wrapper{display:flex;align-items:center;width:100%;font-family:"Source Sans Pro","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:15px}
          .d2h-file-name{white-space:nowrap;text-overflow:ellipsis;overflow-x:hidden}
          .d2h-file-wrapper{border:1px solid #ddd;border-radius:3px;margin-bottom:1em}
          .d2h-diff-table{width:100%;border-collapse:collapse;font-family:Menlo,Consolas,monospace;font-size:13px}
          .d2h-files-diff{display:block;width:100%;height:100%}.d2h-file-diff{overflow-y:hidden}
          .d2h-file-side-diff{display:inline-block;overflow-x:scroll;overflow-y:hidden;width:50%;margin-right:-4px;margin-bottom:-8px}
          .d2h-code-line{display:inline-block;white-space:nowrap;padding:0 8em}
          .d2h-code-side-line{display:inline-block;white-space:nowrap;padding:0 4.5em}
          .d2h-code-line del,.d2h-code-side-line del{display:inline-block;margin-top:-1px;text-decoration:none;background-color:#ffb6ba;border-radius:.2em}
          .d2h-code-line ins,.d2h-code-side-line ins{display:inline-block;margin-top:-1px;text-decoration:none;background-color:#97f295;border-radius:.2em;text-align:left}
          .d2h-code-line-prefix{display:inline;background:0 0;padding:0;word-wrap:normal;white-space:pre}
          .d2h-code-line-ctn{display:inline;background:0 0;padding:0;word-wrap:normal;white-space:pre}
          .line-num1{box-sizing:border-box;float:left;width:3.5em;overflow:hidden;text-overflow:ellipsis;padding:0 .5em 0 .5em}
          .line-num2{box-sizing:border-box;float:right;width:3.5em;overflow:hidden;text-overflow:ellipsis;padding:0 .5em 0 .5em}
          .d2h-code-linenumber{box-sizing:border-box;width:7.5em;position:absolute;display:inline-block;background-color:#fff;color:rgba(0,0,0,.3);text-align:right;border:solid #eee;border-width:0 1px 0 1px;cursor:pointer}
          .d2h-code-linenumber:after{content:''}
          .d2h-code-side-linenumber{position:absolute;display:inline-block;box-sizing:border-box;width:4em;background-color:#fff;color:rgba(0,0,0,.3);text-align:right;border:solid #eee;border-width:0 1px 0 1px;cursor:pointer;overflow:hidden;text-overflow:ellipsis}
          .d2h-code-side-linenumber:after{content:''}.d2h-code-side-emptyplaceholder,.d2h-emptyplaceholder{background-color:#f1f1f1;border-color:#e1e1e1}.d2h-del{background-color:#fee8e9;border-color:#e9aeae}
          .d2h-ins{background-color:#dfd;border-color:#b4e2b4}.d2h-info{background-color:#f8fafd;color:rgba(0,0,0,.3);border-color:#d5e4f2}
          .d2h-file-diff .d2h-del.d2h-change{background-color:#fdf2d0}
          .d2h-file-diff .d2h-ins.d2h-change{background-color:#ded}
          .d2h-file-list-wrapper{margin-bottom:10px}
          .d2h-file-list-wrapper a{text-decoration:none;color:#3572b0}
          .d2h-file-list-wrapper a:visited{color:#3572b0}
          .d2h-file-list-header{text-align:left}
          .d2h-file-list-title{font-weight:700}
          .d2h-file-list-line{display:flex;text-align:left}
          .d2h-file-list{display:block;list-style:none;padding:0;margin:0}
          .d2h-file-list>li{border-bottom:#ddd solid 1px;padding:5px 10px;margin:0}
          .d2h-file-list>li:last-child{border-bottom:none}
          .d2h-file-switch{display:none;font-size:10px;cursor:pointer}
          .d2h-icon{vertical-align:middle;margin-right:10px;fill:currentColor}
          .d2h-deleted{color:#c33}
          .d2h-added{color:#399839}
          .d2h-changed{color:#d0b44c}
          .d2h-moved{color:#3572b0}
          .d2h-tag{display:flex;font-size:10px;margin-left:5px;padding:0 2px;background-color:#fff}
          .d2h-deleted-tag{border:#c33 1px solid}
          .d2h-added-tag{border:#399839 1px solid}
          .d2h-changed-tag{border:#d0b44c 1px solid}
          .d2h-moved-tag{border:#3572b0 1px solid}
          .selecting-left .d2h-code-line,.selecting-left .d2h-code-line *,.selecting-left .d2h-code-side-line,.selecting-left .d2h-code-side-line *,.selecting-right td.d2h-code-linenumber,.selecting-right td.d2h-code-linenumber *,.selecting-right td.d2h-code-side-linenumber,.selecting-right td.d2h-code-side-linenumber *{-webkit-touch-callout:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}
          .selecting-left .d2h-code-line ::-moz-selection,.selecting-left .d2h-code-line::-moz-selection,.selecting-left .d2h-code-side-line ::-moz-selection,.selecting-left .d2h-code-side-line::-moz-selection,.selecting-right td.d2h-code-linenumber::-moz-selection,.selecting-right td.d2h-code-side-linenumber ::-moz-selection,.selecting-right td.d2h-code-side-linenumber::-moz-selection{background:0 0}
          .selecting-left .d2h-code-line ::selection,.selecting-left .d2h-code-line::selection,.selecting-left .d2h-code-side-line ::selection,.selecting-left .d2h-code-side-line::selection,.selecting-right td.d2h-code-linenumber::selection,.selecting-right td.d2h-code-side-linenumber ::selection,.selecting-right td.d2h-code-side-linenumber::selection{background:0 0}
          body {background-color: white; font-family: Arial, Helvetica, sans-serif}
          div#container {width: 90%;margin: auto;padding-top: 20px;}
          tbody.d2h-diff-tbody {background-color: #fff;}
          .text {color: black;}
          p.text {font-size: 1em;}
          .d2h-wrapper {padding-top: 7px;}
          .d2h-file-wrapper {border-radius: 5px;margin-bottom: 2em;color: #1e1e1e;}
          .d2h-file-header {height: auto;padding: 0.5em;}
          </style>
          <title>Salto Preview</title>
      </head>
      <body>
        <div id=container>
          ${renderOptionsHTML(options)}
          ${diff}
        </div>
      </body>
      </html>`

  return Buffer.from(html)
}

const renderPDFDiffView = async (diff: UnifiedDiff, options?: DiffViewOptions): Promise<Buffer> => {
  const html = await renderHTMLDiffView(diff, options)
  return new Promise((resolve, reject) => {
    html2pdf.create(html.toString(), { format: 'A4', orientation: 'landscape' })
      .toBuffer((err: Error, result: Buffer) => {
        if (err) return reject(new Error('Failed to create PDF file'))
        return resolve(result)
      })
  })
}

export const renderDiffView = async (
  diff: UnifiedDiff,
  options: DiffViewOptions): Promise<Buffer> => {
  switch (options.fileType) {
    case PDF:
      return renderPDFDiffView(diff, options)
    case HTML:
      return renderHTMLDiffView(diff, options)
    default:
      throw new Error(`File type '${options.fileType}' is not supported`)
  }
}

export const createChangeDiff = async (
  change: DetailedChange,
): Promise<UnifiedDiff> => {
  const changedElementName = getElementName(change)
  const data = change.data as ChangeData
  const dump = async (element: Element | string | undefined): Promise<string> => {
    if (isElement(element)) {
      return dumpElements([element])
    }
    if (_.isString(element)) {
      return element
    }
    return ''
  }

  data.before = (data.before && data.after)
    ? orderByAfterElement(data.before, data.after)
    : data.before
  return Diff.createPatch(
    changedElementName,
    await dump(data.before),
    await dump(data.after),
    undefined,
    undefined,
    { context: diffContextSize }
  )
}

export const createPlanDiff = async (
  changes: DetailedChange[]
): Promise<UnifiedDiff> => {
  const diffCreators = await Promise.all(wu(changes)
    .map(change => createChangeDiff(change)))

  return changes
    .map((change: Change, i: number) => transformDiff(change, diffCreators[i]))
    .join('\n')
}
