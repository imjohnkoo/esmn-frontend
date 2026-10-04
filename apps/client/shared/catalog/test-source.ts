/**
 * 테스트 전용 — 앱 소스를 «글자» 가 아니라 토큰으로 읽는다(앱 코드에서 import 하지 않는다).
 *
 * 정규식으로 주석을 걷으면 문자열 속 `/*`(예: `'/verify/**'`)를 주석 시작으로 읽어 파일 절반을 놓친다.
 * 그래서 TypeScript 스캐너로 주석을 건너뛰고 토큰(문자열 · 템플릿 조각 · 숫자 · 이름 · 기호)을 순서대로 모은다.
 * `.vue` 는 SFC 파서로 `<script>` · `<script setup>` · `<template>` · `<style>` 을 나눈다.
 */
import { readFileSync } from 'node:fs'
import { parse as parseSfc } from '@vue/compiler-sfc'
import ts from 'typescript'

export type TokenKind = 'string' | 'number' | 'ident' | 'punct'

export interface Token {
  kind: TokenKind
  /** 원문 글자(`'4,900'` · `4900` · `lowestWon` · `+=`) */
  text: string
  /** 문자열 · 템플릿 조각이면 내용, 숫자면 값 글자 */
  value: string
  /** 앞에 줄바꿈이 있었나 — 문장 경계를 가늠한다 */
  newline: boolean
}

const STRING_KINDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
])

export function scanScript(code: string): Token[] {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ true)
  scanner.setText(code)
  const out: Token[] = []
  /** 여는 괄호 종류 — 'b' = 코드 블록 · 객체 `{`, 't' = 템플릿 문자열의 `${` */
  const braces: ('b' | 't')[] = []
  let token = scanner.scan()
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.OpenBraceToken) braces.push('b')
    else if (token === ts.SyntaxKind.CloseBraceToken && braces.pop() === 't') {
      // `${…}` 가 닫혔다 — 템플릿 문자열의 나머지를 읽는다(`${a}원` 의 «원»)
      token = scanner.reScanTemplateToken(false)
    }
    if (token === ts.SyntaxKind.TemplateHead || token === ts.SyntaxKind.TemplateMiddle)
      braces.push('t')
    // 값이 올 자리의 `/` 는 정규식이다 — 정규식 안의 따옴표를 문자열 시작으로 읽지 않게
    const prev = out[out.length - 1]?.text ?? ''
    if (
      (token === ts.SyntaxKind.SlashToken || token === ts.SyntaxKind.SlashEqualsToken) &&
      ['', '(', ',', '=', ':', '[', '!', '&&', '||', '?', '{', '}', ';', 'return', '=>'].includes(
        prev,
      )
    )
      token = scanner.reScanSlashToken()
    const text = scanner.getTokenText()
    const newline = scanner.hasPrecedingLineBreak()
    if (STRING_KINDS.has(token))
      out.push({ kind: 'string', text, value: scanner.getTokenValue(), newline })
    else if (token === ts.SyntaxKind.NumericLiteral)
      out.push({ kind: 'number', text, value: scanner.getTokenValue(), newline })
    else if (
      token === ts.SyntaxKind.Identifier ||
      (token >= ts.SyntaxKind.FirstKeyword && token <= ts.SyntaxKind.LastKeyword)
    )
      out.push({ kind: 'ident', text, value: text, newline })
    else if (token !== ts.SyntaxKind.RegularExpressionLiteral)
      out.push({ kind: 'punct', text, value: text, newline })
    token = scanner.scan()
  }
  return out
}

export interface SourceParts {
  script: Token[]
  /** `.vue` 의 `<template>` 원문(HTML 주석 제거) — 그 밖이면 '' */
  template: string
  /** `.vue` 의 `<style>` 원문 · `.css` 파일 — 그 밖이면 '' */
  style: string
}

/** 파일 내용을 나눠 읽는다 — `readSource` 가 파일에서, 테스트 대조군이 글자에서 같은 길을 탄다 */
export function parseSource(file: string, src: string): SourceParts {
  if (file.endsWith('.css')) return { script: [], template: '', style: src }
  if (!file.endsWith('.vue')) return { script: scanScript(src), template: '', style: '' }
  const { descriptor } = parseSfc(src, { filename: file })
  const code = [descriptor.script?.content ?? '', descriptor.scriptSetup?.content ?? ''].join('\n')
  const template = (descriptor.template?.content ?? '').replace(/<!--[\s\S]*?-->/g, '')
  const style = descriptor.styles.map((s) => s.content).join('\n')
  return { script: scanScript(code), template, style }
}

export function readSource(file: string): SourceParts {
  return parseSource(file, readFileSync(file, 'utf8'))
}

export interface TemplateAttr {
  /** 원문 이름 — `v-if` · `v-bind` · `:naver-url` · `name` */
  name: string
  /** 식 · 값 원문 — 값 없는 속성이면 null */
  value: string | null
}

interface TemplateNode {
  tag?: string
  props?: {
    name: string
    rawName?: string
    exp?: { content: string }
    value?: { content: string }
  }[]
  children?: TemplateNode[]
}

/**
 * `.vue` 템플릿에서 태그가 `tag` 인 요소마다 속성 목록(적힌 순서)을 낸다 — 결선 테스트가 «이 속성뿐» 을 확인한다.
 * 정규식으로 태그를 훑으면 뒤에 덧붙인 속성(`v-bind="obj"` 를 덮는 `:price=…`)을 놓친다.
 */
export function elementAttrs(file: string, tag: string): TemplateAttr[][] {
  const { descriptor } = parseSfc(readFileSync(file, 'utf8'), { filename: file })
  const out: TemplateAttr[][] = []
  const walk = (n: TemplateNode) => {
    if (n.tag === tag)
      out.push(
        (n.props ?? []).map((p) => ({
          name: p.rawName ?? p.name,
          value: p.exp?.content ?? p.value?.content ?? null,
        })),
      )
    n.children?.forEach(walk)
  }
  const ast = descriptor.template?.ast as TemplateNode | undefined
  if (ast) walk(ast)
  return out
}

/** 토큰 가운데 문자열 · 템플릿 조각의 내용만 */
export const stringsOf = (tokens: Token[]) =>
  tokens.filter((t) => t.kind === 'string').map((t) => t.value)
