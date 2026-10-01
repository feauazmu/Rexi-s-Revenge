import { palette } from '../palette';
import { defineSprite } from '../sprite';

/**
 * Rexi's Dialogue Box portrait (40×40), after reference/rexi-character-sheet.png: light-brown
 * flat-top, confident grin, sleeveless judge's robe over a white tank top, and one arm flexed
 * to show the sleeve tattoo (drawn as his left arm, after the old sheet; the sleeve belongs on
 * his right arm per CONTEXT.md, and the art pass redraws this portrait) covering the upper arm from the shoulder to the elbow: a
 * lion head by the shoulder whose mane flows into a columned courthouse by the elbow, the gaps
 * filled with ink shading so it reads as one piece.
 */
export const REXI_PORTRAIT = defineSprite(
  {
    p: '#5c4a8c', // backdrop
    k: palette.outline,
    H: '#b5835a', // hair
    L: '#d8a878', // hair highlight
    h: '#8a5a34', // hair shadow, brows
    S: '#e8b48a', // skin
    l: '#f6cfa8', // skin highlight
    s: '#c48a64', // skin shadow
    t: palette.white, // teeth
    w: '#f2f2f2', // tank top
    g: '#c8c8d8', // tank top shading
    r: '#23202e', // robe
    R: '#3a3448', // robe folds
    A: '#c08038', // sleeve tattoo: lion mane
    I: '#7a4a36', // sleeve tattoo: ink shading over skin
    T: '#4a2a1a', // sleeve tattoo: linework
  },
  [
    'pppppppppppppppppppppppppppppppppppppppp',
    'pppppppppppkkkkkkkkkkppppppppppppppppppp',
    'ppppppppppkHLLHHLLHHHkpppppppppppppppppp',
    'pppppppppkHHLLHHHLLHHHkpppppppppkkkkkkpp',
    'pppppppppkhHHHHHHHHHHhkppppppppklSlSlSkp',
    'pppppppppkhhHhhHHhhHhhkpppppppkSSSSSSSkp',
    'pppppppppkhSSSllllSSShkpppppppklSSlSSSkp',
    'pppppppppkShhhSSSShhhSkpppppppkSSsSSsSkp',
    'ppppppppkSSSwkSSSSkwSSSkppppppkssssssSkp',
    'ppppppppkSSSSSSllSSSSSSkppppppkSSSSSSskp',
    'ppppppppksSSSSSlsSSSSSskpppppppkssssskpp',
    'ppppppppkssSSSssssSSSsskpppppppkSSSSskpp',
    'pppppppppksSSSSSSSSSSskppppppppklSSSskpp',
    'pppppppppksSkSSSSSSkSskpppppppklSSSSskpp',
    'pppppppppksSSkttttkSSskpppppppklSSSSskpp',
    'pppppppppkssSSkkkkSSsskpppppppklSSSSsskp',
    'pppppppppkssSSSSSSSSsskpppppppkSSSSSsskp',
    'pppppppppksssSSSSSSssskpppppppkSSSSSsskp',
    'pppppppppkskSSSSSSSSkskppppkkkkSSSSSsskp',
    'pppppppppksskkkkkkkssskpppkAIAAIAAIAIIkp',
    'ppppppkkSSssssssssssssSSSkSIAAAAIAITIIkp',
    'ppppkkSSSSsSSSSSSSSSSsSSSSkAASSAAATSTIkp',
    'ppkrrkrSSSSSSSllllSSSSSSrkrATSSTATSSSTkp',
    'pkrrRrrSSSSSSSSSSSSSSSSSrrkASSSSATTTTTkp',
    'SSskrrRrrrwwSSSSSSSwwrrrrrkASTTSATSTSTkp',
    'SSskrrRrrrwwwSSSSSwwwrrrrrkAASSAATSTSTkp',
    'SSskrRrrRrwwwwwwwwwwwrrrrrkIAAAAITSTSTkp',
    'SSskrRrrRrwwwwwgwwwwwrrrrrkIIAAIITSTSTkp',
    'SSskrRrrRrwwwwwgwwwwwrrrrrkIIIAAATTTTTkp',
    'sSskrRrrRrgggwwgwwgggrrrrrrkIIIIIIIIIIkp',
    'sSskrRrrRrwwwwwwwwwwwrrrrrrrkkkkkkkkkkpp',
    'SSskrRrrRrwwgwwwwwgwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'sSskrRrrRrwwwgwwwgwwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'sSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'sSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
  ],
);
