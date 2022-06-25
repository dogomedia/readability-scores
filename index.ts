'use strict'

import {unified} from 'unified'
import reTextEnglish from 'retext-english'
import {visit} from 'unist-util-visit'
import {toString} from 'nlcst-to-string'
import {normalize} from 'nlcst-normalize'
import {syllable} from 'syllable'
import {spache} from 'spache'
import {daleChall} from 'dale-chall'
import {daleChallFormula, daleChallGradeLevel} from 'dale-chall-formula'
import {automatedReadability} from 'automated-readability'
import {colemanLiau} from 'coleman-liau'
// Var flesch = require('flesch')
import {fleschKincaid} from 'flesch-kincaid'
import {smogFormula} from 'smog-formula'
import {gunningFog} from 'gunning-fog'
import {spacheFormula} from 'spache-formula'
import {stemmer} from 'stemmer'
import {Root} from 'nlcst'

const min = Math.min
const round = Math.round

let spacheStems
let daleChallStems

export interface ReadabilityScoreResult {
  letterCount: number
  syllableCount: number
  wordCount: number
  sentenceCount: number
  polysyllabicWordCount?: number
  polysyllabicWords?: string[]
  spacheUniqueUnfamiliarWordCount?: number
  spacheUniqueUnfamiliarWords?: string[]
  spache?: number
  daleChallDifficultWordCount?: number
  daleChallDifficultWords?: string[]
  daleChall?: number
  ari?: number
  colemanLiau?: number
  fleschKincaid?: number
  smog?: number
  gunningFog?: number
}

function populateSpacheStems() {
  if (spacheStems === undefined) {
    spacheStems = {}
    for (const w of spache) {
      if (!w.includes("'")) {
        const s = stemmer(w)
        spacheStems[s] = true
      }
    }
  }
}

function populateDaleChallStems() {
  if (daleChallStems === undefined) {
    daleChallStems = {}
    for (const w of daleChall) {
      if (!w.includes("'")) {
        const s = stemmer(w)
        daleChallStems[s] = true
      }
    }
  }
}

function roundTo2Decimals(n: number) {
  return round((n + Number.EPSILON) * 100) / 100
}

const processor = unified().use(reTextEnglish)

/*
Default Config:

--set to true if you want the results to include all unfamiliar/difficult/polysyllabic words
difficultWords = false

--set to true if you want any words where the first letter is a capital to be treated as a recognized proper noun
--for example, if the first word of the sentence is capitalized, it will be treated as familiar regardless of its difficulty
capsAsNames = false

--use only one of these to exclude all others:
onlySpache = false
onlyDaleChall = false
onlyARI = false
onlyColemanLiau = false
onlyFleschKincaid = false
onlySMOG = false
onlyGunningFog = false

--or any of these to exclude one at a time:
--Spache is excluded by default as Dale-Chall is better for anything 4th grade or higher.
skipDaleChall = false
skipARI = false
skipColemanLiau = false
skipFleschKincaid = false
skipSMOG = false
skipGunningFog = false
*/

export interface ReadabilityScoresConfig {
  difficultWords?: boolean
  capsAsNames?: boolean
  onlySpache?: boolean
  onlyDaleChall?: boolean
  onlyARI?: boolean
  onlyColemanLiau?: boolean
  onlyFleschKincaid?: boolean
  onlySMOG?: boolean
  onlyGunningFog?: boolean
  skipDaleChall?: boolean
  skipARI?: boolean
  skipColemanLiau?: boolean
  skipFleschKincaid?: boolean
  skipSMOG?: boolean
  skipGunningFog?: boolean
}

export const defaultConfig: ReadabilityScoresConfig = {
  difficultWords: false,
  capsAsNames: false,
  onlySpache: false,
  onlyDaleChall: false,
  onlyARI: false,
  onlyColemanLiau: false,
  onlyFleschKincaid: false,
  onlySMOG: false,
  onlyGunningFog: false,
  skipDaleChall: false,
  skipARI: false,
  skipColemanLiau: false,
  skipFleschKincaid: false,
  skipSMOG: false,
  skipGunningFog: false
}

export const readabilityScores = (
  value?: any,
  config?: ReadabilityScoresConfig
): ReadabilityScoreResult => {
  const mergedConfig = {...defaultConfig, ...config}

  if (value) {
    const updatedConfig = processConfig(mergedConfig)

    const tree = processor.runSync(processor.parse(value))
    if (updatedConfig.bSpache) {
      populateSpacheStems()
    }

    if (updatedConfig.bDaleChall) {
      populateDaleChallStems()
    }

    return calcScores(tree, updatedConfig)
  }
}

interface InternalConfig {
  bDifficultWords?: boolean
  bCapsAsNames?: boolean
  bSpache?: boolean
  bDaleChall?: boolean
  bARI?: boolean
  bColemanLiau?: boolean
  bFleschKincaid?: boolean
  bSMOG?: boolean
  bGunningFog?: boolean
}

function processConfig(config: ReadabilityScoresConfig): InternalConfig {
  const c: InternalConfig = {}
  let bNotOnly = true
  if (config) {
    bNotOnly = false
    if (config.difficultWords) {
      c.bDifficultWords = true
    }

    if (config.capsAsNames) {
      c.bCapsAsNames = true
    }

    if (config.onlySpache) {
      c.bSpache = true
    } else if (config.onlyDaleChall) {
      c.bDaleChall = true
    } else if (config.onlyARI) {
      c.bARI = true
    } else if (config.onlyColemanLiau) {
      c.bColemanLiau = true
    } else if (config.onlyFleschKincaid) {
      c.bFleschKincaid = true
    } else if (config.onlySMOG) {
      c.bSMOG = true
    } else if (config.onlyGunningFog) {
      c.bGunningFog = true
    } else {
      bNotOnly = true
    }
  }

  if (bNotOnly) {
    c.bDaleChall = !config || !config.skipDaleChall
    c.bARI = !config || !config.skipARI
    c.bColemanLiau = !config || !config.skipColemanLiau
    c.bFleschKincaid = !config || !config.skipFleschKincaid
    c.bSMOG = !config || !config.skipSMOG
    c.bGunningFog = !config || !config.skipGunningFog
    c.bSpache = false
  }

  return c
}

function calcScores(
  tree: Root,
  config: InternalConfig
): ReadabilityScoreResult {
  const spacheUniqueUnfamiliarWords = []
  const daleChallDifficultWords = []
  const polysyllabicWords = []
  let complexPolysyllabicWord = 0
  let polysyllabicWord = 0
  let syllableCount = 0
  let wordCount = 0
  let letters = 0
  let sentenceCount = 0

  visit(tree, 'SentenceNode', sentence)
  visit(tree, 'WordNode', word)

  // Counts are used in calls to scores
  const counts = {
    complexPolysillabicWord: complexPolysyllabicWord, // ComplexPolysillabicWord is intentionally different than complexPolysyllabicWord.
    polysillabicWord: polysyllabicWord,
    unfamiliarWord: spacheUniqueUnfamiliarWords.length,
    difficultWord: daleChallDifficultWords.length,
    syllable: syllableCount,
    sentence: sentenceCount,
    word: wordCount,
    character: letters,
    letter: letters
  }
  // Results are returned to the user
  const results: ReadabilityScoreResult = {
    letterCount: letters,
    syllableCount,
    wordCount,
    sentenceCount,
    polysyllabicWordCount: complexPolysyllabicWord
  }
  if (config.bDifficultWords) {
    results.polysyllabicWords = polysyllabicWords
  }

  if (config.bSpache) {
    results.spacheUniqueUnfamiliarWordCount = spacheUniqueUnfamiliarWords.length
    if (config.bDifficultWords) {
      results.spacheUniqueUnfamiliarWords = spacheUniqueUnfamiliarWords
    }

    const spacheCounts = {
      sentence: counts.sentence,
      word: counts.word,
      unfamiliarWord: counts.unfamiliarWord
    }

    results.spache = roundTo2Decimals(spacheFormula(spacheCounts))
  }

  if (config.bDaleChall) {
    results.daleChallDifficultWordCount = daleChallDifficultWords.length
    if (config.bDifficultWords) {
      results.daleChallDifficultWords = daleChallDifficultWords
    }

    results.daleChall = min(
      17,
      daleChallGradeLevel(daleChallFormula(counts))[1]
    )
  }

  if (config.bARI) {
    results.ari = roundTo2Decimals(automatedReadability(counts))
  }

  if (config.bColemanLiau) {
    results.colemanLiau = roundTo2Decimals(colemanLiau(counts))
  }

  if (config.bFleschKincaid) {
    results.fleschKincaid = roundTo2Decimals(fleschKincaid(counts))
  }

  if (config.bSMOG) {
    const smogCounts = {
      sentence: counts.sentence,
      polysillabicWord: counts.polysillabicWord
    }
    results.smog = roundTo2Decimals(smogFormula(smogCounts))
  }

  if (config.bGunningFog) {
    results.gunningFog = roundTo2Decimals(gunningFog(counts))
  }

  return results

  function sentence() {
    sentenceCount++
  }

  function word(node) {
    const value = toString(node)
    const syllables = syllable(value)
    const normalized = normalize(node, {allowApostrophes: true})
    const reCap = /^[A-Z]/
    const bInitCapAsName = config.bCapsAsNames && reCap.exec(value)

    wordCount++
    syllableCount += syllables
    letters += value.length

    // Count complex words for smog and gunning-fog based on whether they have 3+ syllables.
    if (syllables >= 3) {
      polysyllabicWord++

      if (!bInitCapAsName) {
        complexPolysyllabicWord++
        if (config.bDifficultWords) {
          polysyllabicWords.push(value)
        }
      }
    }

    if (config.bSpache) {
      // Find unique unfamiliar words for Spache.

      // Spache suffixes per https://readabilityformulas.com/spache-readability-formula.php
      const reSuffixes = /(s|ing|ed)$/

      const reNumber = /^[1-9]\d{0,2}(,?\d{3})*$/

      if (
        bInitCapAsName ||
        spache.includes(normalized) ||
        reNumber.test(normalized) ||
        (reSuffixes.test(normalized) && spacheStems[stemmer(normalized)])
      ) {
        // Spache familiar word
      } else if (!spacheUniqueUnfamiliarWords.includes(value)) {
        spacheUniqueUnfamiliarWords.push(value)
      }
    }

    if (config.bDaleChall) {
      // Find unique difficult words for Dale-Chall.
      // TODO: any hyphenated words where both parts are familiar would also be familiar, like battle-field.

      const reNumber = /^[1-9]\d{0,2}(,?\d{3})*$/

      // This does a much better job than https://readabilityformulas.com/dalechallformula/dale-chall-formula.php
      // Tested on the Gettysburg address, this found plenty more that should be unfamiliar, without a bunch of other false positives for endings like "ing" and "ly"

      if (
        bInitCapAsName ||
        daleChall.includes(normalized) ||
        reNumber.test(normalized) ||
        testDaleChallSuffixes(normalized)
      ) {
        // Dale Chall familiar word
      } else {
        daleChallDifficultWords.push(value)
      }
    }
  }

  function testDaleChallSuffixes(normalized) {
    // Dale-Chall suffixes per http://www.lefthandlogic.com/htmdocs/tools/okapi/okapimanual/dale_challWorksheet.PDF
    //	 ['s', 'ies', 'ing', 'n', 'ed', 'ied', 'ly', 'er', 'ier', 'est', 'iest']
    // As "lively" is in the list, "livelier" and "liveliest" should pass due to "ier" and "iest" being valid suffixes.
    // But although "prick" is in the list, "prickly" is not. "Prickly" would be a valid base+suffix, but "pricklier" and "prickliest" should not be valid.
    const reSuffixes = /(s|ing|n|ed|ly|er|est)$/
    const reRemovableSuffixes = /(n|ly|(l?i)?er|(l?i)?est)$/
    const reComboRemoveableSuffixes = /(lier|liest)$/

    if (
      reSuffixes.test(normalized) &&
      daleChallStems[stemmer(normalized.replace(reRemovableSuffixes, ''))]
    ) {
      const normLY = normalized.replace(reComboRemoveableSuffixes, 'ly')
      return normalized === normLY || daleChall.includes(normLY)
      // If normalized === normLY, then normalized does not end in lier/liest, so is already a valid base+suffix
      // If normalized is one of "livelier" or "liveliest", normLY would be "lively", which is in daleChall so returns true
      // if normalized is one of "pricklier" or "prickliest", normLY would be "prickly", which is NOT in daleChall so returns false
    }

    return false
  }
}
