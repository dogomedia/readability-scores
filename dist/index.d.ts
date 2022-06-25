export interface ReadabilityScoreResult {
    letterCount: number;
    syllableCount: number;
    wordCount: number;
    sentenceCount: number;
    polysyllabicWordCount?: number;
    polysyllabicWords?: string[];
    spacheUniqueUnfamiliarWordCount?: number;
    spacheUniqueUnfamiliarWords?: string[];
    spache?: number;
    daleChallDifficultWordCount?: number;
    daleChallDifficultWords?: string[];
    daleChall?: number;
    ari?: number;
    colemanLiau?: number;
    fleschKincaid?: number;
    smog?: number;
    gunningFog?: number;
}
export interface ReadabilityScoresConfig {
    difficultWords?: boolean;
    capsAsNames?: boolean;
    onlySpache?: boolean;
    onlyDaleChall?: boolean;
    onlyARI?: boolean;
    onlyColemanLiau?: boolean;
    onlyFleschKincaid?: boolean;
    onlySMOG?: boolean;
    onlyGunningFog?: boolean;
    skipDaleChall?: boolean;
    skipARI?: boolean;
    skipColemanLiau?: boolean;
    skipFleschKincaid?: boolean;
    skipSMOG?: boolean;
    skipGunningFog?: boolean;
}
export declare const defaultConfig: ReadabilityScoresConfig;
export declare const readabilityScores: (value?: any, config?: ReadabilityScoresConfig) => ReadabilityScoreResult;
