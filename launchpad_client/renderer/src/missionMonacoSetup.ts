import { loader } from '@monaco-editor/react'
import { shikiToMonaco } from '@shikijs/monaco'
import { createHighlighter } from 'shiki'
import type { Monaco } from '@monaco-editor/react'

import extGrammar from '../../../launchpad_server/thirdparty/syntax/ext.min.json'
import sqfGrammar from '../../../launchpad_server/thirdparty/syntax/sqf.min.json'

const MISSION_EDITOR_THEME = 'dark-plus' as const

let setupPromise: Promise<void> | null = null

export const missionMonacoTheme = MISSION_EDITOR_THEME

export function missionResourceLanguage(relPath: string): string {
  const lower = relPath.toLowerCase()
  const dot = lower.lastIndexOf('.')
  if (dot < 0) return 'plaintext'
  const ext = lower.slice(dot)
  if (ext === '.sqf') return 'sqf'
  if (ext === '.ext') return 'ext'
  if (ext === '.cpp' || ext === '.hpp' || ext === '.h' || ext === '.cc' || ext === '.cxx' || ext === '.c') return 'cpp'
  return 'plaintext'
}

export function ensureMissionMonacoShiki(): Promise<void> {
  if (!setupPromise) {
    setupPromise = (async () => {
      const monaco = (await loader.init()) as Monaco
      const highlighter = await createHighlighter({
        themes: [MISSION_EDITOR_THEME],
        langs: [
          'cpp',
          'plaintext',
          // Shiki loads embedded TextMate grammars when `id` is set; @shikijs/types omits this field.
          { ...extGrammar, id: 'ext' } as never,
          { ...sqfGrammar, id: 'sqf' } as never,
        ],
      })

      monaco.languages.register({ id: 'ext' })
      monaco.languages.register({ id: 'arma-ext' })
      monaco.languages.register({ id: 'sqf' })

      shikiToMonaco(highlighter, monaco)
    })()
  }
  return setupPromise
}
